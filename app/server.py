"""Utter: local backend (FastAPI).

Run from the project root:
    .venv\\Scripts\\python -m uvicorn app.server:app --port 8000
then open http://localhost:8000

Model, layer, threshold and preprocessing come from outputs/results.json, which the
notebook writes. Nothing is configured a second time here.

How it works:
  - The user teaches a word: a meaning (e.g. "Water") + a few recordings of their own sound.
  - Each recording becomes a sequence of WavLM frames (one layer, unit length).
  - A new recording is compared with every stored recording by dynamic time warping (DTW).
    Distance to a word = its closest recording.
  - If the best word is not ahead of the second by at least the threshold, the app does
    not guess ("Not sure").
  - A confirmed guess is added as another recording, so the app keeps improving.

Real voices mode: the same pipeline, taught from real TORGO recordings of one person with
dysarthria and tested live on recordings of that person it has never heard
(needs data/sim, built by experiments/build_demo_pack.py).
"""
import base64
import io
import json
import os
import random
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from numba import njit
from transformers import AutoFeatureExtractor, AutoModel, WhisperForConditionalGeneration, WhisperProcessor

# ---------------- Settings ----------------
ROOT = Path(__file__).resolve().parent.parent
RESULTS_PATH = ROOT / "outputs" / "results.json"
EXAMPLES_DIR = ROOT / "outputs" / "examples"
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATE_DIR = Path(os.environ.get("UTTER_STATE_DIR", ROOT / "data" / "app_state"))  # taught words (not in git)
SIM_DIR = ROOT / "data" / "sim"                              # Real voices pack (not in git)
USE_WHISPER = os.environ.get("UTTER_WHISPER", "1") != "0"   # 0 = skip "what a regular assistant hears"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"     # also runs on CPU only
MIN_WORDS = 2               # words needed before recognition makes sense
SOFTMAX_TEMP = 0.05         # only for the displayed "% match" (relative similarity, not a calibrated probability)
MAX_SECONDS = 6
SIM_MAX_TESTS = 30          # Real voices: unheard recordings per run
ALIGN_MAX = 120             # largest side of the alignment picture sent to the browser
SIM_COLORS = [("#4C7DFF", "#C9D8FF"), ("#FF9E5E", "#FFDCC2"), ("#8FD9B0", "#D5F2E2"), ("#C9A4FF", "#EBDDFF"),
              ("#F8A4D2", "#FFE0F1"), ("#FFC93C", "#FBEBB0"), ("#8FD3FF", "#D9F0FF"), ("#F4583E", "#FFC3B5")]
# -------------------------------------------

if not RESULTS_PATH.exists():
    raise SystemExit(f"Missing {RESULTS_PATH}. Run the notebook notebooks/utter.ipynb first.")
RESULTS = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
SR = RESULTS["sr"]
TRIM_DB = RESULTS["trim_db"]
LAYER = RESULTS["best_layer"]
THRESHOLD = RESULTS["threshold"]
TAKES = RESULTS.get("app_takes", 3)
SIM_WORDS = RESULTS.get("vocab_size", 8)     # Real voices: same vocabulary size as the notebook
SIM_TAKES = RESULTS.get("ref_shot", 2)       # Real voices: same number of own recordings as the notebook headline

print(f"[utter] {RESULTS['emb_model']} layer {LAYER}, threshold {THRESHOLD:.4f}, device {DEVICE}")
fe = AutoFeatureExtractor.from_pretrained(RESULTS["emb_model"])
emb_model = AutoModel.from_pretrained(RESULTS["emb_model"]).to(DEVICE).eval()
EMB_PARAMS = sum(p.numel() for p in emb_model.parameters())
asr = None
if USE_WHISPER:
    asr = (WhisperProcessor.from_pretrained(RESULTS["asr_model"]),
           WhisperForConditionalGeneration.from_pretrained(RESULTS["asr_model"]).to(DEVICE).eval())
EMB_LOCK = threading.Lock()                   # one recording at a time through WavLM
# On a GPU, WavLM and Whisper share its small memory, so they take turns. On a CPU there is nothing
# to protect, and recognition must never wait for a slow Whisper transcript.
ASR_LOCK = EMB_LOCK if DEVICE == "cuda" else threading.Lock()
whisper_pool = ThreadPoolExecutor(max_workers=1)
IDLE_SECONDS = 2 if DEVICE == "cuda" else 12  # background transcripts wait until nobody has used the app this long
BUSY = {"t": time.time()}                     # when a recording last went through the model


# ---- Same preprocessing and distance as the notebook ----
def to_16k_trimmed(wav, sr):
    wav = np.asarray(wav, dtype=np.float32)
    if wav.ndim > 1:
        wav = wav.mean(1)
    if sr != SR:
        wav = librosa.resample(wav, orig_sr=sr, target_sr=SR)
    trimmed, _ = librosa.effects.trim(wav, top_db=TRIM_DB)
    return trimmed if len(trimmed) > SR * 0.1 else wav


@torch.no_grad()
def frames(wav):
    """Sequence of WavLM frames (frames x 768) from one layer, each scaled to unit length."""
    BUSY["t"] = time.time()
    with EMB_LOCK:
        inp = fe(wav, sampling_rate=SR, return_tensors="pt").to(DEVICE)
        f = emb_model(**inp, output_hidden_states=True).hidden_states[LAYER][0].float().cpu().numpy()
    return f / (np.linalg.norm(f, axis=1, keepdims=True) + 1e-9)


@njit(cache=True)
def dtw_from_sim(S):
    n, m = S.shape
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = (1.0 - S[i - 1, j - 1]) + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[n, m] / (n + m)


@njit(cache=True)
def dtw_path(S):
    """Same DTW as dtw_from_sim, but also returns the alignment path (for the picture only)."""
    n, m = S.shape
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = (1.0 - S[i - 1, j - 1]) + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    path = np.zeros((n + m, 2), dtype=np.int32)
    i, j, k = n, m, 0
    while i > 0 and j > 0:
        path[k, 0] = i - 1
        path[k, 1] = j - 1
        k += 1
        a, b, c = D[i - 1, j - 1], D[i - 1, j], D[i, j - 1]
        if a <= b and a <= c:
            i -= 1
            j -= 1
        elif b <= c:
            i -= 1
        else:
            j -= 1
    return path[:k][::-1]


def dist(a, b):
    return float(dtw_from_sim(a @ b.T))


def alignment(a, b):
    """Similarity picture (query frames x stored frames) and DTW path, shrunk for the browser."""
    S = a @ b.T
    path = dtw_path(S)
    n, m = S.shape
    si, sj = max(1, int(np.ceil(n / ALIGN_MAX))), max(1, int(np.ceil(m / ALIGN_MAX)))
    small = S[::si, ::sj]
    img = np.clip(small, 0, 1)
    pts = sorted({(int(i) // si, int(j) // sj) for i, j in path})
    return dict(rows=int(small.shape[0]), cols=int(small.shape[1]),
                sim=base64.b64encode((img * 255).astype(np.uint8).tobytes()).decode(),
                path=[list(p) for p in pts], frames_query=int(n), frames_stored=int(m))


# Whisper is counted as correct if its transcript contains the word or a homophone (same rule as the notebook).
DIGITS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
          "6": "six", "7": "seven", "8": "eight", "9": "nine"}
HOMOPHONES = {"knew": ["new", "gnu"], "knot": ["not"], "know": ["no"], "no": ["know"], "four": ["for", "fore"],
              "two": ["to", "too"], "eight": ["ate"], "ate": ["eight"], "witch": ["which"], "sew": ["so", "sow"],
              "see": ["sea"], "read": ["reed", "red"], "red": ["read"], "write": ["right", "rite"],
              "right": ["write", "rite"], "meat": ["meet"], "sell": ["cell"], "seed": ["cede"], "side": ["sighed"],
              "tear": ["tier", "tare"], "hall": ["haul"], "hail": ["hale"], "row": ["roe"], "steak": ["stake"],
              "feet": ["feat"], "one": ["won"], "in": ["inn"], "him": ["hymn"], "bread": ["bred"], "low": ["lo"],
              "wise": ["whys"], "add": ["ad"], "leak": ["leek"], "hold": ["holed"], "tort": ["torte"],
              "sticks": ["styx"]}


def whisper_correct(text, label):
    toks = [DIGITS.get(t, t) for t in re.findall(r"[a-z']+|[0-9]", (text or "").lower())]
    return any(t == label or t in HOMOPHONES.get(label, []) for t in toks)


@torch.no_grad()
def whisper_text(wav):
    if asr is None:
        return None
    proc, model = asr
    with ASR_LOCK:
        f = proc([wav], sampling_rate=SR, return_tensors="pt").input_features.to(DEVICE)
        ids = model.generate(f, language="en", task="transcribe", max_new_tokens=RESULTS["whisper_max_tokens"])
    return proc.batch_decode(ids, skip_special_tokens=True)[0].strip()


def peaks(wav, n=24):
    """Simple waveform shape for display (n bars)."""
    chunks = np.array_split(np.abs(wav), n)
    p = np.array([c.max() if len(c) else 0 for c in chunks])
    return (p / (p.max() + 1e-9)).round(3).tolist()


def decode(data: bytes):
    try:
        wav, sr = sf.read(io.BytesIO(data), dtype="float32")
    except Exception:
        raise HTTPException(400, "Could not read the recording (send WAV).")
    wav = to_16k_trimmed(wav, sr)
    if len(wav) < SR * 0.1:
        raise HTTPException(400, "Recording is too short.")
    return wav[: MAX_SECONDS * SR]


def wav_bytes(wav):
    buf = io.BytesIO()
    sf.write(buf, wav, SR, format="WAV")
    return buf.getvalue()


# ---- State: profiles. "me" is the user's own voice (saved on disk); "sim:<speaker>" is a Real voices run. ----
WORD_KEYS = ("label", "phrase", "icon", "main", "pale")
PROFILES = {"me": dict(id="me", kind="me", name="My voice", words={}, log=[])}
ACTIVE = "me"
RECENT = {}         # rec_id -> dict(wav, frames, whisper, truth) of the last recognised recordings
LOCK = threading.Lock()


def prof():
    return PROFILES[ACTIVE]


def words():
    return prof()["words"]


def new_take(wav, when=None, source=None):
    """One stored recording. Only WavLM runs here, so teaching stays fast (see sound_later for Whisper)."""
    return dict(id=uuid.uuid4().hex[:10], wav=wav, frames=frames(wav), whisper=None,
                peaks=peaks(wav), when=when or time.time(), source=source)


def sound_later(wid):
    """What a regular assistant hears in a word, shown in My language. It is only for display, so one
    recording per word is transcribed, in the background, and only once the app has been idle for a while."""
    if asr is None:
        return
    me = PROFILES["me"]

    def job():
        while time.time() - BUSY["t"] < IDLE_SECONDS:
            time.sleep(0.5)
        w = me["words"].get(wid)
        if not w or not w["takes"] or any(t["whisper"] for t in w["takes"]):
            return
        t = w["takes"][0]
        t["whisper"] = whisper_text(t["wav"])

    whisper_pool.submit(job)


def save_state():
    if ACTIVE != "me":
        return                                  # Real voices runs live in memory only
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    meta = []
    for wid, w in PROFILES["me"]["words"].items():
        for t in w["takes"]:
            p = STATE_DIR / f"{t['id']}.wav"
            if not p.exists():
                sf.write(p, t["wav"], SR)
        meta.append(dict(id=wid, **{k: w[k] for k in WORD_KEYS},
                         takes=[dict(id=t["id"], when=t["when"]) for t in w["takes"]]))
    (STATE_DIR / "words.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    (STATE_DIR / "log.json").write_text(json.dumps(PROFILES["me"]["log"][-300:], ensure_ascii=False), encoding="utf-8")


def load_state():
    p = STATE_DIR / "words.json"
    if not p.exists():
        return
    me = PROFILES["me"]
    for m in json.loads(p.read_text(encoding="utf-8")):
        takes = []
        for t in m["takes"]:
            f = STATE_DIR / f"{t['id']}.wav"
            if f.exists():
                wav, _ = sf.read(f, dtype="float32")
                take = new_take(wav, t["when"])
                take["id"] = t["id"]
                takes.append(take)
        me["words"][m["id"]] = dict({k: m[k] for k in WORD_KEYS}, takes=takes)
        sound_later(m["id"])
    lp = STATE_DIR / "log.json"
    if lp.exists():
        me["log"] = json.loads(lp.read_text(encoding="utf-8"))
    print(f"[utter] loaded {len(me['words'])} words from {p}")


def word_distances(fr, exclude_take=None):
    """Distance of a recording to each word = its closest stored recording. Returns {word: (distance, take)}."""
    out = {}
    for wid, w in words().items():
        best = None
        for t in w["takes"]:
            if t["id"] == exclude_take:
                continue
            d = dist(fr, t["frames"])
            if best is None or d < best[0]:
                best = (d, t)
        if best:
            out[wid] = best
    return out


def self_recognition(wid):
    """Share of a word's recordings the model gets right from the other recordings (leave-one-out)."""
    w = words()[wid]
    if len(w["takes"]) < 2 or len(words()) < 2:
        return None
    ok = 0
    for t in w["takes"]:
        d = word_distances(t["frames"], exclude_take=t["id"])
        ok += min(d, key=lambda k: d[k][0]) == wid
    return round(100 * ok / len(w["takes"]))


def word_json(wid):
    w = words()[wid]
    sound = next((t["whisper"] for t in w["takes"] if t["whisper"]), None)
    return dict(id=wid, **{k: w[k] for k in WORD_KEYS},
                takes=len(w["takes"]), sound=sound, conf=self_recognition(wid),
                take_list=[dict(id=t["id"], when=t["when"], peaks=t["peaks"], whisper=t["whisper"], source=t["source"])
                           for t in reversed(w["takes"])])


def profile_json():
    p = prof()
    return dict(id=p["id"], kind=p["kind"], name=p["name"], sim=p.get("sim"))


def add_log(entry):
    prof()["log"].append(dict(entry, when=time.time()))


load_state()


def warm_up():
    """Run the whole path once on silence, so the first real recording is not the slow one."""
    t0 = time.perf_counter()
    noise = (np.random.default_rng(0).standard_normal(44100) * 0.01).astype(np.float32)
    f = frames(to_16k_trimmed(noise, 44100))        # resampling and trimming also compile on first use
    peaks(noise)
    dist(f, f)
    alignment(f, f)
    print(f"[utter] warm-up {time.perf_counter() - t0:.1f} s, ready")


warm_up()
app = FastAPI(title="Utter")


@app.get("/api/config")
def config():
    return {"takes": TAKES, "min_words": MIN_WORDS, "threshold": THRESHOLD, "whisper": asr is not None,
            "sim": (SIM_DIR / "index.json").exists(), "profile": profile_json(),
            "model": {"name": RESULTS["emb_model"], "layer": LAYER, "params": EMB_PARAMS, "device": DEVICE,
                      "asr": RESULTS["asr_model"], "method": "DTW over frame sequences", "frame_ms": 20}}


@app.get("/api/words")
def list_words():
    with LOCK:
        return [word_json(w) for w in words()]


@app.post("/api/words")
def create_word(label: str = Form(...), phrase: str = Form(...), icon: str = Form("chat-circle-dots"),
                main: str = Form("#8FD9B0"), pale: str = Form("#D5F2E2")):
    with LOCK:
        # The same meaning twice = add recordings to the existing word, do not create a duplicate.
        for old_id, w in words().items():
            if w["label"].lower() == label.strip()[:40].lower():
                return word_json(old_id)
        wid = uuid.uuid4().hex[:8]
        words()[wid] = dict(label=label.strip()[:40], phrase=phrase.strip()[:200], icon=icon, main=main, pale=pale, takes=[])
        save_state()
        return word_json(wid)


@app.post("/api/words/{wid}/edit")
def edit_word(wid: str, phrase: str = Form(None), label: str = Form(None)):
    """Change what the app says for a word (or its name)."""
    with LOCK:
        if wid not in words():
            raise HTTPException(404, "Unknown word")
        if phrase is not None and phrase.strip():
            words()[wid]["phrase"] = phrase.strip()[:200]
        if label is not None and label.strip():
            words()[wid]["label"] = label.strip()[:40]
        save_state()
        return word_json(wid)


@app.post("/api/words/{wid}/archive")
def archive_word(wid: str):
    """Forget a word. Its recordings are not deleted, they move to data/app_state/archive/."""
    with LOCK:
        w = words().pop(wid, None)
        if w is None:
            raise HTTPException(404, "Unknown word")
        if ACTIVE == "me":
            (STATE_DIR / "archive").mkdir(parents=True, exist_ok=True)
            for t in w["takes"]:
                src = STATE_DIR / f"{t['id']}.wav"
                if src.exists():
                    src.rename(STATE_DIR / "archive" / src.name)
        save_state()
        return {"ok": True}


@app.post("/api/words/{wid}/takes")
def add_take(wid: str, file: UploadFile = File(...)):
    if wid not in words():
        raise HTTPException(404, "Unknown word")
    wav = decode(file.file.read())
    take = new_take(wav)
    with LOCK:
        words()[wid]["takes"].append(take)
        save_state()
        if ACTIVE == "me":
            sound_later(wid)
        return word_json(wid)


@app.get("/api/takes/{take_id}/audio")
def take_audio(take_id: str):
    for w in words().values():
        for t in w["takes"]:
            if t["id"] == take_id:
                return Response(wav_bytes(t["wav"]), media_type="audio/wav")
    raise HTTPException(404)


def run_recognition(wav, strict=1.0, truth=None, clip=None):
    """The whole pipeline for one recording, with timings and the pictures the Engine panel shows."""
    ready = [wid for wid, w in words().items() if w["takes"]]
    if len(ready) < MIN_WORDS:
        raise HTTPException(400, f"Teach at least {MIN_WORDS} words first.")
    t0 = time.perf_counter()
    fr = frames(wav)
    t1 = time.perf_counter()
    with LOCK:
        d = word_distances(fr)
        n_compared = sum(len(w["takes"]) for w in words().values())
    t2 = time.perf_counter()
    order = sorted(d, key=lambda k: d[k][0])
    margin = d[order[1]][0] - d[order[0]][0]
    threshold = THRESHOLD * max(0.25, min(3.0, strict))
    x = np.array([-d[w][0] / SOFTMAX_TEMP for w in order])
    p = np.exp(x - x.max())
    p = p / p.sum()
    W = words()
    rec_id = uuid.uuid4().hex[:10]
    RECENT[rec_id] = dict(wav=wav, frames=fr, truth=truth)
    while len(RECENT) > 20:
        RECENT.pop(next(iter(RECENT)))
    out = {"rec_id": rec_id, "accepted": bool(margin >= threshold), "margin": margin, "threshold": threshold,
           "guesses": [dict(id=w, label=W[w]["label"], icon=W[w]["icon"], main=W[w]["main"], pale=W[w]["pale"],
                            dist=round(d[w][0], 4), pct=int(round(100 * pi)), take=d[w][1]["id"])
                       for w, pi in zip(order, p)],
           "align": [dict(alignment(fr, d[w][1]["frames"]), word=w, label=W[w]["label"], take=d[w][1]["id"],
                          take_peaks=peaks(d[w][1]["wav"], 48)) for w in order[:2]],
           "peaks": peaks(wav, 64), "seconds": round(len(wav) / SR, 2), "frames": int(fr.shape[0]),
           "compared": n_compared,
           "timing": {"embed_ms": round(1000 * (t1 - t0)), "dtw_ms": round(1000 * (t2 - t1)),
                      "total_ms": round(1000 * (t2 - t0))}}
    if truth is not None:
        top = W[order[0]]["label"]
        out.update(truth=truth, correct=bool(top == truth), clip=clip)
    return out


@app.post("/api/recognize")
def recognize(file: UploadFile = File(...), strict: float = Form(1.0)):
    return run_recognition(decode(file.file.read()), strict)


@app.get("/api/recent/{rec_id}/whisper")
def recent_whisper(rec_id: str):
    """What a regular assistant (Whisper) hears in the same recording. Separate, so recognition does not wait."""
    r = RECENT.get(rec_id)
    if r is None:
        raise HTTPException(404)
    if "whisper" not in r:
        t0 = time.perf_counter()
        r["whisper"] = whisper_text(r["wav"])
        r["whisper_ms"] = round(1000 * (time.perf_counter() - t0))
    out = {"whisper_text": r["whisper"], "ms": r.get("whisper_ms")}
    if r.get("truth") is not None:
        out["correct"] = whisper_correct(r["whisper"], r["truth"])
    return out


@app.get("/api/recent/{rec_id}/audio")
def recent_audio(rec_id: str):
    r = RECENT.get(rec_id)
    if r is None:
        raise HTTPException(404)
    return Response(wav_bytes(r["wav"]), media_type="audio/wav")


@app.post("/api/confirm")
def confirm(rec_id: str = Form(...), word_id: str = Form(...), learn: str = Form("1")):
    """The user confirmed the guess: it is logged and the recording becomes another example of the word."""
    r = RECENT.get(rec_id)            # kept, so the comparison with a regular assistant can still be asked for
    if r is None or word_id not in words() or r.get("confirmed"):
        raise HTTPException(404)
    r["confirmed"] = True             # one recording is confirmed once
    with LOCK:
        w = words()[word_id]
        if learn == "1":
            w["takes"].append(new_take(r["wav"], source="confirmed"))
        add_log(dict(label=w["label"], phrase=w["phrase"], icon=w["icon"], main=w["main"], source="voice"))
        save_state()
        return word_json(word_id)


@app.get("/api/log")
def get_log():
    return list(reversed(prof()["log"][-100:]))


@app.post("/api/log")
def post_log(label: str = Form(...), phrase: str = Form(...), icon: str = Form("chat-circle-dots"),
             main: str = Form("#FFC93C"), source: str = Form("tap")):
    with LOCK:
        add_log(dict(label=label[:40], phrase=phrase[:200], icon=icon, main=main, source=source))
        save_state()
    return {"ok": True}


@app.post("/api/takes/{take_id}/archive")
def archive_take(take_id: str):
    """Remove a bad recording from a word. The file is not deleted, it moves to data/app_state/archive/."""
    with LOCK:
        for wid, w in words().items():
            for t in w["takes"]:
                if t["id"] == take_id:
                    w["takes"].remove(t)
                    src = STATE_DIR / f"{take_id}.wav"
                    if ACTIVE == "me" and src.exists():
                        (STATE_DIR / "archive").mkdir(parents=True, exist_ok=True)
                        src.rename(STATE_DIR / "archive" / src.name)
                    save_state()
                    return word_json(wid)
    raise HTTPException(404)


@app.post("/api/reset")
def reset():
    """Forget the taught words of the user's own voice (files stay on disk, the list moves to a backup)."""
    global ACTIVE
    with LOCK:
        ACTIVE = "me"
        PROFILES["me"]["words"].clear()
        PROFILES["me"]["log"].clear()
        p = STATE_DIR / "words.json"
        if p.exists():
            p.rename(STATE_DIR / f"words_backup_{int(time.time())}.json")
    return {"ok": True}


# ---- Real voices: real people with dysarthria from TORGO, live ----
def sim_index():
    p = SIM_DIR / "index.json"
    if not p.exists():
        raise HTTPException(404, "Real voices pack is missing. Run experiments/build_demo_pack.py.")
    if not hasattr(sim_index, "cache"):
        sim_index.cache = json.loads(p.read_text(encoding="utf-8"))
    return sim_index.cache


def sim_plan(speaker):
    """Which words of this person can be taught and tested: enough recordings for the takes plus one unheard."""
    by_word = {}
    for c in sim_index():
        if c["speaker"] == speaker:
            by_word.setdefault(c["label"], []).append(c)
    for takes in (SIM_TAKES, 1):
        ok = {w: cs for w, cs in by_word.items() if len(cs) >= takes + 1}
        if len(ok) >= 4:
            return takes, ok
    return None, {}


@app.get("/api/sim/speakers")
def sim_speakers():
    per = {s["speaker"]: s for s in RESULTS["per_speaker"]}
    out = []
    for sp in sorted({c["speaker"] for c in sim_index()}):
        takes, ok = sim_plan(sp)
        r = per.get(sp, {})
        out.append(dict(id=sp, severity=r.get("severity"), clips=sum(c["speaker"] == sp for c in sim_index()),
                        takes=takes, words=len(ok), tests=sum(len(v) - (takes or 0) for v in ok.values()),
                        whisper=r.get("whisper") if r.get("whisper") is not None else r.get("whisper_k1"),
                        heard=r.get("combined") if r.get("combined") is not None else r.get("combined_k1"),
                        sex="woman" if sp.startswith("F") else "man"))
    return out


@app.post("/api/sim/start")
def sim_start(speaker: str = Form(...), seed: int = Form(None)):
    """Teach the app a few words of one real person from their own recordings; the rest stay unheard."""
    global ACTIVE
    takes, ok = sim_plan(speaker)
    if not takes:
        raise HTTPException(400, "This person has too few repeated words.")
    rng = random.Random(seed if seed is not None else time.time_ns())
    vocab = rng.sample(sorted(ok), min(SIM_WORDS, len(ok)))
    t0 = time.perf_counter()
    wd, tests = {}, []
    for i, label in enumerate(vocab):
        clips = ok[label][:]
        rng.shuffle(clips)
        main, pale = SIM_COLORS[i % len(SIM_COLORS)]
        tk = []
        for c in clips[:takes]:
            wav, sr = sf.read(SIM_DIR / c["file"], dtype="float32")
            tk.append(new_take(to_16k_trimmed(wav, sr)[: MAX_SECONDS * SR], source=c["id"]))
        wd[uuid.uuid4().hex[:8]] = dict(label=label, phrase=label.capitalize() + ".", icon="waveform", main=main, pale=pale, takes=tk)
        tests += [dict(clip=c["id"], label=label) for c in clips[takes:]]
    rng.shuffle(tests)
    tests = tests[:SIM_MAX_TESTS]
    per = {s["speaker"]: s for s in RESULTS["per_speaker"]}.get(speaker, {})
    pid = "sim:" + speaker
    with LOCK:
        PROFILES[pid] = dict(id=pid, kind="sim", name=speaker, words=wd, log=[],
                             sim=dict(speaker=speaker, severity=per.get("severity"), takes=takes, words=len(vocab),
                                      tests=tests, teach_ms=round(1000 * (time.perf_counter() - t0)),
                                      taught=takes * len(vocab)))
        ACTIVE = pid
        return dict(profile=profile_json(), words=[word_json(w) for w in wd])


def sim_clip(clip_id):
    for c in sim_index():
        if c["id"] == clip_id:
            return c
    raise HTTPException(404, "Unknown recording")


@app.get("/api/sim/audio/{clip_id}")
def sim_audio(clip_id: str):
    return FileResponse(SIM_DIR / sim_clip(clip_id)["file"], media_type="audio/wav")


@app.post("/api/sim/recognize")
def sim_recognize(clip: str = Form(...), strict: float = Form(1.0)):
    """Recognise one unheard recording of the active real person (the file goes through the same path as the microphone)."""
    if prof()["kind"] != "sim":
        raise HTTPException(400, "Start a Real voices run first.")
    c = sim_clip(clip)
    taught = {t["source"] for w in words().values() for t in w["takes"]}
    if c["id"] in taught:
        raise HTTPException(400, "This recording was used for teaching.")   # never test on a taught recording
    return run_recognition(decode((SIM_DIR / c["file"]).read_bytes()), strict, truth=c["label"], clip=c["id"])


@app.post("/api/profile")
def set_profile(id: str = Form("me")):
    global ACTIVE
    if id not in PROFILES:
        raise HTTPException(404, "Unknown profile")
    with LOCK:
        ACTIVE = id
    return profile_json()


# ---- Evidence from the notebook ----
@app.get("/api/results")
def results():
    return RESULTS


@app.get("/api/examples")
def examples():
    return [dict(e, audio_url=f"/api/examples/audio/{e['file']}") for e in RESULTS.get("examples", [])
            if (EXAMPLES_DIR / e["file"]).exists()]


@app.get("/api/examples/audio/{name}")
def example_audio(name: str):
    path = (EXAMPLES_DIR / name).resolve()
    if path.parent != EXAMPLES_DIR.resolve() or not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/wav")


@app.get("/api/plots/{name}")
def plot(name: str):
    path = (ROOT / "outputs" / name).resolve()
    if path.parent != (ROOT / "outputs").resolve() or path.suffix != ".png" or not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="image/png")


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

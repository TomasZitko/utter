"""Utter (Slyším tě): lokální backend (FastAPI).

Spuštění z kořene projektu:
    .venv\\Scripts\\python -m uvicorn app.server:app --port 8000
a pak otevřít http://localhost:8000

Model, vrstva, práh i předzpracování se berou z outputs/results.json, které vytvoří
notebook. Nic z toho se tady nenastavuje podruhé.

Jak to funguje:
  - Uživatel naučí slovo: význam (např. „Water“) + pár nahrávek svého zvuku.
  - Z každé nahrávky se spočítá časová stopa otisků z WavLM (jedna vrstva).
  - Nová nahrávka se porovná s každou ukázkou pomocí DTW. Vzdálenost slova = nejbližší ukázka.
  - Když je náskok nejlepšího slova před druhým menší než práh, aplikace nehádá („Not sure“).
  - Potvrzený odhad se přidá jako další ukázka, takže se aplikace postupně zlepšuje.
"""
import io
import json
import os
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

# ---------------- Nastavení ----------------
ROOT = Path(__file__).resolve().parent.parent
RESULTS_PATH = ROOT / "outputs" / "results.json"
EXAMPLES_DIR = ROOT / "outputs" / "examples"
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATE_DIR = Path(os.environ.get("UTTER_STATE_DIR", ROOT / "data" / "app_state"))  # naučená slova (mimo git)
USE_WHISPER = os.environ.get("UTTER_WHISPER", "1") != "0"   # 0 = bez „co by slyšel běžný asistent“
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"   # běží i jen na CPU
MIN_WORDS = 2               # kolik slov musí být naučeno, než jde rozpoznávat
SOFTMAX_TEMP = 0.05         # jen pro zobrazení „% match“ (relativní podobnost, ne kalibrovaná pravděpodobnost)
MAX_SECONDS = 6
# -------------------------------------------

if not RESULTS_PATH.exists():
    raise SystemExit(f"Chybí {RESULTS_PATH}. Nejdřív spusť notebook notebooks/slysim_te.ipynb.")
RESULTS = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
SR = RESULTS["sr"]
TRIM_DB = RESULTS["trim_db"]
LAYER = RESULTS["best_layer"]
THRESHOLD = RESULTS["threshold"]
TAKES = RESULTS.get("app_takes", 3)

print(f"[utter] {RESULTS['emb_model']} vrstva {LAYER}, práh {THRESHOLD:.4f}, zařízení {DEVICE}")
fe = AutoFeatureExtractor.from_pretrained(RESULTS["emb_model"])
emb_model = AutoModel.from_pretrained(RESULTS["emb_model"]).to(DEVICE).eval()
asr = None
if USE_WHISPER:
    asr = (WhisperProcessor.from_pretrained(RESULTS["asr_model"]),
           WhisperForConditionalGeneration.from_pretrained(RESULTS["asr_model"]).to(DEVICE).eval())
GPU_LOCK = threading.Lock()                   # WavLM i Whisper sdílí jednu grafiku
whisper_pool = ThreadPoolExecutor(max_workers=1)


# ---- Stejné předzpracování a vzdálenost jako notebook ----
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
    """Časová stopa otisků (rámce × 768) z jedné vrstvy WavLM, normalizovaná na délku 1."""
    with GPU_LOCK:
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


def dist(a, b):
    return float(dtw_from_sim(a @ b.T))


@torch.no_grad()
def whisper_text(wav):
    if asr is None:
        return None
    proc, model = asr
    with GPU_LOCK:
        f = proc([wav], sampling_rate=SR, return_tensors="pt").input_features.to(DEVICE)
        ids = model.generate(f, language="en", task="transcribe", max_new_tokens=RESULTS["whisper_max_tokens"])
    return proc.batch_decode(ids, skip_special_tokens=True)[0].strip()


def peaks(wav, n=24):
    """Jednoduchý tvar vlny pro zobrazení (n sloupců)."""
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


# ---- Stav: naučená slova (v paměti + na disku) ----
WORDS = {}          # id -> dict(label, phrase, icon, main, pale, takes=[take])
RECENT = {}         # rec_id -> dict(wav, frames, whisper) poslední rozpoznávané nahrávky
LOCK = threading.Lock()


def new_take(wav, when=None):
    t = dict(id=uuid.uuid4().hex[:10], wav=wav, frames=frames(wav), whisper=None,
             peaks=peaks(wav), when=when or time.time())
    if asr is not None:
        whisper_pool.submit(lambda: t.__setitem__("whisper", whisper_text(wav)))
    return t


def save_state():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    meta = []
    for wid, w in WORDS.items():
        for t in w["takes"]:
            p = STATE_DIR / f"{t['id']}.wav"
            if not p.exists():
                sf.write(p, t["wav"], SR)
        meta.append(dict(id=wid, **{k: w[k] for k in ("label", "phrase", "icon", "main", "pale")},
                         takes=[dict(id=t["id"], when=t["when"]) for t in w["takes"]]))
    (STATE_DIR / "words.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")


def load_state():
    p = STATE_DIR / "words.json"
    if not p.exists():
        return
    for m in json.loads(p.read_text(encoding="utf-8")):
        takes = []
        for t in m["takes"]:
            f = STATE_DIR / f"{t['id']}.wav"
            if f.exists():
                wav, _ = sf.read(f, dtype="float32")
                take = new_take(wav, t["when"])
                take["id"] = t["id"]
                takes.append(take)
        WORDS[m["id"]] = dict({k: m[k] for k in ("label", "phrase", "icon", "main", "pale")}, takes=takes)
    print(f"[utter] načteno {len(WORDS)} slov z {p}")


def word_distances(fr, exclude_take=None):
    """Vzdálenost nahrávky ke každému slovu = nejbližší ukázka toho slova."""
    out = {}
    for wid, w in WORDS.items():
        ds = [dist(fr, t["frames"]) for t in w["takes"] if t["id"] != exclude_take]
        if ds:
            out[wid] = min(ds)
    return out


def self_recognition(wid):
    """Podíl ukázek slova, které by model správně poznal z ostatních ukázek (leave-one-out)."""
    w = WORDS[wid]
    if len(w["takes"]) < 2 or len(WORDS) < 2:
        return None
    ok = 0
    for t in w["takes"]:
        d = word_distances(t["frames"], exclude_take=t["id"])
        ok += min(d, key=d.get) == wid
    return round(100 * ok / len(w["takes"]))


def word_json(wid):
    w = WORDS[wid]
    sound = next((t["whisper"] for t in w["takes"] if t["whisper"]), None)
    return dict(id=wid, label=w["label"], phrase=w["phrase"], icon=w["icon"], main=w["main"], pale=w["pale"],
                takes=len(w["takes"]), sound=sound, conf=self_recognition(wid),
                take_list=[dict(id=t["id"], when=t["when"], peaks=t["peaks"], whisper=t["whisper"])
                           for t in reversed(w["takes"])])


load_state()
app = FastAPI(title="Utter")


@app.get("/api/config")
def config():
    return {"takes": TAKES, "min_words": MIN_WORDS, "threshold": THRESHOLD, "whisper": asr is not None}


@app.get("/api/words")
def list_words():
    with LOCK:
        return [word_json(w) for w in WORDS]


@app.post("/api/words")
def create_word(label: str = Form(...), phrase: str = Form(...), icon: str = Form("chat-circle-dots"),
                main: str = Form("#8FD9B0"), pale: str = Form("#D5F2E2")):
    with LOCK:
        # Stejný význam podruhé = přidat nahrávky ke stávajícímu slovu, ne vytvořit duplikát.
        for old_id, w in WORDS.items():
            if w["label"].lower() == label.strip()[:40].lower():
                return word_json(old_id)
        wid = uuid.uuid4().hex[:8]
        WORDS[wid] = dict(label=label.strip()[:40], phrase=phrase.strip()[:200], icon=icon, main=main, pale=pale, takes=[])
        save_state()
        return word_json(wid)


@app.post("/api/words/{wid}/takes")
def add_take(wid: str, file: UploadFile = File(...)):
    if wid not in WORDS:
        raise HTTPException(404, "Unknown word")
    wav = decode(file.file.read())
    take = new_take(wav)
    with LOCK:
        WORDS[wid]["takes"].append(take)
        save_state()
        return word_json(wid)


@app.get("/api/takes/{take_id}/audio")
def take_audio(take_id: str):
    for w in WORDS.values():
        for t in w["takes"]:
            if t["id"] == take_id:
                return Response(wav_bytes(t["wav"]), media_type="audio/wav")
    raise HTTPException(404)


@app.post("/api/recognize")
def recognize(file: UploadFile = File(...)):
    ready = [wid for wid, w in WORDS.items() if w["takes"]]
    if len(ready) < MIN_WORDS:
        raise HTTPException(400, f"Teach at least {MIN_WORDS} words first.")
    wav = decode(file.file.read())
    fr = frames(wav)
    with LOCK:
        d = word_distances(fr)
    order = sorted(d, key=d.get)
    margin = d[order[1]] - d[order[0]]
    x = np.array([-d[w] / SOFTMAX_TEMP for w in order])
    p = np.exp(x - x.max()); p = p / p.sum()
    rec_id = uuid.uuid4().hex[:10]
    RECENT[rec_id] = dict(wav=wav, frames=fr)
    while len(RECENT) > 20:
        RECENT.pop(next(iter(RECENT)))
    return {"rec_id": rec_id, "accepted": bool(margin >= THRESHOLD), "margin": margin, "threshold": THRESHOLD,
            "guesses": [dict(id=w, label=WORDS[w]["label"], icon=WORDS[w]["icon"], pct=int(round(100 * pi)))
                        for w, pi in zip(order[:3], p[:3])]}


@app.get("/api/recent/{rec_id}/whisper")
def recent_whisper(rec_id: str):
    """Co by z téže nahrávky slyšel běžný asistent (Whisper). Zvlášť, ať rozpoznání nečeká."""
    r = RECENT.get(rec_id)
    if r is None:
        raise HTTPException(404)
    if "whisper" not in r:
        r["whisper"] = whisper_text(r["wav"])
    return {"whisper_text": r["whisper"]}


@app.post("/api/confirm")
def confirm(rec_id: str = Form(...), word_id: str = Form(...)):
    """Uživatel potvrdil odhad: nahrávka se přidá jako další ukázka slova."""
    r = RECENT.pop(rec_id, None)
    if r is None or word_id not in WORDS:
        raise HTTPException(404)
    t = new_take(r["wav"])
    with LOCK:
        WORDS[word_id]["takes"].append(t)
        save_state()
        return word_json(word_id)


@app.post("/api/takes/{take_id}/archive")
def archive_take(take_id: str):
    """Odebere špatnou nahrávku ze slova. Soubor se nemaže, přesune se do data/app_state/archive/."""
    with LOCK:
        for wid, w in WORDS.items():
            for t in w["takes"]:
                if t["id"] == take_id:
                    w["takes"].remove(t)
                    src = STATE_DIR / f"{take_id}.wav"
                    if src.exists():
                        (STATE_DIR / "archive").mkdir(parents=True, exist_ok=True)
                        src.rename(STATE_DIR / "archive" / src.name)
                    save_state()
                    return word_json(wid)
    raise HTTPException(404)


@app.post("/api/reset")
def reset():
    """Zapomene naučená slova (soubory na disku zůstanou, přesunou se do zálohy)."""
    with LOCK:
        WORDS.clear()
        p = STATE_DIR / "words.json"
        if p.exists():
            p.rename(STATE_DIR / f"words_backup_{int(time.time())}.json")
    return {"ok": True}


# ---- Důkazy z notebooku ----
@app.get("/api/results")
def results():
    return RESULTS


@app.get("/api/examples")
def examples():
    return [dict(e, audio_url=f"/api/examples/audio/{e['file']}") for e in RESULTS.get("examples", [])]


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

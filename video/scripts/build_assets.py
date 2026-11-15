"""Build every generated asset of the Utter launch film from src/storyboard.json.

    ..\\.venv\\Scripts\\python scripts\\build_assets.py          (from the video folder)

Outputs
  src/generated/brand.json   colours + fonts parsed from ../app/static/tokens.css (the app is the source of truth)
  src/generated/voices.json  real waveform peaks, durations, DTW path for the match scene
  public/voices/*.wav        real TORGO clips (trimmed, levelled) named in the storyboard
  public/audio/sfx_*.wav     the sound-effect library (synthesised, original)
  public/audio/music.wav     the score, cut to the storyboard's bars, ducked under every voice clip

Everything is deterministic (fixed seeds), so rebuilding gives the same files.
"""
import json
import re
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt, resample_poly

ROOT = Path(__file__).resolve().parents[1]           # video/
REPO = ROOT.parent                                    # the repository root
import sys
SB_PATH = ROOT / "src" / (sys.argv[1] if len(sys.argv) > 1 else "storyboard.json")
SB = json.loads(SB_PATH.read_text(encoding="utf-8"))
GEN = ROOT / "src/generated"
PUB = ROOT / "public"
SR = 44100
RNG = np.random.default_rng(7)

FPS, BPM, BPB = SB["fps"], SB["bpm"], SB["beatsPerBar"]
BEAT = 60.0 / BPM                                     # seconds per beat
SCENES = []
_t = 0.0
for s in SB["scenes"]:
    d = s["bars"] * BPB * BEAT
    SCENES.append({"id": s["id"], "start": _t, "end": _t + d})
    _t += d
TOTAL = _t
SC = {s["id"]: s for s in SCENES}


def write_wav(path, x, sr=SR):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype={2: "<i2", 4: "<i4"}[sw]).astype(np.float64) / (2 ** (8 * sw - 1))
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    return x, sr


# ---------------------------------------------------------------- brand (from the app)
def build_brand():
    css = (REPO / "app/static/tokens.css").read_text(encoding="utf-8")
    vars_ = dict(re.findall(r"--([a-z0-9-]+):\s*([^;]+);", css))
    keep = ["page", "bg", "surface", "text", "muted", "ink", "line", "line-soft", "line-mid", "accent",
            "pink", "danger", "ok", "ask", "blue"]
    brand = {"colors": {k: vars_[k].strip() for k in keep if k in vars_},
             "fonts": {"display": "Familjen Grotesk", "body": "Instrument Sans"},
             "source": "app/static/tokens.css"}
    (GEN / "brand.json").write_text(json.dumps(brand, indent=2), encoding="utf-8")
    print("brand:", ", ".join(f"{k}={v}" for k, v in brand["colors"].items()))


# ---------------------------------------------------------------- real voices
INDEX = {d["id"]: d for d in json.loads((REPO / "data/sim/index.json").read_text(encoding="utf-8"))}


def trim(x, sr):
    """Cut leading/trailing silence (20 ms frames, -38 dB under the loudest frame), keep 60 ms air."""
    f = int(sr * 0.02)
    n = len(x) // f
    e = np.sqrt((x[: n * f].reshape(n, f) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(e / e.max())
    on = np.where(db > -38)[0]
    a, b = max(0, on[0] * f - int(sr * 0.06)), min(len(x), (on[-1] + 1) * f + int(sr * 0.06))
    return x[a:b]


def features(x, sr, hop=0.01):
    """Log energy in 24 spectral bands, 10 ms hop: a plain stand-in for the visual of DTW."""
    h, w = int(sr * hop), int(sr * 0.025)
    win = np.hanning(w)
    frames = [x[i:i + w] * win for i in range(0, len(x) - w, h)]
    S = np.abs(np.fft.rfft(np.array(frames), n=512)) ** 2
    edges = np.geomspace(2, S.shape[1] - 1, 25).astype(int)
    B = np.stack([S[:, edges[i]:edges[i + 1] + 1].mean(1) for i in range(24)], 1)
    F = np.log(B + 1e-9)
    return (F - F.mean(0)) / (F.std(0) + 1e-6)


def dtw_path(A, B):
    D = np.linalg.norm(A[:, None, :] - B[None, :, :], axis=2)
    n, m = D.shape
    C = np.full((n + 1, m + 1), np.inf)
    C[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            C[i, j] = D[i - 1, j - 1] + min(C[i - 1, j], C[i, j - 1], C[i - 1, j - 1])
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        k = np.argmin([C[i - 1, j - 1], C[i - 1, j], C[i, j - 1]])
        i, j = (i - 1, j - 1) if k == 0 else (i - 1, j) if k == 1 else (i, j - 1)
    return path[::-1], n, m


def peaks(x, n=96):
    seg = np.array_split(np.abs(x), n)
    p = np.array([s.max() for s in seg])
    return [round(float(v), 3) for v in p / (p.max() + 1e-9)]


def build_voices():
    out = {"clips": {}}
    ids = {v["clip"] for v in SB["voices"]} | set(SB["teachClips"]) | set(SB.get("matchClips", [])) | {v["clip"] for v in SB.get("vocab", [])} | set((SB.get("appVoices") or {}).get("teach", [])) | {c for k, c in (SB.get("appVoices") or {}).items() if k in ("listen", "unsure")}
    for cid in sorted(ids):
        d = INDEX[cid]
        x, sr = read_wav(REPO / "data/sim" / d["file"])
        x = trim(x, sr)
        x = x / (np.abs(x).max() + 1e-9) * 0.89
        y = resample_poly(x, SR, sr) if sr != SR else x
        fade = int(SR * 0.012)
        y[:fade] *= np.linspace(0, 1, fade)
        y[-fade:] *= np.linspace(1, 0, fade)
        write_wav(PUB / "voices" / f"{cid}.wav", y)
        out["clips"][cid] = {"dur": round(len(y) / SR, 3), "peaks": peaks(x), "speaker": d["speaker"], "label": d["label"]}
        print(f"voice {cid}: {d['label']:<6} {len(y) / SR:.2f}s (source {d['dur']}s)")
    if SB.get("matchClips"):
        a, b = SB["matchClips"]
        xa, sa = read_wav(REPO / "data/sim" / INDEX[a]["file"])
        xb, sb = read_wav(REPO / "data/sim" / INDEX[b]["file"])
        path, n, m = dtw_path(features(trim(xa, sa), sa), features(trim(xb, sb), sb))
        pick = np.linspace(0, len(path) - 1, 34).astype(int)
        out["match"] = {"a": a, "b": b, "links": [[round(path[k][0] / (n - 1), 4), round(path[k][1] / (m - 1), 4)] for k in pick]}
        print(f"dtw {a} vs {b}: {n}x{m} frames, path {len(path)}")
    (GEN / "voices.json").write_text(json.dumps(out), encoding="utf-8")


# ---------------------------------------------------------------- synthesis kit
def t_(d):
    return np.arange(int(d * SR)) / SR


def env_ad(n, a, d_tau):
    t = np.arange(n) / SR
    e = np.exp(-t / d_tau)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def reverb_ir(seconds=2.6, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    L = r.standard_normal(n) * np.exp(-t * 3.1)
    R = r.standard_normal(n) * np.exp(-t * 3.1)
    L, R = lp(L, 6500), lp(R, 6500)
    return np.stack([L, R], 1) / np.sqrt((L ** 2).sum())


IR = reverb_ir()


def verb(x, wet=0.3):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([fftconvolve(x[:, c], IR[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 3.0


def pan(x, p):                                       # p in -1..1
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], 1)


def norm(x, peak=0.9):
    return x / (np.abs(x).max() + 1e-9) * peak


# ---------------------------------------------------------------- SFX library
def sfx_pop():                     # Blub appears / blinks open: a soft rounded pop
    t = t_(0.22)
    f = 260 + 520 * np.exp(-t * 38)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.06)
    return verb(norm(x, 0.8), 0.18)


def sfx_tick():                    # each line of type landing
    t = t_(0.06)
    x = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 140) + 0.4 * bp(RNG.standard_normal(len(t)), 3000, 9000) * np.exp(-t * 200)
    return pan(norm(x, 0.5), 0.15)


def sfx_whoosh(d=0.9):             # transitions
    n = int(d * SR)
    t = np.arange(n) / SR
    noise = RNG.standard_normal(n)
    sweep = np.zeros(n)
    for k, (a, b) in enumerate(zip(np.linspace(300, 3200, 8), np.linspace(700, 5200, 8))):
        seg = slice(k * n // 8, (k + 1) * n // 8)
        sweep[seg] = bp(noise, a, b)[seg]
    e = np.sin(np.pi * t / d) ** 2
    L, R = sweep * e * np.linspace(1, 0.3, n), sweep * e * np.linspace(0.3, 1, n)
    return verb(norm(np.stack([L, R], 1), 0.6), 0.25)


def sfx_wrong():                   # Whisper's wrong transcript: two muted low blips
    out = np.zeros(int(0.42 * SR))
    for k, (f, at) in enumerate([(311, 0.0), (233, 0.15)]):
        t = t_(0.2)
        x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * env_ad(len(t), 0.004, 0.07)
        i = int(at * SR)
        out[i:i + len(x)] += x
    return verb(norm(lp(out, 2200), 0.6), 0.15)


def sfx_right():                   # Utter gets it: bright two-note kalimba chime
    out = np.zeros(int(1.4 * SR))
    for f, at in [(midi(79), 0.0), (midi(86), 0.09)]:
        t = t_(1.2)
        x = (np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 18))
             + 0.25 * np.sin(2 * np.pi * f * 4.02 * t) * np.exp(-t * 9)) * env_ad(len(t), 0.002, 0.35)
        i = int(at * SR)
        out[i:i + len(x)] += x
    return verb(norm(out, 0.7), 0.3)


def sfx_ask():                     # "not sure": a rising question
    t = t_(0.5)
    f = midi(74) * (1 + 0.12 * np.clip(t / 0.25, 0, 1) ** 2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.004, 0.16)
    return verb(norm(x, 0.6), 0.3)


def sfx_impact():                  # the big number lands
    t = t_(2.2)
    f = 38 + 90 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.55)
    crack = hp(RNG.standard_normal(len(t)), 1800) * np.exp(-t * 26) * 0.35
    return verb(norm(np.tanh(1.6 * (body + crack)), 0.9), 0.35)


def sfx_rec():                     # a recording card lands (record button)
    t = t_(0.35)
    x = np.sin(2 * np.pi * midi(81) * t) * env_ad(len(t), 0.002, 0.05) + 0.6 * np.sin(2 * np.pi * midi(88) * t) * env_ad(len(t), 0.002, 0.03)
    return pan(norm(x, 0.45), -0.1)


def sfx_type(chars=26):            # a soft key cluster for the sentence being spoken
    n = int((chars * 0.035 + 0.2) * SR)
    out = np.zeros(n)
    for k in range(chars):
        t = t_(0.03)
        x = bp(RNG.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 260) * (0.6 + 0.4 * RNG.random())
        i = int(k * 0.035 * SR + RNG.integers(0, 300))
        out[i:i + len(x)] += x
    return pan(norm(out, 0.35), 0.1)


def build_sfx():
    lib = {"pop": sfx_pop, "tick": sfx_tick, "whoosh": sfx_whoosh, "wrong": sfx_wrong, "right": sfx_right,
           "ask": sfx_ask, "impact": sfx_impact, "rec": sfx_rec, "type": sfx_type}
    for k, f in lib.items():
        write_wav(PUB / "audio" / f"sfx_{k}.wav", f())
    print("sfx:", ", ".join(lib))


# ---------------------------------------------------------------- the score
# Warm D major with a lydian lift (the #4 in Gmaj7#11): hopeful, not saccharine.
CHORDS = [  # one per bar, cycled; midi notes of the pad
    [50, 57, 64, 66, 69],      # Dmaj9-ish   D A E F# A
    [47, 54, 62, 66, 69],      # Bm7         B F# D F# A
    [43, 50, 59, 61, 66],      # Gmaj7#11    G D B C# F#
    [45, 52, 61, 64, 66],      # A6sus       A E C# E F#
]
BASS = [38, 35, 31, 33]
ARP = [[74, 69, 76, 78], [74, 71, 78, 81], [71, 74, 79, 73], [73, 76, 78, 81]]   # plucks over each chord

# per scene: which layers play, 0..1
LAYERS = {
    "wake":       dict(pad=0.55, bright=0.25, bell=1, sub=0.0),
    "problem":    dict(pad=0.45, bright=0.15, sub=0.4, pulse=0.35),
    "heardWrong": dict(pad=0.25, bright=0.1, sub=0.55, pulse=0.25),
    "stat":       dict(pad=0.3, bright=0.1, sub=0.6),
    "flip":       dict(pad=0.5, bright=0.35, sub=0.3, riser=1),
    "teach":      dict(pad=0.5, bright=0.5, sub=0.6, kick=1, hat=0.7, pluck=0.8),
    "vocab":      dict(pad=0.5, bright=0.55, sub=0.6, kick=1, hat=0.8, pluck=0.9, clap=0.4),
    "demoTeach":  dict(pad=0.45, bright=0.35, sub=0.45, hat=0.35, pluck=0.35),
    "demoListen": dict(pad=0.45, bright=0.3, sub=0.4, hat=0.25, pluck=0.2),
    "appTeach":   dict(pad=0.45, bright=0.45, sub=0.5, kick=0.8, hat=0.6, pluck=0.6),
    "appListen":  dict(pad=0.45, bright=0.4, sub=0.5, kick=0.6, hat=0.4, pluck=0.3),
    "appUnsure":  dict(pad=0.5, bright=0.3, sub=0.3, bell=0.6),
    "match":      dict(pad=0.5, bright=0.6, sub=0.6, kick=1, hat=0.8, pluck=1, clap=0.6),
    "payoff":     dict(pad=0.45, bright=0.45, sub=0.6, kick=0.8, hat=0.5, pluck=0.4),
    "notSure":    dict(pad=0.55, bright=0.3, sub=0.3, bell=0.7),
    "result":     dict(pad=0.6, bright=0.8, sub=0.7, kick=1, hat=1, pluck=1, clap=0.8),
    "outro":      dict(pad=0.6, bright=0.4, sub=0.4, bell=1, end=1),
}


def voice_windows():
    """Where the real voices play (seconds), so the score can step back under them."""
    w = []
    clips = json.loads((GEN / "voices.json").read_text())["clips"]
    vs = SB["voiceSlots"]
    for sid in [x for x in ("heardWrong", "payoff") if x in SC]:
        for i, v in enumerate(SB["voices"]):
            a = SC[sid]["start"] + (vs["startBeat"] + i * vs["everyBeats"]) * BEAT
            w.append((a, a + clips[v["clip"]]["dur"]))
    return w


def build_music():
    N = int((TOTAL + 3.0) * SR)
    mix = np.zeros((N, 2))
    nbar = int(np.ceil(TOTAL / (BEAT * BPB) - 1e-6))

    def layer_at(bar, key):
        t = bar * BPB * BEAT + 0.01
        for s in SCENES:
            if s["start"] <= t < s["end"]:
                return LAYERS[s["id"]].get(key, 0.0)
        return 0.0

    def add(x, at, gain=1.0):
        i = int(at * SR)
        if x.ndim == 1:
            x = np.stack([x, x], 1)
        j = min(N, i + len(x))
        mix[i:j] += x[: j - i] * gain

    # pad: additive saw-ish voices, per bar, crossfaded; brightness per scene
    pad = np.zeros((N, 2))
    for b in range(nbar):
        g = layer_at(b, "pad")
        if g <= 0:
            continue
        br = layer_at(b, "bright")
        d = BPB * BEAT + 1.2
        t = t_(d)
        e = np.minimum(1, t / 0.5) * np.minimum(1, np.maximum(0, (d - t) / 1.2))
        i0 = int(b * BPB * BEAT * SR)
        L = min(len(t), N - i0)
        for m in CHORDS[b % 4]:
            for det, p in ((-0.06, -0.6), (0.0, 0.0), (0.07, 0.6)):
                f = midi(m + det)
                x = sum(np.sin(2 * np.pi * f * k * t + k) / k * np.exp(-k / (1.5 + 6 * br)) for k in range(1, 9))
                pad[i0:i0 + L] += pan(x * e, p * 0.7)[:L] * g * 0.05
    mix += verb(pad, 0.45)

    for b in range(nbar):
        t0 = b * BPB * BEAT
        # sub bass: root, soft sine
        if (g := layer_at(b, "sub")) > 0:
            t = t_(BPB * BEAT)
            x = np.sin(2 * np.pi * midi(BASS[b % 4]) * t) * np.minimum(1, t / 0.03) * np.exp(-t * 0.4)
            add(x * g * 0.32, t0)
        # bell motif: Blub's three-note signature
        if (g := layer_at(b, "bell")) > 0 and b % 2 == 0:
            for k, (m, at) in enumerate([(81, 0), (78, 0.6), (86, 1.2)]):
                t = t_(2.5)
                f = midi(m)
                x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dcy) for r, a, dcy in ((1, 1, 1.6), (2.76, 0.35, 4), (5.4, 0.15, 7)))
                add(verb(pan(x * env_ad(len(t), 0.002, 9), 0.3 - 0.3 * k), 0.4) * g * 0.13, t0 + at)
        # pulse: muted heartbeat on 1 and the "and" of 2
        if (g := layer_at(b, "pulse")) > 0:
            for at in (0, 1.5 * BEAT):
                t = t_(0.4)
                f = 50 + 60 * np.exp(-t * 30)
                add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * g * 0.35, t0 + at)
        # drums
        if (g := layer_at(b, "kick")) > 0:
            for k in range(BPB):
                if k in (0, 2) or (k == 3 and b % 2):
                    t = t_(0.5)
                    f = 45 + 110 * np.exp(-t * 32)
                    x = np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7))
                    add(x * g * 0.45, t0 + k * BEAT + (0.5 * BEAT if k == 3 else 0))
        if (g := layer_at(b, "clap")) > 0:
            for k in (1, 3):
                t = t_(0.3)
                n = bp(RNG.standard_normal(len(t)), 900, 5000)
                e = sum(np.exp(-np.maximum(0, t - o) * 60) * (t >= o) for o in (0, 0.011, 0.023)) * np.exp(-t * 8)
                add(verb(n * e, 0.4) * g * 0.16, t0 + k * BEAT)
        if (g := layer_at(b, "hat")) > 0:
            for k in range(BPB * 2):
                t = t_(0.08)
                x = hp(RNG.standard_normal(len(t)), 7000) * np.exp(-t * (90 if k % 2 else 60))
                add(pan(x, 0.35 if k % 2 else -0.2) * g * (0.07 if k % 2 else 0.045), t0 + k * BEAT / 2)
        if (g := layer_at(b, "pluck")) > 0:
            for k, m in enumerate(ARP[b % 4] * 2):
                t = t_(0.9)
                f = midi(m)
                x = (np.sin(2 * np.pi * f * t + 1.2 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 25))) * env_ad(len(t), 0.002, 0.22)
                add(verb(pan(x, [-0.5, 0.3, -0.2, 0.5][k % 4]), 0.35) * g * 0.07, t0 + k * BEAT / 2)

    # riser into the beat (the whole "flip" scene)
    if "flip" in SC:
        s = SC["flip"]
        d = s["end"] - s["start"]
        t = t_(d)
        n = RNG.standard_normal(len(t))
        rise = (t / d) ** 2.2
        x = bp(n, 400, 9000) * rise * 0.25 + np.sin(2 * np.pi * np.cumsum(110 + 770 * (t / d) ** 2) / SR) * rise * 0.12
        add(verb(x, 0.3) * 0.7, s["start"])
    # outro: final chord ring
    if "outro" in SC:
        s = SC["outro"]
        t = t_(6.0)
        x = sum(np.sin(2 * np.pi * midi(m) * t) * np.exp(-t * 0.6) for m in (50, 57, 62, 66, 69, 74))
        add(verb(x * np.minimum(1, t / 0.02), 0.5) * 0.06, s["start"])

    # duck under the real voices: they are the point of the film
    g = np.ones(N)
    for a, b in voice_windows():
        i, j = int((a - 0.12) * SR), int((b + 0.25) * SR)
        g[max(0, i):min(N, j)] = 0.28
    k = int(0.09 * SR)
    g = np.convolve(g, np.ones(k) / k, mode="same")
    mix *= g[:, None]

    # master: gentle glue, fade the tail
    mix = np.tanh(mix * 1.4) / 1.4
    tail = int(2.5 * SR)
    mix[-tail:] *= np.linspace(1, 0, tail)[:, None]
    write_wav(PUB / SB.get("music", "audio/music.wav"), norm(mix, 0.85))
    print(f"music: {TOTAL:.1f}s film, {nbar} bars at {BPM} BPM")


if __name__ == "__main__":
    GEN.mkdir(parents=True, exist_ok=True)
    (PUB / "voices").mkdir(parents=True, exist_ok=True)
    (PUB / "audio").mkdir(parents=True, exist_ok=True)
    build_brand()
    build_voices()
    build_sfx()
    build_music()

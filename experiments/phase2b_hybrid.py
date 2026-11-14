"""Fáze 2b: personal vs general vs kombinace (DTW, vrstva 12), jen ZDRAVÍ mluvčí.

Původní popis fáze 2: porovnání metod na ZDRAVÝCH mluvčích (výběr metody), pak jednorázově na lidech s dysartrií.

Metody:
  pooled  = průměr otisku přes čas + centroid (původní notebook)
  dtw     = celá časová stopa otisku, porovnání DTW s každou ukázkou (1-NN)
  (zkoušeno i odečtení průměru přes čas (CMN): na zdravých horší u všech vrstev, viz README)

Spuštění z kořene projektu:  .venv\\Scripts\\python experiments\\phase2_dtw.py [--final]
Bez --final se počítá jen na zdravých mluvčích.
"""
import glob, io, os, re, sys, json, time
import numpy as np, pandas as pd, soundfile as sf, librosa, torch
from numba import njit
from datasets import load_dataset, Audio
from transformers import AutoFeatureExtractor, AutoModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = f"{ROOT}/data/cache"
EMB_MODEL = "microsoft/wavlm-base-plus"
SR, TRIM_DB, MAX_SECONDS = 16000, 30, 6
VOCAB_SIZE, SEED, N_REPEATS = 8, 42, 50
LAYERS = [3, 6, 9, 12]
FINAL = "--final" in sys.argv

# ---------- data: stejný výběr jako notebook ----------
ds = load_dataset("parquet", data_files=sorted(glob.glob(f"{ROOT}/data/raw/*.parquet")), split="train")
ds = ds.cast_column("audio", Audio(decode=False))
paths = ds.data.table.flatten().column("audio.path").to_pylist()
p = [os.path.splitext(os.path.basename(x))[0].split("_") for x in paths]
meta = pd.DataFrame(dict(speaker=[a[0] for a in p], session=[a[1] for a in p], mic=[a[2] for a in p], utt=[a[3] for a in p]))
meta["row"] = np.arange(len(meta))
meta["label"] = [re.sub(r"[^a-z' ]", "", str(t).lower()).strip() for t in list(ds["transcription"])]
meta["status"] = list(ds["speech_status"])
meta["group"] = meta.session + "_" + meta.utt
w = meta[(meta.label != "") & ~meta.label.str.contains(" ")].copy()
mic_n = w.groupby(["speaker", "mic"]).size()
w["mic_rank"] = [-mic_n[(s, m)] for s, m in zip(w.speaker, w.mic)]
w = w.sort_values(["speaker", "group", "mic_rank"]).drop_duplicates(["speaker", "group"])
w = w[w.groupby(["speaker", "label"]).group.transform("size") >= 2]
spk = w.groupby("label").speaker.nunique()
w = w[w.label.map(spk) >= 4].reset_index(drop=True)
w["clip_id"] = w.speaker + "_" + w.group

def to_16k_trimmed(wav, sr):
    wav = np.asarray(wav, dtype=np.float32)
    if wav.ndim > 1: wav = wav.mean(1)
    if sr != SR: wav = librosa.resample(wav, orig_sr=sr, target_sr=SR)
    t, _ = librosa.effects.trim(wav, top_db=TRIM_DB)
    return t if len(t) > SR * 0.1 else wav

wavs = []
for ex in ds.select(w.row.tolist()):
    a = ex["audio"]; x, sr = sf.read(io.BytesIO(a["bytes"]), dtype="float32"); wavs.append(to_16k_trimmed(x, sr))
w["wav"] = wavs
w = w[w.wav.map(len) <= MAX_SECONDS * SR]
df = w[w.groupby(["speaker", "label"]).clip_id.transform("size") >= 2].reset_index(drop=True)
print("clips", len(df))

# ---------- rámcové otisky (cache) ----------
cache_f = f"{CACHE}/frames_wavlm_L{'-'.join(map(str, LAYERS))}.npz"
if os.path.exists(cache_f):
    z = np.load(cache_f, allow_pickle=True)
    frames = {L: list(z[f"L{L}"]) for L in LAYERS}
    assert list(z["ids"]) == list(df.clip_id)
else:
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    fe = AutoFeatureExtractor.from_pretrained(EMB_MODEL); m = AutoModel.from_pretrained(EMB_MODEL).to(dev).eval()
    frames = {L: [] for L in LAYERS}
    with torch.no_grad():
        for x in df.wav:
            hs = m(**fe(x, sampling_rate=SR, return_tensors="pt").to(dev), output_hidden_states=True).hidden_states
            for L in LAYERS:
                frames[L].append(hs[L][0].float().cpu().numpy().astype(np.float16))
    obj = lambda lst: np.array(lst + [None], dtype=object)[:-1]
    np.savez(cache_f, ids=np.array(df.clip_id), **{f"L{L}": obj(frames[L]) for L in LAYERS})

# ---------- DTW ----------
from numba import prange

@njit(cache=True)
def dtw_from_sim(S):
    """DTW se vzdáleností 1 - kosinová podobnost, normalizace délkou cesty (n + m)."""
    n, m = S.shape
    D = np.full((n + 1, m + 1), np.inf); D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = (1.0 - S[i - 1, j - 1]) + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[n, m] / (n + m)

@njit(parallel=True, cache=True)
def dtw_row(G, offs, lens, js):
    out = np.empty(len(js))
    for t in prange(len(js)):
        j = js[t]
        out[t] = dtw_from_sim(G[:, offs[j]:offs[j] + lens[j]])
    return out

def prep(f):
    f = f.astype(np.float32)
    return f / (np.linalg.norm(f, axis=1, keepdims=True) + 1e-9)

def pair_matrix(idx, L):
    F = [prep(frames[L][i]) for i in idx]
    lens = np.array([len(f) for f in F]); offs = np.concatenate([[0], np.cumsum(lens)[:-1]])
    Fall = np.concatenate(F)
    n = len(F); M = np.zeros((n, n))
    for a in range(n - 1):
        js = np.arange(a + 1, n)
        G = F[a] @ Fall[offs[a + 1]:].T
        M[a, a + 1:] = dtw_row(G, offs - offs[a + 1], lens, js)
    return M + M.T

def trials(labels, k, rng):
    n = pd.Series(labels).value_counts(); ok = sorted(n[n >= k + 1].index)
    if len(ok) < VOCAB_SIZE: return None
    out = []
    for _ in range(N_REPEATS):
        vocab = list(rng.choice(ok, VOCAB_SIZE, replace=False))
        enroll = np.zeros(len(labels), bool)
        for c in vocab: enroll[rng.choice(np.flatnonzero(labels == c), k, replace=False)] = True
        out.append((vocab, enroll, np.isin(labels, vocab) & ~enroll))
    return out

# ---------- 2b: personal / general / kombinace na zdravých ----------
L = 12
GENERAL_PER_WORD = 10

def cross(rows, cols):
    C = [prep(frames[L][j]) for j in cols]
    lens = np.array([len(c) for c in C]); offs = np.concatenate([[0], np.cumsum(lens)[:-1]])
    Call = np.concatenate(C)
    M = np.zeros((len(rows), len(cols)))
    for a, i in enumerate(rows):
        M[a] = dtw_row(prep(frames[L][i]) @ Call.T, offs, lens, np.arange(len(cols)))
    return M

rows = []
for s in sorted(df[df.status == "healthy"].speaker.unique()):
    idx = np.flatnonzero((df.speaker == s).values); labels = df.label.values[idx]
    rng = np.random.default_rng(SEED); pool = []
    for c in sorted(set(labels)):
        cand = np.flatnonzero(((df.speaker != s) & (df.label == c)).values)
        pool += list(rng.choice(cand, min(GENERAL_PER_WORD, len(cand)), replace=False))
    pool = np.array(pool); pl = df.label.values[pool]
    M = pair_matrix(idx, L); Mg = cross(idx, pool)
    for k in [1, 2, 3]:
        tr = trials(labels, k, np.random.default_rng(SEED))
        if tr is None: continue
        acc = {"personal": [], "general": [], "combined": []}
        for vocab, en, te in tr:
            ti = np.flatnonzero(te)
            dp = np.stack([M[np.ix_(ti, np.flatnonzero(en & (labels == c)))].min(1) for c in vocab], 1)
            dg = np.stack([Mg[np.ix_(ti, np.flatnonzero(pl == c))].min(1) for c in vocab], 1)
            for name, d in (("personal", dp), ("general", dg), ("combined", np.minimum(dp, dg))):
                acc[name].append((np.array(vocab)[d.argmin(1)] == labels[ti]).mean())
        r = dict(speaker=s, k=k, **{n: float(np.mean(v)) for n, v in acc.items()}); rows.append(r); print(r, flush=True)
R = pd.DataFrame(rows)
R.to_csv(f"{ROOT}/experiments/phase2b_results_healthy.csv", index=False)
print(R.groupby("k").mean(numeric_only=True).round(3).to_string())

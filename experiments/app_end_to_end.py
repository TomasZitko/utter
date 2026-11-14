"""End-to-end test of the Utter app on real dysarthric speech (TORGO).

The test talks to the running app over HTTP exactly like the browser does:
for each person with dysarthria it teaches N_WORDS words with TAKES of their own
recordings each (POST /api/words, POST /api/words/{id}/takes), then sends every
remaining recording of those words to POST /api/recognize and checks the answer.

This is the app's own path (WAV upload, trimming, WavLM, DTW, "not sure" threshold),
using own recordings only (the app has no other people's recordings for invented sounds).

Run (from the project root, two terminals):
    set UTTER_STATE_DIR=data\\app_test_state& set UTTER_WHISPER=0& .venv\\Scripts\\python -m uvicorn app.server:app --port 8001
    .venv\\Scripts\\python experiments\\app_end_to_end.py
Needs the TORGO parquet files in data/raw/ (the notebook downloads them, or copy them there).
"""
import glob
import io
import json
import os
import re
import sys
import urllib.request
import uuid

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

# ---------------- Settings ----------------
SERVER = "http://127.0.0.1:8001"
N_WORDS = 5          # words taught per person (a small personal vocabulary)
TAKES = 3            # own recordings per word, as in the app
N_SETS = 10          # random word sets per person
SEED = 42
OUT_CSV = "experiments/app_end_to_end_results.csv"
# ------------------------------------------


def post(path, fields=None, files=None):
    """Minimal multipart/form-data POST with the standard library."""
    b = uuid.uuid4().hex
    body = io.BytesIO()
    for k, v in (fields or {}).items():
        body.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, data in (files or {}).items():
        body.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="a.wav"\r\n'
                   f"Content-Type: audio/wav\r\n\r\n".encode() + data + b"\r\n")
    body.write(f"--{b}--\r\n".encode())
    req = urllib.request.Request(SERVER + path, data=body.getvalue(), method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def load_single_words():
    """Single-word recordings of people with dysarthria, one copy per recording (as in the notebook)."""
    rows = []
    for f in sorted(glob.glob("data/raw/*.parquet")):
        t = pq.read_table(f, columns=["audio", "transcription", "speech_status"]).to_pandas()
        t = t[t.speech_status == "dysarthria"]
        for audio, text in zip(t.audio, t.transcription):
            label = re.sub(r"[^a-z' ]", "", str(text).lower()).strip()
            if not label or " " in label:
                continue
            p = os.path.splitext(os.path.basename(audio["path"]))[0].split("_")
            rows.append(dict(speaker=p[0], group=p[1] + "_" + p[3], mic=p[2], label=label, wav=audio["bytes"]))
    df = pd.DataFrame(rows)
    mic_n = df.groupby(["speaker", "mic"]).size()
    df["mic_rank"] = [-mic_n[(s, m)] for s, m in zip(df.speaker, df.mic)]
    return df.sort_values(["speaker", "group", "mic_rank"]).drop_duplicates(["speaker", "group"])


def main():
    df = load_single_words()
    rng = np.random.default_rng(SEED)
    out = []
    for s in sorted(df.speaker.unique()):
        d = df[df.speaker == s]
        n = d.label.value_counts()
        ok_words = sorted(n[n >= TAKES + 1].index)
        if len(ok_words) < N_WORDS:
            print(f"{s}: only {len(ok_words)} words with {TAKES + 1}+ recordings, skipped")
            continue
        for rep in range(N_SETS):
            post("/api/reset")
            vocab = list(rng.choice(ok_words, N_WORDS, replace=False))
            tests = []
            for w in vocab:
                clips = d[d.label == w].sample(frac=1, random_state=int(rng.integers(1e9)))
                wid = post("/api/words", {"label": w, "phrase": w})["id"]
                for wav in clips.wav[:TAKES]:
                    post(f"/api/words/{wid}/takes", files={"file": wav})
                tests += [(w, wav) for wav in clips.wav[TAKES:]]
            for w, wav in tests:
                try:
                    r = post("/api/recognize", files={"file": wav})
                except Exception as e:   # e.g. a recording that is only silence
                    print("  skipped one recording:", e)
                    continue
                top = r["guesses"][0]["label"]
                out.append(dict(speaker=s, set=rep, word=w, top1=top, correct=top == w, accepted=r["accepted"]))
        res = pd.DataFrame([o for o in out if o["speaker"] == s])
        acc = res[res.accepted]
        print(f"{s}: top-1 {res.correct.mean():.0%} | accepted {res.accepted.mean():.0%}, "
              f"of those correct {acc.correct.mean():.0%} | n={len(res)}")
        sys.stdout.flush()
    R = pd.DataFrame(out)
    R.to_csv(OUT_CSV, index=False)
    per = R.groupby("speaker").agg(top1=("correct", "mean"), accepted=("accepted", "mean"), n=("correct", "size"))
    per["wrong_actions"] = R.assign(w=R.accepted & ~R.correct).groupby("speaker").w.mean()
    print("\nPer person (averaged over recordings):")
    print(per.round(3).to_string())
    print(f"\nMean over {len(per)} people: top-1 {per.top1.mean():.1%}, accepted {per.accepted.mean():.1%}, "
          f"wrong actions {per.wrong_actions.mean():.1%}. Chance = {1 / N_WORDS:.0%}.")


if __name__ == "__main__":
    main()

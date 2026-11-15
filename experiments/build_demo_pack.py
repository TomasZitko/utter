"""Build the "Real voices" demo pack for the app from the TORGO parquet files.

The app's Real voices mode lets you pick a real person with dysarthria from TORGO,
teaches the app a few of their words from their own recordings, and then recognises
recordings it has never heard, live. This script extracts the recordings it needs:
single-word recordings of people with dysarthria, one microphone per recording
(the same rule as the notebook, so the same word is never counted twice).

Run from the project root (needs data/raw/*.parquet, the notebook downloads them):
    .venv\\Scripts\\python experiments\\build_demo_pack.py
Output: data/sim/<speaker>/*.wav and data/sim/index.json (not committed: TORGO is only cited).
"""
import glob
import json
import os
import re
from collections import Counter

import pyarrow.parquet as pq

# ---------------- Settings ----------------
RAW = "data/raw/*.parquet"
OUT = "data/sim"
# ------------------------------------------


def clean(text):
    return re.sub(r"[^a-z' ]", "", str(text).lower()).strip()


def main():
    rows = []   # (speaker, group, mic, label, bytes)
    for f in sorted(glob.glob(RAW)):
        pf = pq.ParquetFile(f)
        for g in range(pf.metadata.num_row_groups):          # one row group at a time: low memory
            t = pf.read_row_group(g, columns=["audio", "transcription", "speech_status", "duration"]).to_pylist()
            for r in t:
                if r["speech_status"] != "dysarthria":
                    continue
                label = clean(r["transcription"])
                if not label or " " in label:
                    continue
                p = os.path.splitext(os.path.basename(r["audio"]["path"]))[0].split("_")
                rows.append(dict(speaker=p[0], group=p[1] + "_" + p[3], mic=p[2], label=label,
                                 dur=r["duration"], wav=r["audio"]["bytes"]))
        print(f, len(rows))

    # one microphone per recording: prefer the speaker's most common microphone
    mic_n = Counter((r["speaker"], r["mic"]) for r in rows)
    rows.sort(key=lambda r: (r["speaker"], r["group"], -mic_n[(r["speaker"], r["mic"])]))
    seen, index = set(), []
    for r in rows:
        key = (r["speaker"], r["group"])
        if key in seen:
            continue
        seen.add(key)
        name = f"{r['group']}_{r['label']}.wav"
        os.makedirs(f"{OUT}/{r['speaker']}", exist_ok=True)
        with open(f"{OUT}/{r['speaker']}/{name}", "wb") as fh:
            fh.write(r["wav"])
        index.append(dict(speaker=r["speaker"], id=f"{r['speaker']}_{r['group']}", label=r["label"],
                          file=f"{r['speaker']}/{name}", dur=round(float(r["dur"] or 0), 2)))
    with open(f"{OUT}/index.json", "w", encoding="utf-8") as fh:
        json.dump(index, fh)
    print(f"{len(index)} recordings of {len(set(i['speaker'] for i in index))} people -> {OUT}")
    print(Counter(i["speaker"] for i in index))


if __name__ == "__main__":
    main()

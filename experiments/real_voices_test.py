"""Long test of the app's Real voices mode on TORGO, through the running app's HTTP API.

For every person with dysarthria it repeats what the Real voices panel does: the app is taught a random
set of the person's words from their own recordings only (POST /api/sim/start), then every other recording
of those words is recognised (POST /api/sim/recognize) and a regular assistant (Whisper) transcribes the
same recording (GET /api/recent/{id}/whisper). No recording used for teaching is ever tested.

This is the app's own path (file -> trimming -> WavLM -> DTW -> "not sure" threshold) in the own-recordings-only
setting, so compare it with the "own recordings only" numbers in the notebook, not with the combined model.

Run (app server running on port 8000, data/sim built by build_demo_pack.py):
    .venv\\Scripts\\python experiments\\real_voices_test.py
"""
import csv
import json
import sys
import time
import urllib.parse
import urllib.request

# ---------------- Settings ----------------
SERVER = "http://127.0.0.1:8000"
RUNS = 6             # random word sets per person
SEED = 42
OUT_CSV = "experiments/real_voices_results.csv"
OUT_TXT = "experiments/real_voices_log.txt"
# ------------------------------------------


def call(path, fields=None):
    data = urllib.parse.urlencode(fields).encode() if fields is not None else None
    with urllib.request.urlopen(urllib.request.Request(SERVER + path, data=data), timeout=120) as r:
        return json.loads(r.read())


def main():
    out, lines = [], []
    speakers = call("/api/sim/speakers")
    t_start = time.time()
    for sp in speakers:
        if not sp["takes"]:
            continue
        rows = []
        for run in range(RUNS):
            prof = call("/api/sim/start", {"speaker": sp["id"], "seed": SEED + run})["profile"]["sim"]
            for t in prof["tests"]:
                r = call("/api/sim/recognize", {"clip": t["clip"]})
                w = call(f"/api/recent/{r['rec_id']}/whisper")
                rows.append(dict(speaker=sp["id"], severity=sp["severity"], takes=prof["takes"], run=run, clip=t["clip"],
                                 said=r["truth"], top=r["guesses"][0]["label"], correct=r["correct"], accepted=r["accepted"],
                                 margin=round(r["margin"], 4), ms=r["timing"]["total_ms"],
                                 whisper=w["whisper_text"], whisper_correct=w["correct"]))
        n = len(rows)
        acted = [x for x in rows if x["accepted"]]
        line = (f"{sp['id']} ({sp['severity']}, {rows[0]['takes']} own recording(s) per word, n={n}): "
                f"top guess right {sum(x['correct'] for x in rows) / n:.0%} | acts right {sum(x['correct'] for x in acted) / n:.0%}, "
                f"asks again {1 - len(acted) / n:.0%}, acts wrong {sum(not x['correct'] for x in acted) / n:.0%} | "
                f"Whisper right {sum(x['whisper_correct'] for x in rows) / n:.0%} | median {sorted(x['ms'] for x in rows)[n // 2]} ms")
        print(line); sys.stdout.flush()
        lines.append(line)
        out += rows
    call("/api/profile", {"id": "me"})

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader(); w.writerows(out)

    def mean_over_people(fn):
        per = {}
        for x in out:
            per.setdefault(x["speaker"], []).append(x)
        return sum(fn(v) for v in per.values()) / len(per), len(per)

    top, k = mean_over_people(lambda v: sum(x["correct"] for x in v) / len(v))
    right, _ = mean_over_people(lambda v: sum(x["correct"] and x["accepted"] for x in v) / len(v))
    wrong, _ = mean_over_people(lambda v: sum((not x["correct"]) and x["accepted"] for x in v) / len(v))
    ask, _ = mean_over_people(lambda v: sum(not x["accepted"] for x in v) / len(v))
    whi, _ = mean_over_people(lambda v: sum(x["whisper_correct"] for x in v) / len(v))
    ms = sorted(x["ms"] for x in out)[len(out) // 2]
    summary = (f"\nMean over {k} people ({len(out)} unheard recordings, {RUNS} word sets each, own recordings only): "
               f"top guess right {top:.1%}; with 'not sure': acts right {right:.1%}, asks again {ask:.1%}, acts wrong {wrong:.1%}. "
               f"Whisper right {whi:.1%}. Median recognition time {ms} ms. Took {time.time() - t_start:.0f} s.")
    print(summary)
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n" + summary + "\n")


if __name__ == "__main__":
    main()

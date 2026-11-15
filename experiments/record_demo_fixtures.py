"""Record real answers of the running app, for the click-through demo on the project page.

The online demo (docs/demo) has no server and no model. Instead it replays what the real app
answered here: the app is taught a few words from TORGO recordings and then recognises recordings
it has not heard. Every number, alignment picture and transcript in the demo comes from this run.
No audio is saved, only the app's JSON answers.

Run (app server on port 8010 with an EMPTY profile, data/sim built):
    set UTTER_STATE_DIR=some_empty_folder
    .venv\\Scripts\\python -m uvicorn app.server:app --port 8010
    .venv\\Scripts\\python experiments\\record_demo_fixtures.py
"""
import json
import sys
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

# ---------------- Settings ----------------
SERVER = "http://127.0.0.1:8010"
OUT = Path("docs/demo/fixtures")
MY_SPEAKER = "M05"          # whose recordings stand in for "my voice" in the demo (has 5 words said 4+ times)
MY_WORDS = [                # meaning shown in the demo <- TORGO word used as its sound
    dict(label="Water", icon="drop", main="#4C7DFF", pale="#C9D8FF", phrase="Can I have some water, please?"),
    dict(label="Pain", icon="lightning", main="#F4583E", pale="#FFC3B5", phrase="Something hurts. I am in pain."),
    dict(label="Tired", icon="moon", main="#FFC93C", pale="#FBEBB0", phrase="I'm tired. I'd like to rest."),
    dict(label="Walk", icon="person-simple-walk", main="#8FD9B0", pale="#D5F2E2", phrase="Can we go for a walk?"),
    dict(label="Family", icon="users-three", main="#F8A4D2", pale="#FFE0F1", phrase="I want to see my family."),
]
SIM_SEED = 7
SIM_TESTS = 10              # recordings replayed per person
# ------------------------------------------


def call(path, fields=None, files=None):
    if files:
        b = uuid.uuid4().hex
        body = b""
        for k, v in (fields or {}).items():
            body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, (name, data) in files.items():
            body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + data + b"\r\n"
        body += f"--{b}--\r\n".encode()
        req = urllib.request.Request(SERVER + path, data=body, headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    else:
        data = urllib.parse.urlencode(fields).encode() if fields is not None else None
        req = urllib.request.Request(SERVER + path, data=data)
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def save(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{name}: {p.stat().st_size / 1024:.0f} kB")


def main():
    index = json.loads(Path("data/sim/index.json").read_text(encoding="utf-8"))
    call("/api/profile", {"id": "me"})
    assert not call("/api/words"), "start the server with an empty UTTER_STATE_DIR"
    cfg = call("/api/config")

    part = sys.argv[1] if len(sys.argv) > 1 else "all"      # "me" or "sim" records one part only
    if part in ("all", "me"):
        record_me(index, cfg)
    if part in ("all", "sim"):
        record_sim()
    call("/api/profile", {"id": "me"})
    save("results.json", call("/api/results"))


def record_me(index, cfg):
    """ "My voice": teach the demo words from one person's recordings. """
    by_word = {}
    for c in index:
        if c["speaker"] == MY_SPEAKER:
            by_word.setdefault(c["label"], []).append(c)
    sounds = sorted((w for w in by_word if len(by_word[w]) >= cfg["takes"] + 1), key=lambda w: -len(by_word[w]))[:len(MY_WORDS)]
    held = []
    for meaning, sound in zip(MY_WORDS, sounds):
        w = call("/api/words", meaning)
        clips = by_word[sound]
        for c in clips[:cfg["takes"]]:
            call(f"/api/words/{w['id']}/takes", files={"file": ("take.wav", Path("data/sim", c["file"]).read_bytes())})
        held += [(meaning["label"], c) for c in clips[cfg["takes"]:cfg["takes"] + 2]]
    results = []
    for label, c in held:
        r = call("/api/recognize", {"strict": 1}, files={"file": ("rec.wav", Path("data/sim", c["file"]).read_bytes())})
        r["whisper"] = call(f"/api/recent/{r['rec_id']}/whisper")
        r["meant"] = label
        results.append(r)
        print(f"  meant {label:8s} -> {r['guesses'][0]['label']:8s} accepted={r['accepted']} whisper={r['whisper']['whisper_text']!r}")
    save("me.json", dict(config=cfg, words=call("/api/words"), results=results,
                         note=f"Sounds are TORGO recordings of speaker {MY_SPEAKER}; meanings were assigned for the demo."))



def record_sim():
    """Real voices: every person, a fixed word set."""
    speakers = call("/api/sim/speakers")
    save("speakers.json", speakers)
    for sp in speakers:
        if not sp["takes"]:
            continue
        start = call("/api/sim/start", {"speaker": sp["id"], "seed": SIM_SEED})
        start["profile"]["sim"]["tests"] = start["profile"]["sim"]["tests"][:SIM_TESTS]
        answers = {}
        for t in start["profile"]["sim"]["tests"]:
            r = call("/api/sim/recognize", {"clip": t["clip"], "strict": 1})
            r["whisper"] = call(f"/api/recent/{r['rec_id']}/whisper")
            answers[t["clip"]] = r
        save(f"sim_{sp['id']}.json", dict(start=start, answers=answers))


if __name__ == "__main__":
    main()

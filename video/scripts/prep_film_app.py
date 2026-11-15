"""Prepare the film server (port 8010, its own UTTER_STATE_DIR) for capture_app.mjs.

- Pre-teaches a few words through the app's own API with real TORGO takes of speaker M02,
  so the home screen shows a real vocabulary (any sound can mean anything in Utter).
- Writes fake-microphone files: one real take per file, short silence around it, so the app's
  auto-stop ends each recording naturally.
"""
import json
import urllib.request
import uuid
import wave
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
SIM = REPO / "data/sim"
OUT = REPO / "data/film_state"
API = "http://127.0.0.1:8010"
IDX = {d["id"]: d for d in json.loads((SIM / "index.json").read_text())}

# meaning -> (icon, main, pale, phrase) exactly as in app/static/app.js MEANINGS
MEANINGS = {
    "Water": ("drop", "#4C7DFF", "#C9D8FF", "Can I have some water, please?"),
    "Walk": ("person-simple-walk", "#8FD9B0", "#D5F2E2", "Can we go for a walk?"),
    "Family": ("users-three", "#F8A4D2", "#FFE0F1", "I want to see my family."),
    "Medicine": ("pill", "#4C7DFF", "#C9D8FF", "I need my medicine."),
}
PRETAUGHT = {  # meaning -> M02's real takes of one word
    "Water": ["M02_1_0012", "M02_1_0078", "M02_1_0091"],      # "sip"
    "Walk": ["M02_1_0060", "M02_1_0146", "M02_1_0216"],       # "slip"
    "Family": ["M02_1_0177", "M02_2_0215", "M02_2_0239"],     # "witch"
    "Medicine": ["M02_2_0140", "M02_2_0141", "M02_2_0142"],   # "pit"
}
MICS = {  # file -> clip
    # mic_teach.wav: the three "sigh" takes M02_1_0131/0201/0233 in a row (written below)
    "mic_new.wav": "M02_2_0107",       # "sigh", a new recording (Whisper heard "Sorry.")
    "mic_untaught.wav": "M02_2_0157",  # "leak", never taught
}


def post(url, fields=None, files=None):
    b = uuid.uuid4().hex
    body = b""
    for k, v in (fields or {}).items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (name, data) in (files or {}).items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request(API + url, data=body, headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def read(path):
    with wave.open(str(path)) as w:
        sr, x = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
        if w.getnchannels() > 1:
            x = x.reshape(-1, w.getnchannels()).mean(1)
    return x, sr


def trim(x, sr):
    f = int(sr * 0.02)
    n = len(x) // f
    e = np.sqrt((x[: n * f].reshape(n, f) ** 2).mean(1) + 1e-12)
    on = np.where(20 * np.log10(e / e.max()) > -36)[0]
    return x[max(0, on[0] * f - int(sr * 0.05)):(on[-1] + 1) * f + int(sr * 0.05)]


def write(path, x, sr):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    have = {w["label"] for w in json.loads(urllib.request.urlopen(API + "/api/words").read())}
    for label, clips in PRETAUGHT.items():
        if label in have:
            continue
        icon, main, pale, phrase = MEANINGS[label]
        w = post("/api/words", dict(label=label, phrase=phrase, icon=icon, main=main, pale=pale))
        for c in clips:
            w = post(f"/api/words/{w['id']}/takes", files={"file": ("take.wav", (SIM / IDX[c]["file"]).read_bytes())})
        print("taught", label, "with", w.get("takes"), "takes of", IDX[clips[0]]["label"])
    for name, c in MICS.items():
        x, sr = read(SIM / IDX[c]["file"])
        x = trim(x, sr)
        x = x / (np.abs(x).max() + 1e-9) * 0.9
        y = np.concatenate([np.zeros(int(sr * 0.35)), x, np.zeros(int(sr * 1.5))])
        write(OUT / name, y, sr)
        print("mic", name, IDX[c]["label"], f"{len(y) / sr:.2f}s")

"""Turn capture_app.mjs screencasts into film clips.

data/film_state/cap_<name>/ (frames + frames.txt + events.json)
  -> public/app/<name>.mp4  (cropped to the phone, constant 30 fps)
  -> src/generated/app.json (when each event happens, in seconds of that clip)
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT.parent / "data/film_state"
OUT = ROOT / "public/app"
OUT.mkdir(parents=True, exist_ok=True)
meta = {}
import shutil, sys
for name in (sys.argv[1:] or ["teach", "listen"]):
    d = CAP / f"cap_{name}"
    ev = json.loads((d / "events.json").read_text())
    b = ev["box"]
    w, h = int(b["w"]) // 2 * 2, int(b["h"]) // 2 * 2
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(d / "frames.txt"),
                    "-vf", f"crop={w}:{h}:{int(b['x'])}:{int(b['y'])},fps=30,format=yuv420p",
                    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-movflags", "+faststart", str(OUT / f"{name}.mp4")], check=True)
    offset = ev["startWall"] - ev["firstFrame"]
    events = {e["name"]: round(e["t"] + offset, 3) for e in ev["events"]}
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT / f"{name}.mp4")],
                               capture_output=True, text=True).stdout)
    audio = sorted(x.name for x in d.glob("*.wav"))
    for a in audio:   # what the app itself recorded during the capture
        shutil.copy(d / a, ROOT / "public/voices" / f"app_{name}_{a}")
    meta[name] = {"w": w, "h": h, "dur": round(dur, 3), "events": events, "audio": [f"app_{name}_{a[:-4]}" for a in audio]}
    print(name, f"{w}x{h}", f"{dur:.1f}s", events)
old = json.loads((ROOT / "src/generated/app.json").read_text()) if (ROOT / "src/generated/app.json").exists() else {}
old.update(meta)
(ROOT / "src/generated/app.json").write_text(json.dumps(old, indent=2))

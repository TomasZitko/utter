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
for name in ("teach", "listen", "unsure"):
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
    meta[name] = {"w": w, "h": h, "dur": round(dur, 3), "events": events}
    print(name, f"{w}x{h}", f"{dur:.1f}s", events)
(ROOT / "src/generated/app.json").write_text(json.dumps(meta, indent=2))

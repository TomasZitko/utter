"""Contact sheet of chosen frames from a render, in the order given.

    ..\\.venv\\Scripts\\python scripts\\contact_sheet.py out\\draft.mp4 out\\sheet.png 10 50 120 ...
"""
import subprocess
import sys
import tempfile
from pathlib import Path

src, dst, *frames = sys.argv[1:]
fps = 30
cols = 4
with tempfile.TemporaryDirectory() as d:
    for i, fr in enumerate(frames):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{int(fr) / fps:.3f}", "-i", src, "-frames:v", "1",
                        f"{d}/f_{i:03d}.png"], check=True)
    rows = (len(frames) + cols - 1) // cols
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "1", "-i", f"{d}/f_%03d.png",
                    "-vf", f"tile={cols}x{rows}:padding=4", "-frames:v", "1", dst], check=True)
print(dst)

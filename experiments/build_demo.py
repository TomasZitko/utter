"""Build the click-through demo for the project page: docs/demo = the app's own screens + demo.js.

The demo is the real frontend (app/static, copied as it is). docs/demo/demo.js stands in for the
server and the microphone and replays answers recorded from the real app (docs/demo/fixtures,
made by record_demo_fixtures.py). Run again whenever app/static changes:
    python experiments/build_demo.py
"""
import shutil
from pathlib import Path

# ---------------- Settings ----------------
SRC = Path("app/static")
OUT = Path("docs/demo")
BAR_PX = 46
# ------------------------------------------

BAR = f"""
<script>if (location.search.includes("embed")) document.documentElement.classList.add("embed");</script>
<div class="demo-bar"><b>Online demo.</b> Nothing is recognised here and the microphone is not used:
  the screens replay answers the real app gave on real recordings.
  <a href="../#get">Get the real app</a> <a href="../">About the project</a></div>
<style>
  .demo-bar {{ position:fixed; top:0; left:0; right:0; height:{BAR_PX}px; z-index:50; display:flex; align-items:center; justify-content:center; gap:10px;
    padding:0 16px; background:var(--accent, #FFC93C); color:#141414; font:500 15px/1.2 "Instrument Sans", system-ui, sans-serif; text-align:center; }}
  .demo-bar b {{ font-weight:700; }}
  .demo-bar a {{ color:#141414; font-weight:700; white-space:nowrap; }}
  body {{ padding-top:{BAR_PX}px; }}
  .embed .demo-bar {{ display:none; }}  .embed body {{ padding-top:0; }}   /* inside the phone frame on the project page */
  @media (max-width: 820px) {{ .demo-bar {{ height:auto; min-height:{BAR_PX}px; padding:6px 12px; font-size:13px; flex-wrap:wrap; position:static; }} body {{ padding-top:0; }} }}
</style>"""

FIT = f"""<script>
  // the demo bar takes {BAR_PX} px of the window's height
  function demoFit() {{
    const z = innerWidth <= 820 ? 1 : Math.max(0.5, Math.min(1, (innerHeight - {BAR_PX}) / 908, innerWidth / 1380));
    document.documentElement.style.setProperty("--zoom", z.toFixed(3));
  }}
  addEventListener("resize", demoFit); demoFit();
</script>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in SRC.iterdir():
        if f.is_file() and not f.name.startswith("_") and f.name != "index.html":
            shutil.copy(f, OUT / f.name)
    html = (SRC / "index.html").read_text(encoding="utf-8")

    def swap(a, b):
        nonlocal html
        assert html.count(a) == 1, a
        html = html.replace(a, b)

    swap("<title>Utter: voice control that learns your speech</title>", "<title>Utter: online demo</title>")
    swap('<div class="stage">', BAR + '\n<div class="stage">')
    swap("Everything runs on this computer, no voice leaves it.",
         "This page is a demo: it replays recorded answers of the real app, and a hum stands in for the voices.")
    recorder = next(l for l in html.splitlines() if "recorder.js" in l)
    swap(recorder, recorder + '\n<script src="demo.js"></script>')
    swap("</body>", FIT + "\n</body>")
    (OUT / "index.html").write_text(html, encoding="utf-8", newline="\n")
    print("built", OUT, "from", SRC)


if __name__ == "__main__":
    main()

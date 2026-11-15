"""Start Utter and open it in the browser. Used by "Start Utter.bat" and start_utter.sh.

    python run.py            # http://localhost:8000
    python run.py --port 8001 --no-browser
"""
import argparse
import threading
import time
import urllib.request
import webbrowser

import uvicorn

# ---------------- Settings ----------------
HOST = "127.0.0.1"
PORT = 8000
# ------------------------------------------


def open_when_ready(url):
    for _ in range(1800):                       # the first start downloads the models, so wait patiently
        try:
            urllib.request.urlopen(url + "/api/config", timeout=2)
            webbrowser.open(url)
            print(f"\n  Utter is running at {url}\n")
            return
        except Exception:
            time.sleep(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    print("  Loading the speech models (the first start downloads about 1.4 GB)...")
    if not a.no_browser:
        threading.Thread(target=open_when_ready, args=(f"http://localhost:{a.port}",), daemon=True).start()
    uvicorn.run("app.server:app", host=HOST, port=a.port, log_level="warning")

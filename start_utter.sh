#!/bin/sh
# Utter on Mac or Linux: sh start_utter.sh  (installs on the first start, then opens the browser)
set -e
cd "$(dirname "$0")"
PY=""
for p in python3.11 python3.12 python3.10 python3; do command -v "$p" >/dev/null 2>&1 && { PY="$p"; break; }; done
[ -n "$PY" ] || { echo "Python 3.10-3.12 is needed: https://www.python.org/downloads/"; exit 1; }
if [ ! -f .venv/installed.txt ]; then
  echo "First start: installing into .venv (about 5-10 minutes)."
  "$PY" -m venv .venv
  .venv/bin/python -m pip install --upgrade pip >/dev/null
  .venv/bin/python -m pip install torch
  .venv/bin/python -m pip install -r requirements-app.txt
  echo ok > .venv/installed.txt
fi
exec .venv/bin/python run.py "$@"

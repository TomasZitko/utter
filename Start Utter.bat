@echo off
rem Utter: double-click to install (first time) and start the app. Windows 10/11.
setlocal
cd /d "%~dp0"
title Utter

echo.
echo   Utter - voice control that learns your speech
echo   ----------------------------------------------
echo.

rem 1. find Python 3.10-3.12
set "PY="
for %%V in (3.11 3.12 3.10) do (
  if not defined PY (
    py -%%V -c "import sys" >nul 2>&1 && set "PY=py -%%V"
  )
)
if not defined PY (
  python -c "import sys; raise SystemExit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)" >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo   Python 3.10, 3.11 or 3.12 was not found.
  echo   Install Python 3.11 from https://www.python.org/downloads/release/python-3119/
  echo   ^(tick "Add python.exe to PATH"^), then double-click this file again.
  echo.
  pause
  exit /b 1
)

rem 2. first start: private environment + packages (about 5-10 minutes, about 3 GB)
if not exist ".venv\Scripts\python.exe" (
  echo   First start: installing into the folder .venv ^(nothing is installed outside this folder^).
  echo.
  %PY% -m venv .venv || goto :failed
  ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
  nvidia-smi >nul 2>&1
  if not errorlevel 1 (
    echo   NVIDIA graphics card found: installing PyTorch with GPU support.
    ".venv\Scripts\python.exe" -m pip install torch --index-url https://download.pytorch.org/whl/cu126 || ".venv\Scripts\python.exe" -m pip install torch || goto :failed
  ) else (
    ".venv\Scripts\python.exe" -m pip install torch || goto :failed
  )
  ".venv\Scripts\python.exe" -m pip install -r requirements-app.txt || goto :failed
  echo ok> ".venv\installed.txt"
)
if not exist ".venv\installed.txt" (
  ".venv\Scripts\python.exe" -m pip install -r requirements-app.txt || goto :failed
  echo ok> ".venv\installed.txt"
)

rem 3. start (the first start also downloads the two models, about 1.4 GB)
echo.
echo   Starting Utter. The browser opens by itself when it is ready.
echo   Keep this window open while you use the app. Close it to stop.
echo.
".venv\Scripts\python.exe" run.py
pause
exit /b 0

:failed
echo.
echo   The installation did not finish. Check the internet connection and try again.
echo   If it keeps failing, delete the folder .venv and double-click this file again.
echo.
pause
exit /b 1

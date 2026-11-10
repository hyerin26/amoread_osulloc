@echo off
chcp 65001 > nul
cd /d %~dp0
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

rem Promotion planner (mentee copy). Cost and sales data in data\ are SAMPLE (fake) data.
if not exist .venv\Scripts\python.exe (
    echo First run: creating venv. This may take a few minutes...
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -q pip-system-certs
    .venv\Scripts\python.exe -m pip install -q -r planner\requirements.txt
)

if not exist planner\data\planner_data.json (
    echo Building planner data for the first time...
    .venv\Scripts\python.exe -W ignore -m planner.build
)

echo Starting planner... A browser will open. Close this window to stop.
.venv\Scripts\python.exe -m planner.server
if %errorlevel% neq 0 (
    echo.
    echo An error occurred. See the message above. If already running, open http://127.0.0.1:9731
    pause
)

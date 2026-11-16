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

rem Reinstall packages when planner\requirements.txt changed (e.g. a new package after git pull). Without this the server stops with ModuleNotFoundError.
for /f %%h in ('.venv\Scripts\python.exe -c "import hashlib;print(hashlib.sha1(open(r'planner\requirements.txt','rb').read()).hexdigest())"') do set REQ_HASH=%%h
set OLD_HASH=
if exist .venv\requirements.sha1 set /p OLD_HASH=<.venv\requirements.sha1
if not "%REQ_HASH%"=="%OLD_HASH%" (
    echo Updating packages for the new version. This may take a minute...
    .venv\Scripts\python.exe -m pip install -q -r planner\requirements.txt
    if not errorlevel 1 (echo %REQ_HASH%)> .venv\requirements.sha1
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

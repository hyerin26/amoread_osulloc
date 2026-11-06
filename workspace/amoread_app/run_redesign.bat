@echo off
chcp 65001 > nul
cd /d %~dp0
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
rem Redesign branch copy. Port 9751 so it can run next to the main copy (9741) and the mentor original (9731).
set PLANNER_PORT=9751
rem Use the mentor original's venv (same one the 9741 copy runs on; the main copy's .venv has no packages). Only the interpreter is used, nothing there is changed.
rem data\ and planner\data\ here are local copies, not tracked by git.
set VENV_PY=%USERPROFILE%\Downloads\멘토님께받은기존자료\planner_mentee_20261103\planner_mentee\.venv\Scripts\python.exe
if not exist "%VENV_PY%" (
    echo Python venv not found: %VENV_PY%
    pause
    exit /b 1
)
"%VENV_PY%" -m planner.server
if %errorlevel% neq 0 (
    echo.
    echo An error occurred. If already running, open http://127.0.0.1:9751
    pause
)

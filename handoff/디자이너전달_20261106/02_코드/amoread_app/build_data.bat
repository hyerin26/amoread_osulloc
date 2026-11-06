@echo off
chcp 65001 > nul
cd /d %~dp0
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

echo Rebuilding planner data from data\ (sample files are read-only)...
set PY=python
if exist .venv\Scripts\python.exe set PY=.venv\Scripts\python.exe
%PY% -W ignore -m planner.build %*
if %errorlevel% neq 0 (
    echo.
    echo An error occurred. See the message above.
)
pause

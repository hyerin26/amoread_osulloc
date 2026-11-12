@echo off
chcp 65001 > nul
cd /d %~dp0
where py >nul 2>nul && (py -3 setup_env.py %*) || (python setup_env.py %*)
pause

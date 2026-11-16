@echo off
rem 회사 PC 환경 점검: 결과를 env_reports\ 에 저장하고 GitLab env-check 브랜치에 올린다 (tools\env_check.py)
chcp 65001 >nul
cd /d %~dp0
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (
  echo .venv 가 없어요. setup.bat 을 먼저 실행해 주세요.
  pause
  exit /b 1
)
.venv\Scripts\python.exe tools\env_check.py --push
pause

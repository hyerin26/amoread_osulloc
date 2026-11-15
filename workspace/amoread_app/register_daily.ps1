# 매일 자동 확인을 Windows 작업 스케줄러에 등록한다 (PowerShell에서 한 번 실행).
#   powershell -ExecutionPolicy Bypass -File register_daily.ps1 [-At 09:30]
# - 매일 지정 시각 + 로그인할 때마다 실행을 시도한다. 하루 한 번만 실제로 돈다(daily.py가 20시간 안이면 건너뜀).
# - 그 시각에 꺼져 있었으면 켜진 직후(-StartWhenAvailable) 실행, 인터넷이 있을 때만(-RunOnlyIfNetworkAvailable), 실패하면 30분 간격으로 3번 재시도.
# - 이 PC에서 직접 돌려 본 적은 없다(Mac에서만 개발). 처음 한 번 아래 '시험 실행'으로 확인해 주세요.
param([string]$At = "09:30")
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { Write-Error ".venv가 없어요. run_planner.bat을 한 번 실행하거나 requirements를 설치해 주세요."; exit 1 }
$action = New-ScheduledTaskAction -Execute $py -Argument "-m amoread.ai.daily" -WorkingDirectory $root
$triggers = @((New-ScheduledTaskTrigger -Daily -At $At), (New-ScheduledTaskTrigger -AtLogOn))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30) -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "AMOREAD_daily" -Action $action -Trigger $triggers -Settings $settings -Description "AMOREAD 마켓별 신규 프로모션 확인" -Force | Out-Null
Write-Host "등록했어요: 매일 $At + 로그인 시. 시험 실행: Start-ScheduledTask -TaskName AMOREAD_daily"
Write-Host "지우기: Unregister-ScheduledTask -TaskName AMOREAD_daily -Confirm:`$false"

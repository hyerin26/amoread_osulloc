# -*- coding: utf-8 -*-
"""
매일 아침 자동 확인을 화면의 버튼으로 켜고 끄기 (설정 화면 › 매일 아침 자동 확인).

예전에는 PowerShell에서 register_daily.ps1 을 직접 실행해야 했다. 코딩을 모르는 담당자가 켤 수 있게, 같은 일을 서버가 대신 한다.
- Windows: 작업 스케줄러에 'AMOREAD_daily' 등록 (register_daily.ps1 을 그대로 부른다 → 등록 내용은 그 파일 하나에만 있다)
- macOS: 로그인 계정의 LaunchAgents 에 plist 를 두고 launchctl 로 올린다
어느 쪽이든 '매일 정한 시각 + 로그인할 때' daily.py 를 부르고, daily.py 가 하루 한 번만 실제로 돈다 (20시간 안이면 건너뜀).
이 PC의 예약 작업만 만들고 지운다 (관리자 권한 필요 없음). 다른 운영체제에서는 supported=False.
"""
import os
import plistlib
import re
import subprocess
import sys
import threading
from pathlib import Path

from . import daily

ROOT = Path(__file__).resolve().parents[2]
TASK = "AMOREAD_daily"
LABEL = "kr.amoread.daily"
DEFAULT_AT = "09:30"
_run_lock = threading.Lock()
_running = {"on": False}


def _plist() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def _python() -> Path:
    return ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def supported() -> bool:
    return os.name == "nt" or sys.platform == "darwin"


def _sh(*cmd, timeout=40) -> subprocess.CompletedProcess:
    return subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout, cwd=ROOT)


def valid_time(at: str) -> bool:
    m = re.fullmatch(r"(\d{2}):(\d{2})", at or "")
    return bool(m) and int(m.group(1)) < 24 and int(m.group(2)) < 60


def status() -> dict:
    """{supported, on, at, running, last_run, last_ok, results, inspire} — 화면이 그대로 보여 준다."""
    on, at = False, ""
    try:
        if os.name == "nt":
            r = _sh("schtasks", "/Query", "/TN", TASK, "/FO", "LIST", "/V")
            on = r.returncode == 0
            m = re.search(r"(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM|오전|오후)?", r.stdout.split("Start Time", 1)[-1] if "Start Time" in r.stdout else r.stdout.split("시작 시간", 1)[-1] if "시작 시간" in r.stdout else "")
            at = m.group(1).zfill(5) if on and m else ""
        elif sys.platform == "darwin":
            p = _plist()
            if p.exists():
                on = True
                iv = plistlib.loads(p.read_bytes()).get("StartCalendarInterval") or {}
                at = f"{int(iv.get('Hour', 0)):02d}:{int(iv.get('Minute', 0)):02d}"
    except Exception:
        pass
    st = daily.state()
    return {"supported": supported(), "on": on, "at": at or DEFAULT_AT, "running": _running["on"] or daily._lock_path().exists(),
            "last_run": st.get("last_run"), "last_ok": st.get("last_ok"), "results": st.get("results") or {}, "inspire": st.get("inspire"),
            "python_ok": _python().exists()}


def enable(at: str = DEFAULT_AT) -> dict:
    if not supported():
        return {"ok": False, "error": "이 운영체제에서는 자동 실행을 등록할 수 없어요"}
    if not valid_time(at):
        return {"ok": False, "error": "시각은 09:30 처럼 적어 주세요"}
    if not _python().exists():
        return {"ok": False, "error": "프로그램 폴더에 .venv 가 없어요. 설치(setup)를 먼저 해 주세요"}
    try:
        if os.name == "nt":
            r = _sh("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "register_daily.ps1"), "-At", at, timeout=90)
            if r.returncode != 0:
                return {"ok": False, "error": (r.stderr or r.stdout or "등록하지 못했어요").strip()[-300:]}
        else:
            h, m = (int(x) for x in at.split(":"))
            p = _plist()
            p.parent.mkdir(parents=True, exist_ok=True)
            log = ROOT / "planner" / "data" / "ai_collect" / "daily.log"
            log.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(plistlib.dumps({
                "Label": LABEL, "ProgramArguments": [str(_python()), "-m", "amoread.ai.daily"], "WorkingDirectory": str(ROOT),
                "StartCalendarInterval": {"Hour": h, "Minute": m}, "RunAtLoad": True,   # 로그인할 때도 한 번 (그 시각에 꺼져 있었던 날을 위해)
                "StandardOutPath": str(log), "StandardErrorPath": str(log), "ProcessType": "Background"}))
            uid = str(os.getuid())
            _sh("launchctl", "bootout", f"gui/{uid}/{LABEL}")   # 이미 올라가 있으면 내리고 새 시각으로
            r = _sh("launchctl", "bootstrap", f"gui/{uid}", str(p))
            if r.returncode != 0:
                p.unlink(missing_ok=True)
                return {"ok": False, "error": (r.stderr or "등록하지 못했어요").strip()[-300:]}
    except Exception as e:
        return {"ok": False, "error": f"등록하지 못했어요: {type(e).__name__}"}
    return {"ok": True, **status()}


def disable() -> dict:
    try:
        if os.name == "nt":
            r = _sh("schtasks", "/Delete", "/TN", TASK, "/F")
            if r.returncode != 0 and _sh("schtasks", "/Query", "/TN", TASK).returncode == 0:
                return {"ok": False, "error": (r.stderr or "끄지 못했어요").strip()[-300:]}
        elif sys.platform == "darwin":
            _sh("launchctl", "bootout", f"gui/{os.getuid()}/{LABEL}")
            _plist().unlink(missing_ok=True)
    except Exception as e:
        return {"ok": False, "error": f"끄지 못했어요: {type(e).__name__}"}
    return {"ok": True, **status()}


def run_now() -> dict:
    """지금 한 번 돌리기 (백그라운드). 켜져 있지 않아도 된다. 이미 돌고 있으면 그대로 둔다."""
    with _run_lock:
        if _running["on"] or daily._lock_path().exists():
            return {"ok": True, "already": True, **status()}
        _running["on"] = True

    def work():
        try:
            daily.run(force=True)
        except Exception:
            pass
        finally:
            _running["on"] = False
    threading.Thread(target=work, daemon=True).start()
    return {"ok": True, **status()}

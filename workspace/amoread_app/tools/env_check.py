# -*- coding: utf-8 -*-
"""
회사 PC 환경 점검: 이 프로그램이 쓰는 것(외부 사이트 접속, Chrome, 예약 실행, PowerShell, Claude, 파이썬 패키지)이
이 PC에서 되는지 하나씩 시험하고, 결과를 env_reports/ 에 파일로 남긴다. --push 를 주면 env-check 브랜치에 올린다.

  .venv\\Scripts\\python.exe tools\\env_check.py           결과 파일만 만든다
  .venv\\Scripts\\python.exe tools\\env_check.py --push    만들고 env-check 브랜치에 올린다 (env_check.bat 이 이것)

남기지 않는 것: PC 이름·사용자 이름·폴더 경로(~로 바꿈)·프록시 주소·회사 내부 주소. PC는 이름을 바꾼 짧은 코드로만 구분한다.
읽기·접속 시험만 한다. 예약 작업은 시험용 하나를 만들었다가 바로 지운다.
"""
import argparse
import getpass
import hashlib
import json
import os
import platform
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[1]
OUT = REPO / "env_reports"
BRANCH = "env-check"
WIN = os.name == "nt"

# 이 프로그램이 접속하는 곳 (무엇에 쓰는지). 코드에서 모은 목록 — 새 수집처가 생기면 여기에 더한다
SITES = [
    ("마켓 수집", "https://www.osulloc.com/kr/ko/life/event/list/ing"),
    ("마켓 수집", "https://www.kurly.com/main"),
    ("마켓 수집", "https://www.29cm.co.kr/"),
    ("마켓 수집", "https://m.oliveyoung.co.kr/m/mtn"),
    ("마켓 수집", "https://zigzag.kr/"),
    ("트렌드: 뉴스", "https://news.google.com/rss/search?q=%EB%A7%90%EC%B0%A8&hl=ko&gl=KR&ceid=KR:ko"),
    ("트렌드: 검색 급상승", "https://trends.google.com/trending/rss?geo=KR"),
    ("트렌드: 뉴스레터", "https://maily.so/trendaword/feed"),
    ("트렌드: 유튜브", "https://www.youtube.com/"),
    ("트렌드: 유튜브 API", "https://www.googleapis.com/youtube/v3/"),
    ("트렌드: 위키백과", "https://wikimedia.org/api/rest_v1/"),
    ("트렌드: 매거진", "https://www.marieclairekorea.com/"),
    ("트렌드: 매거진", "https://www.vogue.co.kr/"),
    ("트렌드: 매거진", "https://www.elle.co.kr/"),
    ("브리프: 네이버 검색", "https://openapi.naver.com/"),
    ("브리프: 네이버 데이터랩", "https://naverapihub.apigw.ntruss.com/"),
    ("브리프: 네이버 검색광고", "https://api.searchad.naver.com/"),
    ("AI: Claude", "https://api.anthropic.com/"),
    ("AI: Claude 로그인", "https://claude.ai/"),
    ("설치: 파이썬 패키지", "https://pypi.org/simple/"),
    ("설치: 파이썬 패키지", "https://files.pythonhosted.org/"),
    ("코드 받기", "https://gitlab.com/"),
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"


def clean(text: str) -> str:
    """경로·사용자 이름·PC 이름을 지운다."""
    t = str(text or "")
    for v, r in ((str(Path.home()), "~"), (getpass.getuser(), "사용자"), (socket.gethostname(), "이PC")):
        if v and len(v) > 1:
            t = t.replace(v, r)
    t = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "(IP)", t)   # 회사 내부 IP 주소
    return t[:400]


def run(cmd, timeout=40, shell=False):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, shell=shell, encoding="utf-8", errors="replace")
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except FileNotFoundError:
        return 127, "명령을 찾지 못함"
    except subprocess.TimeoutExpired:
        return 124, "시간 초과"
    except OSError as e:
        return 126, f"{type(e).__name__}"


def row(area, name, ok, say, detail=""):
    return {"area": area, "name": name, "ok": ok, "say": say, "detail": clean(detail)}


# ---------- 1. 기본 ----------
def basics():
    out = [row("기본", "운영체제", None, f"{platform.system()} {platform.release()}"),
           row("기본", "파이썬", sys.version_info >= (3, 11), f"{platform.python_version()}" + ("" if sys.version_info >= (3, 11) else " · 3.11 이상 필요"))]
    venv = APP / ".venv"
    out.append(row("기본", "프로그램 환경(.venv)", venv.exists(), "있음" if venv.exists() else "없음 · setup 필요"))
    for mod, why in (("fastapi", "서버"), ("playwright", "화면 수집"), ("httpx", "트렌드 수집"), ("claude_agent_sdk", "AI 기능")):
        try:
            __import__(mod)
            out.append(row("기본", f"패키지 {mod}", True, f"설치됨 ({why})"))
        except Exception as e:   # noqa: BLE001
            out.append(row("기본", f"패키지 {mod}", False, f"없음 ({why})", f"{type(e).__name__}: {e}"))
    return out


# ---------- 2. 네트워크 ----------
def proxy():
    px = urllib.request.getproxies()
    out = [row("네트워크", "프록시(환경변수·시스템)", None, "설정 있음" if px else "설정 없음", "종류: " + ", ".join(sorted(px)) if px else "")]
    if WIN:
        code, txt = run(["netsh", "winhttp", "show", "proxy"])
        has = bool(re.search(r"Proxy Server|프록시 서버", txt)) and not re.search(r"Direct access|직접 액세스", txt)
        out.append(row("네트워크", "프록시(WinHTTP)", None, "설정 있음" if has else "설정 없음"))   # 주소는 남기지 않는다
    return out


def classify(e):
    s = f"{type(e).__name__}: {e}"
    if isinstance(e, ssl.SSLCertVerificationError) or "CERTIFICATE_VERIFY_FAILED" in s:
        return "인증서 확인 실패 (회사 보안 장비가 중간에서 인증서를 바꾸는 경우가 많음)"
    if isinstance(e, socket.gaierror) or "getaddrinfo" in s or "Name or service" in s:
        return "주소를 찾지 못함 (DNS에서 막혔거나 인터넷 안 됨)"
    if isinstance(e, (TimeoutError, socket.timeout)) or "timed out" in s:
        return "시간 초과 (방화벽이 응답 없이 막는 경우가 많음)"
    if "refused" in s.lower():
        return "접속 거부"
    if "reset" in s.lower():
        return "연결이 끊김 (보안 장비가 중간에서 끊는 경우가 많음)"
    return "접속 실패"


def sites():
    out = []
    for why, url in SITES:
        host = url.split("/")[2]
        t = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
            with urllib.request.urlopen(req, timeout=12) as r:
                body = r.read(4000).decode("utf-8", "replace")
                code = r.status
            blocked = re.search(r"차단|접근이 제한|blocked by|access denied|Forcepoint|Zscaler|Symantec|Websense|보안 정책", body, re.I)
            ok = not blocked
            out.append(row("접속", host, ok, f"{'접속됨' if ok else '회사 차단 페이지로 보임'} (HTTP {code}, {time.time() - t:.1f}초)", why))
        except urllib.error.HTTPError as e:   # 서버가 답은 했다 = 길은 열려 있다 (403·404는 사이트 쪽 응답)
            out.append(row("접속", host, e.code < 500 and e.code not in (407,), f"응답 옴 (HTTP {e.code}){' · 프록시 인증 필요' if e.code == 407 else ''}", why))
        except Exception as e:   # noqa: BLE001
            reason = classify(getattr(e, "reason", e) if isinstance(getattr(e, "reason", None), BaseException) else e)
            out.append(row("접속", host, False, reason, f"{why} · {type(e).__name__}: {e}"))
    return out


# ---------- 3. Chrome ----------
def chrome():
    out = []
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:   # noqa: BLE001
        return [row("Chrome", "화면 수집 도구", False, "playwright 없음", str(e))]
    for name, kw in (("Chrome 켜기 (수정된 방식)", {"ignore_default_args": ["--disable-extensions"]}), ("Chrome 켜기 (기본 방식)", {})):
        try:
            with sync_playwright() as p:
                br = p.chromium.launch(channel="chrome", headless=True, timeout=60000, **kw)
                pg = br.new_page()
                try:
                    pg.goto("https://www.29cm.co.kr/", timeout=30000)
                    say = f"켜짐 · 29CM 열림 ({pg.title()[:30]})"
                except Exception as e:   # noqa: BLE001
                    say = f"켜졌지만 페이지를 못 엶 ({type(e).__name__})"
                br.close()
            out.append(row("Chrome", name, True, say))
        except Exception as e:   # noqa: BLE001
            out.append(row("Chrome", name, False, "켜지지 않음", f"{type(e).__name__}: {str(e)[:300]}"))
    return out


# ---------- 4. 예약 실행 · PowerShell ----------
def schedule():
    if not WIN:
        return [row("예약 실행", "작업 스케줄러", None, "Windows가 아니라 건너뜀")]
    out = []
    name = "AMOREAD_envcheck_test"
    code, txt = run(["schtasks", "/Create", "/TN", name, "/SC", "ONCE", "/ST", "23:59", "/TR", "cmd /c exit", "/F"])
    out.append(row("예약 실행", "예약 작업 만들기", code == 0, "됨" if code == 0 else "막힘", txt))
    if code == 0:
        run(["schtasks", "/Delete", "/TN", name, "/F"])
    code, txt = run(["schtasks", "/Query", "/TN", "AMOREAD_daily", "/V", "/FO", "LIST"])
    if code == 0:
        last = re.search(r"(Last Result|마지막 결과):\s*(\S+)", txt)
        when = re.search(r"(Last Run Time|마지막 실행 시간):\s*(.+)", txt)
        out.append(row("예약 실행", "매일 아침 자동 확인 등록", True, f"등록돼 있음 · 마지막 실행 {when.group(2).strip() if when else '-'} · 결과 코드 {last.group(2) if last else '-'}"))
    else:
        out.append(row("예약 실행", "매일 아침 자동 확인 등록", False, "등록 안 됨 (설정 화면에서 켜기)"))
    code, txt = run(["powershell", "-NoProfile", "-Command", "Get-ExecutionPolicy -List | Format-Table -HideTableHeaders | Out-String"])
    out.append(row("PowerShell", "스크립트 실행 정책", None, " / ".join(" ".join(l.split()) for l in txt.splitlines() if l.strip())[:200] or "-"))
    ps = Path(tempfile.gettempdir()) / "amoread_envcheck.ps1"
    ps.write_text("Write-Output ok", encoding="utf-8")
    code, txt = run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps)])
    ps.unlink(missing_ok=True)
    out.append(row("PowerShell", "스크립트 실행 (자동 실행 등록에 씀)", code == 0 and "ok" in txt, "됨" if code == 0 and "ok" in txt else "막힘", txt))
    code, txt = run(["powershell", "-NoProfile", "-Command", "(Get-AppLockerPolicy -Effective).RuleCollections.Count"])
    out.append(row("PowerShell", "프로그램 실행 제한(AppLocker)", None, f"규칙 묶음 {txt.strip()}개" if code == 0 and txt.strip().isdigit() else "확인 못 함"))
    return out


# ---------- 5. Claude ----------
def claude():
    path = shutil.which("claude") or (str(Path.home() / ".local" / "bin" / ("claude.exe" if WIN else "claude")) if (Path.home() / ".local" / "bin" / ("claude.exe" if WIN else "claude")).exists() else "")
    if not path:
        return [row("AI", "Claude Code", False, "설치 안 됨 (AI 기능·트렌드 아이디어에 필요)")]
    cmd = ["cmd.exe", "/d", "/c", path] if WIN and path.lower().endswith((".cmd", ".bat")) else [path]
    code, txt = run(cmd + ["auth", "status"])
    try:
        logged = bool(json.loads(txt[txt.find("{"):txt.rfind("}") + 1]).get("loggedIn"))
    except ValueError:
        logged = False
    return [row("AI", "Claude Code", True, "설치됨"), row("AI", "Claude 로그인", logged, "로그인됨" if logged else "로그인 안 됨 (터미널에서 claude auth login)")]


# ---------- 6. 지난 자동 확인 기록 ----------
def last_daily():
    f = APP / "planner" / "data" / "ai_collect" / "daily.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [row("자동 확인 기록", "daily.json", None, "기록 없음 (한 번도 안 돌았음)")]
    out = [row("자동 확인 기록", "마지막 실행", None, f"{d.get('last_run') or '-'} · 마지막 성공 {d.get('last_ok') or '-'}")]
    for k, r in (d.get("results") or {}).items():
        out.append(row("자동 확인 기록", k, bool(r.get("ok")), f"{'성공' if r.get('ok') else '실패'} · {r.get('at', '')}", r.get("error", "")))
    return out


def write(rows):
    OUT.mkdir(exist_ok=True)
    pc = hashlib.sha1(socket.gethostname().encode()).hexdigest()[:6]
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    base = OUT / f"{stamp}_{platform.system().lower()}_{pc}"
    (base.with_suffix(".json")).write_text(json.dumps({"at": stamp, "pc": pc, "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    mark = {True: "✅", False: "❌", None: "ℹ️"}
    bad = [r for r in rows if r["ok"] is False]
    lines = [f"# 환경 점검 · {stamp} · PC {pc}", "",
             f"막힌 것 {len(bad)}개 / 전체 {len(rows)}개 (✅ 됨 · ❌ 막힘 · ℹ️ 참고)", ""]
    if bad:
        lines += ["## 막힌 것", ""] + [f"- ❌ **{r['area']} · {r['name']}**: {r['say']}" + (f" — {r['detail']}" if r['detail'] else "") for r in bad] + [""]
    area = None
    for r in rows:
        if r["area"] != area:
            area = r["area"]; lines += ["", f"## {area}", "", "| | 항목 | 결과 | 참고 |", "|---|---|---|---|"]
        lines.append(f"| {mark[r['ok']]} | {r['name']} | {r['say']} | {r['detail'].replace('|', '/')} |")
    base.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return base


def push(base):
    code, br = run(["git", "-C", str(REPO), "rev-parse", "--abbrev-ref", "HEAD"])
    if br.strip() != BRANCH:
        print(f"\n지금 브랜치가 {br.strip()} 예요. 결과를 올리려면 먼저: git switch {BRANCH}   (결과 파일은 {base.name}.md 로 저장됐어요)")
        return False
    files = [str(base.with_suffix(".md")), str(base.with_suffix(".json"))]
    for cmd in (["git", "-C", str(REPO), "pull", "--rebase", "--autostash", "origin", BRANCH],
                ["git", "-C", str(REPO), "add", "--", *files],
                ["git", "-C", str(REPO), "commit", "-m", f"환경 점검 결과 {base.name}", "--", *files],
                ["git", "-C", str(REPO), "push", "origin", BRANCH]):
        code, txt = run(cmd, timeout=120)
        if code != 0:
            print("\n올리지 못했어요:", clean(txt)[-300:])
            return False
    print("\nGitLab env-check 브랜치에 올렸어요.")
    return True


def main():
    try:   # Windows 기본 콘솔(cp949)에서 ✅ 같은 글자를 찍다 멈추지 않게
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:   # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description="회사 PC 환경 점검")
    ap.add_argument("--push", action="store_true", help="결과를 env-check 브랜치에 올림")
    ap.add_argument("--no-chrome", action="store_true", help="Chrome 시험 건너뛰기")
    a = ap.parse_args()
    rows = []
    for name, fn in (("기본", basics), ("네트워크", proxy), ("사이트 접속", sites), ("Chrome", None if a.no_chrome else chrome),
                     ("예약 실행", schedule), ("Claude", claude), ("자동 확인 기록", last_daily)):
        if not fn:
            continue
        print(f"점검 중: {name}…", flush=True)
        try:
            rows += fn()
        except Exception as e:   # noqa: BLE001 - 한 항목이 깨져도 나머지는 점검
            rows.append(row(name, "점검 자체", False, "점검 중 오류", f"{type(e).__name__}: {e}"))
    base = write(rows)
    bad = [r for r in rows if r["ok"] is False]
    print(f"\n완료: 막힌 것 {len(bad)}개 / 전체 {len(rows)}개 → {base.name}.md")
    for r in bad:
        print(f"  ❌ {r['area']} · {r['name']}: {r['say']}")
    if a.push:
        push(base)


if __name__ == "__main__":
    main()

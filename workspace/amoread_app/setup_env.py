# -*- coding: utf-8 -*-
"""
처음 받은 PC에서 바로 실행되게 맞춰 주는 설정 도구 (Windows·Mac 공통).

  python setup_env.py [--snapshot 스냅샷.zip 또는 폴더] [--no-capture] [--run]

하는 일 (이미 된 것은 건너뛰므로 여러 번 실행해도 된다)
1. 파이썬 버전 확인 → .venv 만들기 → planner/requirements.txt 설치
   (화면 수집용 playwright는 --no-capture 로 뺄 수 있다. 설치가 안 돼도 앱은 뜬다)
2. 레퍼런스 데이터(planner/data/ai_refs 등) 넣기: 깃에는 데이터가 올라가지 않는다(.gitignore).
   초기 데이터는 레포에 폴더 그대로 들어 있어 풀 필요가 없다(.gitignore 에서 레퍼런스 데이터 폴더만 추적). 없을 때만 --snapshot 이나 환경변수 AMOREAD_SNAPSHOT_DIR 의 스냅샷을 불러온다.
   스냅샷이 없으면 데이터 없이 진행하고, 레퍼런스가 비는 이유와 받는 방법을 알려 준다 (구좌 추천은 데이터 없이도 된다).
3. planner/data/planner_data.json 이 없으면 만든다 (run_planner.bat 과 같은 단계)
4. 점검: 앱 코드가 불러지는지, 레퍼런스가 몇 건 들어갔는지 확인해 알려 준다
5. 실행 방법을 알려 준다 (--run 이면 바로 서버를 띄운다)

데이터를 어디서 받나: 수집 담당(데이터를 만드는 PC)이 `python -m amoread.ai.snapshot_pack export --out <공유 폴더>` 로 올린 zip.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
DATA = ROOT / "planner" / "data"


def say(msg=""):
    print(msg, flush=True)


def run(*cmd, check=True, **kw):
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    return subprocess.run([str(c) for c in cmd], cwd=ROOT, env=env, check=check, **kw)


def step_venv(capture: bool):
    say("1) 파이썬 환경")
    if sys.version_info < (3, 10):
        sys.exit(f"   파이썬 3.10 이상이 필요해요 (지금 {sys.version.split()[0]}). 새 버전을 설치한 뒤 다시 실행해 주세요.")
    if not PY.exists():
        say("   .venv 만드는 중…")
        run(sys.executable, "-m", "venv", VENV)
    run(PY, "-m", "pip", "install", "-q", "--disable-pip-version-check", "pip-system-certs")   # 사내망 인증서(없으면 무시)
    say("   필요한 패키지 설치 중… (처음엔 몇 분 걸려요)")
    run(PY, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-r", ROOT / "planner" / "requirements.txt")
    if capture:
        r = run(PY, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-r", ROOT / "planner" / "requirements-capture.txt", check=False)
        say("   화면 수집 도구(playwright) " + ("설치됨 (이 PC의 Chrome을 써요)" if r.returncode == 0 else "설치 못 함 — 화면 수집·신규 찾기 기능만 빠지고 나머지는 돼요"))
    say("   완료")


def step_data(snapshot: str | None):
    say("2) 레퍼런스 데이터")
    if (DATA / "ai_refs" / "pages.json").exists():
        say("   이미 있어요 (건너뜀)")
        return True
    src = snapshot or os.getenv("AMOREAD_SNAPSHOT_DIR")
    if src and Path(src).exists():
        say(f"   스냅샷 불러오는 중: {src}")
        r = run(PY, "-m", "amoread.ai.snapshot_pack", "import", src, "--yes", check=False)
        if r.returncode == 0:
            return True
        say("   스냅샷을 불러오지 못했어요 (위 메시지 확인)")
    else:
        say("   스냅샷이 없어요." + (f" (경로를 찾지 못함: {src})" if src else ""))
    say("   → 레퍼런스 추천은 비어 있고 구좌 추천만 나와요. 데이터를 받으려면:")
    say("     · 수집 담당에게 스냅샷 zip(또는 공유 폴더 경로)을 받아 `python setup_env.py --snapshot <zip 또는 폴더>`")
    say("     · 또는 직접 색인을 만들려면 amoread/ai/README.md 의 '색인 만들기' 참고")
    return False


def step_planner_data():
    say("3) 기본 데이터")
    if (DATA / "planner_data.json").exists():
        say("   이미 있어요 (건너뜀)")
        return
    say("   처음 만드는 중…")
    r = run(PY, "-W", "ignore", "-m", "planner.build", check=False)
    say("   완료" if r.returncode == 0 else "   건너뜀: 샘플 원본 파일이 없어 못 만들었어요. 레퍼런스·구좌 추천에는 영향 없어요 (원가·일정 같은 다른 화면만 제한)")


def step_check():
    say("4) 점검")
    code = ("import json;from amoread.ai import library;from amoread import references;d=library.items();"
            "own=len(json.loads(references.FILE.read_text(encoding='utf-8')).get('items',[])) if references.FILE.exists() else 0;"
            "print(json.dumps({'mode':d.get('mode'),'sec':d.get('counts',{}).get('sec',0),'own':own},ensure_ascii=False))")
    r = run(PY, "-c", code, check=False, capture_output=True, text=True)
    if r.returncode != 0:
        say("   앱 코드를 불러오지 못했어요:\n" + (r.stderr or r.stdout)[-600:])
        return False
    import json
    d = json.loads(r.stdout.strip().splitlines()[-1])
    if d["mode"] == "demo" or (d["sec"] == 0 and d["own"] == 0):
        say("   앱은 뜨지만 레퍼런스 데이터가 비어 있어요 (레퍼런스 추천이 안 붙어요)")
    else:
        say(f"   정상: 레퍼런스 {d['own']}건 · 검색용 구좌 {d['sec']}개 불러옴")
    return True


def main():
    ap = argparse.ArgumentParser(description="처음 받은 PC에서 바로 실행되게 설정")
    ap.add_argument("--snapshot", help="스냅샷 zip 파일 또는 스냅샷이 모인 폴더")
    ap.add_argument("--no-capture", action="store_true", help="화면 수집 도구(playwright)는 설치하지 않음")
    ap.add_argument("--run", action="store_true", help="설정 후 바로 서버 실행")
    a = ap.parse_args()
    say("AMOREAD 설정 시작\n")
    step_venv(not a.no_capture)
    ok = step_data(a.snapshot)
    step_planner_data()
    healthy = step_check()
    run_cmd = f"{PY} -m planner.server"
    say(f"\n끝났어요{'' if ok else ' (레퍼런스 데이터 없이)'}. 실행: {run_cmd}   → 브라우저에서 http://127.0.0.1:9731")
    if a.run and healthy:
        run(PY, "-m", "planner.server", check=False)


if __name__ == "__main__":
    main()

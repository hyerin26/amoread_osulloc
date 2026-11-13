# -*- coding: utf-8 -*-
"""화면 훑어보기 (개발자용, 선택): 서버를 따로 띄워 화면들을 실제 브라우저로 열고, 콘솔 오류·가로 넘침·깨진 이미지·멈춘 크롭을 찾는다.
실행: .venv/bin/python tests/e2e_smoke.py        (Chrome과 playwright가 있을 때. 기획안 파일은 건드리지 않는다: 기획안 번호 없이 연다)
이 PC의 원가·일정 엑셀이 없어서 나는 409 오류는 알려진 것이라 건너뛴다."""
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 9731
KNOWN = ("409 (Conflict)",)   # 원천 엑셀이 없는 PC에서 /api/products·seasons·calendar·review가 주는 응답


def up() -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def main() -> int:
    from playwright.sync_api import sync_playwright
    proc = None
    if not up():
        proc = subprocess.Popen([str(ROOT / ".venv" / "bin" / "python"), "-m", "planner.server", "--no-browser"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(40):
            if up():
                break
            time.sleep(0.5)
    bad = []
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="chrome")
            for w, h in ((1440, 900), (390, 844)):
                pg = br.new_page(viewport={"width": w, "height": h})
                errs = []
                pg.on("console", lambda m: errs.append(m.text[:140]) if m.type == "error" and not any(k in m.text for k in KNOWN) else None)
                pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)[:140]))
                for path in ("/v2/library", "/v2/compose", "/v2/editor", "/v2/brief", "/v2/preview", "/v2/home", "/v2/settings"):
                    errs.clear()
                    pg.goto(f"http://127.0.0.1:{PORT}{path}")
                    pg.wait_for_timeout(2000)
                    m = pg.evaluate("({sw: document.documentElement.scrollWidth, iw: innerWidth, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).length})")
                    if m["sw"] > m["iw"] + 1:
                        errs.append(f"가로로 넘쳐요 ({m['sw']}>{m['iw']})")
                    if m["broken"]:
                        errs.append(f"깨진 이미지 {m['broken']}개")
                    if path == "/v2/library":   # 구좌 사례 탭: 보이는 크롭이 전부 그려지는가
                        pg.evaluate("document.querySelectorAll('#tabs [role=tab]')[1].click()")
                        pg.wait_for_timeout(4000)
                        st = pg.evaluate("(() => { const a = [...document.querySelectorAll('[data-crop]')].filter(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }); return [a.length, a.filter(e => e.dataset.done).length]; })()")
                        if st[0] and st[0] != st[1]:
                            errs.append(f"보이는 크롭 {st[0]}개 중 {st[1]}개만 처리됐어요")
                    for e in errs:
                        bad.append(f"{w}px {path}: {e}")
                pg.close()
            br.close()
    finally:
        if proc:
            proc.terminate()
    print("\n".join(bad) if bad else "화면 훑어보기: 문제 없음")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

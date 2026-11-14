# -*- coding: utf-8 -*-
"""버튼 일괄 눌러 보기 (개발자용, 선택): v2 화면마다 보이는 버튼·탭을 하나씩 실제로 눌러 오류(화면 멈춤·서버 오류·느린 반응)를 찾는다.
실행: .venv/bin/python tests/e2e_click_sweep.py [기획안 id]
주의: 진짜로 누르므로 기획안·즐겨찾기가 바뀔 수 있다. **실행 전에 planner/data 를 백업하고 끝나면 되돌릴 것.** (삭제·수집·외부 접속 버튼은 건너뛴다)"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 9731
KNOWN = ("409 (Conflict)",)
SKIP = ("삭제", "수집 시작", "신규 확인", "다시 확인", "보드 추가", "선택한", "로그아웃", "초기화", "예전 화면", "PDF", "인쇄")
PAGES = ("home", "brief", "compose", "editor", "preview", "deals", "settings", "library", "inspire")
SEL = "button, [role=tab], summary, [data-open], a[href^='#']"

JS_LIST = """(sel) => [...document.querySelectorAll(sel)].map((e, i) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
  return { i, t: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40), ok: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.disabled,
    k: [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name).join(' ') || e.id || e.className.toString().slice(0, 30), dlg: !!e.closest('dialog') }; })"""


def sweep(pg, url, name, out, depth_limit=70):
    errs = []
    pg.on("console", lambda m: errs.append("console: " + m.text[:160]) if m.type == "error" and not any(k in m.text for k in KNOWN) else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)[:200]))
    pg.on("response", lambda r: errs.append(f"HTTP {r.status} {r.request.method} {r.url.split(str(PORT))[-1][:80]}") if r.status >= 400 and r.status != 409 else None)
    pg.on("dialog", lambda d: d.dismiss())
    pg.goto(url); pg.wait_for_timeout(1800)
    for e in errs:
        out.append(f"{name} [열기]: {e}")
    seen = set()
    for _ in range(depth_limit):
        items = pg.evaluate(JS_LIST, SEL)
        nxt = next((x for x in items if x["ok"] and (x["k"], x["t"]) not in seen and not any(s in x["t"] for s in SKIP)), None)
        if not nxt:
            break
        seen.add((nxt["k"], nxt["t"]))
        errs.clear()
        try:
            ms = pg.evaluate("""async ([sel, i]) => { const e = document.querySelectorAll(sel)[i]; const t = performance.now(); e.click();
                await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); return performance.now() - t; }""", [SEL, nxt["i"]])
        except Exception as ex:   # 눌러서 다른 화면으로 넘어간 경우
            ms = 0
            if "navigat" not in str(ex).lower() and "context" not in str(ex).lower():
                errs.append("click 실패: " + str(ex)[:120])
        pg.wait_for_timeout(350)
        if ms > 400:
            errs.append(f"느림: 누른 뒤 {ms:.0f}ms 동안 화면이 멈춤")
        for e in dict.fromkeys(errs):
            out.append(f"{name} [{nxt['t'] or nxt['k']}]: {e}")
        if pg.url.split("#")[0] != url.split("#")[0]:
            pg.goto(url); pg.wait_for_timeout(1200)
        elif not nxt["dlg"]:   # 창 밖 버튼을 누른 뒤 열린 창은, 그 안 버튼도 눌러 보도록 그대로 둔다 (다음 바퀴에서 dlg 버튼이 먼저 잡힘)
            pass
        # 창 안 버튼을 다 눌렀으면 닫는다
        left = [x for x in pg.evaluate(JS_LIST, SEL) if x["ok"] and x["dlg"] and (x["k"], x["t"]) not in seen and not any(s in x["t"] for s in SKIP)]
        if not left:
            pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    return len(seen)


def main() -> int:
    from playwright.sync_api import sync_playwright
    pid = sys.argv[1] if len(sys.argv) > 1 else ""
    out, n = [], {}
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome")
        for page in PAGES:
            for mode, q in (("예시", ""), ("기획안", f"?id={pid}" if pid else None)):
                if q is None or (q and page in ("home", "settings", "library", "inspire")):
                    continue
                pg = br.new_page(viewport={"width": 1440, "height": 900})
                n[f"{page}/{mode}"] = sweep(pg, f"http://127.0.0.1:{PORT}/v2/{page}{q}", f"{page}({mode})", out)
                pg.close()
        br.close()
    print(json.dumps(n, ensure_ascii=False))
    print("\n".join(out) if out else "문제 없음")
    return 1 if out else 0


if __name__ == "__main__":
    sys.exit(main())

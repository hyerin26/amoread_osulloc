# -*- coding: utf-8 -*-
"""Green UI 충돌 비교: 실행 중인 앱의 기존 편집기(/v2/editor)와 신규 편집기(/v2/editor-next)를 각각 열어
같은 역할의 컴포넌트를 계산된 CSS 값과 요소 스크린샷으로 비교한다. 값은 브라우저에서 잰 것만 쓴다(추정 값 없음).

    python green_ui_compare.py --base http://127.0.0.1:9751 --label before   # 정렬 CSS(editor-next-greenui.css)를 막고 잼
    python green_ui_compare.py --base http://127.0.0.1:9751 --label after    # 지금 상태로 잼 + report.html

판정: 일치 = 비교한 속성이 모두 같음 / 충돌 발견 = 하나라도 다름 / 비교 불가 = 한쪽에 해당 요소가 없음
iframe을 쓰지 않는 이유: 앱 서버가 X-Frame-Options DENY, 두 화면 CSS를 한 문서에 섞으면 클래스가 겹쳐 값이 왜곡된다.
"""
import argparse
import html
import json
import re
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "green-ui-compare"
DEMO_TOKENS = Path(__file__).resolve().parents[1] / "editor" / "v1.12" / "tokens.demo.css"
ALIGN_CSS = "**/editor-next-greenui.css"

BOX = ["background-color", "color", "border-top-width", "border-top-style", "border-top-color", "border-top-left-radius",
       "height", "padding-left", "font-size", "font-weight", "line-height", "font-family", "box-shadow"]
TEXT = ["color", "font-size", "font-weight", "line-height", "font-family"]
CARD = ["background-color", "border-top-width", "border-top-color", "border-top-left-radius", "box-shadow", "padding-left"]
FOCUS = ["outline-style", "outline-width", "outline-color", "outline-offset", "border-top-color", "box-shadow"]

# (분류, 항목, 기존 선택자, 신규 선택자, 속성, 준비(기존, 신규), 메모)
# 준비: None | "focus" | "modal" | "toast" | "disable" | "invalid" | "click:선택자" (그 선택자를 누른 뒤 잼)
ITEMS = [
    ("버튼", "주요 버튼", ".btn.sm.primary", ".am-ed-button--primary", BOX, (None, "click:#changeLayout"), "신규: 구좌 유형 대화상자의 [적용]"),
    ("버튼", "보조 버튼", "#xlsDown", "#exportDemo", BOX, (None, None), ""),
    ("버튼", "텍스트형(고스트) 버튼", "a.btn.sm.ghost", "#undo", BOX, (None, None), "기존 편집기의 실행 취소·이동 링크와 같은 역할"),
    ("버튼", "작은 버튼", ".btn.xs", ".am-ed-button--sm", BOX, (None, None), "기존 .btn.xs는 고스트형만 있음"),
    ("버튼", "비활성 텍스트 버튼", "#xlsDown", "#exportDemo", BOX + ["opacity", "cursor"], ("disable", "disable"), "양쪽 같은 버튼에 disabled를 걸고 잼"),
    ("버튼", "비활성 아이콘 버튼(순서 이동)", "#secList .ib:disabled", "[data-list-action]:disabled", ["color", "opacity", "cursor", "background-color"], (None, None), "맨 위 구좌의 [위로]"),
    ("버튼", "키보드 포커스(주요 버튼)", ".btn.sm.primary, .v2plan .v2btn.primary", ".am-ed-button--primary", FOCUS, ("focus", "click:#changeLayout|focus"), ""),
    ("입력", "한 줄 입력창", "#panel input[type=text]", "#panel-body .am-ed-input", BOX, (None, None), "높이 44px는 DS field-height·앱 --control-lg 기준이라 신규를 유지"),
    ("입력", "입력창 포커스", "#panel input[type=text]", "#panel-body .am-ed-input", FOCUS, ("focus", "focus"), ""),
    ("입력", "여러 줄 입력창", "#panel textarea", "#panel-body .am-ed-textarea", BOX, ("click:#panel [data-tab=copy]", None), "높이는 줄 수에 따라 다름"),
    ("입력", "선택창(select)", "#panel select", ".am-ed-select", BOX, (None, None), "신규 기본 화면에 select 없음(유형은 대화상자로 고름)"),
    ("입력", "체크박스", "#panel input[type=checkbox]", ".inspector input[type=checkbox]", ["width", "height", "accent-color", "appearance"], (None, None), ""),
    ("입력", "라디오 버튼", "input[type=radio]", "input[type=radio]", ["width", "height", "accent-color"], (None, None), "양쪽 모두 라디오 대신 선택형 버튼 사용"),
    ("입력", "선택형 버튼(안 눌림)", ".chip", ".am-ed-choice button[aria-pressed=false]", BOX, (None, "click:[data-ia-group=layout]"), "신규: 배치·표시 탭의 선택지"),
    ("입력", "오류 상태 입력창", "[aria-invalid=true]", ".am-ed-field .am-ed-input", BOX, (None, "invalid"), "기존 편집기 컴포넌트에 오류 입력 규칙이 없음. 신규는 토큰 --err-line"),
    ("탭", "탭(선택됨)", ".seg > button[aria-selected=true]", ".ia-group-btn[aria-selected=true]", BOX, (None, None), ""),
    ("탭", "탭(선택 안 됨)", ".seg > button[aria-selected=false]", ".ia-group-btn[aria-selected=false]", BOX, (None, None), ""),
    ("카드", "편집 패널 카드", "aside.card.panel", "aside.inspector", CARD, (None, None), ""),
    ("카드", "구좌 목록 카드", "nav.card.list", "aside.outline", CARD, (None, None), ""),
    ("선택", "구좌 목록 항목(선택됨)", "#secList button[aria-current=true]", ".outline-item[aria-current=true]", CARD, (None, None), "D-054: 배경 없이 --sel-line 1px"),
    ("아코디언", "접고 펴는 묶음", "details", "details", BOX, (None, None), "기존 편집기에 아코디언 컴포넌트 없음"),
    ("모달", "대화상자", "#dlg", "#typeDialog", CARD + ["width"], ("modal", "modal"), "너비는 22개 유형 미리보기 때문에 신규 유지"),
    ("툴바", "도구 막대", ".head .acts", ".en-tools .topstatus", ["background-color", "border-top-width", "column-gap"], (None, None), ""),
    ("알림", "토스트", ".toast", "#toast", ["background-color", "color", "border-top-left-radius", "font-size", "padding-left"], ("toast", "toast"), ""),
    ("글자", "화면 제목", ".head h1", ".center-head h2", TEXT, (None, None), ""),
    ("글자", "패널 제목", "#panel h2, #panel h3", ".inspector-head h2", TEXT, (None, None), ""),
    ("글자", "본문", "body", "body", TEXT, (None, None), ""),
    ("글자", "보조 문구(캡션)", ".cap", ".am-ed-group__description, .outline-desc", TEXT, (None, None), ""),
]

MEASURE = r"""async ([sel, props, prep]) => {
  const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length) || document.querySelector(sel);
  if (!el) return null;
  if (prep === 'modal' && el.showModal && !el.open) el.showModal();
  if (prep === 'toast') { el.hidden = false; el.classList.add('on'); el.textContent ||= '저장했어요'; }
  if (prep === 'disable') el.disabled = true;
  if (prep === 'invalid') el.setAttribute('aria-invalid', 'true');
  let t = el;
  if (prep === 'focus') { el.focus(); if (!el.isConnected && document.activeElement) t = document.activeElement; }   // 포커스로 다시 그려진 경우
  if (prep) await new Promise(r => setTimeout(r, 300));   // 상태 전환(transition .12s)이 끝난 값을 잰다
  const cs = getComputedStyle(t), out = {};
  for (const p of props) out[p] = cs.getPropertyValue(p).trim();
  t.setAttribute('data-gc-target', '1');
  return out;
}"""
RESET = """() => { document.querySelectorAll('[data-gc-target]').forEach(e => e.removeAttribute('data-gc-target'));
  document.querySelectorAll('dialog[open]').forEach(d => d.close()); }"""


def measure(page, url, side):
    res = {}
    for i, (cat, name, old_sel, new_sel, props, preps, note) in enumerate(ITEMS):
        page.goto(url, wait_until="networkidle")   # 항목마다 새로 열어 앞 항목의 준비 동작이 남지 않게
        page.wait_for_timeout(300)
        sel, prep = (old_sel, preps[0]) if side == "old" else (new_sel, preps[1])
        page.evaluate(RESET)
        if prep and prep.startswith("click:"):
            target, _, prep = prep[6:].partition("|")   # "click:선택자|focus" = 누른 뒤 포커스
            try:
                page.click(target, timeout=3000)
                page.wait_for_timeout(300)
            except Exception:
                pass
            prep = prep or None
        if prep == "focus":
            page.keyboard.press("Tab")   # 이후 focus()가 키보드 포커스(:focus-visible)로 그려지게
        vals = page.evaluate(MEASURE, [sel, props, prep])
        shot = None
        if vals is not None:
            shot = f"{side}_{i:02d}.png"
            try:
                page.locator("[data-gc-target]").first.screenshot(path=str(OUT / shot), timeout=3000)
            except Exception:
                shot = None   # 화면 밖·크기 0 (값은 기록)
        res[name] = {"values": vals, "shot": shot, "selector": sel}
    return res


def tokens(page, url):
    """tokens.demo.css(v1.12 단독 실행 값) vs 앱이 실제로 계산한 :root 값(/static/tokens.css + v2/shell.css)."""
    demo = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", DEMO_TOKENS.read_text("utf-8")))
    page.goto(url, wait_until="networkidle")
    app = page.evaluate("names => Object.fromEntries(names.map(n => [n, getComputedStyle(document.documentElement).getPropertyValue(n).trim()]))", list(demo))
    def norm(v):   # 표기만 다른 값(#fff/#ffffff, .08/0.08, 따옴표·공백)은 같은 값으로
        v = re.sub(r"[\s'\"]", "", v.lower())
        v = re.sub(r"#([0-9a-f])([0-9a-f])([0-9a-f])\b", r"#\1\1\2\2\3\3", v)
        return re.sub(r"(?<![\d.])0\.", ".", v)
    rows = []
    for k, v in demo.items():
        a = app.get(k, "")
        rows.append({"token": k, "demo": v.strip(), "app": a, "status": "비교 불가" if not a else "일치" if norm(a) == norm(v) else "충돌 발견"})
    return rows


def compare(old, new, props):
    if old is None or new is None:
        return "비교 불가", []
    return ("충돌 발견" if any(old.get(p) != new.get(p) for p in props) else "일치"), [(p, new[p], old[p]) for p in props if old.get(p) != new.get(p)]


def report(data, before):
    esc = html.escape
    badge = {"일치": "ok", "충돌 발견": "bad", "비교 불가": "na"}
    rows, counts = [], dict.fromkeys(badge, 0)
    for cat, name, old_sel, new_sel, props, _, note in ITEMS:
        o, n = data["old"][name], data["new"][name]
        st, diffs = compare(o["values"], n["values"], props)
        counts[st] += 1
        bo, bn = before["old"][name]["values"], before["new"][name]["values"]
        b_st, b_diffs = compare(bo, bn, props)
        img = lambda s: f'<img src="{esc(s)}" alt="">' if s else '<span class="na b">요소 없음·화면 밖</span>'
        fixed = [(p, bv, n["values"][p]) for p, bv, _ in b_diffs if n["values"] and n["values"].get(p) != bv]
        cell = ""
        if fixed:
            cell += '<table class="d"><tr><th>바꾼 속성</th><th>현재 값(v1.12)</th><th>변경 후 값</th></tr>' + "".join(
                f"<tr><td>{esc(p)}</td><td>{esc(str(b))}</td><td>{esc(str(a))}</td></tr>" for p, b, a in fixed) + "</table>"
        if diffs:
            cell += '<table class="d"><tr><th>남은 차이</th><th>신규</th><th>기존 Green UI</th></tr>' + "".join(
                f"<tr><td>{esc(p)}</td><td>{esc(str(a))}</td><td>{esc(str(b))}</td></tr>" for p, a, b in diffs) + "</table>"
        if st == "비교 불가":
            side = n["values"] or o["values"]
            cell += f'<div class="sel">잰 쪽 값: {esc(json.dumps(side, ensure_ascii=False)) if side else "양쪽 모두 없음"}</div>'
        rows.append(f"""<tr><td>{esc(cat)}</td><td><b>{esc(name)}</b><div class="sel">기존 <code>{esc(old_sel)}</code><br>신규 <code>{esc(new_sel)}</code></div>{f'<div class="sel">{esc(note)}</div>' if note else ''}</td>
<td>{img(o['shot'])}</td><td>{img(n['shot'])}</td>
<td><span class="b {badge[st]}">{st}</span><div class="sel">정렬 전: {esc(b_st)}</div></td><td>{cell}</td></tr>""")
    tok = "".join(f'<tr><td><code>{esc(r["token"])}</code></td><td>{esc(r["demo"])}</td><td>{esc(r["app"])}</td><td><span class="b {badge[r["status"]]}">{r["status"]}</span></td></tr>' for r in data["tokens"])
    tc = {s: sum(r["status"] == s for r in data["tokens"]) for s in badge}
    bc = dict.fromkeys(badge, 0)
    for it in ITEMS:
        bc[compare(before["old"][it[1]]["values"], before["new"][it[1]]["values"], it[4])[0]] += 1
    (OUT / "report.html").write_text(f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>Green UI 충돌 비교</title>
<style>body{{font:14px/1.5 system-ui,'Malgun Gothic',sans-serif;margin:24px;color:#141414}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #dedede;padding:6px;vertical-align:top;text-align:left}}
img{{max-width:260px;max-height:160px;border:1px dashed #adadad}}.b{{padding:2px 8px;border-radius:8px;font-weight:600;white-space:nowrap}}.ok{{background:#eef5ef;color:#007a46}}.bad{{background:#fff0ec;color:#b52e10}}.na{{background:#f3f3f3;color:#666}}
.sel{{color:#666;font-size:12px}}table.d{{margin-top:6px;font-size:12px}}code{{font-size:12px}}</style>
<h1>Green UI 충돌 비교 · 기존 편집기(/v2/editor) ↔ 신규 편집기(/v2/editor-next)</h1>
<p>기준: 앱의 Green UI v2.5.1(<code>planner/static/tokens.css</code> + <code>v2/shell.css</code> + 기존 편집기 컴포넌트 <code>v2/editor.css</code>).
값은 Chromium에서 잰 계산 값이며 추정 값은 없습니다. 요소가 한쪽에 없으면 <b>비교 불가</b>입니다.
정렬 전 = <code>editor-next-greenui.css</code>를 막고 잰 값(v1.12 원래 모양), 정렬 후 = 지금. 측정: 정렬 전 {esc(before['at'])} · 정렬 후 {esc(data['at'])}</p>
<p><b>컴포넌트 {len(ITEMS)}개</b> — 정렬 전: 일치 {bc['일치']} · 충돌 {bc['충돌 발견']} · 비교 불가 {bc['비교 불가']} → 정렬 후: 일치 {counts['일치']} · 충돌 {counts['충돌 발견']} · 비교 불가 {counts['비교 불가']}</p>
<table><tr><th>분류</th><th>항목</th><th>기존 Green UI</th><th>신규 편집기(정렬 후)</th><th>판정</th><th>충돌 속성 · 현재 값 → 변경 후 값</th></tr>{''.join(rows)}</table>
<h2>토큰: v1.12 tokens.demo.css ↔ 앱 계산 값</h2><p>일치 {tc['일치']} · 충돌 발견 {tc['충돌 발견']} · 비교 불가 {tc['비교 불가']}.
신규 편집기는 앱 안에서 tokens.demo.css를 읽지 않고 앱 값을 그대로 쓴다(editor-next.html). 새로 만든 토큰은 없다.</p>
<table><tr><th>토큰</th><th>v1.12 데모 값</th><th>앱 값(적용됨)</th><th>판정</th></tr>{tok}</table></html>""", "utf-8")
    return bc, counts, tc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:9751")
    ap.add_argument("--label", choices=["before", "after"], default="after")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1600, "height": 1000})
        if a.label == "before":
            page.route(ALIGN_CSS, lambda r: r.abort())
            for f in OUT.glob("*.png"):
                f.unlink()
            OUT.joinpath("before_shots").mkdir(exist_ok=True)
        data = {"at": datetime.now().strftime("%Y-%m-%d %H:%M"), "old": measure(page, a.base + "/v2/editor", "old"),
                "new": measure(page, a.base + "/v2/editor-next", "new" if a.label == "after" else "before_shots/new")}
        data["tokens"] = tokens(page, a.base + "/v2/editor")
        b.close()
    (OUT / f"{a.label}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")
    before = data if a.label == "before" else json.loads((OUT / "before.json").read_text("utf-8"))
    for cat, name, *_r in ITEMS:
        st, diffs = compare(data["old"][name]["values"], data["new"][name]["values"], _r[2])
        print(f"{st:6} {name}: " + "; ".join(f"{p} {n}→{o}" for p, n, o in diffs))
    if a.label == "after":
        print("before/after/tokens", *report(data, before))


if __name__ == "__main__":
    main()

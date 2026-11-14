# -*- coding: utf-8 -*-
"""신규 구좌편집기(/v2/editor-next) 통합 테스트: 실제 앱 서버 + 실제 상품 API + 실제 기획안 저장."""
import json
import re

import pytest

from conftest import open_editor_next, wait_saved

V2_PAGES = ["home", "brief", "compose", "editor", "preview", "deals", "library", "settings"]


def r10(n):
    return int(round(n / 10.0)) * 10   # JS Math.round와 같은 결과가 나오는 범위(양수)


# 1. 기존 편집기 정상 실행 (새 화면 /v2/editor, 예전 화면 /)
def test_existing_editors_still_work(page, server, plan):
    page.goto(f"{server.base}/v2/editor?id={plan['id']}", wait_until="networkidle")
    page.wait_for_function("() => document.querySelectorAll('#secList li').length === 3")
    assert "E2E 상품" in page.locator("#secList").inner_text()
    page.goto(f"{server.base}/", wait_until="networkidle")
    assert page.title()
    assert page.errors == [], page.errors


# 2. 신규 편집기 진입 → 기존 편집기로 복귀 (같은 기획안 id)
def test_enter_and_return(page, server, plan):
    page.goto(f"{server.base}/v2/editor?id={plan['id']}", wait_until="networkidle")
    link = page.locator("#editorNextLink")
    assert link.get_attribute("href") == f"/v2/editor-next?id={plan['id']}"
    link.click()
    page.wait_for_url(f"**/v2/editor-next?id={plan['id']}")
    page.wait_for_function("() => /가져왔어요/.test(document.getElementById('enNotice').textContent)")
    page.locator("#enBack").click()
    page.wait_for_url(f"**/v2/editor?id={plan['id']}")
    assert page.locator("#editorNextLink").count() == 1
    assert page.errors == [], page.errors


# 2-1. 기능 끄기: 화면 404, 기존 편집기의 진입 버튼 없음, 기존 편집기는 그대로
def test_feature_flag_off(server_off):
    import urllib.request, urllib.error
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(server_off.base + "/v2/editor-next")
    assert e.value.code == 404
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(server_off.base + "/v2/editor-next/app.js")
    assert e.value.code == 404
    html = urllib.request.urlopen(server_off.base + "/v2/editor").read().decode("utf-8")
    assert "editorNextLink" not in html and 'id="secList"' in html


# 2-2. 편집기 폴더의 js·css만 열린다 (테스트·문서·경로 이동 차단)
@pytest.mark.parametrize("name,code", [("app.js", 200), ("styles.css", 200), ("run_regression_v112.py", 404),
                                       ("README.md", 404), ("..%2F..%2Fdesign%2Ftokens_v2.5.1.css", 404)])
def test_editor_files_whitelist(server, name, code):
    import urllib.request, urllib.error
    try:
        got = urllib.request.urlopen(f"{server.base}/v2/editor-next/{name}").status
    except urllib.error.HTTPError as e:
        got = e.code
    assert got == code


# 3. Green UI: 앱 토큰을 쓰고 데모 토큰 파일은 읽지 않는다. 대표 컴포넌트가 기존 편집기 값과 같다
def test_green_ui_tokens_applied(page, server, plan):
    requested = []
    page.on("request", lambda r: requested.append(r.url))
    open_editor_next(page, server, plan["id"])
    assert not any("tokens.demo.css" in u for u in requested)
    assert any(u.endswith("/static/tokens.css") for u in requested)
    css = lambda sel, prop: page.locator(sel).first.evaluate(f"el => getComputedStyle(el).getPropertyValue('{prop}')")
    root = lambda name: page.evaluate(f"() => getComputedStyle(document.documentElement).getPropertyValue('{name}').trim()")
    assert root("--accent") == "#007a46" and root("--fs-body") == "15px"   # v2/shell.css 읽기 크기
    assert css("#exportDemo", "background-color") == "rgb(243, 243, 243)" and css("#exportDemo", "height") == "36px"
    assert css(".ia-group-btn[aria-selected=true]", "background-color") == "rgb(238, 245, 239)"
    assert css("aside.inspector", "border-top-left-radius") == "12px"
    assert page.errors == [], page.errors


# 4. 구좌 추가·삭제·순서 변경(버튼·키보드 실행 취소) — 좌측 구성 트리
def test_sections_add_delete_reorder_undo(page, server, plan):
    open_editor_next(page, server, plan["id"])
    order = lambda: page.locator("#page .preview-block").evaluate_all("els => els.map(e => e.dataset.page)")
    assert order() == ["e1", "e2", "e3"]
    page.locator("#addSection").click()
    page.locator('#pickerResults [data-picker-id^="notice"]').first.click()
    page.locator("#pickerApply").click()
    assert len(order()) == 4
    added = [x for x in order() if x not in ("e1", "e2", "e3")][0]
    page.locator(f'[data-list-action="delete:{added}"]').click()
    if page.locator("dialog[open] .am-ed-button--primary, dialog[open] [data-confirm]").count():
        page.locator("dialog[open] .am-ed-button--primary, dialog[open] [data-confirm]").first.click()
    assert order() == ["e1", "e2", "e3"]
    page.locator('[data-list-action="down:e1"]').click()
    assert order() == ["e2", "e1", "e3"]
    page.locator("body").click(position={"x": 5, "y": 5})
    page.keyboard.press("Control+z")
    assert order() == ["e1", "e2", "e3"]
    assert page.errors == [], page.errors


# 5. 중앙 요소 선택 → 우측 그 설정으로 이동(스크롤·펼침·강조)
def test_canvas_selection_reveals_inspector(page, server, plan):
    open_editor_next(page, server, plan["id"])
    a = plan["a"]["seq"]
    name = page.locator(f'#page [data-page="e2"] .mock-product[data-card-product="{a}"] .mock-el--name')
    name.click()
    target = page.locator("#panel-body .am-inspector-target")
    assert target.count() == 1
    assert page.locator("#panel-body details.cb-card-elements-advanced[open]").count() == 1
    box, panel = target.bounding_box(), page.locator("aside.inspector").bounding_box()
    assert panel["y"] <= box["y"] <= panel["y"] + panel["height"], (box, panel)   # 패널 안에 보임
    assert page.errors == [], page.errors


# 6. 카드 16개 요소: 켜기·속성 편집(기본 접힘)·순서 변경·캔버스 Delete
def test_card_elements(page, server, plan):
    open_editor_next(page, server, plan["id"])
    page.locator("#page [data-page=\"e2\"]").click()
    page.locator("[data-cb-rail=\"library\"]").click()
    page.locator("[data-ia-library=\"blocks\"]").click()
    page.locator("[data-cb-add=\"productCard\"]").click()
    card = page.locator('#page [data-page="e2"] .cb-node--productCard').first
    card.click(position={"x": 3, "y": 3})
    panel = "#panel-body"
    assert page.locator(f"{panel} [data-cb-row]").count() == 16
    assert page.locator(f'{panel} [data-cb-field="card.def.label"]').count() == 0   # 꺼진 요소는 입력 없음
    page.locator(f'{panel} [data-cb-visible="label"]').check()
    assert page.locator(f'{panel} [data-cb-field="card.def.label"]').count() == 0   # 켜도 '편집' 전에는 접힘
    page.locator(f'{panel} [data-cb-expand="label"]').click()
    page.locator(f'{panel} [data-cb-field="card.def.label"]').fill("E2E 라벨")
    assert "E2E 라벨" in card.inner_text()
    rows = lambda: page.locator(f"{panel} [data-cb-row]").evaluate_all("els => els.map(e => e.dataset.cbRow)")
    before = rows()
    page.locator(f'{panel} [data-cb-order="sale:-1"]').click()
    after = rows()
    assert after.index("sale") == before.index("sale") - 1
    # HTML5 드래그: 앱의 dragstart/dragover/drop 처리와 순서 변경을 표준 DragEvent로 검증
    # (헤드리스에서 마우스 드래그는 drag_to가 패널을 스크롤해 다른 행을 집거나 drop이 빠져 결과가 흔들림)
    page.evaluate("""() => {
      const row = k => document.querySelector(`#panel-body [data-cb-row="${k}"]`), dt = new DataTransfer();
      const src = row('name'), tgt = row('first'), r = tgt.getBoundingClientRect(), y = r.bottom - 4;   // 아래쪽 = 그 행 뒤에
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 20, clientY: y }));
      tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 20, clientY: y }));
    }""")
    assert rows().index("name") == rows().index("first") + 1, rows()
    page.locator("body").click(position={"x": 5, "y": 5})
    page.keyboard.press("Control+z")   # 드래그도 실행 취소된다
    assert rows().index("name") < rows().index("first"), rows()
    # 중앙에서 고른 속성을 Delete로 숨김 (이번에 고친 버그)
    a = plan["a"]["seq"]
    native = f'#page [data-page="e2"] .mock-product[data-card-product="{a}"] .mock-el--name'
    page.locator(native).click()
    page.keyboard.press("Delete")
    assert page.locator(native).count() == 0
    assert page.errors == [], page.errors


# 7. 설정 ↔ 미리보기: 열 수, 가운데 정렬, 이미지 비율(CSP 아래 data-am-style), 아코디언 이미지 배치
def test_settings_reflect_in_preview(page, server, plan):
    open_editor_next(page, server, plan["id"])
    page.locator('#page [data-page="e2"]').click()
    page.locator('[data-ia-group="layout"]').click()
    page.locator('[data-column-path="layoutColumns.grid2"][data-columns="3"]').click()
    tracks = page.locator('#page [data-page="e2"] .mock-products').evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
    assert tracks == 3
    page.locator('[data-choice="imageRatio"][data-value="4:3"]').click()
    media = page.locator('#page [data-page="e2"] .mock-product-media').first
    w, h = media.evaluate("el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]")
    assert abs(w / h - 4 / 3) < 0.05, (w, h)   # CSP(style-src 'self')에서도 비율이 적용됨 (data-am-style)
    page.locator('#page [data-page="e3"]').click()
    page.locator('[data-ia-group="layout"]').click()
    page.locator('[data-choice="align"][data-value="center"]').click()
    assert page.locator('#page [data-page="e3"] h3').evaluate("el => getComputedStyle(el).textAlign") == "center"
    page.locator('[data-bind="config.presentation"]').select_option("accordion")
    page.locator('[data-bind="config.imagePosition"]').select_option("left")
    assert page.locator('#page [data-page="e3"] .am-ed-accordion').count() >= 1
    assert "image-left" in page.locator('#page [data-page="e3"] .am-accordion-visual').first.get_attribute("class")
    assert page.errors == [], page.errors


# 8. 상품·후기: 실제 API의 이름·가격(기획안 할인 행 + 추가 혜택)·후기, 가상 데이터 없음
def test_real_products_and_reviews(page, server, plan):
    open_editor_next(page, server, plan["id"])
    a, b = plan["a"], plan["b"]
    snap = page.evaluate("() => JSON.stringify(window.AMOREAD_EDITOR_API.exportSnapshot())")
    assert "D001" not in snap and "가상 레퍼런스" not in snap
    card_a = page.locator(f'#page [data-page="e2"] .mock-product[data-card-product="{a["seq"]}"]')
    card_b = page.locator(f'#page [data-page="e2"] .mock-product[data-card-product="{b["seq"]}"]')
    assert a["name"] in card_a.inner_text() and b["name"] in card_b.inner_text()
    first_a = r10(a["price"] * 0.8)
    fin_a = r10(first_a * 0.9)   # 쿠폰: 할인가에서 10% 더 (api.js extraPrice sale_pct)
    won = lambda n: f"{n:,}원"
    assert won(fin_a) in card_a.inner_text() and "쿠폰가" in card_a.inner_text()
    assert won(r10(b["price"] * 0.9)) in card_b.inner_text() and "할인가" in card_b.inner_text()
    assert "★ 0.0" not in page.locator("#page").inner_text()   # 후기 없는 상품을 0점으로 보이지 않음
    # 좌측 '자료' 패널: 이 기획안 상품과 앱 후기 요약 발췌 (가상 데이터 안내 없음)
    page.locator('[data-cb-rail="data"]').click()
    lib = page.locator("#data-library")
    assert "앱 데이터" in lib.inner_text() and "가상 데이터" not in lib.inner_text()
    assert a["name"] in lib.inner_text() and "D001" not in lib.inner_text()
    if a.get("reviews"):
        page.locator('[data-ia-data-mode="reviews"]').click()
        quote = a["reviews"]["quotes"][0]
        assert quote[:20] in lib.inner_text()
        assert lib.locator(f'[data-ia-bind-review^="{a["seq"]}-q"]').count() == len(a["reviews"]["quotes"])
    assert page.errors == [], page.errors


# 9. 저장 → 다시 열기: 값·순서 유지, 기존 편집기 데이터(page.sections)는 그대로
def test_save_and_reopen(page, server, plan):
    open_editor_next(page, server, plan["id"])
    page.locator('#page [data-page="e1"]').click()
    page.locator('[data-ia-group="content"]').click()
    title = page.locator('#panel-body [data-bind="name"]')
    title.fill("E2E 저장 확인 제목")
    page.locator('[data-list-action="down:e1"]').click()
    wait_saved(page)
    st, doc = server.api(f"/api/am/projects/{plan['id']}")
    assert st == 200 and doc["editor_next"]["schema"] == "amoread-editor-next"
    saved = doc["editor_next"]["snapshot"]
    assert [s["id"] for s in saved["sections"]] == ["e2", "e1", "e3"]
    assert next(s for s in saved["sections"] if s["id"] == "e1")["name"] == "E2E 저장 확인 제목"
    assert [s["headline"] for s in doc["page"]["sections"]] == ["E2E 메인", "E2E 상품", "E2E 서비스"]   # 기존 편집기 값 보존
    page.reload(wait_until="networkidle")
    page.wait_for_function("() => /열었어요/.test(document.getElementById('enNotice').textContent)")
    assert page.locator("#page .preview-block").evaluate_all("els => els.map(e => e.dataset.page)") == ["e2", "e1", "e3"]
    assert "E2E 저장 확인 제목" in page.locator('#page [data-page="e1"]').inner_text()
    # 기존 편집기가 저장해도 신규 편집기 저장본은 남는다
    page.goto(f"{server.base}/v2/editor?id={plan['id']}", wait_until="networkidle")
    st, doc2 = server.api(f"/api/am/projects/{plan['id']}")
    assert doc2["editor_next"]["snapshot"]["sections"][0]["id"] == "e2"
    assert page.errors == [], page.errors


# 10. 동시 수정: 다른 화면이 먼저 저장하면 409로 막고 작성 내용은 임시 보관
def test_conflict_is_blocked_and_draft_kept(page, server, plan):
    open_editor_next(page, server, plan["id"])
    st, doc = server.api(f"/api/am/projects/{plan['id']}")
    st, other = server.api("/api/am/projects", {**{k: doc[k] for k in ("id", "title", "brief", "promo_rows", "page", "v2")},
                                                "rationale": "다른 화면", "base_updated_at": doc["updated_at"]})
    assert st == 200
    import time; time.sleep(1.1)   # updated_at이 초 단위
    st, _ = server.api(f"/api/am/projects/{plan['id']}")
    page.locator('#page [data-page="e1"]').click()
    page.locator('[data-ia-group="content"]').click()
    page.locator('#panel-body [data-bind="name"]').fill("충돌 나는 수정")
    page.wait_for_function("() => /저장 못 했어요/.test(document.getElementById('v2saved').textContent)", timeout=15000)
    assert "임시로 보관" in page.locator("#enNotice").inner_text()
    draft = page.evaluate(f"() => localStorage.getItem('amoread.editor-next.draft.{plan['id']}')")
    assert draft and "충돌 나는 수정" in draft
    st, now = server.api(f"/api/am/projects/{plan['id']}")
    assert now["rationale"] == "다른 화면" and not now.get("editor_next")   # 덮어쓰지 않음
    page.evaluate(f"() => localStorage.removeItem('amoread.editor-next.draft.{plan['id']}')")


# 11. 회귀: 앱의 다른 화면이 오류 없이 열린다
@pytest.mark.parametrize("name", V2_PAGES)
def test_other_pages_load(page, server, plan, name):
    page.goto(f"{server.base}/v2/{name}?id={plan['id']}", wait_until="networkidle")
    page.wait_for_timeout(300)
    assert page.errors == [], page.errors

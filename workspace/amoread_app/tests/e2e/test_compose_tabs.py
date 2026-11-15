# -*- coding: utf-8 -*-
"""02 구좌 구성 '고른 구성'에서 탭 구좌 만들기·고치기 (plans/28 3단계).

상품 원천 데이터 없이 돌도록 상품 칸의 SEQ는 가상 번호를 쓴다 (02는 SEQ를 고치지 않고 칸의 탭만 다룬다).
저장은 화면이 서버에 한 값(GET /api/am/projects/{id})으로 확인한다.
"""
import time

import pytest

SECTIONS = [
    {"sectionId": "c1", "order": 0, "name": "메인", "headline": "메인", "layoutId": "hero"},
    {"sectionId": "c2", "order": 1, "name": "추천 상품", "headline": "추천 상품", "layoutId": "grid2",
     "slots": [{"slotId": "k1", "seq": "101", "placeholderStatus": "AVAILABLE"}, {"slotId": "k2", "seq": "102", "placeholderStatus": "AVAILABLE"}]},
    {"sectionId": "c3", "order": 2, "name": "가격대별", "headline": "가격대별", "layoutId": "grid2", "zone_kind": "가격대",
     "tabs": [{"tabId": "tA", "label": "1만원대", "zone_tag": "ZA"}, {"tabId": "tB", "label": "2만원대", "zone_tag": "ZB"}],
     "slots": [{"slotId": "k3", "seq": "101", "tabId": "tA", "placeholderStatus": "AVAILABLE"},
               {"slotId": "k4", "seq": "103", "tabId": "tB", "placeholderStatus": "AVAILABLE"},
               {"slotId": "k5", "seq": "101", "tabId": "tB", "placeholderStatus": "AVAILABLE"},
               {"slotId": "k6", "seq": "102", "placeholderStatus": "AVAILABLE"}]},   # tabId 없음 = 첫 탭(tA)
]


@pytest.fixture
def doc(server):
    st, saved = server.api("/api/am/projects", {"title": "E2E 탭 구좌 02", "status": "planning",
                                                 "v2": {"stage": "compose", "compose": "blank"}, "page": {"sections": SECTIONS}})
    assert st == 200, saved
    yield saved["id"]
    server.api(f"/api/am/projects/{saved['id']}/delete", {})


def _secs(server, pid):
    st, d = server.api(f"/api/am/projects/{pid}")
    assert st == 200, d
    secs = (d.get("page") or {}).get("sections") or []   # 첫 저장 전에는 page가 비어 있음
    return {s["sectionId"]: s for s in secs}, [s["sectionId"] for s in sorted(secs, key=lambda s: s["order"])]


def _until(server, pid, cond, what):
    for _ in range(40):
        secs, order = _secs(server, pid)
        if cond(secs, order):
            return secs, order
        time.sleep(0.25)
    raise AssertionError(f"저장되지 않음: {what}\n{secs}")


def _tabs_of(s):
    label = {t["tabId"]: t["label"] for t in s.get("tabs") or []}
    out = {}
    for sl in s.get("slots") or []:
        out.setdefault(label.get(sl.get("tabId"), sl.get("tabId")), []).append(sl["slotId"])
    return out


def test_compose_tab_editing(page, server, doc):
    page.goto(f"{server.base}/v2/compose?id={doc}", wait_until="networkidle")
    page.wait_for_selector('.r[data-id="c3"] [data-tlabel="tA"]', timeout=30000)
    row = lambda sid: page.locator(f'.r[data-id="{sid}"]')

    # 탭 2개뿐이면 지우기 버튼은 꺼져 있다 (최소 2개)
    assert row("c3").locator('[data-tdel]').first.is_disabled()

    # 탭 이름 바꾸기 → 칸은 그대로 제 탭에 (탭 id로 맞춤)
    row("c3").locator('[data-tlabel="tB"]').fill("2만원대 선물")
    secs, _ = _until(server, doc, lambda s, o: [t["label"] for t in s["c3"]["tabs"]] == ["1만원대", "2만원대 선물"], "탭 이름")
    assert [(t["tabId"], t["zone_tag"]) for t in secs["c3"]["tabs"]] == [("tA", "ZA"), ("tB", "ZB")]   # Zone은 그대로
    assert _tabs_of(secs["c3"]) == {"1만원대": ["k3", "k6"], "2만원대 선물": ["k4", "k5"]}

    # 탭 추가 → 첫 탭 지우기: 그 탭의 칸은 새 첫 탭(2만원대 선물)으로, 같은 상품(101)은 탭 안에서 하나만
    row("c3").locator("[data-tadd]").click()
    row("c3").locator('[data-tdel="tA"]').click()
    secs, _ = _until(server, doc, lambda s, o: [t["tabId"] for t in s["c3"]["tabs"]][:1] == ["tB"] and len(s["c3"]["tabs"]) == 2, "탭 지우기")
    assert _tabs_of(secs["c3"]) == {"2만원대 선물": ["k4", "k5", "k6"]}

    # 진열 유형 고치기
    row("c3").locator("[data-tkind]").fill("선물 가격대")
    _until(server, doc, lambda s, o: s["c3"]["zone_kind"] == "선물 가격대", "진열 유형")

    # 일반 상품 구좌를 탭으로 나누기 → 지금 상품은 첫 탭
    row("c2").locator("[data-tsplit]").click()
    secs, _ = _until(server, doc, lambda s, o: len(s["c2"].get("tabs") or []) == 2, "탭 나누기")
    first = secs["c2"]["tabs"][0]["label"]
    assert _tabs_of(secs["c2"]) == {first: ["k1", "k2"]} and secs["c2"]["zone_kind"] == "탭"

    # [+ 탭 구좌 추가]
    page.click("#addTabBtn")
    secs, order = _until(server, doc, lambda s, o: len(o) == 4, "탭 구좌 추가")
    new = secs[order[-1]]
    assert new["layoutId"] == "grid2" and [t["label"] for t in new["tabs"]] == ["탭 1", "탭 2"]

    # 따로 구좌로 → 탭 하나로: 상품 칸이 따라간다
    row("c2").locator('[data-group="split"]').click()
    secs, order = _until(server, doc, lambda s, o: "c2" not in s and len(o) == 5, "따로 구좌로")
    parts = [secs[i] for i in order if secs[i].get("v2", {}).get("gname") == "추천 상품"]
    assert [sorted(sl["slotId"] for sl in p.get("slots") or []) for p in parts] == [["k1", "k2"], []]
    assert all(not p.get("tabs") and all(sl.get("tabId") is None for sl in p.get("slots") or []) for p in parts)
    page.locator(f'.r[data-id="{parts[0]["sectionId"]}"] [data-group="tab"]').click()
    secs, order = _until(server, doc, lambda s, o: len(o) == 4, "탭 하나로")
    merged = next(s for s in secs.values() if s.get("v2", {}).get("gk") and len(s.get("tabs") or []) == 2 and s["name"] == "추천 상품")
    assert list(_tabs_of(merged).values()) == [["k1", "k2"]]

    # 탭 없애기: 모든 탭의 칸을 한 구좌로
    row("c3").locator("[data-tdrop]").click()
    secs, _ = _until(server, doc, lambda s, o: not s["c3"].get("tabs"), "탭 없애기")
    assert sorted(sl["slotId"] for sl in secs["c3"]["slots"]) == ["k4", "k5", "k6"] and all(sl.get("tabId") is None for sl in secs["c3"]["slots"])

    # 탭 구좌를 상품 탭이 아닌 종류로 바꾸면 물어보고 탭을 없앤다
    mid = merged["sectionId"]
    page.once("dialog", lambda d: d.accept())
    page.locator(f'.r[data-id="{mid}"] select[data-f="layout"]').select_option("hero")
    secs, _ = _until(server, doc, lambda s, o: s[mid]["layoutId"] == "hero" and not s[mid].get("tabs"), "종류 바꾸기")
    # PROMO_WORK 데이터가 없는 PC에서는 지난 행사(/api/review)가 409 — 화면은 B안 없이 그대로 동작
    errors = [e for e in page.errors if "/api/review" not in e and "status of 409" not in e]
    assert not errors, errors


def test_recommended_tab_section_from_rule(page, server):
    """4단계: 선물 브리프의 A안에 가격대 탭 구좌가 나오고, 고르면 탭 구좌로 들어온다 (레퍼런스 색인이 있을 때)."""
    st, saved = server.api("/api/am/projects", {"title": "추석 선물세트", "status": "planning", "brief": {"myeongbun": "추석", "purpose": "선물 수요"},
                                                 "v2": {"stage": "compose", "cls": "season", "keywords": ["선물"]}})
    assert st == 200, saved
    try:
        page.goto(f"{server.base}/v2/compose?id={saved['id']}", wait_until="networkidle")
        page.wait_for_selector('[data-choose="A"]', timeout=30000)
        card = page.locator('article.cand:has([data-choose="A"])')
        if "탭 3" not in card.inner_text():
            pytest.skip("서버 AI 추천이 꺼져 있음 (레퍼런스 색인 없음) — A안이 화면 규칙으로 나옴")
        page.click('[data-choose="A"]')
        page.wait_for_selector('[data-tlabel]')
        labels = page.eval_on_selector_all('[data-tlabel]', "els => els.map(e => e.value)")
        assert labels == ["1만원대", "2만원대", "3만원 이상"]
        assert "선물 유형 규칙" in page.locator(".r:has([data-tlabel]) .grp").inner_text()
        _until(server, saved["id"], lambda s, o: any([t["label"] for t in x.get("tabs") or []] == labels for x in s.values()), "추천 탭 구좌 저장")
    finally:
        server.api(f"/api/am/projects/{saved['id']}/delete", {})

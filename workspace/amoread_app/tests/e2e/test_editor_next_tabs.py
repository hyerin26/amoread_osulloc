# -*- coding: utf-8 -*-
"""탭 구좌가 03 신규 편집기를 거쳐도 지켜지는지 (plans/28 1단계).

상품 원천 데이터가 없는 PC에서도 돌도록, 예시 화면에서 가상 상품을 넣고
편집기 변환(fromLegacyPage)과 앱 저장 변환(enToLegacy·enLegacyMark)을 브라우저 안에서 직접 부른다.
"""
import json

CATALOG = [{"id": s, "name": f"상품 {s}", "listPrice": 10000} for s in ("101", "102", "103")]
LEGACY = {"sections": [{
    "sectionId": "t1", "order": 0, "name": "가격대별", "headline": "가격대별", "layoutId": "grid2", "zone_kind": "가격대",
    "tabs": [{"tabId": "tA", "label": "1만원대", "zone_tag": "Z1"},
             {"tabId": "tB", "label": "2만원대", "zone_tag": "Z2"},
             {"tabId": "tC", "label": "빈 탭", "zone_tag": ""}],
    "slots": [{"slotId": "a1", "seq": "101", "tabId": "tA", "placeholderStatus": "AVAILABLE"},
              {"slotId": "a2", "seq": "102", "placeholderStatus": "AVAILABLE"},             # tabId 없음 = 첫 탭
              {"slotId": "b1", "seq": "101", "tabId": "tB", "placeholderStatus": "AVAILABLE"},  # 같은 상품이 두 탭에
              {"slotId": "b2", "seq": "103", "tabId": "tB", "placeholderStatus": "AVAILABLE"},
              {"slotId": "b3", "seq": "999", "tabId": "tB", "placeholderStatus": "AVAILABLE"},  # 카탈로그 밖 SEQ
              {"slotId": "g1", "seq": "102", "tabId": "gone", "placeholderStatus": "AVAILABLE"}]}]}  # 없는 탭 = 첫 탭

ROUND = """([catalog, legacy, edit]) => {
  const API = window.AMOREAD_EDITOR_API;
  API.setCatalog({ products: catalog, reviews: [] });
  const snap = API.fromLegacyPage(legacy);
  if (edit) new Function('snap', edit)(snap);
  const out = enToLegacy(snap, legacy.sections, new Set(catalog.map(p => p.id)));
  return { snap, out, markIn: enLegacyMark(legacy.sections), markOut: enLegacyMark(out) };
}"""


def _open(page, server):
    page.goto(f"{server.base}/v2/editor-next", wait_until="networkidle")
    page.wait_for_function("() => window.AMOREAD_EDITOR_API && typeof enToLegacy === 'function'")


def _round(page, edit=None):
    return page.evaluate(ROUND, [CATALOG, LEGACY, edit])


def _by_tab(section):
    out = {}
    for sl in section["slots"]:
        out.setdefault(sl.get("tabId"), []).append((sl["slotId"] if sl["slotId"] in {"a1", "a2", "b1", "b2", "b3", "g1"} else "new", sl["seq"]))
    return out


def test_tabs_survive_round_trip(page, server):
    _open(page, server)
    r = _round(page)
    s = r["snap"]["sections"][0]
    assert [(t["id"], t["label"], t["zone"]) for t in s["ftabs"]] == [("tA", "1만원대", "Z1"), ("tB", "2만원대", "Z2"), ("tC", "빈 탭", "")]
    assert [t["productIds"] for t in s["ftabs"]] == [["101", "102"], ["101", "103"], []]
    assert s["ftabCur"] == "tA" and s["productIds"] == ["101", "102"]   # productIds = 지금 보는 탭(처음엔 첫 탭)

    o = r["out"][0]
    assert [(t["tabId"], t["label"], t["zone_tag"]) for t in o["tabs"]] == [("tA", "1만원대", "Z1"), ("tB", "2만원대", "Z2"), ("tC", "빈 탭", "")]
    assert o["zone_kind"] == "가격대"
    by = _by_tab(o)
    assert by["tA"] == [("a1", "101"), ("a2", "102")]
    assert by["tB"] == [("b1", "101"), ("b2", "103"), ("b3", "999")]   # 같은 상품도, 카탈로그 밖 SEQ도 그대로
    assert None not in by and "gone" not in by
    assert not page.errors, page.errors


def test_product_changes_apply_to_the_tab_being_viewed(page, server):
    """편집기의 productIds는 지금 보는 탭의 상품이다: 빼거나 넣으면 그 탭만 바뀐다."""
    _open(page, server)
    r = _round(page, "const s = snap.sections[0]; s.productIds = s.productIds.filter(q => q !== '101');")
    by = _by_tab(r["out"][0])
    assert [q for _, q in by["tA"]] == ["102"]
    assert [q for _, q in by["tB"]] == ["101", "103", "999"]   # 다른 탭의 같은 상품은 그대로
    r = _round(page, "const s = snap.sections[0]; s.ftabs[0].productIds = s.productIds.slice(); s.ftabCur = 'tB'; s.productIds = [...s.ftabs[1].productIds, '102'];")
    by = _by_tab(r["out"][0])
    assert [q for _, q in by["tB"]] == ["101", "103", "102", "999"]
    assert by["tB"][2][0] == "new"


def test_removing_all_tabs_and_layout_without_tabs(page, server):
    _open(page, server)
    r = _round(page, "const s = snap.sections[0]; s.productIds = ['101', '102', '103']; s.ftabs = []; delete s.ftabCur;")   # 편집기 ftDrop과 같은 모양
    o = r["out"][0]
    assert o["tabs"] == [] and all("tabId" not in sl or sl["tabId"] is None for sl in o["slots"])
    assert sorted(sl["seq"] for sl in o["slots"]) == ["101", "102", "103", "999"]   # 탭을 없애도 상품은 하나로 합쳐 남음


def test_mark_sees_tab_changes(page, server):
    _open(page, server)
    marks = page.evaluate("""(legacy) => {
      const a = enLegacyMark(legacy.sections);
      const b = JSON.parse(JSON.stringify(legacy)); b.sections[0].tabs[0].label = '바뀐 이름';
      const c = JSON.parse(JSON.stringify(legacy)); c.sections[0].slots[0].tabId = 'tB';
      const plain = [{ sectionId: 'p', layoutId: 'grid2', headline: 'x', slots: [{ seq: '101' }] }];
      // 탭을 보기 전의 지문 공식 (2026-11-15 05c7ebf)
      const old = sections => { const s = JSON.stringify(sections.map(x => [x.sectionId, x.layoutId, x.headline || '', x.subhead || '', (x.slots || []).map(y => y.seq || '')]));
        let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return `${s.length}:${h.toString(36)}`; };
      return [a, enLegacyMark(b.sections), enLegacyMark(c.sections), enLegacyMark(plain), old(plain)];
    }""", LEGACY)
    assert marks[0] != marks[1] and marks[0] != marks[2]
    assert marks[3] == marks[4], "탭 없는 기획안의 지문은 예전과 같아야 열 때 '다시 맞춤'이 생기지 않음"


# ---------------- 2단계: 03 편집기에서 탭 보기·고치기 (예시 화면, 편집기 가상 상품) ----------------
CUR = "() => { const s = window.AMOREAD_EDITOR_API.exportSnapshot(); return s.sections.find(x => x.id === s.current); }"


def _cur(page):
    return page.evaluate(CUR)


def test_add_tab_section_from_picker_and_edit_tabs(page, server):
    _open(page, server)
    # 구좌 추가 창: '탭'으로 검색하면 상품 탭 카드가 나온다
    page.click("#addSection")
    page.fill("#pickerSearch", "탭")
    page.click('[data-picker-id="grid2@tabs"]')
    page.click("#pickerApply")
    s = _cur(page)
    assert s["layout"] == "grid2" and [t["label"] for t in s["ftabs"]] == ["탭 1", "탭 2"] and s["ftabCur"] == s["ftabs"][0]["id"]
    sel = f'[data-page="{s["id"]}"]'
    assert page.locator(f"{sel} .am-ftab").count() == 2

    # 탭 1에 상품 하나, 미리보기 알약으로 탭 2로 바꿔 다른 상품 하나
    page.click('[data-tab="products"]')
    boxes = page.locator("#panel-body [data-product]")
    p1, p2 = boxes.nth(0).get_attribute("data-product"), boxes.nth(1).get_attribute("data-product")
    for p in s["productIds"]:   # 예시 구좌에 미리 들어 있는 상품은 비운다
        page.uncheck(f'#panel-body [data-product="{p}"]')
    page.check(f'#panel-body [data-product="{p1}"]')
    t2 = s["ftabs"][1]["id"]
    page.click(f'{sel} [data-ftab-pill="{s["id"]}|{t2}"]')
    s = _cur(page)
    assert s["ftabCur"] == t2 and s["productIds"] == [] and s["ftabs"][0]["productIds"] == [p1]
    assert page.locator(f'{sel} [aria-selected="true"].am-ftab').inner_text() == "탭 2"
    page.check(f'#panel-body [data-product="{p2}"]')

    # 탭 이름·Zone (data-bind) → 알약에 바로
    page.fill('#panel-body [data-bind="ftabs.1.label"]', "2만원대")
    page.fill('#panel-body [data-bind="ftabs.1.zone"]', "Z2")
    assert page.locator(f'{sel} [aria-selected="true"].am-ftab').inner_text() == "2만원대"

    # 앱 저장 형식으로: 탭 순서·이름·Zone, 칸의 탭
    out = page.evaluate("(sid) => { const snap = window.AMOREAD_EDITOR_API.exportSnapshot(); return enToLegacy(snap, [], new Set(snap.sections.flatMap(s => s.productIds || []).concat(snap.sections.flatMap(s => (s.ftabs || []).flatMap(t => t.productIds))))).find(x => x.sectionId === sid); }", s["id"])
    assert [(t["label"], t["zone_tag"]) for t in out["tabs"]] == [("탭 1", ""), ("2만원대", "Z2")]
    s = _cur(page)   # 칸 변환은 위 테스트(숫자 SEQ)에서 본다. 예시 상품 id(D001…)는 SEQ가 아니라 칸으로 저장하지 않음
    assert s["ftabs"][0]["productIds"] == [p1] and s["ftabCur"] == t2 and s["productIds"] == [p2]

    # 탭이 2개뿐이면 지울 수 없다 → 하나 추가한 뒤 첫 탭을 지우면 그 상품은 새 첫 탭으로
    assert page.locator('#panel-body [data-ftab-op="del"]').first.is_disabled()
    page.click('#panel-body [data-ftab-op="add"]')
    s = _cur(page)
    assert len(s["ftabs"]) == 3 and s["ftabCur"] == s["ftabs"][2]["id"]
    page.click(f'#panel-body [data-ftab-op="del"][data-ftab-id="{s["ftabs"][0]["id"]}"]')
    s = _cur(page)
    assert [t["label"] for t in s["ftabs"]] == ["2만원대", "탭 3"]
    assert s["ftabs"][0]["productIds"] == [p2, p1] and s["ftabCur"] == s["ftabs"][1]["id"]   # 보던 탭(탭 3)은 그대로

    # 실행 취소로 되돌아오고, 탭 없애기는 모든 상품을 합친다
    page.click("#undo")
    assert len(_cur(page)["ftabs"]) == 3
    page.click("#redo")
    page.click('#panel-body [data-ftab-op="drop"]')
    s = _cur(page)
    assert s["ftabs"] == [] and sorted(s["productIds"]) == sorted([p1, p2])
    assert page.locator(f"{sel} .am-ftab").count() == 0
    assert not page.errors, page.errors


def test_split_existing_grid_and_change_to_layout_without_tabs(page, server):
    _open(page, server)
    sid = page.evaluate("() => window.AMOREAD_EDITOR_API.exportSnapshot().sections.find(s => s.layout === 'grid2')?.id")
    assert sid, "예시 기획안에 2열 상품 구좌가 있어야 해요"
    page.click(f'[data-page="{sid}"]')
    page.click('[data-tab="products"]')
    before = _cur(page)["productIds"]
    page.click('#panel-body [data-ftab-op="split"]')
    s = _cur(page)
    assert len(s["ftabs"]) == 2 and s["productIds"] == before   # 지금 상품은 첫 탭에
    # 상품 탭이 아닌 유형으로 바꾸면 탭을 없앤다
    page.click("#changeLayout")
    page.fill("#pickerSearch", "메인")
    page.click('[data-picker-id="hero"]')
    page.click("#pickerApply")
    s = _cur(page)
    assert s["layout"] == "hero" and s["ftabs"] == []
    assert not page.errors, page.errors

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
    assert sorted(s["productIds"]) == ["101", "102", "103"]

    o = r["out"][0]
    assert [(t["tabId"], t["label"], t["zone_tag"]) for t in o["tabs"]] == [("tA", "1만원대", "Z1"), ("tB", "2만원대", "Z2"), ("tC", "빈 탭", "")]
    assert o["zone_kind"] == "가격대"
    by = _by_tab(o)
    assert by["tA"] == [("a1", "101"), ("a2", "102")]
    assert by["tB"] == [("b1", "101"), ("b2", "103"), ("b3", "999")]   # 같은 상품도, 카탈로그 밖 SEQ도 그대로
    assert None not in by and "gone" not in by
    assert not page.errors, page.errors


def test_product_added_without_tab_goes_to_first_tab_and_removed_leaves_all_tabs(page, server):
    """탭 UI가 없을 때(편집기가 productIds만 고칠 때)도 탭이 깨지지 않는다."""
    _open(page, server)
    r = _round(page, "const s = snap.sections[0]; s.productIds = s.productIds.filter(q => q !== '101');")
    by = _by_tab(r["out"][0])
    assert [q for _, q in by["tA"]] == ["102"]
    assert [q for _, q in by["tB"]] == ["103", "999"]
    r = _round(page, "const s = snap.sections[0]; s.ftabs[1].productIds.push('102'); s.productIds = [...new Set(s.ftabs.flatMap(t => t.productIds))];")
    by = _by_tab(r["out"][0])
    assert [q for _, q in by["tB"]] == ["101", "103", "102", "999"]
    assert by["tB"][2][0] == "new"


def test_removing_all_tabs_and_layout_without_tabs(page, server):
    _open(page, server)
    r = _round(page, "snap.sections[0].ftabs = [];")
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

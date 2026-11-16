# -*- coding: utf-8 -*-
"""
구좌 구성 추천안 만들기 (구좌 구성 화면의 A·C 후보와 같은 모양).

- A (규칙형): 유형 규칙의 필수 구좌만 — 기본 틀.
- C (레퍼런스 조합): 유형 규칙의 구좌 전체 + 구좌마다 맞는 레퍼런스 1개(src). 색인이 없으면 src 없이 규칙만 낸다.
- 모양은 planner/static/v2/compose.js의 CANDS와 같다: secs = [구좌 이름, 레이아웃, 넣은 이유, { src: [페이지키, 그 페이지의 원본 구좌 이름] }]
  pages = 화면의 PAGES(페이지키 → { name, from, period, r, secs })
"""
from . import cases, refs, rules

ANCHOR_AFFINITY = 0.6     # 기준 페이지 점수에 더하는 '우리 브랜드와 가까운 정도' (표준편차 단위 × 이 값, ±2σ까지만)
ANCHOR_SEASON_MISS = 1.5  # 브리프와 페이지의 계절이 서로 알려져 있고 다르면 빼는 점수 (추석 선물에 크리스마스 페이지 방지)
NO_REF = {"terms_notice", "share", "app_promo", "related_promotions", "section_navigation"}   # 정해진 문구·기능이라 레퍼런스를 찾지 않는다
TAB_LAYOUTS = {"grid2", "grid3", "feat"}   # 탭(필터) 구좌를 쓸 수 있는 레이아웃 (plans/28)
PRICE_TABS = ["1만원대", "2만원대", "3만원 이상"]


def _tabs_for(doc: dict, plan: dict):
    """A안 첫 상품 구좌의 탭 (plans/28 4단계). 선물 유형 → 가격대 탭, 고른 키워드 2개 이상 → 키워드 탭(최대 4). 해당 없으면 None.
    모양은 compose.js toRows가 읽는 secs 넷째 칸 {kind, tabs, note}."""
    if plan["type"] == "gift_curation":
        return {"kind": "가격대", "tabs": PRICE_TABS, "note": "선물 유형 규칙"}
    kws = [str(k).strip()[:40] for k in dict.fromkeys((doc.get("v2") or {}).get("keywords") or []) if str(k).strip()][:4]
    return {"kind": "키워드", "tabs": kws, "note": "고른 키워드 규칙"} if len(kws) >= 2 else None



def _match(doc: dict, plan: dict) -> list:
    b, v2 = doc.get("brief") or {}, doc.get("v2") or {}
    cls = rules.CLS_NAME.get(v2.get("cls"), "")
    return [[f"유형: {plan['type_name']}", bool(plan["matched"])], [f"목적: {b.get('purpose') or '미정'}", bool(b.get("purpose"))],
            [f"분류: {cls or '미정'}", bool(cls)], [f"키워드: {', '.join((v2.get('keywords') or [])[:2]) or '없음'}", bool(v2.get("keywords"))]]


def build(doc: dict, per_section: int = 1) -> dict:
    plan = rules.generate(doc)
    conf = rules.CONF_KO[plan["confidence"]]
    basis = [f"프로모션 유형 '{plan['type_name']}' (신뢰도 {conf})", f"판단 키워드: {', '.join(plan['matched']) or '없음 — 목적·분류로 판단'}",
             "근거 사례: " + " / ".join(plan["evidence"]), "유형 규칙은 기획자 검토 전 초안"] + plan["notes"]
    secs_a = [[s["name"], s["layoutId"], s["why"]] for s in plan["sections"] if s["required"]]
    tab = _tabs_for(doc, plan)
    at = next((i for i, x in enumerate(secs_a) if x[1] in TAB_LAYOUTS), None) if tab else None
    if at is not None:
        name = "테마별 추천" if tab["kind"] == "키워드" else secs_a[at][0]   # 첫 키워드 이름('피크닉 추천')은 탭 전체를 대표하지 못함
        secs_a[at] = [name, secs_a[at][1], f"{secs_a[at][2]} · {tab['kind']}별 탭 {len(tab['tabs'])}개로 나눠 보여 줘요", tab]

    pages, ref_items, secs_c = {}, {}, []
    # 1) 브리프에 가까운 페이지를 먼저 고른다: 페이지 검색 점수 + 구성안의 구좌 역할을 얼마나 가졌는가(커버리지) + 우리 브랜드
    need = [s for s in plan["sections"] if s["role"] not in NO_REF]
    q_all = refs.query_for(doc, "", "")
    anchor, anchor_cov = None, 0.0
    bs = refs.brief_season(doc)
    cands = refs.search_pages(q_all, k=12)
    if cands and need:
        def want(s):
            return refs.roles_for(s["layoutId"], s["name"], s["purpose"]) if s["role"] == "product_list" else [s["role"]]
        scored = []
        aff = refs.page_affinity()
        for c in cands:
            cov = sum(1 for s in need if set(want(s)) & c["roles"]) / len(need)
            brand = refs._state["pages"].get(c["page_id"], {}).get("brand")
            ps = refs.page_season(c["page_id"])
            adj = (0.5 if brand in refs.PREFER_BRANDS else 0) + ANCHOR_AFFINITY * max(-2.0, min(2.0, aff.get(c["page_id"], 0.0))) - (ANCHOR_SEASON_MISS if bs and ps and bs != ps else 0)
            scored.append((c["score"] + 2.0 * cov + adj, c["page_id"], cov))
        _, anchor, anchor_cov = max(scored)
    own = 0
    for s in plan["sections"]:
        row = [s["name"], s["layoutId"], s["why"]]
        if s["role"] not in NO_REF:
            q = refs.query_for(doc, s["name"], s["purpose"])
            roles = refs.roles_for(s["layoutId"], s["name"], s["purpose"]) if s["role"] == "product_list" else [s["role"]]
            hit = refs.search_in_page(q, roles, anchor, k=per_section, section=s["layoutId"]) if anchor else []
            if hit:
                own += 1
            else:   # 그 페이지에 없는 구좌는 다른 사례로 보충
                hit = refs.search(q, roles, k=per_section, season=bs, section=s["layoutId"])
            if hit:
                r = hit[0]
                item = refs.as_ref(r, refs.why_text(q, r, s["role"]))
                ref_items[item["id"]] = item
                pg = refs._state["pages"].get(r["page_id"]) or {}
                pages.setdefault(r["page_id"], {"name": pg.get("name") or r["campaign"], "from": refs.BRAND_FROM.get(r["brand"], "외부"), "period": "", "r": [9, 16],
                                                "secs": pg.get("secs") or [], "url": r.get("url", ""), **refs.capture_info(r["page_id"])})
                row.append({"src": [r["page_id"], r["title"]], "refId": item["id"], "sx": {"t": (r.get("text") or "")[:120], "n": len(r.get("text") or "")}})
        secs_c.append(row)
    if anchor and bs and refs.page_season(anchor) and refs.page_season(anchor) != bs:
        basis.append(f"주의: 기준 페이지는 {refs.page_season(anchor)} 시즌 사례예요. 브리프의 계절({bs})과 달라서 구성만 참고하고 문구·혜택은 바꿔 쓰세요")
    if anchor:
        basis.append(f"기준 페이지 '{(refs._state['pages'].get(anchor) or {}).get('name', anchor)[:30]}': 구좌 {len(need)}개 중 {own}개를 이 페이지에서 가져오고 나머지는 다른 사례로 보충")
    mixed = any(len(x) > 3 for x in secs_c)
    saved = cases.candidate(doc)   # 우리가 저장해 둔 비슷한 기획안 (있을 때만)
    cands = [
        {"id": "A", "type": "rule", "title": f"{plan['type_name']} 기본형", "why": "유형의 필수 구좌만 담은 기본 틀이에요", "basis": " · ".join(basis[:2]),
         "match": _match(doc, plan), "secs": secs_a},
        {"id": "C", "type": "mix" if mixed else "rule", "title": "레퍼런스 조합 추천" if mixed else "규칙 전체 구성 (레퍼런스 색인 없음)",
         "why": "유형 규칙으로 구좌를 정하고, 브리프에 가장 가까운 사례 페이지에서 구좌를 먼저 가져와 이었어요" if mixed else "레퍼런스 색인이 없어 규칙만 보여 줘요", "basis": " · ".join(basis[:3]),
         "match": _match(doc, plan), "secs": secs_c},
    ]
    if saved:
        cands.append(saved[0])
        pages["saved"] = saved[1]
    return {"mode": "ai" if mixed else "demo", "basis": basis, "type": {"id": plan["type"], "name": plan["type_name"], "confidence": plan["confidence"],
            "matched": plan["matched"], "evidence": plan["evidence"], "ranking": plan["ranking"]}, "candidates": cands, "pages": pages, "refs": list(ref_items.values())}

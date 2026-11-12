# -*- coding: utf-8 -*-
"""
구좌 구성 추천안 만들기 (구좌 구성 화면의 A·C 후보와 같은 모양).

- A (규칙형): 유형 규칙의 필수 구좌만 — 기본 틀.
- C (레퍼런스 조합): 유형 규칙의 구좌 전체 + 구좌마다 맞는 레퍼런스 1개(src). 색인이 없으면 src 없이 규칙만 낸다.
- 모양은 planner/static/v2/compose.js의 CANDS와 같다: secs = [구좌 이름, 레이아웃, 넣은 이유, { src: [페이지키, 그 페이지의 원본 구좌 이름] }]
  pages = 화면의 PAGES(페이지키 → { name, from, period, r, secs })
"""
from . import cases, refs, rules

NO_REF = {"terms_notice", "share", "app_promo", "related_promotions", "section_navigation"}   # 정해진 문구·기능이라 레퍼런스를 찾지 않는다



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

    pages, ref_items, secs_c = {}, {}, []
    # 1) 브리프에 가까운 페이지를 먼저 고른다: 페이지 검색 점수 + 구성안의 구좌 역할을 얼마나 가졌는가(커버리지) + 우리 브랜드
    need = [s for s in plan["sections"] if s["role"] not in NO_REF]
    q_all = refs.query_for(doc, "", "")
    anchor, anchor_cov = None, 0.0
    cands = refs.search_pages(q_all, k=12)
    if cands and need:
        def want(s):
            return refs.roles_for(s["layoutId"], s["name"], s["purpose"]) if s["role"] == "product_list" else [s["role"]]
        scored = []
        for c in cands:
            cov = sum(1 for s in need if set(want(s)) & c["roles"]) / len(need)
            brand = refs._state["pages"].get(c["page_id"], {}).get("brand")
            scored.append((c["score"] + 2.0 * cov + (0.5 if brand in refs.PREFER_BRANDS else 0), c["page_id"], cov))
        _, anchor, anchor_cov = max(scored)
    own = 0
    for s in plan["sections"]:
        row = [s["name"], s["layoutId"], s["why"]]
        if s["role"] not in NO_REF:
            q = refs.query_for(doc, s["name"], s["purpose"])
            roles = refs.roles_for(s["layoutId"], s["name"], s["purpose"]) if s["role"] == "product_list" else [s["role"]]
            hit = refs.search_in_page(q, roles, anchor, k=per_section) if anchor else []
            if hit:
                own += 1
            else:   # 그 페이지에 없는 구좌는 다른 사례로 보충
                hit = refs.search(q, roles, k=per_section)
            if hit:
                r = hit[0]
                item = refs.as_ref(r, refs.why_text(q, r, s["role"]))
                ref_items[item["id"]] = item
                pg = refs._state["pages"].get(r["page_id"]) or {}
                pages.setdefault(r["page_id"], {"name": pg.get("name") or r["campaign"], "from": refs.BRAND_FROM.get(r["brand"], "외부"), "period": "", "r": [9, 16],
                                                "secs": pg.get("secs") or [], "url": r.get("url", ""), **refs.capture_info(r["page_id"])})
                row.append({"src": [r["page_id"], r["title"]], "refId": item["id"], "sx": {"t": (r.get("text") or "")[:120], "n": len(r.get("text") or "")}})
        secs_c.append(row)
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

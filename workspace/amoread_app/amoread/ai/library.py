# -*- coding: utf-8 -*-
"""
레퍼런스 화면(library.js)용 목록: 수집한 원본 페이지·구좌·참여 이벤트를 화면이 쓰는 항목 모양으로 돌려준다.
분류 값(season·cls·ben·stype·mode)은 labeling.py가 붙인 자동 라벨이고 사람이 고친 값(label_overrides.json)이 우선한다. 읽기만 한다.
"""
import re
import json

from . import labeling, refs, rules


def _page_labels() -> dict:
    out = {}
    for d in (refs.AI_DIR, refs.USER_DIR):   # 수집 색인 + 담당자가 직접 가져온 것
        try:
            out.update(json.loads((d / "page_labels.json").read_text(encoding="utf-8")))
        except (OSError, ValueError):
            pass
    return out


def items(kinds=("page", "sec", "event")) -> dict:
    if not refs._load():
        return {"mode": "demo", "items": [], "counts": {}, "note": "레퍼런스 색인이 없어요 (planner/data/ai_refs)"}
    labels = _page_labels()
    shape_x: dict[str, list[dict]] = {}
    shape: dict[str, list[str]] = {}   # 페이지 윤곽 썸네일용: 페이지별 구좌 역할을 순서대로
    for r in sorted(refs._state["rows"], key=lambda r: (r["page_id"], int(r.get("order") or 0))):
        shape.setdefault(r["page_id"], []).append(r["role"])
        im = r.get("images")
        shape_x.setdefault(r["page_id"], []).append({"r": r["role"], "l": len(r.get("text") or ""), "i": len(im) if isinstance(im, list) else int(im or 0),
                                                     "t": re.sub(r"^[A-Z][A-Za-z ]{2,14}\s+(?=\S)", "", (r.get("title") or "").strip())[:20]})
    out = []
    for pid, pg in refs._state["pages"].items():
        lb = labels.get(pid)
        if not lb:
            continue
        frm = refs.BRAND_FROM.get(pg["brand"], "외부")
        base = {"season": lb["season"], "cls": lb["cls"], "from": frm, "src": pg["brand"], "link": pg.get("url", ""), "r": [9, 16], "ai": True,
                "label": {"type": lb["type"], "type_name": (rules.TYPES.get(lb["type"]) or rules.GENERIC)["name"], "confidence": lb["confidence"], "by": lb["labeled_by"], "evidence": lb.get("evidence", {})}}
        if "page" in kinds and pg["brand"] != "user" and not pg.get("own"):   # 직접 가져온 페이지는 레퍼런스 화면이 따로 보여 준다 (구좌만 여기서)
            out.append({**base, "id": pid, "kind": "page", "name": pg["name"], "ben": lb["ben"], "concept": "", "secs": pg["secs"], "shape": shape.get(pid, []), "shape_x": shape_x.get(pid, [])})
    for r in refs._state["rows"]:
        lb = labels.get(r["page_id"])
        pg = refs._state["pages"].get(r["page_id"])
        if not lb or not pg:
            continue
        sec = labeling.classify_section({"role": r["role"], "text": r["text"]})
        if not sec["stype"]:
            continue
        base = {"season": lb["season"], "cls": lb["cls"], "from": refs.BRAND_FROM.get(pg["brand"], "외부"), "src": pg["brand"], "page": r["page_id"], "psec": r["title"],
                "link": pg.get("url", ""), "r": [9, 16], "ai": True, "label": {"by": lb["labeled_by"], "confidence": lb["confidence"]}, "summary": r["text"][:120], "tl": len(r["text"]), "role": r["role"]}
        if "event" in kinds and r["role"] == "participation_event":
            out.append({**base, "id": r["id"], "kind": "event", "name": r["title"], "mode": (sec["mode"] or [""])[0]})
        elif "sec" in kinds:
            out.append({**base, "id": r["id"], "kind": "sec", "name": r["title"], "stype": sec["stype"]})
    counts = {k: sum(1 for x in out if x["kind"] == k) for k in ("page", "sec", "event")}
    return {"mode": "ai", "items": out, "counts": counts, "vocab": {"cls": labeling.CLS_KO}}

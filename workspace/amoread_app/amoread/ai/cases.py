# -*- coding: utf-8 -*-
"""
우리 팀이 이미 저장한 기획안(planner/data/projects/*.json)에서 비슷한 명분의 구좌 구성을 찾는다 (읽기만, 따로 관리할 목록 없음).

- 쓸수록 좋아지는 부분: 기획안을 만들고 구좌 구성을 저장해 두면 다음 비슷한 기획에서 'D. 지난 우리 기획안처럼'으로 나온다.
- 담당자가 '확정'(또는 반영)한 기획안만 쓴다. 작성 중인 것은 첫 추천을 자동 저장해 둔 값일 수 있어 뺀다 (AI 결과가 AI에게 되먹임되는 것을 막음).
- 같은 명분(명분 사전 이름이 겹침)이거나 제목·명분 글자가 많이 겹치면 비슷하다고 본다. 구좌가 3개 미만인 기획안은 뺀다.
- 기획안 파일에는 쓰지 않는다. 현재 열린 기획안(doc.id)은 제외한다.
"""
import json
import re

from . import rules


def _grams(t: str) -> set:
    t = re.sub(r"\s+", "", (t or "").lower())
    return {t[i:i + 2] for i in range(len(t) - 1)}


def _name_text(d: dict) -> str:
    b = d.get("brief") or {}
    return f"{d.get('title') or ''} {b.get('myeongbun') or ''}"


def find(doc: dict, limit: int = 1) -> list[dict]:
    try:
        from .. import store
        files = list(store.PROJECTS_DIR.glob("*.json"))
    except Exception:
        return []
    me = (doc.get("id") or "").strip()
    cur = _name_text(doc)
    cur_s = (rules.season_hit(doc) or {}).get("name", "")
    cg, out = _grams(cur), []
    for f in files:
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        secs = ((d.get("page") or {}).get("sections")) or []
        if d.get("id") == me or len(secs) < 3 or d.get("status") not in ("confirmed", "reflected"):
            continue
        sim_s = (rules.season_hit(d) or {}).get("name", "")
        g = _grams(_name_text(d))
        jac = len(cg & g) / len(cg | g) if cg and g else 0
        same = bool(cur_s) and cur_s == sim_s
        if same or jac >= 0.4:
            out.append({"score": (1 if same else 0) + jac, "same_season": cur_s if same else "", "jac": jac, "doc": d, "secs": sorted(secs, key=lambda x: x.get("order", 0))})
    out.sort(key=lambda x: (-x["score"], -len(x["secs"])))
    return out[:limit]


def candidate(doc: dict) -> tuple[dict, dict] | None:
    """(후보 D, pages 항목) 또는 None. 화면 compose.js의 CANDS·PAGES와 같은 모양."""
    hit = find(doc)
    if not hit:
        return None
    h, d = hit[0], hit[0]["doc"]
    secs = [[s.get("name") or "구좌", s.get("layoutId") or "text-cta", (s.get("role") or "지난 기획안의 구좌")[:80]] for s in h["secs"]][:12]
    why = f"같은 명분 '{h['same_season']}'으로 저장한 우리 기획안이에요" if h["same_season"] else "제목·명분이 비슷한 우리 기획안이에요"
    cand = {"id": "D", "type": "single", "page": "saved", "title": f"지난 우리 기획안처럼 ('{(d.get('title') or '')[:20]}')", "why": why,
            "match": [[f"같은 명분: {h['same_season']}" if h["same_season"] else "비슷한 제목·명분", True], [f"구좌 {len(secs)}개", True]], "secs": secs}
    page = {"name": d.get("title") or "저장한 기획안", "from": "자사몰", "period": str(d.get("updated_at") or "")[:10], "r": [9, 16], "secs": [x[0] for x in secs]}
    return cand, page

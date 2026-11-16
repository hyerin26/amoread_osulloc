# -*- coding: utf-8 -*-
"""
브리프 키워드 화면이 쓰는 트렌드 키워드 두 가지를 화면에 맞게 줄여 준다.

1) 지금 뜨는 것 (rising): 주간 실행(weekly.py)이 저장한 가장 최근 결과. 화면을 열 때마다 바로 나온다 (네트워크 없음)
2) 공개 출처 탐색 (discover): 명분(중심 키워드)으로 매거진·뉴스를 검색해, 여러 매체에 반복된 소비 현상을 묶는다 (15~25초, 같은 검색 15분 캐시)
   기획안에 기간이 있으면 그 기간 기준 (미래면 최근 30일 + 1·2년 전 같은 기간 참고, 지난 기간이면 전년 같은 기간과 비교)

수치는 검색 결과 안의 서로 다른 기사 수이며 검색량·SNS 반응·판매량이 아니다. 화면에도 그렇게 적는다.
"""
import json
import re
import threading
from datetime import date, datetime

from . import discovery, weekly

LIVE = set(weekly.LIVE)
SIGNAL_LEVELS = ("트렌드 후보", "선행 신호 후보", "시즌 반복", "업계 보도 반복")   # 마인드맵 가지로 낼 등급 ('영감'·'과거 기간 참고'는 근거로만)
_run = {"on": False, "last": None}
_lock = threading.Lock()


def _latest_file(suffix=""):
    best = None
    for p in weekly.DIR.glob(f"*{suffix}.json"):
        m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})" + re.escape(suffix), p.stem)
        if m and (best is None or m.group(1) > best[0]):
            best = (m.group(1), p)
    return best[1] if best else None


def _evidence(rows, n=3):
    return [{"title": e.get("title", ""), "url": e.get("url") if str(e.get("url", "")).startswith(("http://", "https://")) else "",
             "publisher": e.get("platform", ""), "day": e.get("published_day") or ""} for e in (rows or [])[:n]]


def _item(r, moves, kind):
    m = moves.get(r["term"]) or {}
    s = r.get("stories") or {}
    return {
        "term": r["term"], "kind": kind, "stage": r.get("stage", ""), "reason": r.get("reason", ""), "live": r.get("stage") in LIVE,
        "category": r.get("category", ""), "field": r.get("field", ""), "age": r.get("age_group", ""), "what": r.get("what", ""),
        "counts": {"recent": s.get("last_14d"), "mid": s.get("d15_45"), "old": s.get("d46_365")}, "first_seen": r.get("first_seen"),
        "change": r.get("change", ""), "evidence": _evidence(r.get("evidence")) or [{"title": h, "url": "", "publisher": "", "day": ""} for h in (r.get("seed_headlines") or [])[:3]],
        "idea": ({"link": m.get("link", ""), "title": m.get("move_title", ""), "what": m.get("what_to_do", ""), "phrase": m.get("example_phrase", ""),
                  "placement": m.get("placement", ""), "products": m.get("products") or [], "needs_check": m.get("needs_check", ""), "checks": m.get("checks") or []}
                 if m else None),
    }


def latest() -> dict:
    """{general: {date, items}, category: {date, items}} — 지금 뜨는 것(live)이 앞. 결과가 없으면 date=None."""
    out = {}
    for kind, suffix in (("general", ""), ("category", "_category")):
        p = _latest_file(suffix)
        if not p:
            out[kind] = {"date": None, "items": []}
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            out[kind] = {"date": None, "items": [], "error": "결과 파일을 읽지 못했어요"}
            continue
        items = [_item(r, d.get("moves") or {}, kind) for r in d.get("items", [])]
        items.sort(key=lambda x: not x["live"])
        out[kind] = {"date": d.get("date"), "items": items, "errors": d.get("errors") or [], "previous": d.get("previous")}
    out["running"] = _run["on"]
    out["last_run"] = _run["last"]
    return out


def _period(start: str, end: str):
    try:
        s, e = date.fromisoformat(start), date.fromisoformat(end)
    except (TypeError, ValueError):
        return None
    if e < s:
        return None
    if (e - s).days > 92:   # 탐색은 93일까지
        e = date.fromordinal(s.toordinal() + 92)
    return {"label": "기획 기간", "start": s.isoformat(), "end": e.isoformat()}


async def discover(q: str, start: str = "", end: str = "") -> dict:
    """명분 하나로 공개 출처 탐색 → 반복 신호(가지 후보)와 새로 나온 말."""
    q = " ".join((q or "").split())[:40]
    if not q:
        return {"signals": [], "emerging": [], "reason": "검색할 말이 없어요"}
    period = _period(start, end)
    res = await discovery.discover(q, [], [], {}, period, bool(period), None, False)
    sigs = []
    for s in res.get("signals", []):
        label = " ".join(str(s.get("label", "")).split())[:20]
        if not label or label.replace(" ", "") == q.replace(" ", ""):
            continue
        ch = s.get("change") or {}
        sigs.append({"label": label, "level": s.get("level", ""), "stories": s.get("stories", 0), "publishers": len(s.get("publisher_groups") or []),
                     "change": {"now": ch.get("current"), "before": ch.get("previous")} if ch else None, "semantic": s.get("kind") == "semantic",
                     "evidence": _evidence(s.get("evidence"), 4), "branch": s.get("level") in SIGNAL_LEVELS})
    em = []
    for t in (res.get("emerging_terms") or [])[:10]:
        if isinstance(t, dict) and t.get("term"):
            em.append({"term": str(t["term"])[:20], "now": t.get("current") or 0, "before": t.get("previous") or 0})
    return {"query": q, "period": res.get("period"), "signals": sigs[:12], "emerging": em, "cached": bool(res.get("cached")),
            "sources": [{"name": p.get("platform"), "state": p.get("state"), "count": p.get("count", 0)} for p in res.get("providers", [])],
            "reason": res.get("reason")}


def run_now() -> dict:
    """주간 실행을 지금 한 번 (백그라운드, 몇 분 걸림). 이미 돌고 있으면 그대로 둔다."""
    with _lock:
        if _run["on"]:
            return {"ok": True, "already": True}
        _run["on"] = True

    def work():
        try:
            _run["last"] = weekly.run()
        except Exception as e:   # noqa: BLE001
            _run["last"] = {"at": datetime.now().strftime("%Y-%m-%d %H:%M"), "results": {"error": f"{type(e).__name__}: {e}"[:200]}}
        finally:
            _run["on"] = False
    threading.Thread(target=work, daemon=True).start()
    return {"ok": True}

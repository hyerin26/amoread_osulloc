# -*- coding: utf-8 -*-
"""
⑤ 확인·전달: 확정 스냅샷, 확정 이후 바뀐 곳, PROMO_WORK 반영 확인, 결과(계획 대비 실적) (plans/05 R16)

기존 plans.confirm_plan / plans.plan_actual과 같은 계산을 통합 기획안에 적용한다 (그 코드는 고치지 않음).
- 확정: 지금 예측(행별 예상 수량·매출·반응도)을 고정 저장. 이후 고쳐도 결과는 이 값과 비교
- 할인 없음(큐레이션) 행은 예측이 없어 스냅샷에서 뺀다
- 반영 확인: 데이터 갱신 후 PROMO_WORK에 같은 SEQ·유형·시작일 행이 있는지. 상태를 자동으로 바꾸지 않고 기획자가 확인한다
"""
from datetime import datetime

from planner import engine

from . import checks, store

SNAP_FIELDS = ("seq", "type", "start", "end", "rate", "name", "expected_qty", "expected_sales", "expected_range", "lift", "lift_band", "base_qty")
KEY_FIELDS = ("seq", "type", "start", "end", "rate")


def _key(r):
    items = r.get("items")
    seq = "+".join(f"{i.get('seq')}x{i.get('qty') or 1}" for i in items) if items else str(r.get("seq") or "")
    return (seq, r.get("type"), r.get("start"), r.get("end") or r.get("start"))


def confirm(pid: str) -> dict:
    doc = store.load(pid)
    rows = [r for r in (doc.get("promo_rows") or []) if r.get("type") != checks.CURATION]
    chk = checks.check(rows)
    doc["snapshot"] = {
        "confirmed_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "data_built_at": engine.DATA.meta.get("built_at"),
        "summary": {k: chk["summary"].get(k) for k in ("expected_sales", "expected_range", "rows")},
        "rows": [{k: r.get(k) for k in SNAP_FIELDS} | {"items": r.get("items")} for r in chk["rows"] if r.get("kind") in ("기존", "신규조합")],
        "all_keys": [list(_key(r)) + [r.get("rate")] for r in (doc.get("promo_rows") or [])],
    }
    doc["status"] = "confirmed"
    store.write_raw(doc)
    return doc


def changes_since(doc: dict) -> dict:
    snap = doc.get("snapshot")
    if not snap:
        return {"confirmed": False}
    before = {tuple(k[:4]): k[4] for k in snap.get("all_keys") or []}
    now = {_key(r): r.get("rate") for r in (doc.get("promo_rows") or [])}
    added = [k for k in now if k not in before]
    removed = [k for k in before if k not in now]
    rate = [k for k in now if k in before and (now[k] or 0) != (before[k] or 0)]
    return {"confirmed": True, "confirmed_at": snap.get("confirmed_at"), "added": len(added), "removed": len(removed),
            "rate_changed": len(rate), "total": len(added) + len(removed) + len(rate)}


def reflect_check(doc: dict) -> dict:
    """PROMO_WORK에 이 기획안 행이 들어갔는지 (같은 SEQ·유형·시작일). 데이터 갱신 이후 기준."""
    engine.DATA.ensure()
    rows = [r for r in (doc.get("promo_rows") or []) if r.get("seq") and not r.get("items")]
    found = 0
    for r in rows:
        if any(h.get("type") == r.get("type") and str(h.get("start"))[:10] == r.get("start") for h in engine.DATA.promos_of(r["seq"])):
            found += 1
    return {"rows": len(rows), "found": found, "data_built_at": engine.DATA.meta.get("built_at"),
            "promo_workbook_modified": engine.DATA.meta.get("promo_workbook_modified")}


def actual(doc: dict) -> dict:
    """확정 스냅샷 vs 실적 (plans.plan_actual과 같은 기준: 세팅 할인율 ±2%p 판매, 출고일 기준)."""
    snap = doc.get("snapshot")
    if not snap:
        return {"snapshot": None, "rows": []}
    engine.DATA.ensure()
    rows, tot_p, tot_a = [], 0, 0
    for r in snap.get("rows") or []:
        if not r.get("seq"):
            continue
        m = next((h for h in engine.DATA.promos_of(r["seq"]) if h.get("type") == r["type"] and str(h.get("start"))[:10] == r["start"]), None)
        act = (m or {}).get("promo_sales")
        st = (m or {}).get("status") or ("PROMO_WORK에 없음" if not m else "")
        rows.append({**{k: r.get(k) for k in SNAP_FIELDS}, "actual_sales": act, "actual_qty": (m or {}).get("promo_qty"),
                     "actual_lift": (m or {}).get("lift"), "status": st,
                     "ratio": act / r["expected_sales"] if act is not None and r.get("expected_sales") else None})
        if act is not None and r.get("expected_sales"):
            tot_p += r["expected_sales"]
            tot_a += act
    return {"snapshot": {k: snap.get(k) for k in ("confirmed_at", "summary", "data_built_at")}, "rows": rows,
            "matched": sum(1 for x in rows if x["actual_sales"] is not None), "expected_sum": tot_p, "actual_sum": tot_a,
            "ratio": tot_a / tot_p if tot_p else None,
            "note": "실적은 PROMO_WORK에 같은 SEQ·유형·시작일로 들어가고 데이터를 갱신한 뒤에 맞춰져요. 실적은 세팅 할인율 ±2%p로 팔린 판매예요."}

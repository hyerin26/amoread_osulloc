# -*- coding: utf-8 -*-
"""
지난 행사 성과: PROMO_WORK 행사 행을 '회차(wave)'로 묶어 성과를 본다.

회차: 같은 프로모션명·유형이고, 앞 행의 종료일과 PROMO_WAVE_GAP_DAYS 넘게 떨어지지 않은 행들의 묶음.
성과 숫자는 build 단계(history.promo_performance)에서 계산한 값을 그대로 합친다.
- 행사 매출·수량: 라인 할인율이 세팅 할인율 ±2%p인 판매(종료 다음 날까지): 쿠폰 등으로 할인율이 달라진 판매는 빠짐
- 반응도: 행사 기간 일평균 수량 ÷ 시작 35~8일 전 일평균. 상시는 하루특가와 섞여 참고만
"""
from datetime import date, timedelta
from statistics import median

from . import config, engine
from .engine import DATA, _d, _f


def _key(promo, ptype, start):
    return f"{promo}|{ptype}|{start}"


def waves():
    """회차 목록 (최근 시작순). 각 회차에 rows(원천 행 인덱스)를 붙여 캐시한다."""
    DATA.ensure()
    cache = getattr(DATA, "_waves_cache", None)
    if cache and cache[0] == DATA._mtime:
        return cache[1]
    groups = {}
    for i, r in enumerate(DATA.promos):
        s = _d(r.get("start"))
        if not s:
            continue
        groups.setdefault((r.get("promo") or "", r.get("type") or ""), []).append((s, _d(r.get("end")) or s, i))
    out = []
    gap = timedelta(days=config.PROMO_WAVE_GAP_DAYS)
    for (promo, ptype), items in groups.items():
        items.sort()
        cur = None
        for s, e, i in items:
            if cur and s <= cur["end"] + gap:
                cur["idx"].append(i)
                cur["end"] = max(cur["end"], e)
            else:
                cur = {"promo": promo, "type": ptype, "start": s, "end": e, "idx": [i]}
                out.append(cur)
    res = [_summarize(w) for w in out]
    res.sort(key=lambda w: w["start"], reverse=True)
    DATA._waves_cache = (DATA._mtime, res)
    return res


def _summarize(w):
    rows = [DATA.promos[i] for i in w["idx"]]
    rates = [_f(r.get("rate")) for r in rows if _f(r.get("rate")) is not None and 0 < _f(r.get("rate")) < 1]
    lifts = [_f(r.get("lift")) for r in rows if _f(r.get("lift")) is not None]
    cras = [_f(r.get("cost_ratio_after")) for r in rows if _f(r.get("cost_ratio_after")) is not None]
    done = [r for r in rows if r.get("status") in ("완료", "진행중")]
    statuses = {r.get("status") for r in rows}
    status = "예정" if statuses == {"예정"} else ("진행중" if "진행중" in statuses or "예정" in statuses else "완료")
    sales = sum(_f(r.get("promo_sales")) or 0 for r in done)
    inc = sum(_inc(r)[1] for r in done)
    return {
        "key": _key(w["promo"], w["type"], w["start"].isoformat()),
        "promo": w["promo"], "type": w["type"], "start": w["start"].isoformat(), "end": w["end"].isoformat(),
        "days": (w["end"] - w["start"]).days + 1, "rows": len(rows), "items": len({str(r.get("seq")) for r in rows}),
        "promo_sales": sales if done else None,
        "promo_qty": sum(_f(r.get("promo_qty")) or 0 for r in done) if done else None,
        "sales_per_row": sales / len(done) if done else None,
        "inc_sales": inc if done and w["type"] == "하루특가" else None,
        "inc_share": inc / sales if done and sales and w["type"] == "하루특가" else None,
        "avg_rate": sum(rates) / len(rates) if rates else None,
        "min_rate": min(rates) if rates else None, "max_rate": max(rates) if rates else None,
        "lift_median": median(lifts) if lifts else None,
        "cra_median": median(cras) if cras else None,
        "over_target": sum(1 for c in cras if c > config.TARGET_COST_RATIO + 1e-9),
        "status": status, "_idx": w["idx"],
    }


def _inc(r):
    """행사 행 하나의 증분: (증분 수량, 증분 매출) = 행사 수량 − 평소 일평균 × 행사 일수, 평균 판매가로 환산.
    평소 = 시작 35~8일 전 일평균(반응도와 같은 창). 음수면 0으로 보지 않고 그대로 둔다(할인했는데 덜 팔린 것)."""
    # 상시는 쿠폰·같은 기간 하루특가 때문에 '세팅 할인율 판매'가 실제보다 적게 잡히고, 비교 창에 대목이 섞이기 쉬워
    # 증분이 크게 틀어진다 → 하루특가(당일 할인율 일치 86%)만 증분을 낸다
    if r.get("type") != "하루특가":
        return 0.0, 0.0
    q, sales, base = _f(r.get("promo_qty")), _f(r.get("promo_sales")), _f(r.get("base_daily_qty"))
    if q is None or sales is None or base is None:
        return 0.0, 0.0
    s, e = _d(r.get("start")), _d(r.get("end")) or _d(r.get("start"))
    last = _d(DATA.meta.get("sales_last_day")) or e
    days = max(1, (min(e, last) - s).days + 1)
    iq = q - base * days
    unit = sales / q if q else 0
    return iq, iq * unit


def lessons(w, items):
    """회차 교훈(규칙): 깊은 할인의 증분 기여, 반응 약한 품목과 쉰 기간, 같은 회차 안 할인 구간별 반응."""
    out = []
    done = [x for x in items if x.get("promo_sales") is not None and x.get("rate")]
    if not done:
        return out
    if w["type"] != "하루특가":
        rates = sorted(x["rate"] for x in done)
        out.append(f"상시 {len(done)}품목 · 할인 {rates[0]:.0%}~{rates[-1]:.0%}. 상시는 쿠폰·하루특가와 섞여 증분을 정확히 재기 어려워요. "
                   "판매가 첫 3~5일에 몰리는 경향(레버 보드)을 보고 길이·중간 계기를 정하세요.")
        return out
    tot_inc = sum(x["inc_sales"] or 0 for x in done)
    deep = [x for x in done if x["rate"] >= 0.36]
    if deep and tot_inc > 0:
        share = sum(x["inc_sales"] or 0 for x in deep) / tot_inc
        out.append(f"36% 이상 품목 {len(deep)}개가 증분 매출의 {share:.0%}를 만들었어요.")
    weak = [x for x in done if x.get("lift") is not None and x["lift"] < 1.5]
    if weak:
        near = [x for x in weak if x.get("gap") is not None and x["gap"] <= 14]
        out.append(f"평소 대비 1.5배 미만으로 반응이 약한 품목 {len(weak)}개" +
                   (f": 그중 {len(near)}개는 14일 안에 또 특가한 상품이었어요." if near else "."))
    bands = {}
    for x in done:
        if x.get("lift") is not None:
            bands.setdefault(engine._depth(x["rate"]), []).append(x["lift"])
    if len(bands) >= 2:
        med = {b: sorted(v)[len(v) // 2] for b, v in bands.items()}
        best = max(med, key=med.get)
        out.append("할인 구간별 반응(중앙): " + " · ".join(f"{b} {v:.1f}배" for b, v in med.items()) + f" → {best}가 가장 잘 먹혔어요.")
    neg = [x for x in done if (x["inc_sales"] or 0) < 0]
    if neg:
        out.append(f"할인했는데 평소보다 덜 팔린 품목 {len(neg)}개: 다음엔 빼거나 다른 계기를 붙여 보세요.")
    return out


def _public(w):
    return {k: v for k, v in w.items() if not k.startswith("_")}


def list_waves(query=None, ptype=None, limit=300):
    q = (query or "").replace(" ", "").lower()
    out = []
    for w in waves():
        if ptype and w["type"] != ptype:
            continue
        if q and q not in w["promo"].replace(" ", "").lower():
            continue
        out.append(_public(w))
    return out[:limit]


def last_year_waves(today=None, before=14, after=60):
    """작년 이맘때(1년 전 오늘 -before ~ +after일)에 시작한 회차."""
    today = today or date.today()
    c = today - timedelta(days=config.LAST_YEAR_OFFSET)
    d0, d1 = c - timedelta(days=before), c + timedelta(days=after)
    return {"from": d0.isoformat(), "to": d1.isoformat(),
            "waves": [_public(w) for w in waves() if d0 <= _d(w["start"]) <= d1 and w["status"] == "완료"]}


def wave_detail(key):
    w = next((x for x in waves() if x["key"] == key), None)
    if not w:
        return None
    items = []
    for i in w["_idx"]:
        r = DATA.promos[i]
        p = DATA.products.get(str(r.get("seq"))) or {}
        rate = _f(r.get("rate"))
        price, cost = _f(p.get("price")), _f(p.get("cost"))
        now_cra = engine.cost_ratio_after(price, cost, rate) if price and cost is not None and rate and rate < 1 else None
        iq, isales = _inc(r) if r.get("status") in ("완료", "진행중") and r.get("type") == "하루특가" else (None, None)
        prev = [h for h in DATA.promos_of(r.get("seq")) if h.get("type") == "하루특가" and _d(h.get("end"))
                and _d(r.get("start")) and _d(h.get("end")) < _d(r.get("start"))]
        gap = (_d(r.get("start")) - max(_d(h["end"]) for h in prev)).days if prev and r.get("type") == "하루특가" else None
        items.append({"zone": r.get("category_tag") or "", "inc_qty": iq, "inc_sales": isales, "base_daily_qty": _f(r.get("base_daily_qty")), "gap": gap,
                      "seq": str(r.get("seq")), "name": p.get("name") or r.get("item_name"), "type": r.get("type"),
                      "start": r.get("start"), "end": r.get("end"), "rate": rate,
                      "promo_qty": _f(r.get("promo_qty")), "promo_sales": _f(r.get("promo_sales")),
                      "lift": _f(r.get("lift")), "match_share": _f(r.get("match_share")),
                      "cost_ratio_after": _f(r.get("cost_ratio_after")), "status": r.get("status"),
                      "now_active": bool(p.get("active")), "now_cost_ratio_after": now_cra,
                      "now_max_discount": _f(p.get("max_discount")), "exists": bool(p)})
    items.sort(key=lambda x: (x["start"] or "", -(x["promo_sales"] or 0)))
    return {**_public(w), "items_detail": items, "lessons": lessons(w, items),
            "note": "행사 매출·수량 = 세팅 할인율 ±2%p로 팔린 판매(종료 다음 날까지). 증분 = 행사 수량 − 평소(시작 35~8일 전 일평균) × 일수를 "
                      "평균 판매가로 환산. '지금 원가율'은 현재 원가로 같은 할인율을 다시 계산한 값"}


def find_waves(keyword, limit=8):
    """Claude 도구용: 이름에 keyword가 들어간 지난 회차 + 매출 상위 품목."""
    out = []
    for w in list_waves(keyword, limit=limit):
        d = wave_detail(w["key"])
        top = sorted((x for x in d["items_detail"] if x["promo_sales"]), key=lambda x: -x["promo_sales"])[:8]
        out.append({**w, "top_items": [{k: x[k] for k in ("seq", "name", "rate", "promo_sales", "lift", "now_active",
                                                         "now_cost_ratio_after")} for x in top]})
    return out

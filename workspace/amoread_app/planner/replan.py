# -*- coding: utf-8 -*-
"""
지난 행사 다시 기획: 작년 품목·할인율은 그대로 두고 날짜만 올해로 옮긴다. 안 팔리게 된 상품만 비슷한 상품으로 바꾼다. (규칙, AI·비용 없음)
사용자 확정(2026-10-19): "작년이랑 비슷하게 = 할인율·품목을 비슷하게". 원가율은 고정 기준이 아니라 참고로만 표시한다.

1 묶기     같은 행사명이 붙은 회차(상시·하루특가)를 한 묶음으로. types로 하루특가만/상시만 고를 수 있다
2 옮기기   요청 시작일이 있으면 그 날 기준, 없으면 364일 뒤(같은 요일). 이미 지났으면 다음 월요일 기준으로 같은 간격 유지
3 판정     품목마다
           - 지금 안 팔림(최근 90일 판매 없음)  → 교체 (같은 카테고리·가격대, 작년 그 자리 할인율 그대로)
           - 할인 없는 노출 행(0%)               → 뺌
           - 나머지는 작년 할인율 그대로 유지. 반응 약함·매출 감소·다른 행사와 겹침은 '확인해 볼 것'으로, 원가율 초과는 참고로만 알린다
4 교체     점수 순: 최근 28일 매출 + 성장 + (하루특가면) 60일 넘게 쉼 + 리뷰 반응 좋음.
           이미 들어간 상품·다른 행사와 겹침·14일 안 하루특가는 제외. 올해 같은 이름 행사는 지금 짜는 그 행사라 겹침으로 보지 않는다
5 추가     작년 구성에 없던 '올해 뜬 베스트'를 상시에 최대 몇 개 추가 (상시를 짤 때만, 작년 상시 할인율 중앙값)
결과: 기획안 행 + 변경 내역(유지·교체·뺌·추가·확인해 볼 것·원가율 참고)
"""
from datetime import date, timedelta

from . import config, engine, review
from .engine import DATA, _d, _f

BANDS = [b[2] for b in config.PRICE_BANDS]


def _monday_after(d):
    return d + timedelta(days=(7 - d.weekday()) % 7 or 7)


def _core(name):
    """'25블프' → '블프' (연도 접두를 떼고 공백 제거): 작년·올해 같은 행사 이름 비교용."""
    n = (name or "").replace(" ", "")
    return n.lstrip("0123456789") or n


def find_waves(query):
    """행사명에 query가 든 완료 회차 중 가장 최근 시작 묶음(상시·하루특가가 7일 안에 시작하면 한 묶음)."""
    q = (query or "").replace(" ", "")
    ws = [w for w in review.waves() if w["status"] == "완료" and q and q in w["promo"].replace(" ", "")]
    if not ws:
        return []
    ws.sort(key=lambda w: w["start"], reverse=True)
    anchor = _d(ws[0]["start"])
    return [w for w in ws if abs((_d(w["start"]) - anchor).days) <= 7]


def _score(p, ptype, day, reviews):
    s = (_f(p.get("sales_28")) or 0) / 1e6
    g = _f(p.get("growth_28"))
    if g is not None:
        s += max(-0.5, min(1.0, g)) * 0.8
    if ptype == "하루특가":
        last = _d(p["last_deal_end"]) if p.get("last_deal_end") else None
        rest = (day - last).days if last and last < day else None
        s += 1.2 if rest is None or rest >= 61 else (0.4 if rest >= 31 else -1.0)
    r = reviews.get(str(p["seq"]))
    if r and r.get("n", 0) >= 3 and (r.get("avg") or 0) >= 4.7:
        s += 0.5
    return s


def _cra(p, rate):
    price, cost = _f(p.get("price")), _f(p.get("cost"))
    return engine.cost_ratio_after(price, cost, rate) if price and cost is not None and rate and rate < 1 else None


def _overlap_other(p, d0, d1, core, ptype=None):
    """지금 짜는 행사(같은 이름)를 뺀 다른 행사 중 이 기간과 겹치는 첫 행사."""
    for u in DATA.promos_of(p["seq"]):
        if core and core in (u.get("promo") or "").replace(" ", ""):
            continue
        if ptype and u.get("type") != ptype:
            continue
        s = _d(u.get("start"))
        e = _d(u.get("end")) or s
        if s and s <= d1 and e >= d0:
            return u
    return None


def _rate_dist(rows):
    """유형별 할인율 분포: {'하루특가': [['45%', 3], ['40%', 10], ...]} (높은 할인부터)"""
    out = {}
    for r in rows:
        k = f"{round(r['rate'] * 100)}%"
        out.setdefault(r["type"], {}).setdefault(k, 0)
        out[r["type"]][k] += 1
    return {t: sorted(v.items(), key=lambda kv: -int(kv[0][:-1])) for t, v in out.items()}


def refresh(query=None, keys=None, start=None, add_new=5, target=None, types=None):
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    from . import reviews as rv
    rstats, _ = rv.by_seq()
    ws = [w for w in review.waves() if w["key"] in (keys or [])] if keys else find_waves(query)
    if types:
        ws = [w for w in ws if w["type"] in types]
    if not ws:
        kind = f" {'·'.join(types)}" if types else ""
        return {"ok": False, "message": f"'{query}'{kind}이(가) 이름에 든 끝난 행사를 찾지 못했어요."}
    core = _core(ws[0]["promo"])
    w0 = min(_d(w["start"]) for w in ws)
    today = date.today()
    if start:
        ns = _d(start)
    else:
        ns = w0 + timedelta(days=config.LAST_YEAR_OFFSET)
        if ns <= today:
            ns = _monday_after(today)
    off = (ns - w0).days
    items = []
    for w in ws:
        items += [{**x, "wave_type": w["type"], "promo": w["promo"]} for x in review.wave_detail(w["key"])["items_detail"]]
    # 같은 상품·유형·시작일 중복 제거
    seen, uniq = set(), []
    for x in items:
        k = (x["seq"], x["type"], x["start"])
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    items = uniq
    s28 = sorted((_f((DATA.products.get(x["seq"]) or {}).get("sales_28")) or 0) for x in items)
    low_cut = s28[len(s28) // 4] if s28 else 0
    used = {x["seq"] for x in items}
    rows = []
    log = {"kept": [], "rate": [], "replaced": [], "dropped": [], "added": [], "watch": []}

    def pool_for(x, day):
        p0 = DATA.products.get(x["seq"]) or {}
        cat, band = p0.get("category"), p0.get("price_band")
        bi = BANDS.index(band) if band in BANDS else None
        near = {band} | ({BANDS[bi - 1]} if bi else set()) | ({BANDS[bi + 1]} if bi is not None and bi + 1 < len(BANDS) else set())
        e = day if x["type"] == "하루특가" else day + timedelta(days=(_d(x["end"]) - _d(x["start"])).days)
        out = []
        for p in DATA.products.values():
            if str(p["seq"]) in used or not p.get("active") or str(p.get("name", "")).startswith("["):
                continue
            if cat and p.get("category") != cat:
                continue
            if band and p.get("price_band") not in near:
                continue
            if _overlap_other(p, day, e, core):
                continue
            if x["type"] == "하루특가" and any(
                    h.get("type") == "하루특가" and _d(h.get("start")) and abs((_d(h["start"]) - day).days) <= 14
                    and core not in (h.get("promo") or "").replace(" ", "") for h in DATA.promos_of(p["seq"])):
                continue
            out.append(p)
        out.sort(key=lambda p: -_score(p, x["type"], day, rstats))
        return out

    for x in items:
        day = _d(x["start"]) + timedelta(days=off)
        end = (_d(x["end"]) or _d(x["start"])) + timedelta(days=off)
        p = DATA.products.get(x["seq"])
        name = x.get("name")
        rate = x.get("rate")
        if not rate:
            log["dropped"].append({"name": name, "why": "할인 없는 노출 행(0%)"})
            continue
        if not p or not p.get("active"):
            why = "최근 90일 판매 없음"
            pick = next(iter(pool_for(x, day)), None)
            if not pick:
                log["dropped"].append({"name": name, "why": why + " · 같은 카테고리·가격대 대체 상품 없음"})
                continue
            used.add(str(pick["seq"]))
            log["replaced"].append({"from": name, "to": pick["name"], "why": why,
                                    "pick_why": f"28일 {(_f(pick.get('sales_28')) or 0) / 1e4:,.0f}만원"
                                                + (f" · 직전 대비 {(_f(pick.get('growth_28')) or 0) * 100:+.0f}%"
                                                   if pick.get("growth_28") is not None else "")})
            p = pick
            memo = f"작년 {name} {rate:.0%} → 교체(할인율 유지)"
        else:
            log["kept"].append(p["name"])
            memo = f"작년 {rate:.0%} 유지"
            notes = []
            if x["type"] == "하루특가" and x.get("lift") is not None and x["lift"] < 1.5:
                notes.append(f"작년 반응 약함(평소의 {x['lift']:.1f}배)")
            if (_f(p.get("sales_28")) or 0) <= low_cut and (_f(p.get("growth_28")) or 0) < 0 and len(items) >= 8:
                notes.append(f"요즘 매출 하위권·감소 중(28일 {(_f(p.get('sales_28')) or 0) / 1e4:,.0f}만원)")
            u = _overlap_other(p, day, end, core, x["type"])
            if u:
                notes.append(f"다른 {u.get('type')} 행사와 겹침: {u.get('promo')} {_d(u['start']):%m/%d}~")
            if notes:
                log["watch"].append({"name": p["name"], "why": " · ".join(notes)})
        cra = _cra(p, rate)
        if cra is not None and cra > target + 1e-9:
            log["rate"].append({"name": p["name"], "rate": rate, "cost_ratio": cra})
        rows.append({"promo": x["promo"], "type": x["type"], "start": day.isoformat(), "end": end.isoformat(), "seq": str(p["seq"]),
                     "items": None, "rate": rate, "appeal": "", "category_tag": x.get("zone") if x.get("zone") not in (None, "-") else "",
                     "clearance": False, "memo": memo})
    # 올해 뜬 베스트 추가 (상시 묶음이 있을 때)
    sangsi = [r for r in rows if r["type"] == "상시"]
    if sangsi and add_new:
        s0, e0 = _d(sangsi[0]["start"]), _d(sangsi[0]["end"])
        cats = {(DATA.products.get(r["seq"]) or {}).get("category") for r in sangsi}
        cand = [p for p in DATA.products.values() if p.get("active") and str(p["seq"]) not in used
                and p.get("category") in cats and (_f(p.get("growth_28")) or 0) >= 0.3 and (_f(p.get("sales_28")) or 0) >= 500_000
                and not str(p.get("name", "")).startswith("[") and not _overlap_other(p, s0, e0, core)]
        cand.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
        base_rate = sorted(r["rate"] for r in sangsi)[len(sangsi) // 2]
        for p in cand[:add_new]:
            used.add(str(p["seq"]))
            rows.append({"promo": sangsi[0]["promo"], "type": "상시", "start": s0.isoformat(), "end": e0.isoformat(), "seq": str(p["seq"]),
                         "items": None, "rate": base_rate, "appeal": "", "category_tag": "", "clearance": False,
                         "memo": f"올해 뜬 베스트 추가(작년 상시 중앙 {base_rate:.0%})"})
            log["added"].append({"name": p["name"], "why": f"28일 {(_f(p.get('sales_28')) or 0) / 1e4:,.0f}만원 · "
                                                           f"직전 대비 {(_f(p.get('growth_28')) or 0) * 100:+.0f}%"})
    # 같은 상품이 여러 날 들어가도 알림은 한 번만
    for k in ("watch", "rate"):
        seen_n, keep = set(), []
        for v in log[k]:
            if v["name"] not in seen_n:
                seen_n.add(v["name"])
                keep.append(v)
        log[k] = keep
    chk = engine.check_plan(rows)
    booked = [{"promo": w["promo"], "type": w["type"], "start": w["start"], "end": w["end"], "rows": w["rows"]}
              for w in review.waves() if w["status"] != "완료" and core in w["promo"].replace(" ", "")
              and (not types or w["type"] in types)]
    src = [{"promo": w["promo"], "type": w["type"], "start": w["start"], "end": w["end"], "rows": w["rows"],
            "promo_sales": w["promo_sales"], "avg_rate": w["avg_rate"]} for w in ws]
    return {"ok": True, "source": src, "booked": booked, "offset": off, "start": ns.isoformat(), "requested_start": bool(start),
            "rows": rows, "log": log,
            "summary": {"rows": len(rows), "kept": len(log["kept"]), "rate": len(log["rate"]), "replaced": len(log["replaced"]),
                        "dropped": len(log["dropped"]), "added": len(log["added"]), "watch": len(log["watch"]),
                        "expected_sales": chk["summary"]["expected_sales"], "expected_range": chk["summary"]["expected_range"],
                        "errors": chk["summary"]["errors"], "rate_dist": _rate_dist(rows),
                        "ly_rate_dist": _rate_dist([x for x in items if x.get("rate")])},
            "title": f"{ws[0]['promo']} 다시 기획: 작년 품목·할인율 유지 (원본 {w0:%y.%m.%d})",
            "note": "작년 품목·할인율·날짜 리듬을 그대로 옮겼어요(AI 아님). 최근 90일 판매가 없는 상품만 같은 카테고리·가격대에서 "
                    "요즘 매출·성장·쉰 기간·리뷰 점수 순으로 바꾸고, 그 자리 할인율은 작년 그대로 썼어요. 원가율은 참고로만 표시해요."}

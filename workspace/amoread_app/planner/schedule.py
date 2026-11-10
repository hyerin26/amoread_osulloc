# -*- coding: utf-8 -*-
"""
행사 캘린더 · 시즌 일정 · 찻잎이 '오늘의 체크' 알림.

- 캘린더: PROMO_WORK에 잡힌 행사(상시는 기간 막대, 하루특가는 날짜별 품목)와 시즌 이벤트를 날짜 격자로.
  기획안 행은 브라우저가 가진 값이라 화면에서 겹쳐 그린다(서버는 PROMO_WORK만).
- 시즌 일정: settings/시즌일정.csv (화면에서 수정). 날짜가 확실하지 않은 건 메모에 '확인 필요'.
- 알림: 전부 규칙으로 계산한 문장(AI 아님). 숫자는 이 파일과 engine이 계산한다.
"""
import csv
import re
from datetime import date, datetime, timedelta

from . import config, engine, review
from .engine import DATA, _d, _f
from .ideas import _floor5, _recent_daily_deal, _usual_rate

WEEKDAYS = "월화수목금토일"
DEAL_CATS = ("티 세트", "티 제품", "티푸드")
GAP_ALERT_DAYS = 14          # 앞으로 이 기간에 하루특가 빈 날이 있으면 알림
ENDING_ALERT_DAYS = 3        # 진행 중 행사가 이 기간 안에 끝나면 알림
SEASON_HEADS_UP_DAYS = 7     # 시즌 준비 시작일이 이 기간 안으로 들어오면 알림


def _wd(d):
    return WEEKDAYS[d.weekday()]


# ----------------------------------------------------------------------
# 명분 사전 (CSV) — 명절·기념일·절기·세시·학사·직장·차 고유·날씨·쇼핑
# ----------------------------------------------------------------------
SEASON_HEAD = ["날짜", "종료일", "이름", "종류", "준비시작(일전)", "지난행사키워드", "씨앗", "메모"]
KINDS = ["명절·대목", "기념일", "절기·세시", "학사·생활", "직장", "차 고유", "날씨·계절", "쇼핑", "트렌드"]   # 트렌드: 매년 반복되지 않는 그 시기의 명분 (AMOREAD R12-1)
KIND_ICON = {"명절·대목": "🎁", "기념일": "💌", "절기·세시": "🌙", "학사·생활": "🎓", "직장": "💼", "차 고유": "🍵",
             "날씨·계절": "🌦", "쇼핑": "🛍"}
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
efficacy_flags = engine.efficacy_flags


def _read_csv_rows(path):
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            return list(csv.reader(f))
    except UnicodeDecodeError:
        with open(path, encoding="cp949", newline="") as f:
            return list(csv.reader(f))


def read_seasons():
    path = config.SEASON_CSV
    if not path.exists():
        return []
    rows = _read_csv_rows(path)
    out = []
    for r in rows[1:]:
        r = (r + [""] * 8)[:8]
        if not _DATE.match(r[0].strip()):
            continue
        d0 = _d(r[0].strip())
        d1 = _d(r[1].strip()) if _DATE.match(r[1].strip()) else d0
        try:
            lead = max(0, min(120, int(float(r[4] or 21))))
        except ValueError:
            lead = 21
        kind = r[3].strip() if r[3].strip() in KINDS else "기념일"
        seeds = [x.strip()[:60] for x in r[6].split("|") if x.strip()][:4]
        out.append({"date": d0.isoformat(), "end": max(d0, d1).isoformat(), "name": r[2].strip()[:30], "kind": kind,
                    "icon": KIND_ICON.get(kind, "•"), "lead": lead, "keyword": r[5].strip()[:20], "seeds": seeds,
                    "memo": r[7].strip()[:120], "range": (max(d0, d1) - d0).days >= 7})
    return sorted(out, key=lambda e: e["date"])


def save_seasons(items):
    clean = []
    for it in items[:300]:
        d0, d1 = str(it.get("date") or "").strip(), str(it.get("end") or "").strip()
        name = str(it.get("name") or "").strip()
        if not _DATE.match(d0) or not name:
            continue
        if d1 and (not _DATE.match(d1) or d1 == d0):
            d1 = ""
        try:
            lead = max(0, min(120, int(it.get("lead") or 0)))
        except (TypeError, ValueError):
            lead = 21
        kind = it.get("kind") if it.get("kind") in KINDS else "기념일"
        seeds = it.get("seeds")
        seeds = "|".join(x.strip()[:60] for x in (seeds if isinstance(seeds, list) else str(seeds or "").split("|")) if x.strip())
        clean.append([d0, d1, name[:30], kind, lead, str(it.get("keyword") or "").strip()[:20], seeds[:250],
                      str(it.get("memo") or "").strip()[:120]])
    clean.sort()
    config.SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.SEASON_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(SEASON_HEAD)
        w.writerows(clean)
    return len(clean)


def _past_waves(e, limit=3):
    """이 명분으로 했던 지난 행사 회차: 키워드(없으면 이름)가 행사명에 든 완료 회차, 최근순."""
    keys = [k for k in {(e.get("keyword") or "").replace(" ", ""), e["name"].replace(" ", "")} if len(k) >= 2]
    out = []
    for w in review.waves():
        nm = w["promo"].replace(" ", "")
        if w["status"] == "완료" and any(k in nm for k in keys):
            out.append({"key": w["key"], "promo": w["promo"], "type": w["type"], "start": w["start"], "end": w["end"],
                        "rows": w["rows"], "promo_sales": w["promo_sales"], "avg_rate": w["avg_rate"],
                        "lift_median": w["lift_median"]})
    return out[:limit]


def _ly_index(e):
    """작년 같은 달 몰 매출 지수(월 계절 지수)."""
    d0 = _d(e["date"])
    for y in DATA.levers.get("month_index", []):
        if y["year"] == d0.year - 1:
            return y["index"][d0.month - 1]
    return None


def _season_status(e, today):
    """명분 하나: D-day, 준비 시작일, 그 기간에 이미 잡힌 행사, 지난 성과, 작년 같은 달 지수."""
    d0, d1 = _d(e["date"]), _d(e["end"])
    prep = d0 - timedelta(days=e["lead"])
    kw = (e.get("keyword") or "").replace(" ", "")
    # 키워드가 있으면 준비 시작~종료 사이의 '이름에 키워드가 든' 행사, 없으면 당일(기간)에 진행되는 모든 행사
    lo = prep if kw else d0
    booked = {}
    for r in DATA.promos:
        s, t = _d(r.get("start")), _d(r.get("end"))
        if not s or not t or s > d1 or t < lo:
            continue
        name = r.get("promo") or ""
        if kw and kw not in name.replace(" ", ""):
            continue
        k = f"{name} {r.get('type')}"
        booked[k] = booked.get(k, 0) + 1
    ly = []
    if kw:
        off = timedelta(days=config.LAST_YEAR_OFFSET)
        lo2, hi = prep - off - timedelta(days=30), d1 - off + timedelta(days=30)
        ly = [{"key": w["key"], "promo": w["promo"], "type": w["type"], "start": w["start"], "end": w["end"],
               "rows": w["rows"], "promo_sales": w["promo_sales"]}
              for w in review.waves() if kw in w["promo"].replace(" ", "") and lo2 <= _d(w["start"]) <= hi]
    return {**e, "d_day": (d0 - today).days, "prep_start": prep.isoformat(),
            "booked": [{"name": k, "rows": n} for k, n in sorted(booked.items(), key=lambda x: -x[1])],
            "booked_scope": "keyword" if kw else "day",
            "last_year": ly, "past": _past_waves(e), "month_index_ly": _ly_index(e),
            "seed_flags": sorted({w for sd in e["seeds"] for w in efficacy_flags(sd)})}


def seasons_view(today=None):
    DATA.ensure()
    today = today or date.today()
    return [_season_status(e, today) for e in read_seasons() if _d(e["end"]) >= today - timedelta(days=7)]


# ----------------------------------------------------------------------
# 캘린더
# ----------------------------------------------------------------------
def calendar(start=None, days=28):
    DATA.ensure()
    today = date.today()
    d0 = _d(start) if start else today - timedelta(days=today.weekday())
    d0 = d0 - timedelta(days=d0.weekday())               # 월요일부터
    days = max(7, min(int(days or 28), 63))
    d1 = d0 + timedelta(days=days - 1)
    seasons = read_seasons()
    cells = {(d0 + timedelta(days=i)).isoformat(): {"date": (d0 + timedelta(days=i)).isoformat(),
                                                    "wd": _wd(d0 + timedelta(days=i)), "deals": [], "seasons": [],
                                                    "running": 0,
                                                    "wd_index": (DATA.levers.get("weekday_index") or [1] * 7)[(d0 + timedelta(days=i)).weekday()]}
             for i in range(days)}
    bars = {}
    for r in DATA.promos:
        s, e = _d(r.get("start")), _d(r.get("end"))
        if not s:
            continue
        e = e or s
        if s > d1 or e < d0:
            continue
        p = DATA.products.get(str(r.get("seq"))) or {}
        if r.get("type") == "하루특가":
            for i in range((min(e, d1) - max(s, d0)).days + 1):
                k = (max(s, d0) + timedelta(days=i)).isoformat()
                cells[k]["deals"].append({"seq": str(r.get("seq")), "name": p.get("name") or r.get("item_name"),
                                          "rate": _f(r.get("rate")), "promo": r.get("promo")})
            continue
        k = (r.get("promo") or "", r.get("type") or "")
        b = bars.setdefault(k, {"promo": k[0], "type": k[1], "start": s, "end": e, "rows": 0, "rates": []})
        b["start"], b["end"] = min(b["start"], s), max(b["end"], e)
        b["rows"] += 1
        if _f(r.get("rate")) is not None and 0 < _f(r.get("rate")) < 1:
            b["rates"].append(_f(r.get("rate")))
    for b in bars.values():
        for i in range((min(b["end"], d1) - max(b["start"], d0)).days + 1):
            cells[(max(b["start"], d0) + timedelta(days=i)).isoformat()]["running"] += 1
    for ev in seasons:
        s, e = _d(ev["date"]), _d(ev["end"])
        prep = s - timedelta(days=ev["lead"])
        for k, c in cells.items():
            dk = _d(k)
            if s <= dk <= e:
                # 긴 기간(환절기·장마 등)은 첫날과 주 첫날에만 칩을 달아 칸이 붐비지 않게
                if not ev["range"] or dk == s or dk == d0 or dk.weekday() == 0:
                    c["seasons"].append({"name": ev["name"], "kind": "range" if ev["range"] else "day", "type": ev["kind"],
                                         "icon": ev["icon"], "cont": ev["range"] and dk != s})
            elif dk == prep and ev["lead"] > 0:
                c["seasons"].append({"name": f"{ev['name']} 준비", "kind": "prep", "type": ev["kind"], "icon": ev["icon"]})
    out_bars = sorted(({"promo": b["promo"], "type": b["type"], "start": b["start"].isoformat(), "end": b["end"].isoformat(),
                        "rows": b["rows"], "min_rate": min(b["rates"]) if b["rates"] else None,
                        "max_rate": max(b["rates"]) if b["rates"] else None} for b in bars.values()),
                      key=lambda b: (b["start"], -b["rows"]))
    future = [c for c in cells.values() if _d(c["date"]) > today]
    gaps = [c["date"] for c in future if not c["deals"]]
    return {"start": d0.isoformat(), "end": d1.isoformat(), "today": today.isoformat(),
            "days": list(cells.values()), "bars": out_bars,
            "summary": {"deal_gap_days": gaps, "future_days": len(future),
                        "deal_items": sum(len(c["deals"]) for c in cells.values()), "bars": len(out_bars),
                        "max_deals_per_day": engine.DAILY_DEAL_MAX_PER_DAY},
            "seasons": [e for e in seasons if _d(e["end"]) >= d0 and _d(e["date"]) - timedelta(days=e["lead"]) <= d1],
            "note": "PROMO_WORK 기준(스냅샷). 기획안 행은 '기획안 함께 보기'를 켜면 점선으로 겹쳐 보입니다"}


def deal_candidates(day, limit=10, exclude=()):
    """그 날 하루특가로 넣을 만한 상품: 35% 이상 할인 여력, 14일 안 하루특가 없음, 그 날 하루특가 없음, 28일 매출순."""
    DATA.ensure()
    d = _d(day)
    exclude = {str(x) for x in exclude}
    out = []
    for p in DATA.products.values():
        if not p.get("active") or p.get("cost") is None or not _f(p.get("price")):
            continue
        if str(p["seq"]) in exclude or str(p.get("name", "")).startswith("[") or p.get("category") not in DEAL_CATS:
            continue
        md = _f(p.get("max_discount"))
        if md is None or md < 0.30 or _recent_daily_deal(p, d):
            continue
        rate = min(_floor5(_usual_rate(p, "하루특가")), _floor5(md), 0.40)
        if rate < 0.25:
            continue
        sim = engine.simulate_single(p["seq"], rate, "하루특가")
        last = next((h for h in sorted(DATA.promos_of(p["seq"]), key=lambda h: h.get("start") or "", reverse=True)
                     if h.get("type") == "하루특가" and _d(h.get("start")) and _d(h.get("start")) < d), None)
        out.append({**engine.compact(p), "suggest_rate": rate, "exp_qty": sim.get("daily_qty"),
                    "exp_sales": sim.get("daily_sales"), "exp_profit": sim.get("daily_profit"),
                    "last_deal": last.get("start") if last else None, "last_deal_rate": _f(last.get("rate")) if last else None})
    out.sort(key=lambda r: -(_f(r.get("sales_28")) or 0))
    return out[:limit]


def day_detail(day, exclude=()):
    DATA.ensure()
    d = _d(day)
    deals, running = [], {}
    for r in DATA.promos:
        s, e = _d(r.get("start")), _d(r.get("end"))
        if not s:
            continue
        e = e or s
        if not (s <= d <= e):
            continue
        p = DATA.products.get(str(r.get("seq"))) or {}
        if r.get("type") == "하루특가":
            deals.append({"seq": str(r.get("seq")), "name": p.get("name") or r.get("item_name"), "promo": r.get("promo"),
                          "rate": _f(r.get("rate")), "cost_ratio_after": _f(r.get("cost_ratio_after")),
                          "promo_sales": _f(r.get("promo_sales")), "lift": _f(r.get("lift")), "status": r.get("status")})
        else:
            k = f"{r.get('promo')}|{r.get('type')}"
            g = running.setdefault(k, {"promo": r.get("promo"), "type": r.get("type"), "rows": 0, "rates": [],
                                       "start": s.isoformat(), "end": e.isoformat()})
            g["rows"] += 1
            g["start"], g["end"] = min(g["start"], s.isoformat()), max(g["end"], e.isoformat())
            if _f(r.get("rate")):
                g["rates"].append(_f(r.get("rate")))
    seasons = [e for e in read_seasons() if _d(e["date"]) - timedelta(days=e["lead"]) <= d <= _d(e["end"])]
    for g in running.values():
        rs = g.pop("rates")
        g["min_rate"], g["max_rate"] = (min(rs), max(rs)) if rs else (None, None)
    exclude = set(exclude) | {x["seq"] for x in deals}
    return {"date": d.isoformat(), "wd": _wd(d), "deals": deals,
            "running": sorted(running.values(), key=lambda g: -g["rows"]),
            "seasons": [{**e, "d_day": (_d(e["date"]) - d).days} for e in seasons],
            "candidates": deal_candidates(d, exclude=exclude) if d > date.today() else [],
            "ly": engine.last_year_top(d.isoformat(), d.isoformat(), limit=5),
            "note": "후보: 원가율 기준 최대 할인 30% 이상, 앞뒤 14일 안 하루특가 없음, 28일 매출순 (제안 할인율은 가격대별 평소 하루특가 할인율, 최대 40%). "
                    "예상 수량·매출·이익은 최근 28일 일평균 × 과거 하루특가 반응도(참고치)"}


# ----------------------------------------------------------------------
# 찻잎이 '오늘의 체크' (규칙 기반 알림)
# ----------------------------------------------------------------------
def _month_of_sheet(sheet):
    m = re.match(r"\s*(\d{2})\.(\d{1,2})월", str(sheet or ""))
    return (2000 + int(m.group(1)), int(m.group(2))) if m else None


def alerts(today=None):
    DATA.ensure()
    today = today or date.today()
    out = []
    meta = DATA.meta
    last = _d(meta.get("sales_last_day"))
    if last and (today - last).days > 3:
        out.append({"id": f"stale:{last}", "level": "important", "title": "실적이 오래됐어요",
                    "text": f"판매실적이 {last:%m/%d}까지예요 ({(today - last).days}일 전). 실적 CSV를 교체하고 [데이터 갱신]을 눌러 주세요.",
                    "action": {"view": "settings"}})
    ym = _month_of_sheet(meta.get("cost_sheet"))
    if ym and (today.year - ym[0]) * 12 + today.month - ym[1] >= 2:
        out.append({"id": f"cost:{meta.get('cost_sheet')}:{today:%Y-%m}", "level": "info", "title": "원가 기준 확인",
                    "text": f"원가는 '{meta.get('cost_sheet')}' 이동평균가 기준이에요. 새 온라인 가이드가 나왔으면 [설정]에서 올려 주세요.",
                    "action": {"view": "settings"}})

    # 하루특가 빈 날 (내일부터 14일)
    cal = calendar((today + timedelta(days=1)).isoformat(), 21)
    window = [c for c in cal["days"] if today < _d(c["date"]) <= today + timedelta(days=GAP_ALERT_DAYS)]
    gaps = [c for c in window if not c["deals"]]
    if gaps:
        names = ", ".join(f"{_d(c['date']):%m/%d}({c['wd']})" for c in gaps[:6]) + (" 외" if len(gaps) > 6 else "")
        out.append({"id": f"gap:{today}:{len(gaps)}", "level": "important", "title": f"하루특가 빈 날 {len(gaps)}일",
                    "text": f"앞으로 2주 중 PROMO_WORK에 하루특가가 없는 날: {names}. 캘린더에서 날짜를 누르면 후보를 추천해요.",
                    "action": {"view": "calendar", "arg": gaps[0]["date"]}})

    # 시즌 준비
    for s in seasons_view(today):
        if s["lead"] < 21 or s["d_day"] < 0 or _d(s["prep_start"]) > today + timedelta(days=SEASON_HEADS_UP_DAYS):
            continue
        n = sum(b["rows"] for b in s["booked"])
        ly = s["last_year"][0] if s["last_year"] else None
        ly_txt = f" 작년 '{ly['promo']}' {ly['type']} {ly['rows']}품목 성과를 참고할 수 있어요." if ly else ""
        where = f"이름에 '{s['keyword']}' 들어간 행사" if s["booked_scope"] == "keyword" else "당일에 진행되는 행사"
        names = ", ".join(b["name"] for b in s["booked"][:2])
        act = {"view": "review", "arg": ly["key"]} if ly else {"view": "calendar", "arg": s["date"]}
        if n:
            out.append({"id": f"season:{s['name']}:{s['date']}:{n}", "level": "info", "title": f"D-{s['d_day']} {s['name']}",
                        "text": f"{s['name']}({_d(s['date']):%m/%d}): {where} {n}품목이 잡혀 있어요 ({names}).{ly_txt}",
                        "action": act})
        else:
            out.append({"id": f"season:{s['name']}:{s['date']}:0", "level": "important", "title": f"D-{s['d_day']} {s['name']}",
                        "text": f"{s['name']}({_d(s['date']):%m/%d}) 준비 시작일({_d(s['prep_start']):%m/%d})이 다가왔는데 "
                                f"{where}가 아직 없어요.{ly_txt}", "action": act})

    # 곧 끝나는 행사
    ending = {}
    for r in DATA.promos:
        s, e = _d(r.get("start")), _d(r.get("end"))
        if s and e and s <= today <= e and (e - today).days <= ENDING_ALERT_DAYS and r.get("type") != "하루특가":
            ending.setdefault((r.get("promo"), e), 0)
            ending[(r.get("promo"), e)] += 1
    if ending:
        txt = ", ".join(f"{p} {e:%m/%d} 종료({n}품목)" for (p, e), n in sorted(ending.items(), key=lambda x: x[0][1])[:4])
        out.append({"id": f"ending:{today}", "level": "info", "title": "곧 끝나는 행사", "text": f"{txt}. 이어서 할 행사가 필요한지 확인해 보세요.",
                    "action": {"view": "calendar", "arg": today.isoformat()}})

    # 요즘 뜨는데 행사 예정 없는 상품
    hot = [p for p in DATA.products.values() if p.get("active") and (_f(p.get("growth_28")) or 0) >= 0.3
           and (_f(p.get("sales_28")) or 0) >= 500_000 and not p.get("upcoming") and not p.get("running")]
    if hot:
        hot.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
        out.append({"id": f"hot:{today}:{len(hot)}", "level": "info", "title": f"요즘 뜨는데 행사 없는 상품 {len(hot)}개",
                    "text": f"최근 28일 매출이 직전보다 30% 넘게 늘었는데 진행·예정 행사가 없어요: "
                            f"{', '.join(p['name'] for p in hot[:3])}{' 외' if len(hot) > 3 else ''}.",
                    "action": {"view": "products", "arg": "grow"}})
    # 외부 신호: 검색은 오르는데 우리 매출은 덜 오른 그룹 / 데이터랩 캐시가 오래됨
    from . import trends
    tv = trends.overview()
    for g in tv["groups"]:
        gap = next((s for s in g["signals"] if s["k"] in ("gap", "ahead")), None)
        if gap:
            out.append({"id": f"trend:{g['name']}:{gap['k']}:{tv['fetched_at']}", "level": "info", "title": f"검색 신호 · {g['name']}",
                        "text": f"{gap['text']} (네이버 데이터랩 {tv['fetched_at']} 기준). [트렌드]에서 이 키워드로 기획을 시작할 수 있어요.",
                        "action": {"view": "signals"}})
    if tv["fetched_at"]:
        age = (today - datetime.strptime(tv["fetched_at"][:10], "%Y-%m-%d").date()).days
        if age >= 14:
            out.append({"id": f"trendstale:{tv['fetched_at']}", "level": "info", "title": "검색 트렌드가 오래됐어요",
                        "text": f"네이버 검색 트렌드를 {age}일 전에 받았어요. [트렌드]에서 새로 받아 주세요.", "action": {"view": "signals"}})
    order = {"urgent": 0, "important": 1, "info": 2}
    out.sort(key=lambda a: order[a["level"]])
    return {"today": today.isoformat(), "alerts": out,
            "source": "규칙으로 계산한 알림 (AI 문장 아님) · PROMO_WORK 스냅샷·실적·시즌일정.csv 기준"}

# -*- coding: utf-8 -*-
"""
기획 아이디어(예시 기획안): 실적 데이터로 바로 짜는 규칙 기반 템플릿. Claude 호출 없음.
각 아이디어는 그대로 기획안 보드로 불러오거나, Claude에게 넘겨 다듬을 수 있다.

할인율 고르는 법: 과거 같은 유형·가격대의 평소 할인율(중앙값)을 기본으로 하고,
원가율 기준(45%)을 지키는 최대 할인보다 높으면 5% 단위로 내린다. 10% 미만이 되면 그 상품은 뺀다.
"""
import json
import math
from datetime import date, datetime, timedelta

from . import config, engine
from .engine import DATA, _d, _f

MIN_RATE = 0.10


def _floor5(x):
    return math.floor(x * 20 + 1e-9) / 20


def _usual_rate(p, ptype):
    band = p.get("price_band")
    row = next((r for r in DATA.patterns if r.get("유형") == ptype and r.get("가격대") == band), None)
    base = _f(row.get("할인율_중앙")) if row else None
    return base if base else (0.20 if ptype == "상시" else 0.30)


def _pick_rate(p, ptype, cap=None):
    md = _f(p.get("max_discount"))
    if md is None:
        return None
    r = min(_floor5(_usual_rate(p, ptype)), _floor5(md))
    if cap:
        r = min(r, cap)
    return r if r >= MIN_RATE else None


def _pool(d0, d1):
    out = []
    for p in DATA.products.values():
        if not p.get("active") or p.get("cost") is None or not _f(p.get("price")):
            continue
        if engine._scheduled_overlap(p, d0, d1):
            continue
        out.append(p)
    return out


def _recent_daily_deal(p, d0, days=14):
    for h in DATA.promos_of(p["seq"]):
        if h.get("type") != "하루특가":
            continue
        hs = _d(h.get("start"))
        if hs and abs((hs - d0).days) <= days:
            return True
    return False


def _row(promo, ptype, s, e, p, rate, memo):
    return {"promo": promo, "type": ptype, "start": s.isoformat(), "end": e.isoformat(), "seq": str(p["seq"]),
            "items": None, "rate": rate, "appeal": "", "clearance": False, "memo": memo}


def _won_man(v):
    return f"{(v or 0) / 10000:,.0f}만원"


def next_monday(base=None):
    base = base or date.today()
    return base + timedelta(days=(7 - base.weekday()) % 7 or 7)


def build_ideas(start=None):
    DATA.ensure()
    d0 = _d(start) if start else next_monday()
    d1 = d0 + timedelta(days=6)
    pool = _pool(d0, d1)
    ideas = []

    # 1) 요즘 뜨는 상품 할인전 — 최근 28일 매출이 직전 28일보다 크게 는 상품
    grow = [p for p in pool if (_f(p.get("growth_28")) or 0) >= 0.3 and (_f(p.get("sales_28")) or 0) >= 500_000]
    grow.sort(key=lambda p: -((_f(p["sales_28"]) or 0) - (_f(p["sales_28"]) or 0) / (1 + _f(p["growth_28"]))))
    rows = []
    for p in grow:
        r = _pick_rate(p, "상시", cap=0.20)
        if r:
            rows.append(_row("요즘 뜨는 티 할인전", "상시", d0, d1, p, r,
                             f"28일 매출 {_won_man(p.get('sales_28'))}, 직전 대비 +{_f(p['growth_28']) * 100:.0f}%"))
        if len(rows) >= 8:
            break
    ideas.append(_idea("grow", "TREND", "요즘 뜨는 상품 할인전",
                       "최근 28일 매출이 직전 28일보다 30% 이상 늘어난 상품을 모아, 오르는 흐름에 노출과 가벼운 할인을 더합니다. "
                       "이미 잘 팔리는 중이라 할인은 평소 상시 수준(최대 20%)으로 낮게 잡았습니다.", rows, d0, d1))

    # 1-2) 작년 이맘때 잘 팔린 상품 — 작년 같은 주(364일 전) 매출 상위, 올해도 판매 중
    ly = engine.last_year_top(d0.isoformat(), d1.isoformat(), limit=60)
    rows = []
    pool_seq = {str(p["seq"]) for p in pool}
    for r in ly["rows"]:
        if r["seq"] not in pool_seq or str(r.get("name", "")).startswith("["):
            continue
        p = DATA.products[r["seq"]]
        rate = _pick_rate(p, "상시")
        if not rate:
            continue
        was = f", 작년 행사: {', '.join(r['ly_promos'][:2])}" if r["ly_promos"] else ", 작년 이 주엔 행사 없음"
        rows.append(_row("작년 이맘때 베스트", "상시", d0, d1, p, rate,
                         f"작년 같은 주 매출 {_won_man(r['ly_sales'])}{was} · 올해 28일 {_won_man(p.get('sales_28'))}"))
        if len(rows) >= 8:
            break
    if ly["available"]:
        ideas.append(_idea("lastyear", "SEASON", "작년 이맘때 잘 팔린 상품전",
                           f"작년 같은 주({_d(ly['ly_from']):%y/%m/%d}~{_d(ly['ly_to']):%m/%d}, 364일 전 같은 요일)에 매출이 높았고 "
                           "올해도 팔리는 상품입니다. 시즌 수요가 반복되는 상품이라 같은 시기에 노출을 미리 잡아 둡니다. "
                           "작년에 행사로 팔린 상품인지 근거에 함께 적었습니다.", rows, d0, d1))

    # 1-3) 외부 신호: 검색 트렌드 기획전 (네이버 데이터랩 캐시가 있을 때) · 고객이 사랑한 상품전 (리뷰)
    from . import reviews, trends
    tv = trends.overview()
    hot = next((g for g in tv["groups"] if any(s["level"] == "important" for s in g["signals"])), None)
    if hot:
        tp = trends.plan_rows(hot["name"], d0.isoformat())
        if tp and tp["rows"]:
            sig = " / ".join(s["text"] for s in hot["signals"][:2])
            ideas.append(_idea("trend", "SEARCH TREND", f"{hot['name']} 검색 트렌드 기획전",
                               f"네이버 검색 '{', '.join(hot['keywords'][:3])}' 신호: {sig}. "
                               f"연결 상품 중 이 주에 행사가 없는 상품을 매출순으로 골랐습니다 (데이터랩 {tv['fetched_at']} 기준).", tp["rows"], d0, d1))
    rv = reviews.overview()
    rows = []
    pool_seq = {str(p["seq"]) for p in pool}
    for r in rv["good"]:
        if r["seq"] not in pool_seq or str(r.get("name", "")).startswith("["):
            continue
        p = DATA.products[r["seq"]]
        rate = _pick_rate(p, "상시")
        if not rate:
            continue
        extra = f" · 선물 언급 {r['gift']}" if r["gift"] else ""
        rows.append(_row("고객이 사랑한 상품", "상시", d0, d1, p, rate,
                         f"최근 {rv['weeks']}주 리뷰 {r['n']}건 평점 {r['avg']:.1f}{extra} · 28일 매출 {_won_man(p.get('sales_28'))}"))
        if len(rows) >= 8:
            break
    if rv["available"]:
        ideas.append(_idea("review", "VOICE", "고객이 사랑한 상품전",
                           f"최근 {rv['weeks']}주 오설록몰 리뷰에서 평점 4.7 이상·리뷰 3건 이상인 상품입니다. "
                           "후기를 상세페이지·배너 문구 근거로 쓸 수 있고, 만족도가 검증된 상품이라 신규 고객 유입용 할인에 맞습니다.", rows, d0, d1))

    # 2) 오래 쉬었던 상품 할인전 — 할인 판매가 오래 없었던 꾸준한 상품
    dorm = []
    for p in pool:
        # 시즌 한정·콜라보([미피] 등 태그 상품)는 판매 기간이 짧아 '오래 쉰' 게 아니므로 뺀다
        if str(p.get("name", "")).startswith("["):
            continue
        dsp = _f(p.get("days_since_promo"))
        on_sale = _f(p.get("days_on_sale")) or 0
        if on_sale < 120:
            continue
        if dsp is None or dsp >= 45:
            # 지금도 꾸준히 팔리는 상품만 (최근 28일 매출 20만원 이상)
            if (_f(p.get("sales_28")) or 0) >= 200_000 and (_f(p.get("max_discount")) or 0) >= 0.15:
                dorm.append(p)
    dorm.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    rows = []
    for p in dorm:
        r = _pick_rate(p, "상시")
        if r:
            dsp = _f(p.get("days_since_promo"))
            gap = f"마지막 행사 {int(dsp)}일 전 종료" if dsp is not None else "2025-09 이후 행사 없음"
            rows.append(_row("오랜만의 할인전", "상시", d0, d1, p, r, f"{gap}, 90일 매출 {_won_man(p.get('sales_90'))}"))
        if len(rows) >= 8:
            break
    ideas.append(_idea("dormant", "REVIVE", "오래 행사 없던 상품 할인전",
                       "꾸준히 팔리는데(최근 28일 20만원 이상) 45일 넘게 행사에 들어가지 않았거나 2025-09 이후 행사 이력이 없는 상품입니다 "
                       "(PROMO_WORK 기준). 할인 피로가 없어 평소 상시 할인율만으로도 반응을 기대할 수 있습니다.", rows, d0, d1))

    # 3) 원가 여유 하루특가 위크 — 35% 이상 할인해도 원가율 기준을 지키는 인기 상품을 하루 3개씩
    deal = [p for p in pool if (_f(p.get("max_discount")) or 0) >= 0.35 and not _recent_daily_deal(p, d0)
            and not str(p.get("name", "")).startswith("[") and p.get("category") in ("티 세트", "티 제품", "티푸드")]
    deal.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    rows, used_cat = [], {}
    days = [d0 + timedelta(days=i) for i in range(7)]
    queue = deal[:40]
    for day in days:
        picked = 0
        for p in list(queue):
            cat = p.get("category")
            if used_cat.get((day, cat)):
                continue
            r = _pick_rate(p, "하루특가", cap=0.40)
            if not r or r < 0.25:
                queue.remove(p)
                continue
            rows.append(_row("하루특가 위크", "하루특가", day, day, p, r,
                             f"원가율 기준 최대 {_f(p['max_discount']) * 100:.0f}%, 28일 매출 {_won_man(p.get('sales_28'))}"))
            used_cat[(day, cat)] = True
            queue.remove(p)
            picked += 1
            if picked >= 3:
                break
    ideas.append(_idea("deal", "DAILY DEAL", "원가 여유 하루특가 위크",
                       "깊게 할인해도 할인 후 원가율 45%를 넘지 않는 인기 상품을 하루 3개씩(카테고리 겹치지 않게) 배치했습니다. "
                       "14일 안에 하루특가가 있었던 상품은 뺐습니다.", rows, d0, d1))

    # 4) 원가 높은 상품 묶음전 — 혼자서는 할인 여력이 없는 인기 상품 + 원가 낮은 짝
    heavy = [p for p in pool if (_f(p.get("max_discount")) or 1) < 0.15 and (_f(p.get("sales_28")) or 0) >= 300_000
             and not str(p.get("name", "")).startswith("[")]
    heavy.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    rows = []
    for p in heavy[:6]:
        res = engine.suggest_partners(p["seq"], min_rate=0.25, limit=5)
        part = next((x for x in res["partners"] if not engine._scheduled_overlap(DATA.products[x["seq"]], d0, d1)), None)
        if not part:
            continue
        rate = min(0.30, _floor5(part["combo_max_discount"]))
        rows.append({"promo": "함께 사면 더 좋은 세트", "type": "상시", "start": d0.isoformat(), "end": d1.isoformat(),
                     "seq": None, "items": [{"seq": str(p["seq"]), "qty": 1}, {"seq": part["seq"], "qty": 1}],
                     "rate": rate, "appeal": "", "clearance": False,
                     "memo": f"{p['name']} 단독 최대 할인 {max(0, _f(p['max_discount']) or 0) * 100:.0f}% → "
                             f"{part['name']}와 묶으면 {part['combo_max_discount'] * 100:.0f}% (SEQ 등록 필요)"})
        if len(rows) >= 4:
            break
    ideas.append(_idea("bundle", "BUNDLE", "원가 높은 상품 묶음전",
                       "원가율이 높아 단독으로는 할인하기 어려운 인기 상품에, 원가 낮은 상품을 하나 얹어 묶음 할인 여력을 만듭니다. "
                       "새 조합상품이라 SEQ 등록이 필요합니다.", rows, d0, d1))

    # 5) 2만원대 선물 기획전 — 가장 많이 팔리는 가격대의 세트
    gift = [p for p in pool if 20000 <= (_f(p.get("price")) or 0) < 30000 and p.get("category") in ("티 세트", "티 제품")]
    gift.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    rows = []
    for p in gift:
        r = _pick_rate(p, "상시")
        if r:
            rows.append(_row("2만원대 선물 기획전", "상시", d0, d1, p, r, f"28일 매출 {_won_man(p.get('sales_28'))}"))
        if len(rows) >= 8:
            break
    ideas.append(_idea("price", "GIFT", "2만원대 선물 기획전",
                       "부담 없는 선물 가격대인 2만원대 티 세트·티 제품을 매출순으로 모았습니다. 가격대별 평소 상시 할인율을 썼습니다.",
                       rows, d0, d1))

    ideas += myeongbun_ideas(d0, d1, pool)
    ideas += lever_ideas(d0, d1, pool)
    ideas += scout_ideas(d0, d1)
    return {"start": d0.isoformat(), "end": d1.isoformat(), "ideas": [i for i in ideas if i["rows"]],
            "note": "아이디어는 실적·명분 사전·레버·바깥 신호로 규칙이 짠 초안입니다(AI 아님). 불러온 뒤 상품·할인율을 조정하세요."}


def _idea(key, kicker, title, lead, rows, d0, d1, why=None, levers=None, group=None, evidence=None):
    chk = engine.check_plan(rows) if rows else {"rows": [], "summary": {}}
    crs = [r["cost_ratio_after"] for r in chk["rows"] if r.get("cost_ratio_after") is not None]
    rates = [r["rate"] for r in rows if r.get("rate")]
    return {
        "key": key, "kicker": kicker, "title": title, "lead": lead, "period": f"{d0:%m/%d}~{d1:%m/%d}",
        "why": why, "levers": levers or [], "group": group or kicker, "evidence": evidence or [],
        "rows": rows,
        "items": [{"name": c.get("name"), "type": c.get("type"), "rate": c.get("rate"), "start": c.get("start"),
                   "level": c.get("level")} for c in chk["rows"]],
        "facts": {"count": len(rows), "avg_rate": sum(rates) / len(rates) if rates else None,
                  "avg_cost_ratio": sum(crs) / len(crs) if crs else None,
                  "expected_sales": chk["summary"].get("expected_sales"),
                  "expected_range": chk["summary"].get("expected_range"),
                  "expected_profit": chk["summary"].get("expected_profit"),
                  "warnings": chk["summary"].get("warnings"), "errors": chk["summary"].get("errors")},
        "brief": f"{title} ({d0:%m/%d}~{d1:%m/%d}) 예시 기획안을 다듬어줘. {lead}",
    }


# ----------------------------------------------------------------------
# 명분 아이디어 — 앞으로 6주 안 명분마다 하나 (명분 사전의 씨앗 + 종류별 상품 고르기)
# ----------------------------------------------------------------------
KIND_WORDS = {  # 씨앗에 상품 말이 없을 때 종류별로 고르는 상품 포함어 / 카테고리
    "명절·대목": (None, "티 세트"), "기념일": (None, "티 세트"), "직장": (None, "티 세트"), "쇼핑": (None, None),
    "절기·세시": (["녹차", "세작", "호지", "블렌디드", "밀크티"], None), "날씨·계절": (["밀크티", "블렌디드", "꿀배", "호지", "말차"], None),
    "차 고유": (["우전", "세작", "녹차", "말차"], None), "학사·생활": (["말차", "랑드샤", "밀크티"], None),
}
SEED_WORDS = ["말차", "세작", "우전", "녹차", "호지", "밀크티", "블렌디드", "블랙티", "얼그레이", "영귤", "꿀배", "허브", "민트",
              "캐모마일", "콜드브루", "랑드샤", "롤케이크", "초콜릿", "티백"]


def _pick_products(pool, words=None, category=None, n=6):
    xs = []
    for p in pool:
        if str(p.get("name", "")).startswith("["):
            continue
        name = str(p.get("name", "")).replace(" ", "")
        if words and not any(w in name for w in words):
            continue
        if category and p.get("category") != category:
            continue
        xs.append(p)
    xs.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    return xs[:n * 2]


def myeongbun_ideas(d0, d1, pool):
    from . import schedule
    out = []
    for e in schedule.seasons_view(d0):
        if e["d_day"] < -2 or e["d_day"] > 42:
            continue
        seed_text = " ".join(e["seeds"])
        words = [w for w in SEED_WORDS if w in seed_text]
        kw, cat = KIND_WORDS.get(e["kind"], (None, None))
        cands = _pick_products(pool, words or kw, None if words else cat)
        rows = []
        for p in cands:
            r = _pick_rate(p, "상시")
            if r:
                rows.append({**_row(e["name"], "상시", d0, d1, p, r, f"명분 '{e['name']}' · 28일 매출 {_won_man(p.get('sales_28'))}"),
                             "category_tag": f"{e['icon']} {e['name']}", "appeal": (e["seeds"][0] if e["seeds"] else "")[:40]})
            if len(rows) >= 6:
                break
        past = e.get("past") or []
        ev = [f"지난 '{w['promo']}' {w['type']} {w['rows']}품목 · 행사 매출 {_won_man(w.get('promo_sales'))}" for w in past[:2]]
        if e.get("month_index_ly"):
            ev.append(f"작년 같은 달 몰 매출 지수 {e['month_index_ly']:.2f}")
        when = f"D-{e['d_day']}" if e["d_day"] > 0 else ("D-day" if e["d_day"] == 0 else "진행 중")
        out.append(_idea(f"mb:{e['name']}:{e['date']}", f"{e['icon']} {e['kind']} · {when}", f"{e['name']}: {e['seeds'][0] if e['seeds'] else e['name']}",
                         f"명분 {e['name']}({e['date'][5:]}) · 한 주 상시 기획. 씨앗: {' / '.join(e['seeds']) or '-'}. "
                         + (f"메모: {e['memo']}" if e.get("memo") else ""),
                         rows, d0, d1, why=f"{e['name']} {when}", group="명분", evidence=ev,
                         levers=["준비 시작 " + e["prep_start"][5:]] + (["효능 표현 주의: " + ", ".join(e["seed_flags"])] if e.get("seed_flags") else [])))
    return out


# ----------------------------------------------------------------------
# 레버 아이디어 — 우리 실적에서 본 손잡이를 그대로 기획으로
# ----------------------------------------------------------------------
def lever_ideas(d0, d1, pool):
    out = []
    L = DATA.levers or {}
    gap = {g["band"]: g for g in L.get("gap", [])}
    g61, g14 = gap.get("61~120일"), gap.get("~14일")
    # ① 푹 쉰 인기 상품 하루특가 — 61~120일 쉰 상품
    rested = [p for p in pool if 61 <= (_f(p.get("days_since_deal")) or -1) <= 150 and (_f(p.get("max_discount")) or 0) >= 0.30
              and not str(p.get("name", "")).startswith("[")]
    rested.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    days = [d for d in (d0 + timedelta(days=i) for i in range(7)) if d.weekday() in (1, 2, 3)]   # 화·수·목
    rows = []
    for i, p in enumerate(rested[:9]):
        day = days[i % len(days)] if days else d0
        r = _pick_rate(p, "하루특가", cap=0.40)
        if r and r >= 0.25:
            rows.append(_row("푹 쉰 베스트 특가", "하루특가", day, day, p, r, f"하루특가 {int(_f(p['days_since_deal']))}일 쉼 · 28일 매출 {_won_man(p.get('sales_28'))}"))
    ev = [f"61~120일 쉰 상품 반응 {g61['lift']:.1f}배 vs 14일 안 재특가 {g14['lift']:.1f}배 (근거 {g61['n']}·{g14['n']}건)"] if g61 and g14 else []
    out.append(_idea("lv:rested", "LEVER · 쉰 기간", "푹 쉰 베스트 하루특가", "하루특가를 두 달 넘게 쉰 인기 상품만 골라 화·수·목에 하루 3개씩 배치했습니다.",
                     rows, d0, d1, why="쉬게 할수록 크게 터진다", group="레버", evidence=ev, levers=["하루 3개", "화·수·목", "쉰 기간 61일+"]))
    # ② 36% 열기 — 31~35%에서 머물던 상품을 36~40%로
    cells = {r["key"]: r["cells"] for r in L.get("depth_by_category", [])}
    open36 = []
    for p in pool:
        md = _f(p.get("max_discount"))
        c = cells.get(p.get("category"), {})
        if md is None or not (0.36 <= md) or not c.get("36~40%") or str(p.get("name", "")).startswith("["):
            continue
        if (_f(p.get("daily_deal_rate_median")) or 0) <= 0.35:
            open36.append(p)
    open36.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    rows = []
    days = [d0 + timedelta(days=i) for i in range(7) if (d0 + timedelta(days=i)).weekday() in (1, 2)]
    for i, p in enumerate(open36[:6]):
        day = days[i % len(days)] if days else d0
        if _recent_daily_deal(p, day):
            continue
        rows.append(_row("36% 특가", "하루특가", day, day, p, 0.36, f"평소 하루특가 중앙 {(_f(p.get('daily_deal_rate_median')) or 0) * 100:.0f}% → 36% · 원가율 45% 안"))
    ts = cells.get("티 세트", {})
    ev = [f"티 세트 하루특가 31~35% {ts['31~35%']['lift']:.1f}배 → 36~40% {ts['36~40%']['lift']:.1f}배"] if ts.get("31~35%") and ts.get("36~40%") else []
    out.append(_idea("lv:open36", "LEVER · 할인 깊이", "36%로 한 칸 더: 반응 계단 넘기", "평소 하루특가를 35% 이하로 하던 인기 상품 중 원가율 45% 안에서 36%를 열 수 있는 상품입니다.",
                     rows, d0, d1, why="36%를 넘으면 반응이 계단식으로 뛴다", group="레버", evidence=ev, levers=["36%", "화·수"]))
    # ③ 월요일 대신 화·목 — 요일 시험
    wk = {w["wd"]: w for w in L.get("weekday", [])}
    if wk.get("월") and wk.get("수"):
        top = [p for p in pool if (_f(p.get("max_discount")) or 0) >= 0.30 and not str(p.get("name", "")).startswith("[")]
        top.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
        days = [d0 + timedelta(days=i) for i in range(7) if (d0 + timedelta(days=i)).weekday() in (1, 3)]
        rows, used = [], 0
        for p in top:
            if used >= 6:
                break
            day = days[used % len(days)] if days else d0
            if _recent_daily_deal(p, day):
                continue
            r = _pick_rate(p, "하루특가", cap=0.40)
            if r and r >= 0.25:
                rows.append(_row("화·목 특가 시험", "하루특가", day, day, p, r, "요일 시험: 월 → 화·목"))
                used += 1
        ev = [f"특가 있는 월 {wk['월']['deal']:.2f} vs 없는 월 {wk['월']['no_deal']:.2f} · 특가 있는 수 {wk['수']['deal']:.2f} vs 없는 수 {wk['수']['no_deal']:.2f} (몰 매출 배수)"]
        out.append(_idea("lv:weekday", "LEVER · 요일", "월요일 대신 화·목 특가 시험", "월요일은 특가 없이도 가장 잘 팔리는 날이라, 특가를 화·목으로 옮겨 몰 전체 매출이 늘어나는지 시험합니다.",
                         rows, d0, d1, why="요일 레버 시험", group="레버", evidence=ev, levers=["화·목", "하루 3개"]))
    return out


def scout_ideas(d0, d1):
    from . import scout
    out = []
    try:
        ov = scout.overview()
    except Exception:
        return out
    for c in ov["cards"][:12]:
        v = c.get("verify") or {}
        if v.get("status") not in ("떠오르는 중", "정점 근처") and c.get("state") != "keep":
            continue
        pr = scout.plan_rows(c["term"], d0.isoformat())
        if not pr["rows"]:
            continue
        b = pr["bridge"]
        ev = [f"글 {c['docs']}건(최근 7일 {c['recent7']})"] + ([f"검색 4주 {v['momentum'] * 100:+.0f}%"] if v.get("momentum") is not None else [])
        out.append(_idea(f"sc:{c['term']}", f"OUTSIDE · {b['type']}", f"{c['term']}: {b['copy'] or b['why']}",
                         f"바깥에서 뜨는 '{c['term']}'을 {b['type']}로 엮은 한 주 기획. {b['why']}", pr["rows"], d0, d1,
                         why=f"트렌드 {v.get('status') or '감시 중'}", group="바깥", evidence=ev))
        if len(out) >= 3:
            break
    return out


# ----------------------------------------------------------------------
# 이번 주 아이디어 — 주마다 한 번 풀을 만들어 저장, 넘겨 보기, 좋아요·별로·이미 함
# ----------------------------------------------------------------------
IDEA_DIR = config.DATA_DIR / "ideas"
FEEDBACK = config.DATA_DIR / "idea_feedback.json"
PER_PAGE = 6


def _fb():
    try:
        return json.loads(FEEDBACK.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def feedback(key, vote):
    if vote not in ("up", "down", "done", "clear"):
        raise ValueError("vote")
    fb = _fb()
    if vote == "clear":
        fb.pop(key, None)
    else:
        fb[key[:80]] = {"vote": vote, "at": date.today().isoformat()}
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    FEEDBACK.write_text(json.dumps(fb, ensure_ascii=False), encoding="utf-8")
    return fb


def _score(i, fb):
    f = fb.get(i["key"], {})
    if f.get("vote") == "down":
        return -99
    if f.get("vote") == "done" and (date.today() - _d(f["at"])).days < 56:
        return -98
    n = i["facts"]["count"] or 0
    base = {"레버": 6, "바깥": 7}.get(i["group"], 5) + (2 if i["group"].startswith("명분") else 0)
    base += min(3, len(i.get("evidence") or []))
    base += 2 if f.get("vote") == "up" else 0
    if i["key"].startswith("mb:"):
        try:
            dd = int(str(i.get("why", "")).split("D-")[1].split()[0]) if "D-" in str(i.get("why")) else 0
            base += 3 if 7 <= dd <= 35 else (1 if dd < 7 else 0)
        except (IndexError, ValueError):
            pass
    return base + min(n, 8) / 4


def weekly(start=None, page=0, refresh=False):
    """그 주 아이디어 풀(저장본). 처음 열 때 규칙으로 만들어 data/ideas/YYYY-Www.json에 저장하고, 페이지로 넘겨 본다."""
    DATA.ensure()
    d0 = _d(start) if start else next_monday()
    y, w, _ = d0.isocalendar()
    path = IDEA_DIR / f"{y}-W{w:02d}.json"
    doc = None
    if path.exists() and not refresh:
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            doc = None
        if doc and doc.get("data_built_at") != DATA.meta.get("built_at"):
            doc = None          # 데이터가 갱신되면 다시 만든다
    if doc is None:
        res = build_ideas(d0.isoformat())
        doc = {"start": res["start"], "end": res["end"], "made_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
               "data_built_at": DATA.meta.get("built_at"), "ideas": res["ideas"], "note": res["note"]}
        IDEA_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    fb = _fb()
    ranked = sorted(doc["ideas"], key=lambda i: -_score(i, fb))
    ranked = [i for i in ranked if _score(i, fb) > -90]
    # 같은 묶음(group)이 한 페이지에 몰리지 않게 섞기
    pages, rest = [], list(ranked)
    while rest:
        pg, groups = [], {}
        for i in list(rest):
            if len(pg) >= PER_PAGE:
                break
            if groups.get(i["group"], 0) >= 2 and len(rest) > PER_PAGE:
                continue
            pg.append(i)
            groups[i["group"]] = groups.get(i["group"], 0) + 1
            rest.remove(i)
        if not pg:
            pg, rest = rest[:PER_PAGE], rest[PER_PAGE:]
        pages.append(pg)
    n = len(pages)
    k = page % n if n else 0
    for i in (pages[k] if n else []):
        i["vote"] = fb.get(i["key"], {}).get("vote")
    return {"start": doc["start"], "end": doc["end"], "made_at": doc["made_at"], "page": k, "pages": n, "total": len(ranked),
            "ideas": pages[k] if n else [], "note": doc["note"]}

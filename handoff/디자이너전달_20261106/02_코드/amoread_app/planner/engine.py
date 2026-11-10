# -*- coding: utf-8 -*-
"""
기획 계산 엔진: 웹 화면(API)과 Claude 도구가 같은 함수를 쓴다.
숫자는 모두 여기서 계산하고, Claude는 이 결과를 보고 조합·설명만 한다.

데이터: planner/data/planner_data.json (build.py 결과)
"""
import json
import math
import threading
from datetime import date, datetime, timedelta

from . import config

# 상시 할인 반응도는 같은 기간 하루특가·다른 할인과 섞여 신뢰도가 낮아 예상치에 쓰지 않는다(1.0배 가정)
RECENT_PROMO_DAYS = 14          # 같은 SEQ를 이 기간 안에 또 행사하면 '연속 행사' 경고
DAILY_DEAL_MAX_PER_DAY = 6      # 하루특가 하루 품목 수 참고 상한 (과거 이력 기준 4~6개)
DEAL_SWEET_SPOT = 4             # 레버: 하루 3~4개일 때 품목당 반응이 가장 컸음 → 넘으면 '분산' 힌트
DEAL_REST_DAYS = 60             # 레버: 같은 상품 하루특가를 60일 넘게 쉬었을 때 반응이 컸음
SANGSI_LONG_DAYS = 14           # 레버: 상시 판매는 첫 3~5일에 몰림 → 이보다 길면 '중간 계기' 힌트
ROUND_UNIT = 100                # 할인가 100원 단위


# 식품 표시·광고: 질병 예방·치료 효능으로 읽힐 수 있는 표현 (카피 점검용 — 법률 판단 아님, RA 검토 필요)
EFFICACY_WORDS = ("감기", "면역", "예방", "치료", "해독", "디톡스", "혈압", "혈당", "다이어트", "살 빠", "체지방", "항암",
                  "숙취", "피로회복", "질병", "염증", "소화제")


def efficacy_flags(text):
    t = str(text or "")
    return [w for w in EFFICACY_WORDS if w in t]


class DataNotReady(Exception):
    pass


def _f(v):
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except (TypeError, ValueError):
        return None


def _d(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()


class PlannerData:
    """planner_data.json을 메모리에 올려 두고 파일이 바뀌면 다시 읽는다."""

    def __init__(self, path=None):
        self.path = path or config.PLANNER_JSON
        self._mtime = None
        self._lock = threading.Lock()
        self.meta, self.products, self.patterns, self.lifts, self.promos = {}, {}, [], [], []
        self.last_year = {}
        self.levers = {}

    def ensure(self):
        if not self.path.exists():
            raise DataNotReady("기획용 데이터가 없습니다. [데이터 갱신]을 먼저 실행하세요.")
        m = self.path.stat().st_mtime
        if m == self._mtime:
            return self
        with self._lock:
            if m == self._mtime:
                return self
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            self.meta = raw.get("meta", {})
            self.products = {str(p["seq"]): p for p in raw.get("products", [])}
            self.patterns = raw.get("patterns", [])
            self.lifts = raw.get("lift_by_rate", [])
            self.promos = raw.get("promos", [])
            self.last_year = raw.get("last_year") or {}
            self.levers = raw.get("levers") or {}
            self._by_seq_promos = {}
            for p in self.promos:
                self._by_seq_promos.setdefault(str(p.get("seq")), []).append(p)
            self._mtime = m
        return self

    def promos_of(self, seq):
        return self._by_seq_promos.get(str(seq), [])


DATA = PlannerData()


# ----------------------------------------------------------------------
# 기본 계산
# ----------------------------------------------------------------------
def sale_price(price, rate):
    """할인가 (100원 단위 내림 없이 정확값: 엑셀 수식 =정가*(1-할인율)과 같게)."""
    return round(price * (1 - rate))


def cost_ratio_after(price, cost, rate):
    sp = price * (1 - rate)
    return cost / (sp / config.VAT) if sp > 0 else None


def max_discount(price, cost, target=None):
    target = target or config.TARGET_COST_RATIO
    if not price or cost is None:
        return None
    return 1 - cost * config.VAT / target / price


def unit_profit(sale_price_v, cost):
    """개당 매출총이익 = 할인가(부가세 제외) − 원가. 원가율 기준과 같은 정의(할인가/1.1)를 쓴다."""
    if sale_price_v is None or cost is None:
        return None
    return sale_price_v / config.VAT - cost


def lift_info(rate, promo_type):
    """하루특가 할인율 구간의 과거 반응도: (중앙, 하위25, 상위25, 건수, 구간). 상시는 1.0 고정(참고 신뢰도 낮음)."""
    if promo_type != "하루특가" or rate is None:
        return 1.0, 1.0, 1.0, 0, "상시(1.0 가정)"
    bands = [(0.25, "~25%"), (0.30, "26~30%"), (0.35, "31~35%"), (0.40, "36~40%"), (1.0, "41%~")]
    label = next(lab for hi, lab in bands if rate <= hi + 1e-9)
    row = next((r for r in DATA.lifts if r.get("구간") == label), None)
    if not row:
        return 1.0, 1.0, 1.0, 0, label
    med = _f(row.get("반응도_중앙")) or 1.0
    return med, _f(row.get("반응도_하위25")) or med, _f(row.get("반응도_상위25")) or med, int(row.get("행사수") or 0), label


def weekday_factor(d0, d1):
    """기간 안 날짜들의 요일 지수 합 (몰 매출 요일 리듬, 평균 1)."""
    idx = DATA.levers.get("weekday_index") or [1.0] * 7
    return sum(idx[(d0 + timedelta(days=i)).weekday()] for i in range((d1 - d0).days + 1))


def lift_for_rate(rate, promo_type):
    """하루특가 할인율 구간별 과거 반응도(중앙값). 상시는 1.0 (참고 숫자 신뢰도 낮음)."""
    if promo_type != "하루특가" or rate is None:
        return 1.0
    bands = [(0.25, "~25%"), (0.30, "26~30%"), (0.35, "31~35%"), (0.40, "36~40%"), (1.0, "41%~")]
    label = next(lab for hi, lab in bands if rate <= hi + 1e-9)
    row = next((r for r in DATA.lifts if r.get("구간") == label), None)
    return _f(row.get("반응도_중앙")) if row else 1.0


# ----------------------------------------------------------------------
# 상품 조회
# ----------------------------------------------------------------------
COMPACT_FIELDS = ("seq", "name", "category", "product_type", "price", "price_band", "cost", "cost_ratio",
                  "max_discount", "status", "old_cost", "sales_28", "qty_28", "growth_28", "sales_90", "qty_90",
                  "avg_disc_28", "days_since_promo", "last_promo_end", "days_on_sale",
                  "last_promo", "last_promo_type", "last_promo_start",
                  "last_promo_rate", "promos_90d", "max_rate", "daily_deal_rate_median", "best_lift", "active",
                  "last_sale_date", "ly_next28", "ly_prev28", "sales_prev28",
                  "base_qty", "base_src", "days_since_deal", "last_deal_end")


def compact(p, with_series=False):
    out = {k: p.get(k) for k in COMPACT_FIELDS}
    out["upcoming"] = p.get("upcoming") or []
    out["running"] = p.get("running") or []
    if with_series:
        out["daily_qty"] = p.get("daily_qty") or []
    return out


def all_products(with_series=True):
    DATA.ensure()
    return [compact(p, with_series) for p in DATA.products.values()]


def get_product(seq):
    DATA.ensure()
    p = DATA.products.get(str(seq))
    if not p:
        return None
    out = compact(p, with_series=True)
    out["components"] = p.get("components") or []
    out["note"] = p.get("note")
    out["stock_ref"] = p.get("stock")
    out["response"] = discount_response(seq)   # 상품장 물류+영업재고(전 채널, 월마감): 참고용으로만 상세에 표시
    hist = sorted((r for r in DATA.promos_of(seq) if r.get("status") != "예정"),
                  key=lambda r: r.get("start") or "", reverse=True)
    out["history"] = [{k: r.get(k) for k in ("promo", "type", "start", "end", "rate", "promo_qty", "promo_sales",
                                             "lift", "cost_ratio_after", "status")} for r in hist[:40]]
    return out


def search_products(query=None, category=None, product_type=None, price_min=None, price_max=None,
                    max_cost_ratio=None, min_max_discount=None, active_only=True, has_cost=True,
                    exclude_scheduled_from=None, exclude_scheduled_to=None, min_days_since_promo=None,
                    sort="sales_28", limit=30):
    """조건으로 상품 찾기. sort: sales_28 | growth_28 | max_discount | cost_ratio | days_since_promo | price"""
    DATA.ensure()
    q = (query or "").replace(" ", "").lower()
    s_from, s_to = _d(exclude_scheduled_from), _d(exclude_scheduled_to)
    res = []
    for p in DATA.products.values():
        if active_only and not p.get("active"):
            continue
        if has_cost and p.get("cost") is None:
            continue
        if q and q not in str(p.get("name", "")).replace(" ", "").lower() and q != str(p.get("seq")):
            continue
        if category and p.get("category") != category:
            continue
        if product_type and p.get("product_type") != product_type:
            continue
        price = _f(p.get("price")) or 0
        if price_min is not None and price < price_min:
            continue
        if price_max is not None and price > price_max:
            continue
        cr = _f(p.get("cost_ratio"))
        if max_cost_ratio is not None and (cr is None or cr > max_cost_ratio):
            continue
        md = _f(p.get("max_discount"))
        if min_max_discount is not None and (md is None or md < min_max_discount):
            continue
        if min_days_since_promo is not None:
            dsp = _f(p.get("days_since_promo"))
            if dsp is not None and dsp < min_days_since_promo:   # None = 2025-09 이후 행사 이력 없음 → 통과
                continue
        if s_from and s_to and _scheduled_overlap(p, s_from, s_to):
            continue
        res.append(p)
    keymap = {"sales_28": lambda p: -(_f(p.get("sales_28")) or 0), "growth_28": lambda p: -(_f(p.get("growth_28")) or -9),
              "max_discount": lambda p: -(_f(p.get("max_discount")) or -9), "cost_ratio": lambda p: _f(p.get("cost_ratio")) or 9,
              "days_since_promo": lambda p: -(_f(p.get("days_since_promo")) if p.get("days_since_promo") is not None else 9999),
              "price": lambda p: _f(p.get("price")) or 0}
    res.sort(key=keymap.get(sort, keymap["sales_28"]))
    return [compact(p) for p in res[: max(1, min(int(limit or 30), 200))]]


def _scheduled_overlap(p, d0, d1):
    """PROMO_WORK에 이 기간과 겹치는 행사가 잡혀 있으면 True."""
    for u in DATA.promos_of(p["seq"]):
        s = _d(u.get("start"))
        e = _d(u.get("end")) or s
        if s and s <= d1 and e >= d0:
            return True
    return False


def existing_promos(date_from, date_to):
    """기간에 이미 잡혀 있는(PROMO_WORK) 행사 목록."""
    DATA.ensure()
    d0, d1 = _d(date_from), _d(date_to)
    out = []
    for r in DATA.promos:
        s, e = _d(r.get("start")), _d(r.get("end"))
        if s and e and s <= d1 and e >= d0:
            out.append({k: r.get(k) for k in ("promo", "type", "seq", "item_name", "start", "end", "rate")})
    return sorted(out, key=lambda r: (r["start"], r["promo"], r["type"]))


def patterns():
    DATA.ensure()
    return {"by_type_price": DATA.patterns, "lift_by_rate": DATA.lifts,
            "rules": DATA.meta.get("rules", {}), "sales_last_day": DATA.meta.get("sales_last_day")}


# ----------------------------------------------------------------------
# 조합 계산기
# ----------------------------------------------------------------------
def simulate_mix(items, rate=None, target=None):
    """items: [{seq, qty}] → 정가합·원가합·원가율·원가율 기준 최대 할인·(rate 주면) 할인 후 원가율."""
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    lines, missing = [], []
    price = cost = 0.0
    for it in items:
        p = DATA.products.get(str(it.get("seq")))
        qty = max(1, int(it.get("qty") or 1))
        if not p:
            missing.append(f"SEQ {it.get('seq')} 없음")
            continue
        pc, cc = _f(p.get("price")), _f(p.get("cost"))
        if pc is None or cc is None:
            missing.append(f"{p.get('name')} 원가/정가 없음")
        lines.append({"seq": str(p["seq"]), "name": p.get("name"), "qty": qty, "price": pc, "cost": cc,
                      "cost_ratio": _f(p.get("cost_ratio")), "sales_28": _f(p.get("sales_28"))})
        price += (pc or 0) * qty
        cost += (cc or 0) * qty
    out = {"lines": lines, "missing": missing, "price": price, "cost": cost, "target": target,
           "cost_ratio": cost / (price / config.VAT) if price else None,
           "max_discount": max_discount(price, cost, target) if price and not missing else None}
    if rate is not None and price:
        out["rate"] = rate
        out["sale_price"] = sale_price(price, rate)
        out["cost_ratio_after"] = cost_ratio_after(price, cost, rate)
        out["ok"] = out["cost_ratio_after"] is not None and out["cost_ratio_after"] <= target + 1e-9
    if out["max_discount"] is not None:
        md = max(0.0, out["max_discount"])
        out["max_discount_price"] = int(math.ceil(price * (1 - md) / ROUND_UNIT) * ROUND_UNIT)
    return out


def suggest_partners(seq, min_rate=0.30, limit=12, category=None, target=None, max_price_ratio=1.0):
    """이 상품과 묶었을 때 '할인 min_rate 이상을 해도 원가율 target 이하'가 되는 짝 상품 (최근 매출순).
    짝은 기준 상품에 '얹는' 상품이라 정가가 기준 정가 × max_price_ratio 이하인 것만 본다."""
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    base = DATA.products.get(str(seq))
    if not base or base.get("cost") is None:
        return {"base": None, "partners": [], "message": "기준 상품의 원가가 없습니다."}
    bp, bc = _f(base["price"]), _f(base["cost"])
    res = []
    for p in DATA.products.values():
        if str(p["seq"]) == str(seq) or not p.get("active") or p.get("cost") is None:
            continue
        if category and p.get("category") != category:
            continue
        if str(p.get("name", "")).startswith("["):   # 보자기·콜라보 등 태그 상품은 짝 후보에서 뺀다
            continue
        pp, pc = _f(p["price"]), _f(p["cost"])
        if not pp or pp > bp * max_price_ratio:
            continue
        md = max_discount(bp + pp, bc + pc, target)
        if md is not None and md >= min_rate:
            res.append({"seq": str(p["seq"]), "name": p.get("name"), "category": p.get("category"),
                        "price": pp, "cost_ratio": _f(p.get("cost_ratio")), "sales_28": _f(p.get("sales_28")),
                        "days_since_promo": _f(p.get("days_since_promo")), "combo_price": bp + pp,
                        "combo_cost_ratio": (bc + pc) / ((bp + pp) / config.VAT), "combo_max_discount": md})
    res.sort(key=lambda r: -(r["sales_28"] or 0))
    return {"base": compact(base), "base_max_discount": max_discount(bp, bc, target),
            "partners": res[: max(1, min(int(limit or 12), 50))]}


FAMILIES = ("말차", "녹차", "그린티", "밀크티", "호지", "얼그레이", "세작", "우전", "랑드샤", "제주", "블랙티", "허브",
            "동백", "영귤", "꿀배", "마롱", "무화과", "딸기")


def _family(name):
    n = str(name or "")
    return {f for f in FAMILIES if f in n}


def recommend_bundles(min_rate=0.25, per_base=3, max_bases=12, category=None, target=None):
    """
    조합 추천: 원가가 높아 혼자서는 min_rate만큼 할인할 수 없는 인기 상품마다, 묶으면 그 할인이 가능한 짝을 추천.
    짝 점수 = 최근 매출(정규화) + 다른 카테고리(함께 쓰는 상품) 0.3 + 같은 계열(말차·밀크티 등) 0.25.
    """
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    bases = [p for p in DATA.products.values()
             if p.get("active") and p.get("cost") is not None and (_f(p.get("max_discount")) or 0) < min_rate
             and (_f(p.get("sales_28")) or 0) > 0 and not str(p.get("name", "")).startswith("[")
             and (not category or p.get("category") == category)]
    bases.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    out, used = [], {}
    for b in bases[:max_bases]:
        res = suggest_partners(b["seq"], min_rate, limit=50, target=target)
        parts = res["partners"]
        if not parts:
            continue
        top_sales = max((x["sales_28"] or 0) for x in parts) or 1
        fam_b = _family(b.get("name"))
        for x in parts:
            same_fam = bool(fam_b & _family(x["name"]))
            other_cat = x.get("category") != b.get("category")
            # 같은 짝이 여러 기준 상품에 반복 추천되지 않게 이미 쓴 만큼 감점
            x["score"] = ((x["sales_28"] or 0) / top_sales + (0.3 if other_cat else 0) + (0.25 if same_fam else 0)
                          - 0.35 * used.get(x["seq"], 0))
            why = []
            if same_fam:
                why.append(f"같은 계열({', '.join(sorted(fam_b & _family(x['name'])))})")
            if other_cat:
                why.append(f"{b.get('category')}+{x.get('category')} 함께 쓰기")
            why.append(f"짝 28일 매출 {(x['sales_28'] or 0) / 10000:,.0f}만원")
            x["why"] = " · ".join(why)
            rate = min(0.35, math.floor(x["combo_max_discount"] * 20 + 1e-9) / 20)
            x["suggest_rate"] = rate
            x["combo_sale_price"] = int(math.floor(x["combo_price"] * (1 - rate) / ROUND_UNIT) * ROUND_UNIT)
        parts.sort(key=lambda x: -x["score"])
        for x in parts[:per_base]:
            used[x["seq"]] = used.get(x["seq"], 0) + 1
        out.append({"base": compact(b), "base_max_discount": res["base_max_discount"], "partners": parts[:per_base]})
    return {"min_rate": min_rate, "target": target, "bundles": out}


# ----------------------------------------------------------------------
# 기획안 검증
# ----------------------------------------------------------------------
PLAN_ROW_FIELDS = ("promo", "type", "start", "end", "seq", "items", "rate", "appeal", "category_tag", "clearance", "memo")


def _baseline_daily_qty(p):
    """평소 하루 판매량: 최근 56일 중 행사일을 뺀 날 기준·요일 보정(build). 없으면 최근 28일 평균."""
    b = _f(p.get("base_qty"))
    if b is not None:
        return b
    q = _f(p.get("qty_28"))
    return (q or 0) / 28


def check_plan(rows, target=None):
    """
    기획안 행 검증. 행: {promo, type(상시/하루특가), start, end, seq 또는 items[{seq,qty}], rate, clearance}
    반환: 행별 계산값 + 경고 목록 + 요약.
    """
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    out_rows, per_day_deals = [], {}
    keyset = {}
    tot_sales = tot_disc = tot_profit = tot_lo = tot_hi = 0.0
    for i, r in enumerate(rows):
        res = {k: r.get(k) for k in PLAN_ROW_FIELDS}
        res["idx"] = i
        warns, errs, hints = [], [], []
        rate = _f(r.get("rate"))
        ptype = r.get("type") or "상시"
        try:
            s, e = _d(r.get("start")), _d(r.get("end") or r.get("start"))
        except ValueError:
            s = e = None
        if not s or not e:
            errs.append("시작일/종료일 형식 오류(YYYY-MM-DD)")
        elif e < s:
            errs.append("종료일이 시작일보다 빠름")
        if ptype == "하루특가" and s and e and s != e:
            warns.append("하루특가인데 기간이 하루가 아님")
        if rate is None or rate <= 0:
            errs.append("할인율 없음")
        elif rate >= 0.8:
            errs.append("할인율 80% 이상(차단)")
        elif rate >= 0.5:
            warns.append("할인율 50% 이상")
        if r.get("items"):
            mix = simulate_mix(r["items"], rate, target)
            res.update(kind="신규조합", name=" + ".join(f"{l['name']}{'×'+str(l['qty']) if l['qty'] > 1 else ''}"
                                                     for l in mix["lines"]),
                       price=mix["price"], cost=mix["cost"])
            if mix["missing"]:
                errs += mix["missing"]
            p = None
        else:
            p = DATA.products.get(str(r.get("seq")))
            if not p:
                errs.append(f"SEQ {r.get('seq')} 없음")
                res.update(kind="기존", name=None, price=None, cost=None)
            else:
                res.update(kind="기존", name=p.get("name"), category=p.get("category"),
                           price=_f(p.get("price")), cost=_f(p.get("cost")))
                if p.get("cost") is None:
                    warns.append("원가 없음: 원가율 검증 불가")
                if not p.get("active"):
                    warns.append("최근 90일 판매 없음(판매 중지 여부 확인)")
        price, cost = res.get("price"), res.get("cost")
        if price and rate is not None and 0 < rate < 1:
            res["sale_price"] = sale_price(price, rate)
            if cost is not None:
                cra = cost_ratio_after(price, cost, rate)
                res["cost_ratio_after"] = cra
                res["max_discount"] = max_discount(price, cost, target)
                up = unit_profit(res["sale_price"], cost)
                res["unit_profit"] = round(up)
                if cra > target + 1e-9:
                    (errs if config.COST_RATIO_STRICT and not r.get("clearance") else warns).append(
                        f"할인 후 원가율 {cra:.0%} > 기준 {target:.0%}" + (" (클리어런스 예외)" if r.get("clearance") else ""))
        if p and s and e:
            mx = _f(p.get("max_rate"))
            if rate and mx and rate > mx + 0.05:
                warns.append(f"역대 최대 할인 {mx:.0%}보다 높음")
            for h in DATA.promos_of(p["seq"]):
                hs, he = _d(h.get("start")), _d(h.get("end"))
                if not hs or not he:
                    continue
                # 상시 위에 하루특가를 얹는 건 정상 운영(어드민이 기간을 쪼갬) → 같은 유형끼리만 경고
                if hs <= e and he >= s and h.get("type") == ptype:
                    warns.append(f"기존 행사와 기간 겹침: {h.get('promo')} {h.get('type')} {hs:%m/%d}~{he:%m/%d} "
                                 f"{(_f(h.get('rate')) or 0):.0%}")
                elif ptype == "하루특가" and h.get("type") == "하루특가":
                    if 0 < (s - he).days <= RECENT_PROMO_DAYS:
                        warns.append(f"{(s - he).days}일 전에도 하루특가({h.get('promo')} {(_f(h.get('rate')) or 0):.0%})")
                    elif 0 < (hs - e).days <= RECENT_PROMO_DAYS:
                        warns.append(f"{(hs - e).days}일 뒤에도 하루특가 예정({h.get('promo')} {(_f(h.get('rate')) or 0):.0%})")
            base = _baseline_daily_qty(p)
            wdf = weekday_factor(s, e)
            lift, lo, hi, ln, lband = lift_info(rate, ptype)
            exp_qty = base * lift * wdf
            res["expected_qty"] = round(exp_qty)
            res["lift"], res["lift_n"], res["lift_band"] = round(lift, 2), ln, lband
            res["base_qty"] = round(base, 2)
            # 레버 힌트 (경고 아님 — 우리 실적에서 본 경향)
            if ptype == "하루특가":
                last_end = _d(p.get("last_deal_end")) if p.get("last_deal_end") else None
                gap = (s - last_end).days if last_end and last_end < s else None
                if gap is not None and gap <= DEAL_REST_DAYS:
                    hints.append(f"쉰 기간 {gap}일: 61~120일 쉰 상품의 반응이 14일 안 재특가보다 훨씬 컸음(레버 보드)")
                if s.weekday() == 0:
                    hints.append("월요일은 특가 없이도 매출이 가장 높은 날, 몰 전체 매출 증가 효과는 작았음(레버 보드)")
                elif s.weekday() >= 5:
                    hints.append("주말은 평소 매출이 낮은 날(토 0.6배 안팎): 특가 반응 근거 적음")
                if rate is not None and 0.30 < rate < 0.36:
                    hints.append("31~35%와 36~40% 사이 반응 차이가 큼, 36%를 열 수 있는지 확인(레버 보드)")
            elif ptype == "상시" and (e - s).days + 1 > SANGSI_LONG_DAYS:
                hints.append(f"상시 {(e - s).days + 1}일: 판매는 첫 3~5일에 몰림, 중간 계기(요일 특가·2차 오픈) 권장")
            if res.get("sale_price"):
                res["expected_sales"] = round(exp_qty * res["sale_price"])
                res["expected_range"] = [round(base * lo * wdf * res["sale_price"]), round(base * hi * wdf * res["sale_price"])]
                tot_lo += res["expected_range"][0]
                tot_hi += res["expected_range"][1]
                tot_sales += res["expected_sales"]
                tot_disc += exp_qty * (price - res["sale_price"])
                if res.get("unit_profit") is not None:
                    res["expected_profit"] = round(exp_qty * unit_profit(res["sale_price"], cost))
                    tot_profit += res["expected_profit"]
        if s and e:
            key = (str(r.get("seq") or res.get("name")), ptype)
            for prev_i, (ps, pe) in keyset.get(key, []):
                if ps <= e and pe >= s:
                    warns.append(f"이 기획안 {prev_i + 1}행과 같은 상품·유형 기간 겹침")
            keyset.setdefault(key, []).append((i, (s, e)))
            if ptype == "하루특가":
                per_day_deals[s.isoformat()] = per_day_deals.get(s.isoformat(), 0) + 1
        fl = efficacy_flags(r.get("appeal"))
        if fl:
            warns.append(f"소구문구에 효능으로 읽힐 수 있는 표현: {', '.join(fl)} (식품 표시광고: RA 확인)")
        res["errors"], res["warnings"], res["hints"] = errs, warns, hints
        res["level"] = "error" if errs else ("warn" if warns else "ok")
        out_rows.append(res)
    crowded = {d: n for d, n in per_day_deals.items() if n > DAILY_DEAL_MAX_PER_DAY}
    spread = {d: n for d, n in per_day_deals.items() if DEAL_SWEET_SPOT < n <= DAILY_DEAL_MAX_PER_DAY}
    summary = {
        "rows": len(out_rows), "errors": sum(1 for r in out_rows if r["errors"]),
        "warnings": sum(1 for r in out_rows if r["warnings"] and not r["errors"]),
        "expected_sales": round(tot_sales), "expected_discount": round(tot_disc),
        "expected_profit": round(tot_profit), "expected_range": [round(tot_lo), round(tot_hi)],
        "spread_days": spread, "hints": sum(len(r["hints"]) for r in out_rows),
        "profit_rate": tot_profit / (tot_sales / config.VAT) if tot_sales else None,
        "daily_deals_per_day": per_day_deals, "crowded_days": crowded, "target": target,
        "note": "예상 매출 = 평소 하루 판매(최근 56일 중 행사일 제외) × 요일 지수 × 과거 할인율 구간 반응도(범위: 하위25~상위25%). "
                "상시는 반응도 1.0 가정. "
                "매출총이익 = 예상 수량 × (할인가 ÷ 1.1 − 원가), 신규 조합은 판매 이력이 없어 빠짐",
    }
    return {"rows": out_rows, "summary": summary}


def simulate_single(seq, rate, promo_type="상시", target=None):
    """상품 하나를 rate로 할인할 때: 할인가·원가율·개당 이익, 과거 반응도로 본 하루 예상 수량·매출·이익(참고)."""
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    p = DATA.products.get(str(seq))
    if not p:
        return None
    price, cost = _f(p.get("price")), _f(p.get("cost"))
    out = {"seq": str(seq), "rate": rate, "type": promo_type, "price": price, "cost": cost}
    if not price:
        return out
    sp = sale_price(price, rate)
    base = _baseline_daily_qty(p)
    lift, lo, hi, ln, lband = lift_info(rate, promo_type)
    out.update(sale_price=sp, base_daily_qty=base, base_src=p.get("base_src"), lift=lift, lift_lo=lo, lift_hi=hi, lift_n=ln,
               lift_band=lband, daily_qty=base * lift, daily_sales=base * lift * sp)
    if cost is not None:
        up = unit_profit(sp, cost)
        out.update(cost_ratio_after=cost_ratio_after(price, cost, rate), unit_profit=up,
                   regular_unit_profit=unit_profit(price, cost), daily_profit=base * lift * up,
                   ok=cost_ratio_after(price, cost, rate) <= target + 1e-9)
    return out


# ----------------------------------------------------------------------
# 할인 반응 — "몇 %에서 얼마나 팔렸나 → 다음엔 여기까지"
# ----------------------------------------------------------------------
DEPTH = [(0.25, "~25%"), (0.30, "26~30%"), (0.35, "31~35%"), (0.40, "36~40%"), (1.0, "41%~")]


def _depth(rate):
    return next(lab for hi, lab in DEPTH if rate <= hi + 1e-9)


def discount_response(seq, target=None):
    """상품의 지난 하루특가 반응을 할인 구간별로 + 같은 카테고리 곡선 + 원가율 선 + 쉰 기간 → 다음 할인 제안(규칙)."""
    DATA.ensure()
    target = target or config.TARGET_COST_RATIO
    p = DATA.products.get(str(seq))
    if not p:
        return None
    own = {}
    for h in DATA.promos_of(seq):
        lift, rate = _f(h.get("lift")), _f(h.get("rate"))
        if h.get("type") != "하루특가" or h.get("status") != "완료" or lift is None or not rate or rate >= 1:
            continue
        own.setdefault(_depth(rate), []).append((lift, h.get("start")))
    own_rows = []
    for _, lab in DEPTH:
        xs = own.get(lab)
        if xs:
            ls = sorted(x[0] for x in xs)
            own_rows.append({"band": lab, "lift": round(ls[len(ls) // 2], 2), "n": len(ls), "last": max(x[1] for x in xs)})
    cat_curve = next((r["cells"] for r in DATA.levers.get("depth_by_category", []) if r["key"] == p.get("category")), {})
    price, cost = _f(p.get("price")), _f(p.get("cost"))
    md = max_discount(price, cost, target) if price and cost is not None else None
    cra = {r: cost_ratio_after(price, cost, r) for r in (0.30, 0.36, 0.40)} if price and cost is not None else {}
    dsd = int(p["days_since_deal"]) if p.get("days_since_deal") is not None else None
    tips = []
    if own_rows:
        best = max(own_rows, key=lambda r: r["lift"])
        tips.append(f"지난 하루특가 중 {best['band']}에서 가장 잘 팔렸어요 (평소의 {best['lift']:.1f}배 · {best['n']}건).")
    c36, c31 = (cat_curve.get("36~40%") or {}).get("lift"), (cat_curve.get("31~35%") or {}).get("lift")
    if md is not None:
        if md >= 0.36:
            tips.append(f"원가율 {target:.0%} 안에서 {min(md, 0.40) * 100:.0f}%까지 가능해요"
                        + (f": {p.get('category')}는 36~40%에서 평소의 {c36:.0f}배였어요." if c36 else "."))
        elif md > 0:
            tips.append(f"원가율 {target:.0%} 선에선 최대 {md * 100:.0f}%예요. 36%를 열면 원가율 {cra[0.36] * 100:.0f}%"
                        + (f": {p.get('category')} 36~40% 반응 {c36:.0f}배 vs 31~35% {c31:.0f}배." if c36 and c31 else "."))
        else:
            tips.append("원가율 기준으로는 할인 여력이 거의 없어요. 원가 낮은 상품과 묶어 보세요.")
    if dsd is None:
        tips.append("2025-09 이후 하루특가 기록이 없어요. 첫 특가는 반응이 큰 편이었어요(레버 보드).")
    elif dsd < DEAL_REST_DAYS:
        tips.append(f"마지막 하루특가가 {dsd}일 전이에요. {DEAL_REST_DAYS - dsd}일 더 쉬면 반응이 커질 가능성이 있어요.")
    else:
        tips.append(f"하루특가를 {dsd}일 쉬었어요. 지금 걸기 좋은 때예요.")
    return {"seq": str(seq), "own": own_rows, "category": p.get("category"), "category_curve": cat_curve,
            "max_discount": md, "cost_ratio_at": {f"{int(k * 100)}": v for k, v in cra.items()},
            "days_since_deal": dsd, "base_qty": _f(p.get("base_qty")), "base_src": p.get("base_src"), "tips": tips,
            "note": "반응 = 하루특가 당일 수량 ÷ 시작 35~8일 전 일평균 (세팅 할인율 ±2%p 판매). 건수가 적으면 카테고리 곡선을 함께 보세요."}


# ----------------------------------------------------------------------
# 작년 같은 기간
# ----------------------------------------------------------------------
def last_year_window(date_from, date_to):
    """올해 기간 → 작년(364일 전) 같은 요일 기간의 인덱스. 데이터 범위를 벗어나면 None."""
    ly = DATA.last_year
    if not ly or not ly.get("start"):
        return None
    off = ly.get("offset", config.LAST_YEAR_OFFSET)
    d0, d1 = _d(date_from) - timedelta(days=off), _d(date_to) - timedelta(days=off)
    s = _d(ly["start"])
    i0, i1 = (d0 - s).days, (d1 - s).days
    if i1 < 0 or i0 >= ly.get("days", 0):
        return None
    return max(0, i0), min(ly["days"] - 1, i1), d0, d1


def last_year_top(date_from, date_to, limit=30, category=None):
    """작년 같은 기간(364일 전)에 많이 팔린 상품. 올해 판매 중·원가 있는 상품만, 작년 행사 여부를 함께 준다."""
    DATA.ensure()
    win = last_year_window(date_from, date_to)
    if not win:
        return {"available": False, "rows": [],
                "message": "작년 같은 기간 실적이 데이터 범위 밖입니다 (실적 마지막 날 기준 지난 28일 ~ 앞으로 150일만 담음)."}
    i0, i1, d0, d1 = win
    ly = DATA.last_year
    rows = []
    for seq, arr in ly["sales"].items():
        p = DATA.products.get(seq)
        if not p or not p.get("active"):
            continue
        if category and p.get("category") != category:
            continue
        s = sum(arr[i0:i1 + 1])
        if s <= 0:
            continue
        q = sum((ly["qty"].get(seq) or [0] * ly["days"])[i0:i1 + 1])
        promos = sorted({f"{h.get('promo')} {h.get('type')}" for h in DATA.promos_of(seq)
                         if _d(h.get("start")) and _d(h.get("start")) <= d1 and (_d(h.get("end")) or _d(h.get("start"))) >= d0})
        rows.append({**compact(p), "ly_sales": s, "ly_qty": q, "ly_promos": promos})
    rows.sort(key=lambda r: -r["ly_sales"])
    total = sum(ly["total"][i0:i1 + 1])
    return {"available": True, "ly_from": d0.isoformat(), "ly_to": d1.isoformat(), "ly_total": total,
            "rows": rows[: max(1, min(int(limit or 30), 200))],
            "note": "작년 = 364일 전 같은 요일. 작년 행사는 PROMO_WORK 기록(2025-09 이후)만 확인됨"}

# -*- coding: utf-8 -*-
"""
과거 행사 이력(PROMO_WORK) × 판매실적 → 행사별 성과, 할인 패턴, SEQ별 판매 요약.

실적은 출고일 기준이라 행사 실적이 다음 날로 밀릴 수 있다. 그래서 날짜만 보지 않고
'라인 할인율이 세팅 할인율과 같은 판매'를 행사 실적으로 본다 (종료 다음 날까지).
"""
from datetime import date, timedelta

import numpy as np
import pandas as pd

from ops.document import data_loader as DL

from . import config
from .costing import cost_ratio_after


def parse_promo_rows(promo_rows) -> pd.DataFrame:
    """ops.core.promo_workbook.PromoRow 목록 → 정규화한 DataFrame (할인율은 0~1 소수)."""
    out = []
    for r in promo_rows:
        start, end = DL._parse_date(r.start), DL._parse_date(r.end)
        if not r.seq or start is None:
            continue
        price = DL._parse_number(r.price)
        dtype = str(r.discount_type or "").strip()
        if dtype == "정액":
            amount = DL._parse_number(r.rate)
            rate = amount / price if amount is not None and price else None
        else:
            rate = DL._parse_rate(r.rate)
        out.append({"row": r.row, "promo": r.promo_name, "type": r.type, "seq": r.seq,
                    "item_name": str(r.item_name or "").strip(), "category_tag": r.category,
                    "discount_type": dtype, "price": price, "rate": rate,
                    "start": pd.Timestamp(start), "end": pd.Timestamp(end or start)})
    df = pd.DataFrame(out)
    if not df.empty:
        df["days"] = (df["end"] - df["start"]).dt.days + 1
        df["price_band"] = df["price"].map(config.price_band)
    return df


def promo_performance(promos: pd.DataFrame, sales: pd.DataFrame, seq_cost: dict) -> pd.DataFrame:
    """행사 행마다 행사 실적(라인 할인율 매칭)·평소 대비 배수·할인 후 원가율."""
    if promos.empty:
        return promos
    last_day = sales["date"].max()
    by_seq = {k: v for k, v in sales.groupby("seq")}
    res = []
    for p in promos.itertuples(index=False):
        rec = {"row": p.row, "promo_qty": np.nan, "promo_sales": np.nan, "match_share": np.nan,
               "base_daily_qty": np.nan, "lift": np.nan, "cost_ratio_after": np.nan, "status": ""}
        cost = seq_cost.get(p.seq)
        if cost and p.price and p.rate is not None and p.rate < 1:
            rec["cost_ratio_after"] = cost_ratio_after(p.price, cost, p.rate)
        if p.start > last_day:
            rec["status"] = "예정"
            res.append(rec)
            continue
        s = by_seq.get(p.seq)
        if s is None or p.rate is None:
            rec["status"] = "실적 없음"
            res.append(rec)
            continue
        w_end = min(p.end + timedelta(days=config.SHIP_LAG_DAYS), last_day)
        win = s[(s["date"] >= p.start) & (s["date"] <= w_end)]
        hit = win[(win["rate"] - p.rate).abs() <= config.RATE_MATCH_TOL]
        rec["promo_qty"] = hit["qty"].sum()
        rec["promo_sales"] = hit["sales"].sum()
        tot = win.loc[win["qty"] > 0, "qty"].sum()
        rec["match_share"] = hit.loc[hit["qty"] > 0, "qty"].sum() / tot if tot > 0 else np.nan
        b0 = p.start - timedelta(days=config.BASELINE_FROM)
        b1 = p.start - timedelta(days=config.BASELINE_TO)
        base = s[(s["date"] >= b0) & (s["date"] <= b1)]["qty"].sum() / (config.BASELINE_FROM - config.BASELINE_TO + 1)
        rec["base_daily_qty"] = base
        days = (min(p.end, last_day) - p.start).days + 1
        if base > 0 and days > 0:
            rec["lift"] = (rec["promo_qty"] / days) / base
        rec["status"] = "진행중" if p.end > last_day else "완료"
        res.append(rec)
    return promos.merge(pd.DataFrame(res), on="row", how="left")


def discount_patterns(perf: pd.DataFrame) -> pd.DataFrame:
    """유형 × 가격대별 평소 할인율·반응도·할인 후 원가율."""
    d = perf[perf["rate"].notna() & (perf["rate"] > 0) & (perf["rate"] < 1)
             & perf["type"].isin(["상시", "하루특가"])].copy()
    if d.empty:
        return pd.DataFrame()
    q = lambda x, v: x.quantile(v)
    g = d.groupby(["type", "price_band"])
    out = g.agg(행사수=("row", "size"),
                할인율_하위25=("rate", lambda x: q(x, .25)), 할인율_중앙=("rate", "median"),
                할인율_상위25=("rate", lambda x: q(x, .75)), 할인율_최대=("rate", "max"),
                반응도_중앙=("lift", "median"), 할인후원가율_중앙=("cost_ratio_after", "median"),
                행사일수_중앙=("days", "median")).reset_index()
    order = {lab: i for i, (_, _, lab) in enumerate(config.PRICE_BANDS)}
    out["_o"] = out["price_band"].map(order)
    return out.sort_values(["type", "_o"]).drop(columns="_o").rename(columns={"type": "유형", "price_band": "가격대"})


def lift_by_rate(perf: pd.DataFrame) -> pd.DataFrame:
    """하루특가 할인율 구간별 반응도(평소 대비 배수)."""
    d = perf[(perf["type"] == "하루특가") & perf["lift"].notna()].copy()
    if d.empty:
        return pd.DataFrame()
    d["구간"] = pd.cut(d["rate"], [0, .25, .30, .35, .40, 1], labels=["~25%", "26~30%", "31~35%", "36~40%", "41%~"])
    return d.groupby("구간", observed=True).agg(행사수=("row", "size"), 반응도_중앙=("lift", "median"),
                                               반응도_하위25=("lift", lambda x: x.quantile(.25)),
                                               반응도_상위25=("lift", lambda x: x.quantile(.75))).reset_index()


def seq_sales_summary(sales: pd.DataFrame, days_series: int = 90) -> tuple:
    """SEQ별 최근 판매 요약 + 최근 N일 일별 수량. 반환: (DataFrame, 기준일)"""
    last = sales["date"].max()
    daily = sales.groupby(["seq", "date"], as_index=False)[["sales", "qty", "disc"]].sum()

    def window(a, b):
        w = daily[(daily["date"] > last - timedelta(days=a)) & (daily["date"] <= last - timedelta(days=b))]
        return w.groupby("seq")[["sales", "qty", "disc"]].sum()

    r28, p28, r90 = window(28, 0), window(56, 28), window(90, 0)
    out = pd.DataFrame(index=sorted(daily["seq"].unique()))
    out["sales_28"], out["qty_28"] = r28["sales"], r28["qty"]
    out["sales_prev28"] = p28["sales"]
    out["sales_90"], out["qty_90"] = r90["sales"], r90["qty"]
    gross = r28["sales"] + r28["disc"]
    out["avg_disc_28"] = r28["disc"] / gross.where(gross > 0)
    out = out.fillna({"sales_28": 0, "qty_28": 0, "sales_prev28": 0, "sales_90": 0, "qty_90": 0})
    out["growth_28"] = np.where(out["sales_prev28"] > 0, out["sales_28"] / out["sales_prev28"] - 1, np.nan)
    days = pd.date_range(last - timedelta(days=days_series - 1), last)
    piv = daily[daily["date"] >= days[0]].pivot_table(index="seq", columns="date", values="qty", aggfunc="sum")
    piv = piv.reindex(columns=days).fillna(0)
    out["daily_qty"] = [list(map(int, piv.loc[s].values)) if s in piv.index else [0] * days_series for s in out.index]
    last_sale = daily[daily["qty"] > 0].groupby("seq")["date"].max()
    out["last_sale_date"] = last_sale.dt.strftime("%Y-%m-%d")
    # 판매 기간 (첫 판매일부터). 쿠폰·상시 할인 때문에 라인 할인율로는 '할인 공백'을 못 잰다 →
    # '오래 행사 없던 상품'은 PROMO_WORK 기준 days_since_promo(seq_promo_summary)로 본다
    first_sale = daily[daily["qty"] > 0].groupby("seq")["date"].min()
    out["days_on_sale"] = (last - first_sale).dt.days
    out.index.name = "seq"
    return out.reset_index(), last


def last_year_daily(sales: pd.DataFrame, last_day: pd.Timestamp, offset: int = None, ahead: int = None) -> dict:
    """
    작년 같은 기간 일별 매출·수량 (기획할 앞으로 N일에 해당하는 작년 날짜).
    작년 날짜 = 올해 날짜 - offset(364일 = 같은 요일). 반환 리스트의 i번째 = 작년 (start + i일).
    """
    offset = offset or config.LAST_YEAR_OFFSET
    back = config.LAST_YEAR_BACK_DAYS
    ahead = (ahead or config.LAST_YEAR_AHEAD_DAYS) + back
    d0 = last_day + timedelta(days=1) - timedelta(days=offset) - timedelta(days=back)
    days = pd.date_range(d0, periods=ahead)
    w = sales[(sales["date"] >= days[0]) & (sales["date"] <= days[-1])]
    out = {"start": d0.strftime("%Y-%m-%d"), "this_year_start": (last_day + timedelta(days=1)).strftime("%Y-%m-%d"),
           "days": ahead, "back": back, "offset": offset, "sales": {}, "qty": {}, "total": [0] * ahead}
    if w.empty:
        return out
    g = w.groupby(["seq", "date"])[["sales", "qty"]].sum()
    for col in ("sales", "qty"):
        piv = g[col].unstack("date").reindex(columns=days).fillna(0)
        piv = piv[piv.sum(axis=1) > 0]
        out[col] = {str(s): [int(round(v)) for v in piv.loc[s].values] for s in piv.index}
    tot = w.groupby("date")["sales"].sum().reindex(days).fillna(0)
    out["total"] = [int(round(v)) for v in tot.values]
    return out


def seq_promo_summary(perf: pd.DataFrame, today: pd.Timestamp) -> pd.DataFrame:
    """SEQ별 행사 이력 요약: 최근 행사, 90일 행사 횟수, 최대 할인, 최고 반응도, 예정 행사."""
    if perf.empty:
        return pd.DataFrame(columns=["seq"])
    rows = []
    for seq, g in perf.groupby("seq"):
        past = g[g["start"] <= today].sort_values("start")
        fut = g[g["start"] > today].sort_values("start")
        rec = {"seq": seq}
        if not past.empty:
            lp = past.iloc[-1]
            rec.update(last_promo=lp["promo"], last_promo_type=lp["type"], last_promo_start=lp["start"].strftime("%Y-%m-%d"),
                       last_promo_rate=lp["rate"])
            rec["promos_90d"] = int((past["start"] > today - timedelta(days=90)).sum())
            last_end = past["end"].max()
            rec["last_promo_end"] = last_end.strftime("%Y-%m-%d")
            rec["days_since_promo"] = max(0, (today - last_end).days)
            valid = past[past["rate"].notna() & (past["rate"] < 1)]
            rec["max_rate"] = valid["rate"].max() if not valid.empty else np.nan
            dd = valid[valid["type"] == "하루특가"]
            rec["daily_deal_rate_median"] = dd["rate"].median() if not dd.empty else np.nan
            rec["best_lift"] = past["lift"].max()
        if not fut.empty:
            rec["upcoming"] = [{"promo": r.promo, "type": r.type, "start": r.start.strftime("%Y-%m-%d"),
                                "end": r.end.strftime("%Y-%m-%d"), "rate": r.rate} for r in fut.itertuples()]
        # 오늘 진행 중(시작 ≤ 오늘 ≤ 종료)인 행사
        cur = g[(g["start"] <= today) & (g["end"] >= today)]
        if not cur.empty:
            rec["running"] = [{"promo": r.promo, "type": r.type, "end": r.end.strftime("%Y-%m-%d"), "rate": r.rate}
                              for r in cur.itertuples()]
        rows.append(rec)
    return pd.DataFrame(rows)


def today_ts() -> pd.Timestamp:
    return pd.Timestamp(date.today())

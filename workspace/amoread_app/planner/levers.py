# -*- coding: utf-8 -*-
"""
기획 레버: 우리 실적으로 잰 '기획할 때 돌릴 수 있는 손잡이' (build 단계에서 계산해 planner_data.json에 저장).

모두 관찰값이다(시즌·상품 선정이 섞여 있어 인과로 단정하지 않음). 화면에는 근거 건수와 함께 보여준다.
- 요일: 몰 일매출(전 SEQ 합) ÷ 28일 이동중앙값 → 요일별 중앙값. 하루특가 있는 날/없는 날을 나눠 본다
- 할인 깊이: 하루특가 반응도(평소 대비 배수) 중앙값을 카테고리·가격대 × 할인 구간으로
- 재특가 간격: 같은 SEQ의 직전 하루특가 종료일과의 간격 구간별 반응도
- 하루 품목 수: 그날 하루특가 품목 수별 품목당 반응도·그날 특가 매출 합
- 상시 감쇠: 10일 이상 상시 품목의 일차별 판매(첫 3일 평균 = 1)
- 월 계절: 월 매출 ÷ 그해 월평균
"""
from datetime import timedelta

import numpy as np
import pandas as pd

from . import config

WD = "월화수목금토일"
DEPTH_BINS = [0, .25, .30, .35, .40, 1]
DEPTH_LABELS = ["~25%", "26~30%", "31~35%", "36~40%", "41%~"]
GAP_BINS = [0, 14, 30, 60, 120, 99999]
GAP_LABELS = ["~14일", "15~30일", "31~60일", "61~120일", "120일+·첫 특가"]
NDAY_BINS = [0, 2, 3, 4, 6, 99]
NDAY_LABELS = ["1~2개", "3개", "4개", "5~6개", "7개+"]


def _r(v, n=3):
    try:
        f = float(v)
        return None if np.isnan(f) else round(f, n)
    except (TypeError, ValueError):
        return None


def promo_days_by_seq(promos: pd.DataFrame) -> dict:
    """SEQ → 행사가 걸린 날짜 집합(종료 다음 날까지: 출고일 기준 실적 보정)."""
    out = {}
    for r in promos.itertuples(index=False):
        if pd.isna(r.start):
            continue
        end = (r.end if not pd.isna(r.end) else r.start) + timedelta(days=config.SHIP_LAG_DAYS)
        out.setdefault(r.seq, set()).update(pd.date_range(r.start, end))
    return out


def weekday_index(sales: pd.DataFrame) -> list:
    """몰 전체 일매출의 요일 지수(최근 2년, 28일 이동중앙값 대비 중앙값). 월=0."""
    last = sales["date"].max()
    d = sales[sales["date"] > last - timedelta(days=730)].groupby("date")["sales"].sum()
    d = d.reindex(pd.date_range(d.index.min(), last), fill_value=0)
    rel = d / d.rolling(28, center=True, min_periods=14).median()
    idx = rel.groupby(rel.index.dayofweek).median()
    idx = idx / idx.mean()          # 평균 1로 맞춤 (기준선 × 지수 합이 기준선 × 7이 되게)
    return [round(float(idx.get(i, 1.0)), 3) for i in range(7)]


def baselines(sales: pd.DataFrame, promo_days: dict, wd_idx: list, windows=(28, 56), min_days=7) -> pd.DataFrame:
    """SEQ별 평소 하루 판매량: 최근 28일 중 행사일을 뺀 날의 수량 ÷ (그날 요일 지수 합).
    행사 없는 날이 min_days 미만이면 56일로 넓히고, 그래도 부족하면 최근 28일 평균(행사일 포함)으로 대체해 표시한다.
    (56일 창을 기본으로 쓰면 9월 추석 같은 대목이 섞여 비수기 기준선이 부풀려져 28일을 먼저 쓴다)"""
    last = sales["date"].max()
    big = pd.date_range(last - timedelta(days=max(windows) - 1), last)
    daily = sales[sales["date"] >= big[0]].groupby(["seq", "date"])["qty"].sum()
    rows = []
    wd = np.array(wd_idx)
    for seq, g in daily.groupby(level=0):
        q_all = g.droplevel(0).reindex(big, fill_value=0)
        pdays = promo_days.get(seq, set())
        rec = None
        for w in windows:
            days = big[-w:]
            q = q_all.reindex(days)
            mask = np.array([d not in pdays for d in days])
            n = int(mask.sum())
            if n >= min_days:
                wsum = wd[days.dayofweek.values[mask]].sum()
                rec = {"base_qty": round(float(q.values[mask].sum() / wsum), 3) if wsum > 0 else 0.0,
                       "base_days": n, "base_src": f"최근 {w}일 중 행사 없는 {n}일"}
                break
        if rec is None:
            rec = {"base_qty": round(float(q_all.values[-28:].sum() / 28), 3), "base_days": 0,
                   "base_src": "최근 28일 평균(행사가 잦아 행사일 포함)"}
        rows.append({"seq": seq, **rec})
    return pd.DataFrame(rows)


def compute(sales: pd.DataFrame, perf: pd.DataFrame, products: pd.DataFrame, wd_idx: list) -> dict:
    out = {"weekday_index": wd_idx}
    last = sales["date"].max()
    mall = sales[sales["date"] > last - timedelta(days=1000)].groupby("date")["sales"].sum()
    mall = mall.reindex(pd.date_range(mall.index.min(), last), fill_value=0)
    rel = mall / mall.rolling(28, center=True, min_periods=14).median()

    deal = perf[perf["type"] == "하루특가"].copy()
    deal_days = set()
    for r in deal.itertuples(index=False):
        deal_days.update(pd.date_range(r.start, r.end))
    is_deal = rel.index.isin(deal_days)
    wd = rel.index.dayofweek
    out["weekday"] = [{"wd": WD[i], "all": _r(rel[wd == i].median()), "no_deal": _r(rel[(wd == i) & ~is_deal].median()),
                       "deal": _r(rel[(wd == i) & is_deal].median()), "deal_days": int(((wd == i) & is_deal).sum())}
                      for i in range(7)]

    done = deal[(deal["status"] == "완료") & deal["lift"].notna()].copy()
    cat = products.set_index("seq")["category"]
    done["category"] = done["seq"].map(cat)
    done["depth"] = pd.cut(done["rate"], DEPTH_BINS, labels=DEPTH_LABELS)
    out["deal_weekday"] = [{"wd": WD[i], "lift": _r(g["lift"].median(), 2), "n": int(len(g))}
                           for i, g in done.groupby(done["start"].dt.dayofweek)]

    def depth_table(key):
        rows = []
        for k, g in done.groupby(key, observed=True):
            if not k:
                continue
            cells = {}
            for b, gg in g.groupby("depth", observed=True):
                cells[str(b)] = {"lift": _r(gg["lift"].median(), 2), "q1": _r(gg["lift"].quantile(.25), 2),
                                 "q3": _r(gg["lift"].quantile(.75), 2), "n": int(len(gg))}
            rows.append({"key": k, "cells": cells})
        return rows
    out["depth_labels"] = DEPTH_LABELS
    out["depth_by_category"] = depth_table("category")
    out["depth_by_price"] = depth_table("price_band")
    out["depth_all"] = depth_table(lambda _: "전체")

    # 재특가 간격
    allp = deal.sort_values("start")
    prev, gaps = {}, {}
    for r in allp.itertuples(index=False):
        p = prev.get(r.seq)
        gaps[r.row] = (r.start - p).days if p is not None else None
        prev[r.seq] = r.end
    done["gap"] = done["row"].map(gaps)
    done["gap_b"] = pd.cut(done["gap"].fillna(99998), GAP_BINS, labels=GAP_LABELS)
    out["gap"] = [{"band": str(b), "lift": _r(g["lift"].median(), 2), "rate": _r(g["rate"].median(), 2), "n": int(len(g))}
                  for b, g in done.groupby("gap_b", observed=True)]

    # 하루 품목 수
    done["n_day"] = done.groupby("start")["seq"].transform("count")
    done["nb"] = pd.cut(done["n_day"], NDAY_BINS, labels=NDAY_LABELS)
    day = done.groupby("start").agg(n=("seq", "count"), tot=("promo_sales", "sum"))
    day["nb"] = pd.cut(day["n"], NDAY_BINS, labels=NDAY_LABELS)
    per_item = done.groupby("nb", observed=True)["lift"].median()
    per_day = day.groupby("nb", observed=True)["tot"].median()
    ndays = day.groupby("nb", observed=True).size()
    out["items_per_day"] = [{"band": str(b), "lift": _r(per_item.get(b), 2), "day_sales": _r(per_day.get(b), 0),
                             "days": int(ndays.get(b, 0))} for b in NDAY_LABELS if b in ndays.index]

    # 상시 감쇠
    ss = perf[(perf["type"] == "상시") & (perf["status"] == "완료") & perf["rate"].notna()].copy()
    ss = ss[(ss["end"] - ss["start"]).dt.days + 1 >= 10]
    by = {k: v for k, v in sales.groupby("seq")}
    curves = []
    for r in ss.itertuples(index=False):
        g = by.get(r.seq)
        if g is None:
            continue
        w = g[(g["date"] >= r.start) & (g["date"] <= r.end) & ((g["rate"] - r.rate).abs() <= config.RATE_MATCH_TOL)]
        w = w.groupby("date")["qty"].sum().reindex(pd.date_range(r.start, r.end), fill_value=0)
        if w.iloc[:3].mean() <= 0:
            continue
        curves.append(pd.Series((w / w.iloc[:3].mean()).values[:28], index=range(1, min(28, len(w)) + 1)))
    if curves:
        cv = pd.concat(curves, axis=1).median(axis=1)
        out["sangsi_decay"] = {"days": [int(i) for i in cv.index], "value": [_r(v, 2) for v in cv.values], "n": len(curves)}
    else:
        out["sangsi_decay"] = {"days": [], "value": [], "n": 0}

    # 월 계절
    ms = mall.groupby([mall.index.year, mall.index.month]).sum()
    months = []
    for y in sorted({k[0] for k in ms.index}):
        vals = {m: ms.get((y, m)) for m in range(1, 13)}
        full = [v for m, v in vals.items() if v is not None and not (y == last.year and m == last.month)]
        mean = np.mean(full) if full else None
        months.append({"year": int(y), "index": [_r(vals[m] / mean, 2) if vals[m] is not None and mean and not (y == last.year and m >= last.month) else None
                                                 for m in range(1, 13)]})
    out["month_index"] = months
    out["n_deals"] = int(len(done))
    out["note"] = ("관찰값입니다. 시즌·상품 선정이 섞여 있어 원인으로 단정하지 말고 '근거 + 다음에 시험해 볼 것'으로 쓰세요. "
                   "반응도 = 행사 기간 일평균 수량 ÷ 시작 35~8일 전 일평균(세팅 할인율 ±2%p 판매만).")
    return out

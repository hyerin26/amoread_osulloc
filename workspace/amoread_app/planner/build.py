# -*- coding: utf-8 -*-
"""
기획용 데이터 만들기 (1단계).

    python -m planner.build            # osulloc_ops 폴더에서 실행
    python -m planner.build --no-cache # 판매실적 CSV 다시 집계

결과
- planner/data/planner_data.json : 웹뷰·Claude가 읽는 데이터 (상품표, 할인 패턴, 행사 성과)
- output/기획데이터_점검_YYYYMMDD_HHMMSS.xlsx : 사람이 숫자를 확인하는 엑셀 (새 파일)
원천 파일(xlsm, 가이드, CSV)은 읽기만 한다.
"""
import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from ops.core import promo_workbook

from . import config, costing, history, levers, sources


def _clean(v):
    """JSON 직렬화: NaN/inf → None, numpy 숫자 → 파이썬 숫자, Timestamp → 문자열."""
    if isinstance(v, dict):
        return {k: _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    if isinstance(v, pd.Timestamp):
        return v.strftime("%Y-%m-%d")
    if v is pd.NaT:
        return None
    return v


def build(use_cache: bool = True, log=print) -> dict:
    log("1/5 온라인 가이드(상품장) 읽는 중...")
    cost_df, cost_sheet, guide_path = sources.load_cost_sheet()
    log(f"    {guide_path.name} / {cost_sheet} : SAP {len(cost_df)}개")

    log("2/5 프로모션 할인정보 xlsm 읽는 중 (스냅샷 사본)...")
    wb = promo_workbook.load()
    log(f"    PROMO_WORK {len(wb.promo_rows)}행 / SEQ_MASTER {len(wb.master_rows)}행 (원본 수정시각 {wb.source['modified_at']})")

    log("3/5 SEQ 원가 계산...")
    seq_df = costing.build_seq_table(wb.master_rows, cost_df, sources.load_wrap_overrides())
    ok = seq_df["cost"].notna()
    log(f"    원가 계산 {ok.sum()}/{len(seq_df)} SEQ (보자기 추정 {seq_df['status'].str.startswith('보자기').sum()}개)")

    log("4/5 판매실적 집계...")
    sales, files = sources.load_sales(use_cache=use_cache)
    log(f"    {', '.join(f.name for f in files)} → {sales['date'].min():%Y-%m-%d} ~ {sales['date'].max():%Y-%m-%d}")
    sales_sum, last_day = history.seq_sales_summary(sales)

    log("5/5 행사 이력 성과 계산...")
    promos = history.parse_promo_rows(wb.promo_rows)
    seq_cost = dict(zip(seq_df["seq"], seq_df["cost"]))
    perf = history.promo_performance(promos, sales, seq_cost)
    today = history.today_ts()
    promo_sum = history.seq_promo_summary(perf, today)
    patterns = history.discount_patterns(perf)
    lifts = history.lift_by_rate(perf)
    done = perf[perf["status"] == "완료"]
    log(f"    행사 {len(perf)}행 (완료 {len(done)}, 예정 {int((perf['status'] == '예정').sum())}) · "
        f"하루특가 당일 실적 중 세팅 할인율 일치 비중 "
        f"{done.loc[done['type'] == '하루특가', 'match_share'].median():.0%}")

    products = seq_df.merge(sales_sum, on="seq", how="left").merge(promo_sum, on="seq", how="left")
    products["active"] = products["sales_90"].fillna(0) > 0

    # 평소 판매(행사일 제외 · 요일 보정) — 예상 판매의 기준선. 행사일이 섞인 28일 평균은 과대 추정이라 쓰지 않음
    wd_idx = levers.weekday_index(sales)
    base = levers.baselines(sales, levers.promo_days_by_seq(promos), wd_idx)
    products = products.merge(base, on="seq", how="left")
    # 같은 상품 하루특가 쉰 기간 (재특가 간격 레버)
    past_deal = perf[(perf["type"] == "하루특가") & (perf["start"] <= today)].groupby("seq")["end"].max()
    products["last_deal_end"] = products["seq"].map(past_deal).map(lambda d: d.strftime("%Y-%m-%d") if pd.notna(d) else None)
    products["days_since_deal"] = products["seq"].map(past_deal).map(lambda d: int(max(0, (today - d).days)) if pd.notna(d) else None).astype("object")
    lever = levers.compute(sales, perf, products, wd_idx)
    log(f"    평소 판매 기준선 {int((products['base_days'].fillna(0) > 0).sum())}개 SEQ(행사일 제외) · 요일 지수 {wd_idx}")

    # 작년 같은 기간(364일 전, 같은 요일) 일별 매출 — 시즌 기획·작년 이맘때 비교용
    last_year = history.last_year_daily(sales, last_day)
    b = last_year["back"]
    products["ly_prev28"] = products["seq"].map(lambda s: sum((last_year["sales"].get(str(s)) or [0])[:b]))
    products["ly_next28"] = products["seq"].map(lambda s: sum((last_year["sales"].get(str(s)) or [0])[b:b + 28]))
    log(f"    작년 같은 기간 {last_year['start']}부터 {last_year['days']}일(지난 {b}일 포함) · 판매 있던 SEQ {len(last_year['sales'])}개")

    meta = {
        "built_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sales_last_day": last_day.strftime("%Y-%m-%d"),
        "sales_files": [f.name for f in files],
        "guide_file": guide_path.name, "cost_sheet": cost_sheet,
        "promo_workbook_modified": wb.source["modified_at"],
        "rules": {"target_cost_ratio": config.TARGET_COST_RATIO, "vat": config.VAT,
                  "wrap_cost": config.WRAP_COST, "wrap_cost_limited": config.WRAP_COST_LIMITED,
                  "rate_match_tol": config.RATE_MATCH_TOL, "ship_lag_days": config.SHIP_LAG_DAYS,
                  "stock_note": f"재고는 기획에 쓰지 않음 ({cost_sheet}의 전 채널·월마감 재고를 상품 상세에 참고로만 표시)"},
    }
    perf_out = perf   # category_tag(=PROMO_WORK 카테고리명·Zone)도 담는다. 지난 행사 재기획 때 Zone 구성을 그대로 가져오려고
    data = {
        "meta": meta,
        "products": products.to_dict(orient="records"),
        "patterns": patterns.to_dict(orient="records"),
        "lift_by_rate": lifts.to_dict(orient="records"),
        "promos": perf_out.to_dict(orient="records"),
        "last_year": last_year,
        "levers": lever,
    }
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = config.PLANNER_JSON.with_suffix(".tmp")
    tmp.write_text(json.dumps(_clean(data), ensure_ascii=False), encoding="utf-8")
    tmp.replace(config.PLANNER_JSON)
    log(f"저장: {config.PLANNER_JSON}")

    report = write_report(products, patterns, lifts, perf_out)
    log(f"점검 엑셀: {report}")
    return data


def write_report(products, patterns, lifts, perf) -> Path:
    config.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = config.REPORT_DIR / f"기획데이터_점검_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
    p = products.copy()
    p["구성"] = p["components"].map(lambda cs: " + ".join(f"{c.get('name')}({c.get('cost') or '?'})" for c in (cs or [])))
    prod_cols = {"seq": "SEQ", "name": "상품명", "category": "카테고리", "product_type": "구분", "price": "정가",
                 "cost": "원가(이동평균)", "cost_ratio": "정가 원가율", "max_discount": "원가율45% 최대할인",
                 "status": "원가 상태", "note": "비고", "sales_28": "최근28일 매출", "qty_28": "최근28일 수량", "base_qty": "평소 하루 수량(행사일 제외)", "days_since_deal": "하루특가 쉰 일수", "ly_next28": "작년 같은 기간 28일 매출",
                 "growth_28": "직전28일 대비", "sales_90": "최근90일 매출", "last_promo_end": "마지막 행사 종료일", "days_since_promo": "행사 없이 지난 일수",
                 "stock": "재고(참고: 상품장 전 채널)", "last_promo": "최근 행사", "last_promo_rate": "최근 할인율",
                 "promos_90d": "90일 행사수", "max_rate": "역대 최대할인", "best_lift": "최고 반응도", "구성": "구성(원가)"}
    sheet1 = p[[c for c in prod_cols if c in p.columns]].rename(columns=prod_cols)
    miss = sheet1[sheet1["원가 상태"] == "원가 누락"]
    pf_cols = {"promo": "프로모션", "type": "유형", "seq": "SEQ", "item_name": "상품명", "start": "시작", "end": "종료",
               "price": "정가", "rate": "할인율", "promo_qty": "행사 수량", "promo_sales": "행사 매출",
               "match_share": "할인율 일치 비중", "base_daily_qty": "평소 일평균", "lift": "반응도(배)",
               "cost_ratio_after": "할인후 원가율", "status": "상태"}
    sheet4 = perf[[c for c in pf_cols if c in perf.columns]].rename(columns=pf_cols)
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        sheet1.to_excel(xw, sheet_name="상품표", index=False)
        miss.to_excel(xw, sheet_name="원가누락", index=False)
        patterns.to_excel(xw, sheet_name="할인패턴", index=False)
        lifts.to_excel(xw, sheet_name="하루특가 반응도", index=False)
        sheet4.to_excel(xw, sheet_name="행사성과", index=False)
        pct = {"정가 원가율", "원가율45% 최대할인", "직전28일 대비", "최근 할인율", "역대 최대할인", "할인율",
               "할인율 일치 비중", "할인후 원가율", "할인율_하위25", "할인율_중앙", "할인율_상위25", "할인율_최대",
               "할인후원가율_중앙"}
        for ws in xw.book.worksheets:
            ws.freeze_panes = "A2"
            for cell in ws[1]:
                ws.column_dimensions[cell.column_letter].width = max(10, min(40, len(str(cell.value)) * 2))
                fmt = "0%" if cell.value in pct else ("#,##0" if cell.value and any(
                    k in str(cell.value) for k in ("매출", "정가", "원가(", "수량", "재고")) else None)
                if fmt:
                    for c in ws[cell.column_letter][1:]:
                        c.number_format = fmt
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description="기획용 데이터 만들기")
    ap.add_argument("--no-cache", action="store_true", help="판매실적 CSV 다시 집계")
    args = ap.parse_args(argv)
    try:
        build(use_cache=not args.no_cache)
    except (sources.SourceError, promo_workbook.WorkbookStructureError) as e:
        print(f"[오류] {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

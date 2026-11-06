# -*- coding: utf-8 -*-
"""
오설록닷컴 SAP 실적 요약 (이번 주 화면 첫 줄).

원천(읽기만): sap_sales_download.py 가 매일 만드는 planner/data/sap_sales_*.{csv,json}
목표: planner/settings/SAP_목표.csv (SAP 쿼리에 목표 값이 비어 있어 실적표 목표를 손으로 적어 둠)
"""
import calendar
import csv
import json
from datetime import date

from . import config

DAILY_CSV = config.DATA_DIR / "sap_sales_daily.csv"
LATEST_JSON = config.DATA_DIR / "sap_sales_latest.json"
STATUS_JSON = config.DATA_DIR / "sap_sales_status.json"
TARGET_CSV = config.SETTINGS_DIR / "SAP_목표.csv"
B2C = "17000100"          # 오설록 닷컴 B2C (planner SEQ 실적과 같은 몰)
STALE_GAP_DAYS = 3        # SAP 실적보다 SEQ 판매실적 CSV가 이만큼 넘게 늦으면 교체 알림
SPARK_DAYS = 28


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _targets():
    """{(기간, 거래처): 목표금액(원)}: 기간은 'YYYY-MM' 또는 'BY27'."""
    if not TARGET_CSV.exists():
        return {}
    with open(TARGET_CSV, encoding="utf-8-sig", newline="") as f:
        out = {}
        for r in csv.DictReader(f):
            try:
                out[(r["기간"].strip(), r["거래처"].strip())] = float(str(r["목표금액(백만원)"]).replace(",", "")) * 1e6
            except (KeyError, ValueError):
                continue
        return out


def _daily_series(code, last):
    if not DAILY_CSV.exists():
        return []
    with open(DAILY_CSV, encoding="utf-8-sig", newline="") as f:
        rows = {r["date"]: float(r["sales"] or 0) for r in csv.DictReader(f) if r["customer"] == code}
    days = sorted(d for d in rows if d <= last)[-SPARK_DAYS:]
    return [{"date": d, "sales": rows[d]} for d in days]


def _by_label(d: date) -> str:
    return f"BY{(d.year + 1 if d.month >= 7 else d.year) % 100}"


def _pick(rec, key):
    v = (rec or {}).get(key)
    return v if isinstance(v, (int, float)) else None


def summary(seq_last_day: str | None = None) -> dict:
    status = _read_json(STATUS_JSON) or {}
    latest = _read_json(LATEST_JSON)
    if not latest:
        return {"ready": False, "status": status}
    d = date.fromisoformat(latest["date"])
    rows = latest.get("rows", {})
    tg = _targets()
    month_key, by_key = f"{d:%Y-%m}", _by_label(d)
    days_in_month = calendar.monthrange(d.year, d.month)[1]

    def block(code):
        r = rows.get(code) or {}
        month = _pick(r, "당월금액")
        t_month, t_by = tg.get((month_key, code)), tg.get((by_key, code))
        by_now = _pick(r, "당년누적금액(BY)")
        return {
            "name": r.get("name", code),
            "day": _pick(r, "당일금액"), "day_qty": _pick(r, "당일수량"),
            "month": month, "month_ly": _pick(r, "전년동월금액"), "month_growth": _pick(r, "당월성장율"),
            # 단순 추정: 지금까지 하루 평균 × 이번 달 일수
            "month_forecast": month / d.day * days_in_month if month is not None else None,
            "month_target": t_month, "month_rate": month / t_month if month is not None and t_month else None,
            "by": by_now, "by_ly": _pick(r, "전년누적금액(BY)"), "by_growth": _pick(r, "누적성장율(BY)"),
            "by_target": t_by, "by_rate": by_now / t_by if by_now is not None and t_by else None,
            "spark": _daily_series(code, latest["date"]),
        }

    gap = None
    if seq_last_day:
        gap = (d - date.fromisoformat(seq_last_day)).days
    return {
        "ready": True, "date": latest["date"], "month_label": f"{d.month}월", "by_label": by_key,
        "status": status, "total": block("TOTAL"), "b2c": block(B2C),
        "seq_last_day": seq_last_day, "seq_gap": gap, "seq_stale": gap is not None and gap > STALE_GAP_DAYS,
        "target_file": TARGET_CSV.name,
    }

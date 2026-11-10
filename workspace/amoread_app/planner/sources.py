# -*- coding: utf-8 -*-
"""
원천 파일 읽기 (전부 읽기 전용).

- load_cost_sheet(): 온라인 가이드의 'NN월 상품장' 시트 → SAP별 이동평균가 원가·소비자가·재고
- load_sales(): SEQ 판매실적 CSV(연도별) → SEQ × 일자 × 라인할인율 집계표 (CSV 수정시각 기준 캐시)
"""
import re
import warnings
from pathlib import Path

import openpyxl
import pandas as pd

from . import config

warnings.filterwarnings("ignore", message="Data Validation extension is not supported")


class SourceError(Exception):
    pass


# ----------------------------------------------------------------------
# 온라인 가이드 (원가)
# ----------------------------------------------------------------------
def guide_candidates() -> list:
    """사용 가능한 온라인 가이드 파일들 (기본 폴더 + 웹에서 올린 폴더), 최신순."""
    files = []
    for d, pattern in ((config.GUIDE_DIR, config.GUIDE_GLOB), (config.GUIDE_UPLOAD_DIR, "*.xlsx")):
        if Path(d).exists():
            files += [p for p in Path(d).glob(pattern) if not p.name.startswith("~$")]
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


def find_guide_file(guide_dir: Path = None) -> Path:
    if guide_dir:
        files = sorted((p for p in Path(guide_dir).glob(config.GUIDE_GLOB) if not p.name.startswith("~$")),
                       key=lambda p: p.stat().st_mtime, reverse=True)
    else:
        files = guide_candidates()
    if not files:
        raise SourceError(f"온라인 가이드 파일이 없습니다: {config.GUIDE_DIR}\\{config.GUIDE_GLOB}")
    return files[0]


def load_wrap_overrides(path: Path = None) -> dict:
    """보자기_본품지정.csv → {보자기SEQ: 본품SEQ}"""
    path = Path(path or config.WRAP_OVERRIDE_CSV)
    if not path.exists():
        return {}
    try:
        df = pd.read_csv(path, encoding="utf-8-sig", dtype=str)
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="cp949", dtype=str)
    df = df.dropna(subset=[df.columns[0], df.columns[1]])
    return {str(a).strip(): str(b).strip() for a, b in zip(df.iloc[:, 0], df.iloc[:, 1]) if str(a).strip()}


def _sap_key(v):
    """SAP 코드를 비교 가능한 키로: 숫자는 int, 그 외(S코드 등)는 대문자 문자열."""
    if v is None:
        return None
    if isinstance(v, float):
        if v != v:  # NaN
            return None
        v = int(v)
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if not s:
        return None
    return int(s) if s.isdigit() else s.upper()


def _norm(v) -> str:
    return str(v).strip() if v is not None else ""


def _parse_price_cost_block(rows, sheet, cost_label, extra=()):
    """
    '상품코드' + cost_label(이동평균가 계열) 헤더가 있는 표를 읽는다.
    헤더 아래 줄: 소비자가 → 세전(VAT제외)/세후(VAT포함), 원가 열 → '원가'.
    """
    hdr = next((i for i, r in enumerate(rows[:40]) if "상품코드" in [_norm(v) for v in r]
                and cost_label in [_norm(v) for v in r]), None)
    if hdr is None:
        raise SourceError(f"{sheet}: '상품코드'·'{cost_label}' 헤더를 찾지 못했습니다")
    h = [_norm(v) for v in rows[hdr]]
    names = ("상품코드", "상품명", "소비자가", cost_label) + tuple(extra)
    col = {}
    for name in names:
        if name in h:
            col[name] = h.index(name)
    for a, b in (("대", "유형(대)"), ("대", "대유형"), ("중", "유형(중)"), ("중", "중유형"), ("소", "유형(소)"), ("소", "소유형")):
        if a not in col and b in h:
            col[a] = h.index(b)
    sub = [_norm(v) for v in rows[hdr + 1]]
    price_col = col["소비자가"] + (1 if sub[col["소비자가"] + 1] in ("세후", "VAT포함") else 0)
    cost_col = col[cost_label]
    if sub[cost_col] != "원가":
        raise SourceError(f"{sheet}: '{cost_label}' 아래 '원가' 열 위치가 예상과 다릅니다 ({sub[cost_col]!r})")
    out = []
    for r in rows[hdr + 2:]:
        sap = _sap_key(r[col["상품코드"]]) if col["상품코드"] < len(r) else None
        if sap is None:
            continue
        g = lambda k: r[col[k]] if k in col and col[k] < len(r) else None
        cost = pd.to_numeric(r[cost_col], errors="coerce")
        out.append({
            "sap": sap, "sap_name": g("상품명"), "대": g("대"), "중": g("중"), "소": g("소"),
            "price_vat": pd.to_numeric(r[price_col], errors="coerce"),
            # 원가 0원은 '미입력'으로 본다 (포장재 930…은 costing에서 따로 0원 처리)
            "cost": cost if cost == cost and cost > 0 else float("nan"),
            "logistics_stock": pd.to_numeric(g("물류재고"), errors="coerce"),
            "sales_stock": pd.to_numeric(g("영업재고"), errors="coerce"),
        })
    return pd.DataFrame(out).drop_duplicates("sap", keep="first")


def load_cost_sheet(path: Path = None) -> tuple:
    """
    반환: (DataFrame[sap, sap_name, 대, 중, 소, price_vat, cost, cost_source, logistics_stock, sales_stock],
           시트이름, 파일경로)
    원가 = 'NN월 상품장'의 '이동평균가' 아래 '원가' (사용자 확정: 이동평균가를 원가로 본다).
    상품장에 없는 SAP는 같은 파일 '1) 상품정보_손익예측' 시트의 '[*참고]이평가' 원가로 채운다
    (그 시트는 예전 기준 값이라 cost_source='구 상품정보'로 표시).
    """
    path = Path(path or find_guide_file())
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheets = [s for s in wb.sheetnames if re.search(r"월\s*상품장\s*$", s)]
        if not sheets:
            raise SourceError(f"'NN월 상품장' 시트가 없습니다: {wb.sheetnames}")
        sheet = sheets[0]
        rows = [list(r) for r in wb[sheet].iter_rows(values_only=True)]
        fb_sheet = next((s for s in wb.sheetnames if "상품정보" in s and "손익" in s), None)
        fb_rows = [list(r) for r in wb[fb_sheet].iter_rows(values_only=True)] if fb_sheet else []
    finally:
        wb.close()

    df = _parse_price_cost_block(rows, sheet, "이동평균가", extra=("물류재고", "영업재고"))
    df["cost_source"] = sheet
    if fb_rows:
        try:
            fb = _parse_price_cost_block(fb_rows, fb_sheet, "[*참고]이평가")
        except SourceError:
            fb = pd.DataFrame()
        if not fb.empty:
            fb = fb[fb["cost"].notna()]
            have = set(df.loc[df["cost"].notna(), "sap"])
            fb = fb[~fb["sap"].isin(have)].copy()
            fb["cost_source"] = f"구 상품정보({fb_sheet})"
            # 상품장에 행은 있지만 원가가 비어 있던 SAP는 원가만 채운다
            fill = df["cost"].isna() & df["sap"].isin(fb["sap"])
            m = fb.set_index("sap")
            df.loc[fill, "cost"] = df.loc[fill, "sap"].map(m["cost"])
            df.loc[fill, "cost_source"] = fb["cost_source"].iloc[0]
            df = pd.concat([df, fb[~fb["sap"].isin(df["sap"])]], ignore_index=True)
    return df, sheet, path


# ----------------------------------------------------------------------
# 판매실적 (SEQ)
# ----------------------------------------------------------------------
SALES_COLS = {
    "경로상품코드": "seq", "기준일자": "date_raw",
    "해체전 sellout순판매금액": "sales", "해체전 sellout판매수량": "qty", "해체전 sellout할인금액": "disc",
}


def _read_csv(path: Path, usecols) -> pd.DataFrame:
    try:
        return pd.read_csv(path, encoding="utf-8-sig", usecols=usecols)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="cp949", usecols=usecols)


def _parse_kdate(s: pd.Series) -> pd.Series:
    """'2026. 7. 20.' → Timestamp"""
    return pd.to_datetime(s.astype(str).str.replace(" ", "", regex=False), format="%Y.%m.%d.", errors="coerce")


def _aggregate_one(path: Path) -> pd.DataFrame:
    d = _read_csv(path, list(SALES_COLS)).rename(columns=SALES_COLS)
    d["date"] = _parse_kdate(d.pop("date_raw"))
    d = d.dropna(subset=["date", "seq"])
    d["seq"] = d["seq"].astype(int).astype(str)
    gross = d["sales"] + d["disc"]
    # 라인 할인율(소수 둘째 자리) — 하루 늦게 출고된 주문도 할인율로 행사에 귀속시키기 위함
    d["rate"] = (d["disc"] / gross.where(gross > 0)).round(2).fillna(-1.0)
    g = d.groupby(["seq", "date", "rate"], as_index=False)[["sales", "qty", "disc"]].sum()
    return g[(g["sales"] != 0) | (g["qty"] != 0) | (g["disc"] != 0)]


def load_sales(sales_dir: Path = None, use_cache: bool = True) -> tuple:
    """
    반환: (DataFrame[seq, date, rate, sales, qty, disc], 사용한 파일 목록)
    rate = 라인 할인율(0~1, 둘째 자리 반올림). 매출 0인 반품·취소 라인은 -1.
    연도별 CSV마다 수정시각으로 캐시(parquet)한다.
    """
    sales_dir = Path(sales_dir or config.SALES_DIR)
    files = sorted(p for p in sales_dir.glob(config.SALES_GLOB) if not p.name.startswith("~$"))
    if not files:
        raise SourceError(f"판매실적 CSV가 없습니다: {sales_dir}\\{config.SALES_GLOB}")
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    parts = []
    for f in files:
        stamp = int(f.stat().st_mtime)
        cache = config.CACHE_DIR / f"sales_{re.sub(r'[^0-9A-Za-z]+', '_', f.stem)}_{stamp}.parquet"
        if use_cache and cache.exists():
            parts.append(pd.read_parquet(cache))
            continue
        agg = _aggregate_one(f)
        for old in config.CACHE_DIR.glob(cache.name.rsplit("_", 1)[0] + "_*.parquet"):
            old.unlink(missing_ok=True)  # 같은 파일의 예전 캐시 정리
        agg.to_parquet(cache, index=False)
        parts.append(agg)
    df = pd.concat(parts, ignore_index=True)
    # 연도 파일끼리 날짜가 겹치면 같은 날이 두 번 더해지므로, 겹치는 날짜는 뒤(최신) 파일 것만 남긴다
    seen, keep = set(), []
    for p in reversed(parts):
        days = set(p["date"].unique())
        keep.append(p[~p["date"].isin(seen)])
        seen |= days
    if sum(len(k) for k in keep) != len(df):
        df = pd.concat(keep, ignore_index=True)
    return df, files


def load_trend(sales_dir: Path = None) -> pd.DataFrame:
    """일자별트렌드(몰 전체 KPI). 현재는 기준일 확인·몰 전체 매출 참고용."""
    sales_dir = Path(sales_dir or config.SALES_DIR)
    frames = []
    for f in sorted(sales_dir.glob(config.TREND_GLOB)):
        t = _read_csv(f, None)
        if "기준일자" not in t.columns:
            continue
        frames.append(t[["기준일자", "순판매금액", "방문세션수", "구매고객수"]])
    if not frames:
        return pd.DataFrame(columns=["date", "net_sales", "sessions", "buyers"])
    t = pd.concat(frames).rename(columns={"기준일자": "date", "순판매금액": "net_sales",
                                          "방문세션수": "sessions", "구매고객수": "buyers"})
    t["date"] = pd.to_datetime(t["date"], errors="coerce")
    return t.dropna(subset=["date"]).drop_duplicates("date", keep="last").sort_values("date")

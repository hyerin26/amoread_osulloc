# -*- coding: utf-8 -*-
"""
'BY26 프로모션별 할인정보.xlsm' 공통 리더 (읽기 전용).

기존 프로그램과의 차이
- 컬럼 위치를 숫자로 하드코딩하지 않고 '헤더 텍스트'로 찾는다.
  (checker는 헤더 3행/데이터 4행, document_maker는 헤더 1행/데이터 2행으로 서로 다르게 알고 있었음.
   실제 파일은 헤더 1행 — checker는 2~3행을 읽지 않는 상태)
- 계산값(data_only)과 수식 원문을 함께 읽어, '수식이 수기 값으로 덮어써진 셀'을 구분할 수 있다.
- 값 정규화는 하지 않고 원본 그대로 담는다. 해석(할인율 % 변환 등)은 사용하는 쪽/검증 모듈 책임.
"""
import warnings
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import openpyxl

from . import config

# 공유 xlsm의 데이터유효성 확장(J열 드롭다운) 경고 — 읽기 전용이라 무해하므로 숨김
warnings.filterwarnings("ignore", message="Data Validation extension is not supported")
from .excel_safe import snapshot, describe_source

# 헤더 첫 줄(개행 앞) 기준 논리 이름
PROMO_HEADERS = {
    "start": "시작일",
    "end": "종료일",
    "promo_name": "프로모션명",
    "type": "유형",
    "seq": "SEQ코드",
    "item_name": "상품명",
    "category": "카테고리명",
    "appeal": "소구문구",
    "discount_type": "할인구분",
    "price": "정가",
    "rate": "할인율",
    "discounted_price": "할인가",
}
MASTER_HEADERS = {
    "sap": "SAP",
    "sap_name": "SAP상품명",
    "seq": "SEQ",
    "category": "카테고리",
    "name": "상품명",
    "product_type": "상품구분",
    "price": "정가",
    "price_total": "SEQ정가합계",
}


class WorkbookStructureError(Exception):
    pass


@dataclass
class PromoRow:
    row: int
    start: object
    end: object
    promo_name: str
    type: str
    seq: str
    item_name: object
    category: object
    appeal: object
    discount_type: str
    price: object
    rate: object
    discounted_price: object
    discounted_price_is_formula: bool = True


@dataclass
class MasterRow:
    row: int
    sap: object
    sap_name: object
    seq: str
    category: object
    name: object
    product_type: object
    price: object


@dataclass
class PromoWorkbook:
    source: dict
    promo_rows: list = field(default_factory=list)
    master_rows: list = field(default_factory=list)
    promo_header_row: int = 0
    master_header_row: int = 0

    def master_by_seq(self) -> dict:
        out = {}
        for m in self.master_rows:
            if m.seq:
                out.setdefault(m.seq, []).append(m)
        return out


def _norm_header(v) -> str:
    if v is None:
        return ""
    return str(v).split("\n")[0].replace("(자동)", "").strip()


def _find_columns(rows: list, wanted: dict, required: tuple, max_scan: int = 6):
    """앞쪽 몇 행에서 헤더 행을 찾아 {논리이름: 0-based col} 반환."""
    for i, row in enumerate(rows[:max_scan]):
        normed = [_norm_header(v) for v in row]
        cols = {}
        for key, label in wanted.items():
            # 완전일치 우선, 없으면 접두 일치('SEQ정가합계(자동)' 등)
            if label in normed:
                cols[key] = normed.index(label)
            else:
                for j, h in enumerate(normed):
                    if h.startswith(label) and key not in cols and h not in wanted.values():
                        cols[key] = j
                        break
        if all(k in cols for k in required):
            return i + 1, cols
    raise WorkbookStructureError(f"헤더를 찾지 못했습니다 (필수: {[wanted[k] for k in required]})")


def _seq_str(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def _read_sheet(path: Path, sheet: str, data_only: bool) -> list:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=data_only, keep_vba=False)
    try:
        if sheet not in wb.sheetnames:
            raise WorkbookStructureError(f"시트 '{sheet}' 없음. 현재 시트: {wb.sheetnames}")
        return [list(r) for r in wb[sheet].iter_rows(values_only=True)]
    finally:
        wb.close()


def load(path: Path = None) -> PromoWorkbook:
    """원본을 스냅샷 복사한 뒤 PROMO_WORK / SEQ_MASTER를 읽는다."""
    path = Path(path or config.PROMO_WORKBOOK_PATH)
    source = describe_source(path)
    source["snapshot_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with snapshot(path) as snap:
        pv = _read_sheet(snap, config.PROMO_SHEET_NAME, data_only=True)
        pf = _read_sheet(snap, config.PROMO_SHEET_NAME, data_only=False)
        mv = _read_sheet(snap, config.MASTER_SHEET_NAME, data_only=True)

    wb = PromoWorkbook(source=source)

    hdr, pc = _find_columns(pv, PROMO_HEADERS, required=("start", "promo_name", "seq", "discount_type", "rate"))
    wb.promo_header_row = hdr
    dp_col = pc.get("discounted_price")

    def g(row, key):
        c = pc.get(key)
        return row[c] if c is not None and c < len(row) else None

    for idx in range(hdr, len(pv)):
        row = pv[idx]
        seq = _seq_str(g(row, "seq"))
        promo_name = str(g(row, "promo_name") or "").strip()
        if not seq and not promo_name and g(row, "start") is None:
            continue
        is_formula = True
        if dp_col is not None and idx < len(pf) and dp_col < len(pf[idx]):
            f = pf[idx][dp_col]
            is_formula = isinstance(f, str) and f.startswith("=")
        wb.promo_rows.append(PromoRow(
            row=idx + 1,
            start=g(row, "start"),
            end=g(row, "end"),
            promo_name=promo_name,
            type=str(g(row, "type") or "").strip(),
            seq=seq,
            item_name=g(row, "item_name"),
            category=g(row, "category"),
            appeal=g(row, "appeal"),
            discount_type=str(g(row, "discount_type") or "").strip(),
            price=g(row, "price"),
            rate=g(row, "rate"),
            discounted_price=g(row, "discounted_price"),
            discounted_price_is_formula=is_formula,
        ))

    mhdr, mc = _find_columns(mv, MASTER_HEADERS, required=("sap", "seq", "product_type", "price"))
    wb.master_header_row = mhdr

    def gm(row, key):
        c = mc.get(key)
        return row[c] if c is not None and c < len(row) else None

    for idx in range(mhdr, len(mv)):
        row = mv[idx]
        if gm(row, "sap") is None and gm(row, "seq") is None:
            continue
        wb.master_rows.append(MasterRow(
            row=idx + 1,
            sap=gm(row, "sap"),
            sap_name=gm(row, "sap_name"),
            seq=_seq_str(gm(row, "seq")),
            category=gm(row, "category"),
            name=gm(row, "name"),
            product_type=gm(row, "product_type"),
            price=gm(row, "price"),
        ))
    return wb

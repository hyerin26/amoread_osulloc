# -*- coding: utf-8 -*-
"""[멘티용 복사본] ops.document.data_loader 중 기획 도우미가 쓰는 값 해석 함수만 남김."""
from datetime import datetime


def _parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _parse_number(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    s = str(val).strip().replace(",", "").replace("원", "").replace("%", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_rate(val):
    """% 서식 셀은 0.25처럼 소수로 저장됨. 0~1 범위면 그대로, 1보다 크면 %로 간주해 100으로 나눔."""
    n = _parse_number(val)
    if n is None:
        return None
    if n > 1:
        return n / 100
    return n

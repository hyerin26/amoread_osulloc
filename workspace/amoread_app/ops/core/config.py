# -*- coding: utf-8 -*-
"""
[멘티용 복사본] osulloc_ops 공통 설정 중 기획 도우미가 쓰는 부분만 남김.
원본은 공유 OneDrive xlsm 을 읽지만, 이 복사본은 data/sample 의 가상 데이터 파일을 읽는다.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]   # 이 폴더(planner_mentee)
ENV_PATH = BASE_DIR / ".env"
OUTPUT_DIR = BASE_DIR / "output"

try:
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH)
except ImportError:
    pass

# 프로모션 할인정보 엑셀 (원본: BY26 프로모션별 할인정보.xlsm — 시트·헤더 구조 동일)
PROMO_WORKBOOK_PATH = Path(os.getenv("PROMO_WORKBOOK_PATH")
                           or (BASE_DIR / "data" / "sample" / "BY26 프로모션별 할인정보(샘플).xlsx"))
PROMO_SHEET_NAME = "세팅&피그마용_PROMO_WORK"
MASTER_SHEET_NAME = "연동용_SEQ_MASTER"

PROMO_TYPES = ("하루특가", "상시", "큐레이션")
RATE_TYPES = ("정율", "정률")
AMOUNT_TYPES = ("정액",)

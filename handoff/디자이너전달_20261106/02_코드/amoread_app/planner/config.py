# -*- coding: utf-8 -*-
"""
[멘티용 복사본] 원가·매출은 data/ 아래 가상 데이터를 읽는다.

기획 도우미 설정. 경로·기준값은 osulloc_ops 루트의 .env 로 덮어쓸 수 있다.

원천 파일은 모두 '읽기만' 한다.
- 판매실적 CSV / 일자별트렌드 CSV : data/report_service (report_service_download.py 가 매일 갱신)
- 온라인 가이드(상품장 = 이동평균가 원가) : promotion_document_maker 폴더의 최신 '★오설록 온라인 가이드*.xlsx'
- 프로모션 할인정보 xlsm : ops.core.config.PROMO_WORKBOOK_PATH (스냅샷 복사 후 읽기)
"""
import os
from pathlib import Path

from ops.core import config as core_config  # .env 로드도 여기서 됨

PLANNER_DIR = Path(__file__).resolve().parent
DATA_DIR = PLANNER_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
PLANNER_JSON = DATA_DIR / "planner_data.json"
REPORT_DIR = core_config.OUTPUT_DIR

SALES_DIR = Path(os.getenv("PLANNER_SALES_DIR") or (core_config.BASE_DIR / "data" / "report_service"))
SALES_GLOB = "CustomTemplate 고객판매실적_seq *.csv"
TREND_GLOB = "일자별트렌드_전체 데이터_*.csv"

GUIDE_DIR = Path(os.getenv("PLANNER_GUIDE_DIR") or (core_config.BASE_DIR / "data" / "sample"))
GUIDE_GLOB = "★오설록 온라인 가이드*.xlsx"
# 웹 화면에서 올린 새 온라인 가이드가 저장되는 곳. GUIDE_DIR와 합쳐 '가장 최근 파일'을 쓴다.
GUIDE_UPLOAD_DIR = DATA_DIR / "guide"
GUIDE_UPLOAD_MAX_MB = 60

SETTINGS_DIR = PLANNER_DIR / "settings"
WRAP_OVERRIDE_CSV = SETTINGS_DIR / "보자기_본품지정.csv"   # 보자기SEQ → 본품SEQ (이름으로 못 찾을 때)
SEASON_CSV = SETTINGS_DIR / "명분사전.csv"                 # 명분 사전(명절·기념일·절기·세시·학사·직장·차 고유·날씨), 화면에서 고칠 수 있음
TREND_CSV = SETTINGS_DIR / "트렌드키워드.csv"              # 검색 트렌드 키워드 그룹 ↔ 오설록 상품 연결
TREND_CACHE = DATA_DIR / "trends.json"                     # 네이버 데이터랩 응답 캐시

# 외부 신호 — 네이버 데이터랩 검색어 트렌드 (키는 osulloc_ops\.env 에만, 화면·로그에 노출 금지)
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID") or ""
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET") or ""
TREND_REFRESH_MIN_GAP_MIN = 10   # 새로 받기 최소 간격 (데이터랩 일 1,000회 제한 보호)
# 고객 리뷰 — 리뷰 주간 수집기(review_weekly_collector) 결과 CSV를 읽기만 한다 (작성자 열은 읽지 않음)
REVIEW_DIR = Path(os.getenv("PLANNER_REVIEW_DIR") or (core_config.BASE_DIR / "data" / "sample" / "reviews"))
REVIEW_WEEKS = 8
PLANS_DIR = DATA_DIR / "plans"
# 기획 D-day — 공휴일 DB(읽기만, OneDrive) → data/holidays.csv 캐시. 임시공휴일·회사 휴무는 휴무일_추가.csv
HOLIDAY_XLSX = Path(os.getenv("PLANNER_HOLIDAY_XLSX")
                    or (core_config.BASE_DIR / "data" / "sample" / "한국_공휴일DB.xlsx"))
HOLIDAY_CACHE = DATA_DIR / "holidays.csv"
HOLIDAY_EXTRA_CSV = SETTINGS_DIR / "휴무일_추가.csv"
TIMELINE_KIND_CSV = SETTINGS_DIR / "기획일정_구분.csv"   # 프로모션명 포함어 → 이벤트/GNB
CHAT_LOG = DATA_DIR / "chat_log.jsonl"   # 보안 가이드 AI-09: 프롬프트 기록 보존

# 로컬 서버 (이 PC에서만 접속)
SERVER_HOST = "127.0.0.1"
SERVER_PORT = int(os.getenv("PLANNER_PORT") or 9731)
# Claude (설치된 Claude Code 로그인 사용, API 키 불필요)
CLAUDE_MODEL = os.getenv("PLANNER_CLAUDE_MODEL") or "claude-opus-5-5"
CLAUDE_MAX_TURNS = int(os.getenv("PLANNER_CLAUDE_MAX_TURNS") or 40)
CLAUDE_RATE_PER_MIN = 10   # 보안 가이드 AI-12: 분당 30회 미만

# ----------------------------------------------------------------------
# 기획 기준 (사용자 확정 2026-10-16)
# ----------------------------------------------------------------------
# 할인 후 원가율 = 원가 / (할인가 / 1.1). 이 값 이하면 OK. 클리어런스(재고 털이)는 초과 허용.
TARGET_COST_RATIO = float(os.getenv("PLANNER_TARGET_COST_RATIO") or 0.45)
# 원가율은 참고 지표(사용자 2026-10-19: "원가율 자체가 고정 지표가 아님") → 기본은 넘어도 '주의'. 1로 두면 '오류'로 막는다
COST_RATIO_STRICT = (os.getenv("PLANNER_COST_RATIO_STRICT") or "0") == "1"
VAT = 1.1
# 보자기 원가 (보자기 포장 완제품 S코드는 상품장에 없음 → 본품 원가 + 보자기 원가)
WRAP_COST = int(os.getenv("PLANNER_WRAP_COST") or 4000)            # 일반 보자기 3,500 + 물류포장
WRAP_COST_LIMITED = int(os.getenv("PLANNER_WRAP_COST_LIMITED") or 9000)  # 한정 보자기

# 실적 귀속: 라인 할인율이 세팅 할인율과 이 차이 이내면 그 행사 실적으로 본다
RATE_MATCH_TOL = 0.02
# 출고일 기준 실적이라 행사 종료 다음 날까지 본다
SHIP_LAG_DAYS = 1
# 행사 반응도 비교 기간: 시작 35일 전 ~ 8일 전 (직전 행사 여파·예고 효과를 피함)
BASELINE_FROM, BASELINE_TO = 35, 8
# 작년 같은 기간: 364일 전(같은 요일). 실적 마지막 날 기준 앞으로 이 일수만큼의 작년 일별 매출을 데이터에 담는다
LAST_YEAR_OFFSET = 364
LAST_YEAR_AHEAD_DAYS = 150
LAST_YEAR_BACK_DAYS = 28        # 작년 '지금까지 4주'도 담아 작년 시즌 흐름(이번 4주 → 다음 4주)을 비교
# 지난 행사 묶기: 같은 이름·유형이라도 이 일수 넘게 떨어져 있으면 다른 회차로 본다
PROMO_WAVE_GAP_DAYS = 21

PRICE_BANDS = [(0, 10000, "1만원 미만"), (10000, 20000, "1만원대"), (20000, 30000, "2만원대"),
               (30000, 50000, "3~4만원대"), (50000, 80000, "5~7만원대"), (80000, 10**9, "8만원 이상")]


def price_band(price) -> str:
    try:
        p = float(price)
    except (TypeError, ValueError):
        return ""
    for lo, hi, label in PRICE_BANDS:
        if lo <= p < hi:
            return label
    return ""

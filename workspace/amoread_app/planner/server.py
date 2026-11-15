# -*- coding: utf-8 -*-
"""
기획 도우미 로컬 웹 서버.

    python -m planner.server        (app_planner.bat)

보안 (docs/security/Security.mdc 기준, 로컬 1인 도구에 맞춘 적용)
- 127.0.0.1에만 바인딩 + Host 헤더 확인(DNS 리바인딩 방지) → 이 PC 밖에서는 접속 불가
- 실행할 때마다 새로 만드는 토큰을 페이지에 심고, 모든 /api 요청은 X-Planner-Token 헤더를 확인
  (다른 웹사이트가 이 PC의 서버로 요청을 보내는 CSRF 차단)
- 보안 헤더(X-Frame-Options DENY, nosniff, CSP default-src 'self'), 오류는 일반 문구만 응답(스택트레이스 비노출)
- 파일 업로드: xlsx 확장자 + 파일 헤더 + 크기 제한, 경로 성분 제거 (refresh.save_guide_upload)
- Claude 호출: 분당 제한 + 요청/결과 로그(data/chat_log.jsonl)
"""
import logging
import re
import secrets
import sys
import threading
import webbrowser
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

from . import claude_agent, config, engine, ideas, keywords, plans, refresh, replan, review, reviews, sapsales, schedule, scout, timeline, trends, usage

STATIC_DIR = Path(__file__).resolve().parent / "static"
TOKEN = secrets.token_urlsafe(32)
ALLOWED_HOSTS = {f"127.0.0.1:{config.SERVER_PORT}", f"localhost:{config.SERVER_PORT}"}

log = logging.getLogger("planner")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class Guard(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.headers.get("host") not in ALLOWED_HOSTS:
            return JSONResponse({"error": "허용되지 않은 접속입니다."}, status_code=403)
        if request.url.path.startswith("/api/"):
            if not secrets.compare_digest(request.headers.get("x-planner-token", ""), TOKEN):
                return JSONResponse({"error": "인증 토큰이 없습니다. 페이지를 새로고침하세요."}, status_code=401)
        resp = await call_next(request)
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Content-Security-Policy"] = ("default-src 'self'; img-src 'self' data:; style-src 'self'; "
                                                   "script-src 'self'; object-src 'none'; frame-ancestors 'none'")
        resp.headers["Referrer-Policy"] = "no-referrer"
        # 글꼴(2.4MB)만 캐시: no-store면 화면을 옮길 때마다 다시 받아 기본 글꼴 → 우리 글꼴로 바뀌는 깜빡임이 생김 (2026-11-10)
        # 글꼴 파일은 이름이 바뀌지 않는 한 내용이 같다. 나머지(화면·데이터)는 예전처럼 저장하지 않음
        if request.url.path.startswith("/static/fonts/") and resp.status_code == 200:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            resp.headers["Cache-Control"] = "no-store"
        return resp


app.add_middleware(Guard)


@app.exception_handler(Exception)
async def on_error(request: Request, exc: Exception):
    log.exception("처리 중 오류: %s", request.url.path)
    return JSONResponse({"error": "처리 중 오류가 발생했습니다. 서버 창의 메시지를 확인하세요."}, status_code=500)


@app.exception_handler(engine.DataNotReady)
async def on_not_ready(request: Request, exc: engine.DataNotReady):
    return JSONResponse({"error": str(exc), "code": "no_data"}, status_code=409)


@app.exception_handler(RequestValidationError)
async def on_invalid(request: Request, exc: RequestValidationError):
    return JSONResponse({"error": "입력값 형식이 올바르지 않습니다."}, status_code=400)


# ----------------------------------------------------------------------
# 페이지
# ----------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
def index():
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html.replace("__PLANNER_TOKEN__", TOKEN))


# 새 버전 (plans/20 재설계 화면). 예전 화면(/)은 그대로 두고 /v2/ 아래에 따로. 정해진 이름만 열어 준다
V2_PAGES = {"home", "brief", "compose", "editor", "preview", "deals", "library", "settings"}
# 신규 구좌편집기 (기존 /v2/editor는 그대로 두고 따로). 끄면 화면 404 + 화면 안 <!--editor-next-->…<!--/editor-next--> 진입 버튼을 뺀다
EDITOR_NEXT_ON = config.EDITOR_NEXT and (config.EDITOR_NEXT_DIR / "app.js").is_file()
_EDITOR_NEXT_BLOCK = re.compile(r"<!--editor-next-->.*?<!--/editor-next-->", re.S)
_EDITOR_NEXT_FILE = re.compile(r"^[A-Za-z0-9_.-]+\.(js|css)$")   # 편집기 폴더의 js·css만 (테스트·문서·하위 폴더는 열지 않음)


@app.get("/v2", response_class=HTMLResponse)
@app.get("/v2/", response_class=HTMLResponse)
@app.get("/v2/{page}", response_class=HTMLResponse)
def v2_page(request: Request, page: str = "home"):
    # 03 구좌 편집 = 신규 구좌편집기 하나 (2026-11-15, plans/27 §12). 옛 주소·단계 링크(/v2/editor?id=…)는 그대로 넘겨 준다.
    # 편집기 파일이 없거나 AMOREAD_EDITOR_NEXT=0이면 예전 편집기(editor.html)를 그대로 연다
    if page == "editor" and EDITOR_NEXT_ON:
        from fastapi.responses import RedirectResponse
        q = request.url.query
        return RedirectResponse(f"/v2/editor-next{'?' + q if q else ''}", status_code=307)
    if page not in V2_PAGES and not (page == "editor-next" and EDITOR_NEXT_ON):
        raise HTTPException(404, "없는 화면입니다.")
    html = (STATIC_DIR / "v2" / f"{page}.html").read_text(encoding="utf-8")
    if not EDITOR_NEXT_ON:
        html = _EDITOR_NEXT_BLOCK.sub("", html)
    return HTMLResponse(html.replace("__PLANNER_TOKEN__", TOKEN))


@app.get("/v2/editor-next/{name}")
def editor_next_file(name: str):
    m = _EDITOR_NEXT_FILE.match(name)
    p = config.EDITOR_NEXT_DIR / name if m and EDITOR_NEXT_ON else None
    if not p or not p.is_file():
        raise HTTPException(404, "없는 파일입니다.")
    return FileResponse(p, media_type="text/javascript" if m.group(1) == "js" else "text/css")


# 레퍼런스 이미지 (2026-11-10): <img>가 토큰 머리를 보낼 수 없어 /api 밖에 둔다 (서버는 127.0.0.1 + Host 검사만 통과)
# - /refimg/own/{파일}: 담당자가 올린 이미지 (planner/data/references/img)
# - /refimg/pin?u=…: 핀 이미지를 볼 때만 받아서 그대로 전달 (i.pinimg.com만, 저장하지 않음 · plans/21 §4)
from amoread import references as _refs  # noqa: E402
from fastapi.responses import Response  # noqa: E402


@app.get("/refimg/own/{name}")
def refimg_own(name: str):
    p = _refs.image_path(name)
    if not p:
        raise HTTPException(404, "이미지가 없어요")
    return FileResponse(p)


@app.get("/refimg/pin")
def refimg_pin(u: str):
    try:
        body, ctype = _refs.pin_image(u)
    except Exception:
        raise HTTPException(404, "이미지를 받지 못했어요")
    return Response(body, media_type=ctype)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# AMOREAD 통합 기획 API (/api/am/*) — 같은 Guard(토큰·보안 헤더)가 적용된다
from amoread.api import router as amoread_router  # noqa: E402
app.include_router(amoread_router)

# 멘트추천기능 (AI 카피 추천, ai/amoread-ai-module 브랜치에서 모듈만 가져옴): 같은 app·Guard를 쓰는 선택 모듈 (새 서버 없음).
# 폴더(저장소 루트/멘트추천기능)가 없으면 건너뛴다. 화면 쪽은 v2/editor-next-ai.js
from importlib.util import spec_from_file_location, module_from_spec  # noqa: E402
_copy_dir = Path(__file__).resolve().parents[3] / "멘트추천기능"
if (_copy_dir / "__init__.py").is_file():
    try:
        _copy_spec = spec_from_file_location("osulloc_copy_recommender", _copy_dir / "__init__.py",
                                             submodule_search_locations=[str(_copy_dir)])
        _copy_module = module_from_spec(_copy_spec)
        sys.modules[_copy_spec.name] = _copy_module
        _copy_spec.loader.exec_module(_copy_module)
        _copy_module.install(app)
    except Exception:   # 모듈 문제로 앱 전체가 안 켜지는 일은 막는다 (AI 버튼만 '연결 안 됨')
        log.exception("멘트추천기능을 불러오지 못했어요")


# ----------------------------------------------------------------------
# 데이터
# ----------------------------------------------------------------------
@app.get("/api/meta")
def meta():
    try:
        m = engine.DATA.ensure().meta
    except engine.DataNotReady:
        m = None
    return {"meta": m, "guides": refresh.guide_files(), "rebuild": refresh.status(),
            "claude": {"available": claude_agent.SDK_OK, "model": config.CLAUDE_MODEL},
            "target": config.TARGET_COST_RATIO}


@app.get("/api/products")
def products():
    return {"products": engine.all_products(with_series=True)}


@app.get("/api/product/{seq}")
def product(seq: str):
    if not seq.isdigit():
        raise HTTPException(400, "SEQ는 숫자입니다.")
    p = engine.get_product(seq)
    if not p:
        return JSONResponse({"error": "SEQ를 찾을 수 없습니다."}, status_code=404)
    p["reviews"] = reviews.for_product(seq)
    return p


@app.get("/api/ideas")
def get_ideas(start: str | None = None, page: int = 0):
    """이번 주 아이디어(주마다 한 번 규칙으로 만들어 저장), page로 '다른 아이디어 보기'."""
    try:
        return ideas.weekly(start, max(0, min(page, 99)))
    except ValueError:
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 입니다.")


class IdeaVote(BaseModel):
    key: str = Field(max_length=80)
    vote: str = Field(max_length=8)


@app.post("/api/ideas/feedback")
def idea_feedback(req: IdeaVote):
    try:
        ideas.feedback(req.key, req.vote)
    except ValueError:
        raise HTTPException(400, "잘못된 값")
    return {"ok": True}


@app.get("/api/levers")
def get_levers():
    return engine.DATA.ensure().levers


@app.get("/api/response/{seq}")
def get_response(seq: str):
    if not seq.isdigit():
        raise HTTPException(400, "SEQ는 숫자입니다.")
    r = engine.discount_response(seq)
    if r is None:
        return JSONResponse({"error": "SEQ를 찾을 수 없습니다."}, status_code=404)
    return r


@app.get("/api/patterns")
def get_patterns():
    return engine.patterns()


@app.get("/api/promos")
def promos(date_from: str, date_to: str):
    try:
        return {"rows": engine.existing_promos(date_from, date_to)}
    except ValueError:
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 입니다.")


def _date_or_400(*vals):
    for v in vals:
        if v is not None:
            try:
                engine._d(v)
            except ValueError:
                raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 입니다.")


@app.get("/api/simulate")
def simulate(seq: str, rate: float, type: str = "상시"):
    if not seq.isdigit() or not (0 < rate < 1) or type not in ("상시", "하루특가"):
        raise HTTPException(400, "입력값 형식이 올바르지 않습니다.")
    r = engine.simulate_single(seq, rate, type)
    if r is None:
        return JSONResponse({"error": "SEQ를 찾을 수 없습니다."}, status_code=404)
    return r


@app.get("/api/lastyear")
def last_year(date_from: str, date_to: str, category: str | None = None, limit: int = 30):
    _date_or_400(date_from, date_to)
    return engine.last_year_top(date_from, date_to, min(max(limit, 1), 200), category or None)


# ---------- 캘린더 · 시즌 · 알림 ----------
@app.get("/api/calendar")
def get_calendar(start: str | None = None, days: int = 28):
    _date_or_400(start)
    return schedule.calendar(start, days)


class DayReq(BaseModel):
    date: str = Field(max_length=10)
    exclude: list[str] = Field(default_factory=list, max_length=200)


@app.post("/api/day")
def day(req: DayReq):
    _date_or_400(req.date)
    return schedule.day_detail(req.date, [s[:12] for s in req.exclude])


@app.get("/api/seasons")
def get_seasons():
    return {"items": schedule.read_seasons(), "view": schedule.seasons_view()}


class SeasonItem(BaseModel):
    date: str = Field(max_length=10)
    end: str | None = Field(default="", max_length=10)
    name: str = Field(max_length=30)
    kind: str | None = Field(default="기념일", max_length=10)
    lead: int | None = Field(default=21, ge=0, le=120)
    keyword: str | None = Field(default="", max_length=20)
    seeds: str | None = Field(default="", max_length=260)
    memo: str | None = Field(default="", max_length=120)


class SeasonReq(BaseModel):
    items: list[SeasonItem] = Field(max_length=300)


@app.post("/api/seasons")
def post_seasons(req: SeasonReq):
    return {"saved": schedule.save_seasons([i.model_dump() for i in req.items])}


@app.get("/api/alerts")
def get_alerts():
    return schedule.alerts()


# ---------- 오설록닷컴 SAP 실적 (sap_sales_download.py 결과, 읽기만) ----------
@app.get("/api/sap-sales")
def get_sap_sales():
    try:
        seq_last = engine.DATA.ensure().meta.get("sales_last_day")
    except engine.DataNotReady:
        seq_last = None
    return sapsales.summary(seq_last)


# ---------- 기획 D-day: 상시 시작일 = 오픈, 업무일(주말·공휴일 제외) 역산 ----------
@app.get("/api/dday")
def get_dday():
    return timeline.dday()


class KindReq(BaseModel):
    promo: str = Field(min_length=1, max_length=40)
    kind: str = Field(pattern="^(이벤트|GNB)$")


@app.post("/api/dday/kind")
def post_dday_kind(req: KindReq):
    timeline.set_kind(req.promo, req.kind)
    return timeline.dday()


# ---------- 외부 신호: 검색 트렌드 · 고객 리뷰 ----------
@app.get("/api/signals")
def signals():
    return {"trends": trends.overview(), "reviews": reviews.overview()}


@app.post("/api/signals/refresh")
def signals_refresh():
    try:
        trends.refresh()
    except trends.TrendError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return {"trends": trends.overview()}


class TrendPlanReq(BaseModel):
    group: str = Field(max_length=20)
    start: str | None = Field(default=None, max_length=10)


@app.post("/api/signals/plan")
def signals_plan(req: TrendPlanReq):
    _date_or_400(req.start)
    r = trends.plan_rows(req.group, req.start)
    if r is None:
        return JSONResponse({"error": "키워드 그룹을 찾을 수 없습니다."}, status_code=404)
    return r


class TrendGroup(BaseModel):
    name: str = Field(max_length=20)
    keywords: str = Field(max_length=400)
    match: str | None = Field(default="", max_length=300)
    category: str | None = Field(default="", max_length=20)
    memo: str | None = Field(default="", max_length=100)


class TrendGroupsReq(BaseModel):
    items: list[TrendGroup] = Field(max_length=30)


@app.get("/api/settings/trend-groups")
def get_trend_groups():
    return {"items": [{**g, "keywords": ";".join(g["keywords"]), "match": ";".join(g["match"])} for g in trends.read_groups()]}


@app.post("/api/settings/trend-groups")
def post_trend_groups(req: TrendGroupsReq):
    return {"saved": trends.save_groups([i.model_dump() for i in req.items])}


# ---------- 트렌드 스카우트 (네이버 검색 + 데이터랩, 규칙 추출 — 비용 없음) ----------
@app.get("/api/scout")
def get_scout():
    return scout.overview()


@app.post("/api/scout/run")
def run_scout():
    try:
        return scout.run()
    except (scout.ScoutError, trends.TrendError) as e:
        return JSONResponse({"error": str(e)}, status_code=400)


# ---------- 브리프 키워드 확장 (검색광고 연관 키워드 + 네이버 뉴스·블로그, 보내는 것은 키워드뿐) ----------
class KeywordReq(BaseModel):
    q: str = Field(min_length=1, max_length=20)
    refresh: bool = False


@app.post("/api/keywords/expand")
def keywords_expand(req: KeywordReq):
    try:
        return keywords.expand(req.q, req.refresh)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)


# 외부 연결 상태·자체 한도 사용량 (설정·데이터 화면). 키 값은 절대 내보내지 않고 '있음/없음'만
@app.get("/api/connections")
def connections():
    return {"usage": usage.summary(), "keys": {"naver": trends.has_keys(), "searchad": keywords.has_ad_keys()}}


class ScoutMark(BaseModel):
    term: str = Field(max_length=30)
    status: str = Field(max_length=8)


@app.post("/api/scout/mark")
def mark_scout(req: ScoutMark):
    try:
        scout.mark(req.term, req.status)
    except scout.ScoutError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return {"ok": True}


class ScoutPlan(BaseModel):
    term: str = Field(max_length=30)
    start: str | None = Field(default=None, max_length=10)


@app.post("/api/scout/plan")
def plan_scout(req: ScoutPlan):
    _date_or_400(req.start)
    return scout.plan_rows(req.term, req.start)


class QueryReq(BaseModel):
    items: list[str] = Field(max_length=40)


@app.get("/api/settings/scout-queries")
def get_scout_queries():
    return {"items": scout.read_queries()}


@app.post("/api/settings/scout-queries")
def post_scout_queries(req: QueryReq):
    return {"saved": scout.save_queries(req.items)}


# ---------- 지난 행사 다시 기획 (작년 구성 유지 · 품목만 최신 매출로) ----------
class ReplanReq(BaseModel):
    query: str | None = Field(default=None, max_length=30)
    keys: list[str] | None = Field(default=None, max_length=6)
    start: str | None = Field(default=None, max_length=10)
    types: list[str] | None = Field(default=None, max_length=2)


@app.post("/api/replan")
def post_replan(req: ReplanReq):
    _date_or_400(req.start)
    types = [t for t in (req.types or []) if t in ("상시", "하루특가")] or None
    return replan.refresh(req.query, [k[:120] for k in (req.keys or [])] or None, req.start, types=types)


# ---------- 지난 행사 성과 ----------
@app.get("/api/review")
def get_review(query: str | None = None, type: str | None = None):
    return {"waves": review.list_waves((query or "")[:40], type or None), "last_year": review.last_year_waves()}


@app.get("/api/review/wave")
def get_wave(key: str):
    d = review.wave_detail(key[:120])
    if not d:
        return JSONResponse({"error": "행사를 찾을 수 없습니다."}, status_code=404)
    return d


class MixItem(BaseModel):
    seq: str = Field(max_length=12)
    qty: int = Field(default=1, ge=1, le=20)


class MixReq(BaseModel):
    items: list[MixItem] = Field(max_length=10)
    rate: float | None = Field(default=None, ge=0, lt=1)


@app.post("/api/mix")
def mix(req: MixReq):
    return engine.simulate_mix([i.model_dump() for i in req.items], req.rate)


class PartnerReq(BaseModel):
    seq: str = Field(max_length=12)
    min_rate: float = Field(default=0.3, ge=0, lt=1)
    category: str | None = Field(default=None, max_length=20)
    limit: int = Field(default=20, ge=1, le=50)


@app.post("/api/partners")
def partners(req: PartnerReq):
    return engine.suggest_partners(req.seq, req.min_rate, req.limit, req.category or None)


class BundleReq(BaseModel):
    min_rate: float = Field(default=0.25, ge=0.05, lt=0.8)
    category: str | None = Field(default=None, max_length=20)


@app.post("/api/bundles")
def bundles(req: BundleReq):
    return engine.recommend_bundles(req.min_rate, category=req.category or None)


class PlanRow(BaseModel):
    promo: str | None = Field(default="", max_length=60)
    type: str | None = Field(default="상시", max_length=10)
    start: str | None = Field(default=None, max_length=10)
    end: str | None = Field(default=None, max_length=10)
    seq: str | None = Field(default=None, max_length=12)
    items: list[MixItem] | None = Field(default=None, max_length=10)
    rate: float | None = Field(default=None, ge=0, le=1)
    appeal: str | None = Field(default="", max_length=80)
    category_tag: str | None = Field(default="", max_length=40)
    clearance: bool | None = False
    memo: str | None = Field(default="", max_length=300)


class BriefMeta(BaseModel):
    myeongbun: str | None = Field(default="", max_length=300)
    concept: str | None = Field(default="", max_length=300)
    target: str | None = Field(default="", max_length=300)
    customer: str | None = Field(default="", max_length=300)


class PlanReq(BaseModel):
    id: str | None = Field(default=None, max_length=32)
    brief_meta: BriefMeta | None = None
    title: str | None = Field(default="", max_length=80)
    brief: str | None = Field(default="", max_length=4000)
    rationale: str | None = Field(default="", max_length=20000)
    source: str | None = Field(default="", max_length=40)
    rows: list[PlanRow] = Field(default_factory=list, max_length=500)


def _rows(req: PlanReq):
    return [r.model_dump() for r in req.rows]


@app.post("/api/check")
def check(req: PlanReq):
    return engine.check_plan(_rows(req))


@app.get("/api/plans")
def get_plans():
    return {"plans": plans.list_plans()}


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str):
    try:
        return plans.load_plan(plan_id)
    except (ValueError, FileNotFoundError):
        return JSONResponse({"error": "기획안을 찾을 수 없습니다."}, status_code=404)


@app.post("/api/plans")
def post_plan(req: PlanReq):
    return plans.save_plan({**req.model_dump(), "rows": _rows(req)})


@app.post("/api/plans/{plan_id}/confirm")
def confirm_plan(plan_id: str):
    try:
        return plans.confirm_plan(plan_id)
    except (ValueError, FileNotFoundError):
        return JSONResponse({"error": "먼저 저장하세요."}, status_code=404)


@app.get("/api/plans/{plan_id}/actual")
def plan_actual(plan_id: str):
    try:
        return plans.plan_actual(plan_id)
    except (ValueError, FileNotFoundError):
        return JSONResponse({"error": "기획안을 찾을 수 없습니다."}, status_code=404)


@app.post("/api/plans/{plan_id}/delete")
def remove_plan(plan_id: str):
    try:
        plans.delete_plan(plan_id)
    except ValueError:
        raise HTTPException(400, "잘못된 기획안 ID")
    return {"ok": True}


@app.post("/api/export")
def export(req: PlanReq):
    path = plans.export_plan({**req.model_dump(), "rows": _rows(req)})
    return FileResponse(path, filename=path.name,
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ----------------------------------------------------------------------
# 데이터 갱신 · 원가 파일 · 보자기 설정
# ----------------------------------------------------------------------
class RebuildReq(BaseModel):
    full: bool = False


@app.post("/api/rebuild")
def rebuild(req: RebuildReq):
    started = refresh.start_rebuild(use_cache=not req.full)
    return {"started": started, "status": refresh.status()}


@app.get("/api/rebuild")
def rebuild_status():
    return refresh.status()


@app.post("/api/guide")
async def upload_guide(file: UploadFile = File(...)):
    data = await file.read(config.GUIDE_UPLOAD_MAX_MB * 1024 * 1024 + 1)
    try:
        info = refresh.save_guide_upload(file.filename, data)
    except refresh.UploadError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return {"ok": True, **info, "guides": refresh.guide_files()}


@app.get("/api/settings/wrap")
def get_wrap():
    return {"items": refresh.read_wrap_overrides()}


class WrapItem(BaseModel):
    wrap_seq: str = Field(max_length=12)
    base_seq: str = Field(max_length=12)
    memo: str | None = Field(default="", max_length=100)


class WrapReq(BaseModel):
    items: list[WrapItem] = Field(max_length=300)


@app.post("/api/settings/wrap")
def post_wrap(req: WrapReq):
    n = refresh.save_wrap_overrides([i.model_dump() for i in req.items])
    return {"saved": n}


# ----------------------------------------------------------------------
# Claude
# ----------------------------------------------------------------------
class ClaudeReq(BaseModel):
    brief: str = Field(min_length=2, max_length=4000)
    rows: list[PlanRow] = Field(default_factory=list, max_length=200)


@app.post("/api/claude/plan")
async def claude_plan(req: ClaudeReq, request: Request):
    engine.DATA.ensure()
    try:
        job = claude_agent.start_job(req.brief, [r.model_dump() for r in req.rows],
                                     request.client.host if request.client else "")
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, status_code=429 if "잦습니다" in str(e) else 503)
    return {"job": job}


@app.get("/api/claude/job/{job_id}")
def claude_job(job_id: str):
    st = claude_agent.job_status(job_id)
    if not st:
        return JSONResponse({"error": "작업을 찾을 수 없습니다."}, status_code=404)
    return st


def main():
    import uvicorn
    url = f"http://127.0.0.1:{config.SERVER_PORT}/"
    if "--no-browser" not in sys.argv:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    print(f"기획 도우미: {url}  (이 창을 닫으면 종료됩니다)")
    uvicorn.run(app, host=config.SERVER_HOST, port=config.SERVER_PORT, log_level="warning")


if __name__ == "__main__":
    main()

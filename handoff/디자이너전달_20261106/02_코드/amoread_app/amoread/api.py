# -*- coding: utf-8 -*-
"""
AMOREAD 통합 기획 API (/api/am/*).

보안: planner.server의 Guard 미들웨어가 /api/* 전체에 토큰·Host 검사와 보안 헤더를 적용한다 (여기서 따로 열지 않음).
입력은 pydantic으로 길이·형식을 제한하고, 오류 응답은 일반 문구만 돌려준다.
원천(PROMO_WORK 등)에는 쓰지 않는다. 쓰는 곳: planner/data/projects/*.json, settings/명분사전.csv(사용자가 명시적으로 추가할 때만).
"""
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, model_validator

from planner import plans, schedule, timeline

from . import checks, results, store

router = APIRouter(prefix="/api/am")

DATE = r"^\d{4}-\d{2}-\d{2}$"
SID = r"^[A-Za-z0-9_-]{1,40}$"
Short = Annotated[str, Field(max_length=120)]


def _date(s):
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 입니다.")


# ----------------------------------------------------------------------
# 모델
# ----------------------------------------------------------------------
class Item(BaseModel):
    seq: str = Field(max_length=12)
    qty: int = Field(default=1, ge=1, le=20)


class PromoRow(BaseModel):  # planner.server.PlanRow와 같은 필드·제한
    promo: str | None = Field(default="", max_length=60)
    type: str | None = Field(default="상시", max_length=10)
    start: str | None = Field(default=None, max_length=10)
    end: str | None = Field(default=None, max_length=10)
    seq: str | None = Field(default=None, max_length=12)
    items: list[Item] | None = Field(default=None, max_length=10)
    rate: float | None = Field(default=None, ge=0, le=1)
    appeal: str | None = Field(default="", max_length=80)
    category_tag: str | None = Field(default="", max_length=40)
    clearance: bool | None = False
    memo: str | None = Field(default="", max_length=300)


class Period(BaseModel):
    start: str = Field(pattern=DATE)
    end: str = Field(pattern=DATE)

    @model_validator(mode="after")
    def _order(self):
        try:
            datetime.strptime(self.start, "%Y-%m-%d"), datetime.strptime(self.end, "%Y-%m-%d")
        except ValueError:
            raise ValueError("날짜가 올바르지 않습니다")
        if self.end < self.start:
            raise ValueError("종료일이 시작일보다 빠릅니다")
        return self


class SeasonRef(BaseModel):
    name: str = Field(max_length=30)
    date: str = Field(pattern=DATE)


class Brief(BaseModel):
    myeongbun: str = Field(default="", max_length=300)
    concept: str = Field(default="", max_length=300)
    customer: str = Field(default="", max_length=300)
    target: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=40)
    audience: str = Field(default="", max_length=300)
    background: str = Field(default="", max_length=2000)
    constraints: str = Field(default="", max_length=1000)
    benefits_note: str = Field(default="", max_length=1000)
    period: Period | None = None
    page_kind: Literal["이벤트", "GNB", "없음"] = "이벤트"
    season_ref: SeasonRef | None = None


class Slot(BaseModel):
    slotId: str = Field(pattern=SID)
    seq: str | None = Field(default=None, max_length=12)
    items: list[Item] | None = Field(default=None, max_length=10)
    placeholderStatus: Literal["AVAILABLE", "UNDECIDED"] = "UNDECIDED"
    customCopy: str = Field(default="", max_length=200)


class DesignerRef(BaseModel):
    referenceId: str = Field(max_length=60)
    designerNote: str = Field(default="", max_length=500)


class Section(BaseModel):
    sectionId: str = Field(pattern=SID)
    order: int = Field(default=0, ge=0, le=200)
    name: str = Field(default="", max_length=40)
    purpose: str = Field(default="", max_length=20)
    role: str = Field(default="", max_length=200)
    zone_tag: str = Field(default="", max_length=40)
    layoutId: str = Field(default="", max_length=40)
    layoutSourceRefId: str | None = Field(default=None, max_length=60)
    headline: str = Field(default="", max_length=120)
    subhead: str = Field(default="", max_length=400)
    cta: str = Field(default="", max_length=40)
    slots: list[Slot] = Field(default_factory=list, max_length=40)
    designNotes: str = Field(default="", max_length=2000)
    designerReferences: list[DesignerRef] = Field(default_factory=list, max_length=20)
    unplacedProducts: list[Short] = Field(default_factory=list, max_length=40)
    # 가격 노출 방식 (R18 축 2): '' 미정(기본) | emphasis 할인율 강조 | price 가격 표시 | name 이미지·상품명만 | section 섹션 대표 가격
    price_display: Literal["", "emphasis", "price", "name", "section"] = ""
    section_price: int | None = Field(default=None, ge=0, le=10_000_000)   # 섹션 대표 가격 (예: 균일가 8,800원)


class Page(BaseModel):
    sections: list[Section] = Field(default_factory=list, max_length=40)


class Origin(BaseModel):
    type: Literal["calendar", "brief", "replan", "idea", "deal_gap", "legacy"] = "brief"
    ref: str = Field(default="", max_length=120)


class Links(BaseModel):
    legacy_plan_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")
    promo_work_keys: list[Short] = Field(default_factory=list, max_length=200)


class DealCandidate(BaseModel):
    seq: str | None = Field(default=None, max_length=12)
    items: list[Item] | None = Field(default=None, max_length=10)
    rate: float | None = Field(default=None, ge=0, le=1)
    memo: str = Field(default="", max_length=120)


class DealPlan(BaseModel):
    """하루특가 설정: 하루 자리 수와 후보 상품. 편성 결과는 promo_rows의 하루특가 행(같은 날짜 안의 순서 = 자리 순서)."""
    slots: int = Field(default=4, ge=1, le=12)
    candidates: list[DealCandidate] = Field(default_factory=list, max_length=100)


class PoolItem(BaseModel):
    """후보 상품: 아직 역할(상시 할인, 할인 없음, 하루특가)을 정하지 않은 상품."""
    seq: str | None = Field(default=None, max_length=12)
    items: list[Item] | None = Field(default=None, max_length=10)
    memo: str = Field(default="", max_length=200)
    source: str = Field(default="", max_length=40)


class ProjectReq(BaseModel):
    id: str | None = Field(default=None, max_length=32)
    title: str = Field(default="", max_length=80)
    status: Literal["planning", "confirmed", "reflected"] = "planning"
    origin: Origin | None = None
    brief: Brief = Field(default_factory=Brief)
    promo_rows: list[PromoRow] = Field(default_factory=list, max_length=500)
    deal_plan: DealPlan | None = None
    pool: list[PoolItem] = Field(default_factory=list, max_length=100)
    page: Page | None = None
    links: Links | None = None
    rationale: str = Field(default="", max_length=20000)


class SeasonAddReq(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    date: str = Field(pattern=DATE)
    end: str | None = Field(default="", max_length=10)
    kind: str = Field(default="기념일", max_length=10)
    lead: int = Field(default=21, ge=0, le=120)
    keyword: str = Field(default="", max_length=20)
    seeds: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=4)
    memo: str = Field(default="", max_length=120)


class RowsReq(BaseModel):
    rows: list[PromoRow] = Field(default_factory=list, max_length=500)


class ExportReq(BaseModel):   # 기존 /api/export와 같은 필드 (남는 필드는 무시)
    title: str = Field(default="", max_length=80)
    brief: str = Field(default="", max_length=4000)
    rationale: str = Field(default="", max_length=20000)
    source: str = Field(default="", max_length=40)
    rows: list[PromoRow] = Field(default_factory=list, max_length=500)


# ----------------------------------------------------------------------
# 검증·내보내기: 할인 없음(큐레이션) 행을 따로 다루는 감싸기 (engine, plans는 그대로)
# ----------------------------------------------------------------------
@router.post("/check")
def check_rows(req: RowsReq):
    return checks.check([r.model_dump() for r in req.rows])


@router.post("/export")
def export_rows(req: ExportReq):
    path = checks.export({**req.model_dump(), "rows": [r.model_dump() for r in req.rows]})
    return FileResponse(path, filename=path.name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ----------------------------------------------------------------------
# 통합 기획안
# ----------------------------------------------------------------------
def _not_found():
    return JSONResponse({"error": "기획안을 찾을 수 없습니다."}, status_code=404)


@router.get("/projects")
def list_projects():
    return {"projects": store.list_projects(), "status_label": store.STATUS_LABEL}


@router.get("/projects/{pid}")
def get_project(pid: str):
    try:
        return store.load(pid)
    except (ValueError, FileNotFoundError):
        return _not_found()


@router.post("/projects")
def save_project(req: ProjectReq):
    return store.save(req.model_dump())


@router.post("/projects/{pid}/confirm")
def confirm_project(pid: str):
    """⑤ 확정: 지금 예측을 고정 저장하고 상태를 '확정'으로 (R16)."""
    try:
        return results.confirm(pid)
    except (ValueError, FileNotFoundError):
        return _not_found()


@router.get("/projects/{pid}/result")
def project_result(pid: str):
    """⑤ 확정 이후 바뀐 곳, PROMO_WORK 반영 확인, 결과(계획 대비 실적)."""
    try:
        doc = store.load(pid)
    except (ValueError, FileNotFoundError):
        return _not_found()
    return {"changes": results.changes_since(doc), "reflect": results.reflect_check(doc), "actual": results.actual(doc)}


@router.post("/projects/{pid}/delete")
def delete_project(pid: str):
    try:
        store.delete(pid)
    except ValueError:
        raise HTTPException(400, "잘못된 기획안 ID")
    return {"ok": True}


# ---------- 기존 기획 도우미 기획안 가져오기 (원본은 읽기만) ----------
@router.get("/legacy")
def legacy_list():
    return {"plans": plans.list_plans()}


@router.post("/legacy/{plan_id}/import")
def legacy_import(plan_id: str):
    try:
        src = plans.load_plan(plan_id)
    except (ValueError, FileNotFoundError):
        return JSONResponse({"error": "기존 기획안을 찾을 수 없습니다."}, status_code=404)
    draft = store.from_legacy(src)
    doc = ProjectReq.model_validate(draft)   # 같은 검증을 거친다
    return store.save(doc.model_dump())


# ---------- 캘린더 '내 기획안' 겹 + 날짜 미정 ----------
@router.get("/calendar")
def calendar_layer(start: str, end: str):
    d0, d1 = _date(start), _date(end)
    dated, undated = [], []
    for s in store.list_projects():
        per = s.get("period")
        if not per:
            undated.append(s)
            continue
        if per["start"] <= d1.isoformat() and per["end"] >= d0.isoformat():
            try:
                d = store.load(s["id"])
            except (ValueError, FileNotFoundError):
                continue
            days = {}
            for r in d.get("promo_rows") or []:
                if r.get("type") == "하루특가" and r.get("start"):
                    days[r["start"]] = days.get(r["start"], 0) + 1
            dated.append({**s, "deal_days": days})
    return {"dated": dated, "undated": undated, "status_label": store.STATUS_LABEL}


# ---------- 그 날짜에 걸친 기획안과 하루특가 편성 (캘린더 날짜 상세, 하루특가 담기 R2·R3) ----------
@router.get("/day")
def day_projects(date: str):
    day = _date(date).isoformat()
    out = []
    for s in store.list_projects():
        per = s.get("period")
        if not per or not (per["start"] <= day <= per["end"]):
            continue
        try:
            d = store.load(s["id"])
        except (ValueError, FileNotFoundError):
            continue
        secs = ((d.get("page") or {}).get("sections")) or []
        slots = int(((d.get("deal_plan") or {}).get("slots")) or 4)
        deals = [{"seq": r.get("seq"), "items": r.get("items"), "rate": r.get("rate")}
                 for r in (d.get("promo_rows") or []) if r.get("type") == "하루특가" and r.get("start") == day]
        out.append({"id": s["id"], "title": s["title"], "status": s["status"], "period": per,
                    "page_kind": (d.get("brief") or {}).get("page_kind") or "이벤트",
                    "has_page": bool(d.get("page")), "has_deal_section": any(x.get("layoutId") == "deal-banner" for x in secs),
                    "slots": slots, "deals": deals, "filled": len(deals)})
    out.sort(key=lambda x: (not x["has_deal_section"], x["period"]["start"]))
    return {"date": day, "projects": out}


# ---------- 명분 사전에 추가 (사용자가 명시적으로 누를 때만) ----------
@router.post("/seasons/add")
def season_add(req: SeasonAddReq):
    if req.kind not in schedule.KINDS:
        raise HTTPException(400, "명분 종류가 올바르지 않습니다.")
    if req.end:
        if _date(req.end) < _date(req.date):
            raise HTTPException(400, "종료일이 시작일보다 빠릅니다.")
    items = schedule.read_seasons()
    if any(x["name"] == req.name.strip() and x["date"] == req.date for x in items):
        return {"added": False, "reason": "같은 이름·날짜의 명분이 이미 있습니다. 기존 명분에 연결합니다.",
                "season_ref": {"name": req.name.strip(), "date": req.date}}
    new = req.model_dump()
    new["name"] = new["name"].strip()
    saved = schedule.save_seasons(items + [new])
    return {"added": True, "saved": saved, "season_ref": {"name": new["name"], "date": req.date}}


# ---------- 컨셉 이력 (통합 기획안 + 기존 기획안) ----------
@router.get("/concepts")
def concepts(limit: int = 60):
    out = []
    for s in store.list_projects():
        if s.get("concept") or s.get("myeongbun"):
            out.append({"source": "통합 기획안", "id": s["id"], "title": s["title"], "myeongbun": s["myeongbun"],
                        "concept": s["concept"], "date": (s.get("period") or {}).get("start") or (s.get("updated_at") or "")[:10]})
    for p in plans.list_plans():
        try:
            d = plans.load_plan(p["id"])
        except (ValueError, FileNotFoundError):
            continue
        bm = d.get("brief_meta") or {}
        if not (bm.get("concept") or bm.get("myeongbun")):
            continue
        starts = sorted(r.get("start") for r in (d.get("rows") or []) if r.get("start"))
        out.append({"source": "기존 기획안", "id": d.get("id"), "title": d.get("title") or "", "myeongbun": bm.get("myeongbun") or "",
                    "concept": bm.get("concept") or "", "date": starts[0] if starts else (d.get("updated_at") or "")[:10]})
    out.sort(key=lambda x: x.get("date") or "", reverse=True)
    return {"items": out[:max(1, min(limit, 200))]}


# ---------- 제작 일정 (기존 timeline 규칙: 오픈일에서 업무일 역산) ----------
@router.get("/schedule")
def production_schedule(open: str, kind: str = "이벤트"):
    if kind not in timeline.KINDS:
        raise HTTPException(400, "페이지 유형은 이벤트 또는 GNB 입니다.")
    open_d, today = _date(open), date.today()
    hol = timeline.holidays()
    du = timeline.DURATIONS[kind]
    lead = du["plan"] + du["design"] + du["dev"]
    rem = timeline.wd_between(today, open_d, hol) if open_d > today else 0
    steps = timeline._step_view(timeline._milestones(open_d, du["plan"], du["design"], du["dev"], hol), today, hol)
    return {"open": open_d.isoformat(), "kind": kind, "lead": lead, "wd_left": rem,
            "mode": timeline._mode(rem, du) if open_d > today else "지남", "steps": steps,
            "rule": f"{kind} {lead}업무일 = 틀 기획 {du['plan']} + 디자인 {du['design']} + 퍼블·개발 {du['dev']} (주말·공휴일 제외)"}

# -*- coding: utf-8 -*-
"""
AI 추천 API (/api/am/ai/*) — 구좌 구성 추천(1단계)과 구좌별 레퍼런스 추천(2단계).

- planner.server의 Guard가 /api/* 전체에 토큰·Host 검사와 보안 헤더를 적용한다 (여기서 따로 열지 않음).
- 입력은 pydantic으로 길이·형식을 제한하고, 읽기만 한다 (기획안·원천 파일에 쓰지 않음, 외부 호출 없음).
- 화면(planner/static)은 바꾸지 않는다. 화면의 sources/*.js가 이 API를 부르도록 바꾸는 것은 화면 담당이 정한다.
  응답 모양은 sources/outline.js · recommend.js · compose.js의 결과 모양({ mode, basis, items } · CANDS)에 맞춰 두었다.
"""
from typing import Annotated, Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import compose, feedback, intake, library, refs, rules

router = APIRouter(prefix="/ai")
Txt = Annotated[str, Field(max_length=2000)]
Short = Annotated[str, Field(max_length=120)]


class BriefIn(BaseModel):   # amoread.api.Brief의 글 필드만 (모양은 같고 모두 선택)
    myeongbun: str = Field(default="", max_length=300)
    concept: str = Field(default="", max_length=300)
    customer: str = Field(default="", max_length=300)
    target: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=40)
    audience: str = Field(default="", max_length=300)
    background: Txt = ""
    benefits_note: str = Field(default="", max_length=1000)
    key_copy: Short = ""
    season_ref: dict | None = None   # 고른 명분 {name, date}


class V2In(BaseModel):
    cls: Literal["", "season", "brand", "launch", "collab", "clear"] = ""
    seed: str = Field(default="", max_length=20)
    keywords: list[Annotated[str, Field(max_length=20)]] = Field(default_factory=list, max_length=30)


class DocIn(BaseModel):
    id: str = Field(default="", max_length=64)   # 현재 기획안 ID (비슷한 기획안 찾을 때 자기 자신을 빼려고)
    title: str = Field(default="", max_length=80)
    brief: BriefIn = Field(default_factory=BriefIn)
    v2: V2In = Field(default_factory=V2In)


class ComposeReq(BaseModel):
    doc: DocIn
    per_section: int = Field(default=1, ge=1, le=3)


class SectionIn(BaseModel):
    layoutId: str = Field(default="", max_length=40)
    name: str = Field(default="", max_length=40)
    purpose: str = Field(default="", max_length=20)


class RefsReq(BaseModel):
    section: SectionIn
    doc: DocIn = Field(default_factory=DocIn)
    n: int = Field(default=3, ge=1, le=8)


@router.get("/status")
def ai_status():
    """색인이 준비됐는지, 어떤 방식으로 검색하는지."""
    return refs.status()


@router.post("/outline")
def ai_outline(req: DocIn):
    """1단계만: 유형 판단과 구좌 목록. 레퍼런스 색인이 없어도 동작한다. 결과: { mode, basis, items } (outline.js purposeOutline과 같은 모양 + 판단 근거)."""
    plan = rules.generate(req.model_dump())
    conf = rules.CONF_KO[plan["confidence"]]
    return {"mode": "ai", "basis": [f"프로모션 유형 '{plan['type_name']}' (신뢰도 {conf})", f"판단 키워드: {', '.join(plan['matched']) or '없음 — 목적·분류로 판단'}",
                                   "유형 규칙은 기획자 검토 전 초안"] + plan["notes"],
            "type": {"id": plan["type"], "name": plan["type_name"], "confidence": plan["confidence"], "evidence": plan["evidence"], "ranking": plan["ranking"], "support_pages": plan["support_pages"]},
            "items": [{"name": s["name"], "layoutId": s["layoutId"], "purpose": s["purpose"], "optional": not s["required"], "why": s["why"], "role": s["role"], "support": s.get("support")}
                      for s in plan["sections"]]}


@router.post("/compose")
def ai_compose(req: ComposeReq):
    """1+2단계: 구좌 구성 추천안(A 규칙형, C 레퍼런스 조합) + 쓰인 레퍼런스 페이지 정보."""
    out = compose.build(req.doc.model_dump(), req.per_section)
    feedback.record("compose", doc_id=req.doc.id, type=out["type"]["id"], cands=[c["id"] for c in out["candidates"]], refs=[r["id"] for r in out["refs"]][:20])
    return out


class FeedbackReq(BaseModel):
    event: Literal["pick_cand", "pick_ref", "drop_ref"]
    doc_id: str = Field(default="", max_length=64)
    cand_id: str = Field(default="", max_length=8)
    ref_id: str = Field(default="", max_length=80)
    section: str = Field(default="", max_length=40)


@router.post("/feedback")
def ai_feedback(req: FeedbackReq):
    """담당자가 후보를 골랐거나(pick_cand), 레퍼런스를 골랐거나 버렸을 때(pick_ref·drop_ref) 기록. ID만 남기고 기획안에는 쓰지 않는다."""
    return {"ok": feedback.record(req.event, doc_id=req.doc_id, cand_id=req.cand_id, ref_id=req.ref_id, section=req.section)}


@router.get("/feedback/summary")
def ai_feedback_summary():
    """후보별 노출·선택 횟수, 많이 고른·버린 레퍼런스."""
    return feedback.summary()


@router.post("/references")
def ai_references(req: RefsReq):
    """2단계만: 구좌 하나에 맞는 레퍼런스. 결과: { mode, basis, items } (recommend.js recommendRefs와 같은 모양)."""
    return refs.recommend(req.section.model_dump(), req.doc.model_dump(), req.n)


@router.get("/snapshot")
def ai_snapshot(id: str = ""):
    """수집본 화면: 저장해 둔 페이지를 안전한 읽기용 HTML로. 외부 링크가 만료돼도 볼 수 있다. 저장본이 없으면 { ok: false }."""
    from . import snapshot
    return snapshot.view(id)


@router.get("/capture")
def ai_capture(id: str = ""):
    """화면 수집본(그려서 저장한 HTML+CSS). 화면이 안전하게 그려 넣는다(스크립트 없음). 없으면 404."""
    import re as _re
    from . import render
    if not _re.fullmatch(r"[A-Za-z0-9_.-]{1,60}", id or ""):
        return JSONResponse({"error": "잘못된 id예요"}, status_code=400)
    h = render.load_html(id)
    return {"html": h} if h is not None else JSONResponse({"error": "저장된 화면이 없어요"}, status_code=404)


@router.get("/library")
def ai_library():
    """레퍼런스 화면용 목록: 수집한 원본 페이지·구좌·참여 이벤트 + 자동 분류 라벨 (사람이 고친 값 우선). 색인이 없으면 mode='demo'."""
    return library.items()


class HideReq(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_.-]{1,60}$")
    on: bool = True


@router.post("/hide")
def ai_hide(req: HideReq):
    """수집본 페이지 삭제(숨김)/되돌리기. 원본 색인 파일은 그대로 두고 삭제 목록(ai_refs_user/hidden.json)에만 적어서, 색인을 다시 만들어도 다시 나오지 않고 되돌릴 수 있다."""
    if req.on and req.id not in refs._state.get("pages", {}):
        refs._load()
        if req.id not in refs._state.get("pages", {}):
            return JSONResponse({"error": "없는 레퍼런스예요"}, status_code=404)
    return {"ok": True, "hidden": refs.set_hidden(req.id, req.on)}


@router.get("/hidden")
def ai_hidden():
    return {"ids": sorted(refs.hidden())}


class CollectReq(BaseModel):
    urls: list[Annotated[str, Field(max_length=500)]] = Field(max_length=60)
    allow_known: bool = False   # 같은 주소여도 내용이 달라진 프로모션을 새로 추가할 때(신규 찾기 화면)


@router.get("/collect/sources")
def ai_collect_sources():
    """수집 버튼 화면: 지난번에 적은 주소 목록."""
    from . import collect
    return {"urls": collect.sources(), "max": collect.MAX_URLS}


@router.post("/collect/start")
def ai_collect_start(req: CollectReq):
    """주소 목록을 하나씩 내려받아 구좌 나누기·자동 분류 후 라이브러리에 추가 (백그라운드). 진행은 /collect/status로 묻는다."""
    from . import collect
    try:
        return collect.start(req.urls, req.allow_known)
    except intake.IntakeError as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/collect/status")
def ai_collect_status(id: str = ""):
    from . import collect
    j = collect.status(id)
    return j if j else JSONResponse({"error": "수집 기록을 찾을 수 없어요"}, status_code=404)


class DiscoverReq(BaseModel):
    market: str = Field(pattern=r"^[a-z0-9_-]{1,20}$")


@router.get("/discover")
def ai_discover():
    """마켓별 마지막 확인 결과(신규/이미 있음). 확인은 /discover/start."""
    from . import daily, discover
    return {"markets": discover.view(), "daily": daily.state(), "running": any(j["state"] == "running" for j in discover._jobs.values())}


@router.post("/discover/start")
def ai_discover_start(req: DiscoverReq):
    """마켓 하나의 기획전·이벤트 목록을 브라우저로 열어 프로모션 링크를 긁는다 (백그라운드). 진행은 /discover/status."""
    from . import discover
    try:
        return discover.start(req.market)
    except intake.IntakeError as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/discover/status")
def ai_discover_status(id: str = ""):
    from . import discover
    j = discover.status(id)
    return j if j else JSONResponse({"error": "확인 기록을 찾을 수 없어요"}, status_code=404)


class PreviewReq(BaseModel):
    method: Literal["url", "html"]
    url: str = Field(default="", max_length=500)
    html: str = Field(default="", max_length=5_500_000)
    filename: str = Field(default="", max_length=120)


@router.post("/intake/preview")
def ai_intake_preview(req: PreviewReq):
    """새 레퍼런스 가져오기 1단계: 링크(서버가 내려받음) 또는 HTML 파일 → 이름·종류·분류·혜택·구좌 나누기 초안. 아직 저장하지 않는다 (24시간 보관)."""
    try:
        if req.method == "url":
            return intake.preview_url(req.url)
        return intake.preview_html(req.html, req.filename, req.url)
    except intake.IntakeError as e:
        return JSONResponse({"error": str(e)}, status_code=400)


class CommitReq(BaseModel):
    draft_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    name: str = Field(default="", max_length=60)
    kind: str = Field(default="page", max_length=20)
    kind_label: str = Field(default="", max_length=20)
    season: str = Field(default="", max_length=30)
    cls: str = Field(default="", max_length=20)
    type: str = Field(default="", max_length=30)
    ben: list[Annotated[str, Field(max_length=20)]] = Field(default_factory=list, max_length=10)
    mode: list[Annotated[str, Field(max_length=20)]] = Field(default_factory=list, max_length=5)
    pts: list[Annotated[str, Field(max_length=20)]] = Field(default_factory=list, max_length=10)
    tags: list[Annotated[str, Field(max_length=20)]] = Field(default_factory=list, max_length=20)
    memo: str = Field(default="", max_length=300)


@router.post("/intake/commit")
def ai_intake_commit(req: CommitReq):
    """새 레퍼런스 가져오기 2단계: 담당자가 확인·수정한 값으로 라이브러리에 추가하고 AI 검색 색인에도 넣는다."""
    try:
        return intake.commit(req.draft_id, req.model_dump(exclude={"draft_id"}))
    except intake.IntakeError as e:
        return JSONResponse({"error": str(e)}, status_code=400)

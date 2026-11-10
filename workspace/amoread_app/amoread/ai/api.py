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
from pydantic import BaseModel, Field

from . import compose, feedback, library, refs, rules

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


@router.get("/library")
def ai_library():
    """레퍼런스 화면용 목록: 수집한 원본 페이지·구좌·참여 이벤트 + 자동 분류 라벨 (사람이 고친 값 우선). 색인이 없으면 mode='demo'."""
    return library.items()

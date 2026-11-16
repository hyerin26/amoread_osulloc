# -*- coding: utf-8 -*-
"""트렌드 키워드 API (/api/am/trend/*). 화면: v2/brief.js 의 마인드맵 가지·근거 패널."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import claude_code, service

router = APIRouter(prefix="/trend")


class DiscoverReq(BaseModel):
    q: str = Field(max_length=40)
    start: str = Field(default="", max_length=10)
    end: str = Field(default="", max_length=10)


@router.get("/rising")
def rising():
    """지금 뜨는 것: 주간 실행이 저장한 가장 최근 결과 (기본 + 차 인접 분야)."""
    return service.latest()


@router.post("/discover")
async def discover(req: DiscoverReq):
    """명분으로 공개 출처(매거진·뉴스)를 검색해 반복 신호를 묶는다. 15~25초, 같은 검색은 15분 캐시."""
    return await service.discover(req.q, req.start, req.end)


@router.get("/status")
def status():
    """주간 실행에 쓰는 Claude Code 로그인 상태 (설치·로그인 여부만)."""
    return {"claude_code": claude_code.status(), "running": service._run["on"], "last_run": service._run["last"]}


@router.post("/run")
def run():
    """지금 뜨는 것을 지금 한 번 새로 찾기 (백그라운드, 몇 분)."""
    return service.run_now()

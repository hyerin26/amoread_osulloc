from __future__ import annotations
import asyncio
from collections import deque
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import time
from typing import Literal
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from .domain import CopyError, PROMPT_VERSION, build_context, validate_result
from .provider import ClaudeCopyProvider

log = logging.getLogger('planner.copy')


class Draft(BaseModel):
    model_config = ConfigDict(extra='forbid')
    section_id: str = Field(min_length=1, max_length=80)
    headline: str = Field(default='', max_length=120)
    subhead: str = Field(default='', max_length=400)
    layout_id: str = Field(min_length=1, max_length=40)
    scope: str = Field(default='', max_length=200)
    product_seqs: list[str] = Field(default_factory=list, max_length=40)


class CopyRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    task: Literal['suggest','polish'] = 'suggest'
    scope: Literal['section','brief'] = 'section'
    project_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    target: Literal['both','headline','subhead'] = 'both'
    tone: Literal['브랜드 기본','담백하게','감성적으로'] = '브랜드 기본'
    draft: Draft


class Jobs:
    def __init__(self, store, engine, provider, timeout=120):
        self.store, self.engine, self.provider = store, engine, provider
        self.timeout = timeout
        self.jobs = {}
        self.calls = deque()

    def start(self, req):
        now = time.monotonic()
        for key in list(self.jobs):
            job = self.jobs[key]
            if job['status'] != 'running' and now-job['started']>3600:
                self.jobs.pop(key)
        if not self.provider.available:
            raise HTTPException(503, 'Claude Agent SDK가 없어요. 기존 앱 가상환경에서 planner/requirements.txt를 설치해 주세요.')
        if any(j['status']=='running' for j in self.jobs.values()):
            raise HTTPException(429, '다른 카피를 만드는 중이에요. 완료하거나 취소한 뒤 다시 시도해 주세요.')
        while self.calls and now-self.calls[0]>60:
            self.calls.popleft()
        if len(self.calls)>=6:
            raise HTTPException(429, '요청이 잦아요. 잠시 후 다시 시도해 주세요.')
        try:
            project = self.store.load(req.project_id)
        except (FileNotFoundError, ValueError):
            raise HTTPException(404, '기획안을 찾을 수 없어요.')
        if req.task == 'polish' and (req.scope != 'section' or req.target != 'subhead'):
            raise HTTPException(400, '설명 다듬기는 구좌의 서브 카피에만 사용할 수 있어요.')
        draft = req.draft.model_dump()
        if req.scope == 'brief':
            if req.target != 'headline' or draft['section_id'] != 'brief':
                raise HTTPException(400, '브리프에서는 메인 카피만 추천할 수 있어요.')
            # 아직 구좌가 없는 01 브리프에서도 동작. 원본 기획안은 변경하지 않는다.
            draft = dict(section_id='brief', headline=(project.get('brief') or {}).get('key_copy') or '',
                         subhead='', layout_id='hero', scope='기획안 전체의 대표 메인 카피', product_seqs=[])
            project = {**project, 'page': {'sections': [{'sectionId':'brief', 'headline':draft['headline'], 'layoutId':'hero'}]}}

        if any(not s.isdigit() or len(s)>12 for s in draft['product_seqs']):
            raise HTTPException(400, '상품 SEQ 형식이 올바르지 않아요.')
        catalogue = self.engine.DATA.ensure().products if draft['product_seqs'] else {}
        try:
            context, warnings, context_hash = build_context(project, draft, req.target, req.tone, catalogue, req.task)
        except CopyError as e:
            raise HTTPException(409, str(e))
        self.calls.append(now)
        job_id = uuid.uuid4().hex
        job = dict(id=job_id, section_id=draft['section_id'], status='running', result=None, error=None, started=now,
                   sources=context['sources'], warnings=warnings)
        self.jobs[job_id] = job
        # 완료된 작업도 무한히 쌓이지 않도록 가장 오래된 결과부터 제거.
        for old in sorted(self.jobs, key=lambda k:self.jobs[k]['started'])[:-40]:
            if self.jobs[old]['status']!='running': self.jobs.pop(old)
        job['task'] = asyncio.create_task(self.run(job, context, context_hash, warnings))
        return self.status(job_id)

    async def run(self, job, context, context_hash, warnings):
        async def work():
            correction = None
            for attempt in range(2):
                raw = await self.provider.generate(context, correction)
                try:
                    return validate_result(raw, context, self.engine.efficacy_flags)
                except CopyError as e:
                    if attempt: raise
                    correction = str(e)
        try:
            items = await asyncio.wait_for(work(), timeout=self.timeout)
            job['result'] = dict(mode='ai', request_id=job['id'], section_id=job['section_id'], target=context['target'],
                model=self.provider.model, prompt_version=PROMPT_VERSION, context_hash=context_hash,
                items=items, sources=context['sources'], warnings=warnings, task=context['task'],
                original_text=context['section']['subhead'] if context['task']=='polish' else None)
            job['status'] = 'done'
        except asyncio.CancelledError:
            job['status'], job['error'] = 'cancelled', '요청을 취소했어요.'
        except TimeoutError:
            job['status'], job['error'] = 'error', '응답 시간이 길어 요청을 종료했어요. 잠시 후 다시 시도해 주세요.'
        except CopyError as e:
            job['status'], job['error'] = 'error', str(e)
        except Exception as e:
            # SDK 원문에는 인증/경로 정보가 포함될 수 있어 브라우저나 로그에 복사하지 않는다.
            log.warning('copy generation failed (%s)', type(e).__name__)
            job['status'], job['error'] = 'error', 'Claude 호출에 실패했어요. 기존 앱의 Claude 인증·모델 설정과 SDK 설치 상태를 확인해 주세요.'
        finally:
            job.pop('task', None)

    def status(self, key):
        job = self.jobs.get(key)
        if not job: raise HTTPException(404, '추천 작업을 찾을 수 없어요. 다시 요청해 주세요.')
        return {k:job[k] for k in ('id','section_id','status','result','error','sources','warnings')} | {'elapsed':round(time.monotonic()-job['started'])}

    def cancel(self, key):
        job = self.jobs.get(key)
        if not job: raise HTTPException(404, '추천 작업을 찾을 수 없어요.')
        if task := job.get('task'):
            job['status'], job['error'] = 'cancelled', '요청을 취소했어요.'
            task.cancel()
        return self.status(key)

    async def shutdown(self):
        tasks = [j['task'] for j in self.jobs.values() if j.get('task')]
        for task in tasks: task.cancel()
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)


def install(app, store=None, engine=None, model=None, provider=None):
    if store is None or engine is None:
        from amoread import store as project_store
        from planner import engine as planner_engine, config
        store, engine = project_store, planner_engine
        model = model or config.CLAUDE_MODEL
    jobs = Jobs(store, engine, provider or ClaudeCopyProvider(model))
    app.state.copy_recommender = jobs
    router = APIRouter(prefix='/api/am/copy')

    @router.get('/status')
    def status():
        return dict(available=jobs.provider.available, model=jobs.provider.model, prompt_version=PROMPT_VERSION,
            auth_verified=False, note='SDK 설치 여부만 확인해요. 인증 상태는 실제 호출할 때 확인됩니다.')

    @router.post('/jobs')
    async def start(req: CopyRequest): return jobs.start(req)

    @router.get('/jobs/{key}')
    def get(key: str): return jobs.status(key)

    @router.post('/jobs/{key}/cancel')
    async def cancel(key: str): return jobs.cancel(key)

    app.include_router(router)
    app.mount('/copy-recommender-assets', StaticFiles(directory=Path(__file__).parent/'static'), name='copy-recommender-assets')
    previous_lifespan = app.router.lifespan_context
    @asynccontextmanager
    async def lifespan(application):
        async with previous_lifespan(application) as state:
            try:
                yield state
            finally:
                await jobs.shutdown()
    app.router.lifespan_context = lifespan

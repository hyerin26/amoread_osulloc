"""브리프 탐색: 최신 데이터·재검색 캐시·근거 저장·AI 입력/출력 경계. 외부 API는 호출하지 않는다."""
import asyncio
import sys
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from planner import brief_research as ai, keywords
from amoread import store
from amoread.api import ProjectReq


@pytest.fixture
def research(monkeypatch, tmp_path):
    monkeypatch.setattr(keywords.config, 'KEYWORD_CACHE', tmp_path / 'cache.json')
    monkeypatch.setattr(keywords, 'has_ad_keys', lambda: True)
    monkeypatch.setattr(keywords.trends, 'has_keys', lambda: True)
    monkeypatch.setattr(keywords.trends, '_log', lambda _: None)
    monkeypatch.setattr(keywords, '_related', lambda _: [{'keyword': '감사 선물'}])
    monkeypatch.setattr(keywords, '_trend', lambda _: [])
    monkeypatch.setattr(keywords, '_articles', lambda _: [])


def test_refresh_bypasses_cache_and_preserves_original_timestamp(research, monkeypatch):
    first = keywords.expand('연말 선물')
    monkeypatch.setattr(keywords, '_related', lambda _: [{'keyword': '사무실 티타임'}])
    cached = keywords.expand('연말 선물')
    assert cached['cached'] is True
    assert cached['fetched_at'] == first['fetched_at']
    assert cached['sources']['searchad']['items'][0]['keyword'] == '감사 선물'
    fresh = keywords.expand('연말 선물', refresh=True)
    assert fresh['cached'] is False
    assert fresh['sources']['searchad']['items'][0]['keyword'] == '사무실 티타임'
    assert keywords.expand('봄 나들이')['seed'] == '봄 나들이'


def test_legacy_relevance_sorted_cache_is_not_reused(research, monkeypatch):
    keywords._save({'연말 선물': {'t': keywords.time.time(), 'data': {'seed': '연말 선물', 'words': ['예전']}}})
    assert keywords.expand('연말 선물')['research_version'] == 2


def test_articles_are_requested_by_date_and_unsafe_links_are_removed(monkeypatch):
    sorts = []
    def search(kind, seed, **kw):
        sorts.append(kw['sort'])
        return [{'title': '최근 차 선물', 'description': '내용', 'link': 'javascript:alert(1)', 'postdate': '20261115'}]
    monkeypatch.setattr(keywords.scout, '_search', search)
    rows = keywords._articles('선물')
    assert sorts == ['date', 'date']
    assert rows[0]['date'] == '2026-11-15'
    assert rows[0]['link'] == ''


@pytest.mark.parametrize('values', [[1]*7, [0]*4+[1]*4, []])
def test_incomplete_or_zero_baseline_does_not_imply_stable_interest(values):
    assert keywords._change(values) is None


def test_four_week_change_uses_two_complete_windows():
    assert keywords._change([10]*4+[15]*4) == .5


def test_keyword_evidence_survives_actual_project_save(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'PROJECTS_DIR', tmp_path)
    req = ProjectReq.model_validate({'brief': {'myeongbun': '연말 선물'}, 'v2': {'seed': '연말 선물', 'keywords': ['감사 선물'], 'keyword_research': {
        'root': '연말 선물', 'hidden': ['숨긴말'], 'manual': [{'keyword': '티타임', 'category': 'situation'}],
        'evidence': [{'keyword': '감사 선물', 'root': '연말 선물', 'source': 'searchad', 'fetched_at': '2026-11-15T12:00:00Z', 'change_4w': None,
            'articles': [{'title': '차 선물', 'kind': '블로그', 'date': '2026-11-14', 'link': 'https://example.com/'}]}],
        'concept_candidates': [{'text': '감사의 티타임', 'source': 'ai', 'rationale': '감사 선물 키워드 활용', 'keywords': ['감사 선물']}], 'concept_basis': '고른 키워드 조합'}}})
    saved = store.save(req.model_dump())
    loaded = store.load(saved['id'])
    assert loaded['brief']['myeongbun'] == loaded['v2']['seed'] == '연말 선물'
    assert loaded['v2']['keyword_research'] == req.v2.keyword_research.model_dump()
    # 다음 화면이 v2를 보내지 않아도 근거는 보존한다.
    store.save({'id': saved['id'], 'title': '다음 화면 저장'})
    assert store.load(saved['id'])['v2']['keyword_research']['evidence'][0]['source'] == 'searchad'


def request(**extra):
    return ai.ResearchRequest(mode='concept', root='연말 선물', keywords=['감사 선물'], **extra)


def test_ai_input_rejects_unselected_evidence_and_oversized_keywords():
    with pytest.raises(ValidationError):
        request(evidence=[{'keyword': '다른말'}])
    with pytest.raises(ValidationError):
        ai.ResearchRequest(mode='concept', root='선물', keywords=['말']*6)


def test_ai_provider_disables_tools_and_rejects_unknown_keywords(monkeypatch):
    options = []
    class Options:
        def __init__(self, **kw): options.append(kw)
    class Result:
        is_error = False
        structured_output = {'suggestions': [{'text': '감사의 티타임', 'rationale': '감사 선물에서 조합', 'keywords': ['감사 선물']}]*3}
    async def query(**kw): yield Result()
    monkeypatch.setitem(sys.modules, 'claude_agent_sdk', SimpleNamespace(ClaudeAgentOptions=Options, ResultMessage=Result, query=query))
    assert len(asyncio.run(ai.generate(request()))['suggestions']) == 3
    assert options[0]['tools'] == options[0]['allowed_tools'] == options[0]['setting_sources'] == []
    Result.structured_output['suggestions'][0]['keywords'] = ['없는말']
    with pytest.raises(ValueError): asyncio.run(ai.generate(request()))


def test_ai_failure_is_retryable_and_does_not_leak_raw_errors(monkeypatch):
    async def fail(_): raise RuntimeError('secret-token-example')
    monkeypatch.setattr(ai, 'generate', fail)
    monkeypatch.setattr(ai, '_calls', ai.deque())
    monkeypatch.setattr(ai, '_running', False)
    app = FastAPI(); app.include_router(ai.router)
    with TestClient(app) as client:
        r = client.post('/api/brief/recommendations', json=request().model_dump())
        assert r.status_code == 503 and 'error' in r.json()
        assert 'secret-token' not in r.text
        assert ai._running is False


def test_research_api_uses_existing_host_and_token_guard(monkeypatch):
    from planner import server
    monkeypatch.setattr(ai, '_calls', ai.deque())
    monkeypatch.setattr(ai, '_running', False)
    async def result(_):
        return {'suggestions': [{'text': '감사의 티타임', 'rationale': '감사 선물 조합', 'keywords': ['감사 선물']}]*3}
    monkeypatch.setattr(ai, 'generate', result)
    with TestClient(server.app, base_url=f'http://127.0.0.1:{server.config.SERVER_PORT}') as client:
        assert client.post('/api/brief/recommendations', json=request().model_dump()).status_code == 401
        r = client.post('/api/brief/recommendations', json=request().model_dump(), headers={'x-planner-token': server.TOKEN})
        assert r.status_code == 200
        assert len(r.json()['suggestions']) == 3

"""웹 검색 결과 출처 검증·호출 범위·저장 복원. 실제 Claude/외부 검색은 호출하지 않는다."""
import asyncio
import json
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from planner import keyword_agent as agent, brief_research as ai
from amoread.api import ProjectReq


def request():
    return agent.KeywordRequest(root='연말 선물', seed='감사 선물')


def candidate(keyword='취향 큐레이션', link='https://example.com/article'):
    return {'keyword': keyword, 'rationale': '자료의 선물 고르는 장면에서 도출', 'sources': [
        {'title': '선물 고르기', 'link': link, 'date': '2026-01-01'}]}


def run(coro): return asyncio.run(coro)


def test_only_tool_observed_links_are_web_evidence_and_missing_links_are_ideas():
    web = agent.WebEvidence(); web.searches = 1
    web.urls = {'https://example.com/article'}
    raw = {'items': [candidate(), candidate('차 한 잔 편지', 'https://invented.example/fake')]}
    out = agent.validate_result(raw, request(), web)
    assert out['items'][0]['source'] == 'ai_web'
    assert out['items'][0]['sources'][0]['link'] == 'https://example.com/article'
    assert out['items'][1]['source'] == 'ai_idea'
    assert out['items'][1]['sources'] == []


def test_no_tool_execution_cannot_masquerade_as_web_research():
    with pytest.raises(ValueError, match='web_search_not_executed'):
        agent.validate_result({'items': [candidate()]}, request(), agent.WebEvidence())


def test_duplicate_and_excluded_words_are_removed_and_future_dates_are_unknown():
    web = agent.WebEvidence();web.searches=1;web.urls={'https://example.com/article'}
    future = candidate();future['sources'][0]['date'] = (datetime.now().date()+timedelta(days=5)).isoformat()
    req = agent.KeywordRequest(root='연말 선물', seed='감사 선물', exclude=['티백'])
    result = agent.validate_result({'items':[future,candidate('취향큐레이션'),candidate('티백'),candidate('감사 선물'),candidate('잘못된!말')]},req,web)
    assert len(result['items'])==1
    assert result['items'][0]['sources'][0]['date']==''


def test_search_outputs_support_nested_dicts_markdown_and_text():
    urls = agent.observed_urls({'results': [{'url':'https://example.com/a'}, {'content':'[자료](https://example.com/b). https://example.com/c'}]})
    assert urls == {'https://example.com/a','https://example.com/b','https://example.com/c'}
    assert not agent.observed_urls('http://127.0.0.1:9751/ http://localhost/ file:///tmp/secret')


def test_fetch_is_limited_to_links_from_search_and_search_calls_are_bounded():
    web=agent.WebEvidence()
    assert run(web.before({'tool_name':'WebSearch'},None,None))=={}
    run(web.after({'tool_name':'WebSearch','tool_response':{'results':[{'url':'https://example.com/a'}]}},None,None))
    assert run(web.before({'tool_name':'WebFetch','tool_input':{'url':'https://example.com/a'}},None,None))=={}
    denied=run(web.before({'tool_name':'WebFetch','tool_input':{'url':'http://localhost/'}},None,None))
    assert denied['hookSpecificOutput']['permissionDecision']=='deny'
    denied=run(web.before({'tool_name':'Bash'},None,None))
    assert denied['hookSpecificOutput']['permissionDecision']=='deny'
    for _ in range(2):run(web.before({'tool_name':'WebSearch'},None,None))
    assert run(web.before({'tool_name':'WebSearch'},None,None))['hookSpecificOutput']['permissionDecision']=='deny'


def test_sdk_enables_only_web_tools_and_validates_final_citations(monkeypatch):
    options=[]
    class Options:
        def __init__(self,**kw):self.kw=kw;options.append(kw)
    class Matcher:
        def __init__(self,**kw):self.hooks=kw['hooks']
    class Result:
        is_error=False
        structured_output={'items':[candidate()]}
    async def query(prompt,options):
        assert json.loads(prompt)['seed']=='감사 선물'
        before=options.kw['hooks']['PreToolUse'][0].hooks[0]
        after=options.kw['hooks']['PostToolUse'][0].hooks[0]
        await before({'tool_name':'WebSearch'},None,None)
        await after({'tool_name':'WebSearch','tool_response':{'results':[{'url':'https://example.com/article'}]}},None,None)
        yield Result()
    monkeypatch.setitem(sys.modules,'claude_agent_sdk',SimpleNamespace(ClaudeAgentOptions=Options,HookMatcher=Matcher,ResultMessage=Result,query=query))
    result=run(agent.generate_keywords(request()))
    assert result['items'][0]['source']=='ai_web'
    assert options[0]['tools']==options[0]['allowed_tools']==['WebSearch','WebFetch']
    assert options[0]['setting_sources']==[] and options[0]['mcp_servers']=={}


def test_keywords_endpoint_reuses_throttle_and_preserves_evidence_on_save(monkeypatch):
    web=agent.WebEvidence();web.searches=1;web.urls={'https://example.com/article'}
    result=agent.validate_result({'items':[candidate()]},request(),web)
    async def generate(_):return result
    monkeypatch.setattr(ai,'generate_keywords',generate)
    monkeypatch.setattr(ai,'_running',False);monkeypatch.setattr(ai,'_calls',ai.deque())
    app=FastAPI();app.include_router(ai.router)
    with TestClient(app) as client:
        r=client.post('/api/brief/keywords',json=request().model_dump());assert r.status_code==200
        item=r.json()['items'][0]
        payload={'v2':{'keyword_research':{'root':'연말 선물','ai_expansions':[{'parent':'감사 선물','fetched_at':result['fetched_at'],'items':[
            {'keyword':item['keyword'],'source':item['source'],'rationale':item['rationale'],'articles':item['sources']}]}]}}}
        saved=ProjectReq.model_validate(payload).model_dump()
        assert saved['v2']['keyword_research']['ai_expansions'][0]['items'][0]['articles'][0]['link']=='https://example.com/article'
        monkeypatch.setattr(ai,'_running',True)
        assert client.post('/api/brief/keywords',json=request().model_dump()).status_code==429


def test_installed_sdk_options_and_hooks_are_compatible_without_live_calls(monkeypatch):
    sdk=pytest.importorskip('claude_agent_sdk')
    async def query(prompt,options):
        assert options.tools==['WebSearch','WebFetch']
        assert options.hooks['PreToolUse'][0].matcher=='WebSearch|WebFetch'
        before=options.hooks['PreToolUse'][0].hooks[0]
        after=options.hooks['PostToolUse'][0].hooks[0]
        await before({'tool_name':'WebSearch'},None,{})
        await after({'tool_name':'WebSearch','tool_response':{'results':[{'url':'https://example.com/article'}]}},None,{})
        yield sdk.ResultMessage(subtype='success',duration_ms=1,duration_api_ms=1,is_error=False,num_turns=2,session_id='test',structured_output={'items':[candidate()]})
    monkeypatch.setattr(sdk,'query',query)
    assert run(agent.generate_keywords(request()))['items'][0]['source']=='ai_web'

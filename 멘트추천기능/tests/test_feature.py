import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('copy_test_package', ROOT/'__init__.py', submodule_search_locations=[str(ROOT)])
package = importlib.util.module_from_spec(spec); sys.modules[spec.name] = package; spec.loader.exec_module(package)
from copy_test_package.domain import CopyError, build_context, validate_result
from copy_test_package.api import CopyRequest

PID = 'a'*32
PROJECT = {'id':PID, 'brief':{'concept':'봄의 여유','audience':'차 선물을 고르는 고객','constraints':'원가율 40% 이하\n과장 없이',
    'period':{'start':'2026-03-01','end':'2026-03-15'},'key_copy':'봄의 첫 잔'},
    'v2':{'keywords':['피크닉'],'extras':[]},
    'page':{'sections':[{'sectionId':'hero','headline':'봄의 첫 잔','layoutId':'hero'},{'sectionId':'goods','headline':'차 선물','layoutId':'grid2'}]},
    'promo_rows':[{'seq':'101','type':'상시','rate':.2}]}
CATALOGUE = {'101':{'seq':'101','name':'녹차 티백 10입','category':'티 제품','cost':987654,'sales_28':999999,'reviews':'SECRET_REVIEW'}}
REQUEST = {'project_id':PID,'target':'both','tone':'브랜드 기본','draft':{'section_id':'hero','headline':'봄의 첫 잔','subhead':'차와 함께 쉬어가요',
    'layout_id':'hero','scope':'차 선물','product_seqs':['101']}}


def raw(context):
    items = [dict(headline=h,subhead=s,angle=a,basis=['brief.concept']) for h,s,a in [
        ('봄을 담은 차 한 잔','일상에 은은한 여유를 더해 보세요.','브랜드 감성'),
        ('오늘의 작은 티타임','차와 함께 잠깐 쉬어가요.','사용 상황'),
        ('가볍게 건네는 봄','마음을 전하는 차를 만나 보세요.','컨셉 강조')]]
    for item in items:
        for key in context['rules']['locked_fields']: item[key]=context['section'][key]
    return {'items':items}


class Store:
    def load(self, pid):
        if pid!=PID: raise FileNotFoundError(pid)
        return copy.deepcopy(PROJECT)


class Provider:
    model = 'test-provider-not-real-ai'
    available = True
    def __init__(self, delay=0, invalid=False):self.calls=0;self.delay=delay;self.invalid=invalid;self.context=None
    async def generate(self, context, correction=None):
        self.calls+=1;self.context=context
        await asyncio.sleep(self.delay)
        result=raw(context)
        if self.invalid:result['items'][0]['headline']='무료배송 99%'
        return result


ENGINE = SimpleNamespace(DATA=SimpleNamespace(ensure=lambda:SimpleNamespace(products=CATALOGUE)),efficacy_flags=lambda t:['면역'] if '면역' in t else [])


def context(target='both'):
    return build_context(PROJECT, REQUEST['draft'], target, REQUEST['tone'], CATALOGUE)[0]


def client(provider=None):
    app=FastAPI();package.install(app,store=Store(),engine=ENGINE,provider=provider or Provider())
    return app,TestClient(app)


def completed(c, key):
    for _ in range(200):
        job=c.get('/api/am/copy/jobs/'+key).json()
        if job['status']!='running':return job
        time.sleep(.005)
    raise AssertionError('Job did not finish')


def test_context_excludes_private_fields_and_filters_internal_lines():
    ctx,warnings,_=build_context(PROJECT,REQUEST['draft'],'both','브랜드 기본',CATALOGUE)
    serialized=json.dumps(ctx,ensure_ascii=False)
    assert all(x not in serialized for x in ['987654','999999','SECRET_REVIEW','원가율'])
    assert '20%' in serialized and '피크닉' in serialized and warnings


def test_compound_benefits_do_not_make_unverified_final_price():
    doc=copy.deepcopy(PROJECT);doc['v2']['extras']=[{'seqs':['101'],'val':5,'calc':'sale_pct'}]
    ctx,warnings,_=build_context(doc,REQUEST['draft'],'both','브랜드 기본',CATALOGUE)
    assert not any(s['id'].startswith('discount.') for s in ctx['sources'])
    assert warnings


@pytest.mark.parametrize('mutation', ['numbers','claims','efficacy','unknown_basis','length','emoji_length','duplicates'])
def test_invalid_outputs_are_rejected(mutation):
    ctx=context();result=raw(ctx);item=result['items'][0]
    if mutation=='numbers':item['headline']='99% 할인'
    if mutation=='claims':item['headline']='무료배송으로 전하는 봄'
    if mutation=='efficacy':item['headline']='면역을 위한 차'
    if mutation=='unknown_basis':item['basis']=['made-up-source']
    if mutation=='length':item['headline']='가'*61
    if mutation=='emoji_length':item['headline']='🌿'*31
    if mutation=='duplicates':result['items'][1].update(headline=item['headline'],subhead=item['subhead'])
    with pytest.raises(CopyError):validate_result(result,ctx,ENGINE.efficacy_flags)


@pytest.mark.parametrize('target,locked', [('headline','subhead'),('subhead','headline')])
def test_partial_regeneration_preserves_locked_text(target,locked):
    ctx=context(target);result=raw(ctx);assert len(validate_result(result,ctx))==3
    result['items'][0][locked]='덮어쓰기'
    with pytest.raises(CopyError):validate_result(result,ctx)


def test_jobs_return_three_real_provider_results_without_mutating_project():
    before=copy.deepcopy(PROJECT);provider=Provider();app,c=client(provider)
    with c:
        start=c.post('/api/am/copy/jobs',json=REQUEST);assert start.status_code==200
        job=completed(c,start.json()['id']);assert job['status']=='done'
        assert job['result']['mode']=='ai' and len(job['result']['items'])==3
        assert job['result']['section_id']=='hero' and provider.calls==1
    assert PROJECT==before


def test_invalid_output_is_retried_once_and_never_returned():
    provider=Provider(invalid=True);app,c=client(provider)
    with c:
        start=c.post('/api/am/copy/jobs',json=REQUEST).json()
        job=completed(c,start['id'])
        assert job['status']=='error' and job['result'] is None and provider.calls==2


def test_missing_sdk_does_not_fall_back_to_fake_copy():
    provider=Provider();provider.available=False;app,c=client(provider)
    with c:
        assert c.post('/api/am/copy/jobs',json=REQUEST).status_code==503
        assert provider.calls==0


def test_timeout_and_cancel_release_job():
    async def scenario():
        app,_=client(Provider(delay=1));jobs=app.state.copy_recommender;jobs.timeout=.01
        started=jobs.start(CopyRequest.model_validate(REQUEST))
        await asyncio.sleep(.05);assert jobs.status(started['id'])['status']=='error'
        started=jobs.start(CopyRequest.model_validate(REQUEST));jobs.cancel(started['id'])
        await asyncio.sleep(.01);assert jobs.status(started['id'])['status']=='cancelled'
        await jobs.shutdown()
    asyncio.run(scenario())


def test_parallel_requests_and_invalid_project_are_blocked():
    app,c=client(Provider(delay=1))
    with c:
        bad=copy.deepcopy(REQUEST);bad['project_id']='b'*32
        assert c.post('/api/am/copy/jobs',json=bad).status_code==404
        start=c.post('/api/am/copy/jobs',json=REQUEST).json()
        assert c.post('/api/am/copy/jobs',json=REQUEST).status_code==429
        c.post('/api/am/copy/jobs/'+start['id']+'/cancel')


def test_sdk_call_disables_tools_and_uses_structured_output(monkeypatch):
    from copy_test_package.provider import ClaudeCopyProvider
    recorded={}
    class Options:
        def __init__(self,**kw):recorded.update(kw)
    class Result:
        is_error=False
        structured_output=raw(context())
    async def query(**kwargs):
        recorded['prompt']=kwargs['prompt'];yield Result()
    monkeypatch.setitem(sys.modules,'claude_agent_sdk',SimpleNamespace(ClaudeAgentOptions=Options,ResultMessage=Result,query=query))
    result=asyncio.run(ClaudeCopyProvider('configured-model').generate(context()))
    assert len(result['items'])==3
    assert recorded['tools']==[] and recorded['allowed_tools']==[] and recorded['mcp_servers']=={}
    assert recorded['setting_sources']==[] and recorded['model']=='configured-model'
    assert recorded['output_format']['type']=='json_schema'


def test_brief_recommendation_without_sections_uses_saved_brief_only():
    class BriefStore:
        def load(self, pid):
            doc=copy.deepcopy(PROJECT);doc['page']['sections']=[]
            return doc
    provider=Provider();app=FastAPI()
    package.install(app,store=BriefStore(),engine=ENGINE,provider=provider)
    request=copy.deepcopy(REQUEST)
    request.update(scope='brief',target='headline')
    request['draft'].update(section_id='brief',headline='클라이언트 임의 문구',product_seqs=['999'])
    with TestClient(app) as c:
        result=c.post('/api/am/copy/jobs',json=request)
        assert result.status_code==200
        job=completed(c,result.json()['id'])
        assert job['status']=='done' and job['result']['target']=='headline'
        assert provider.context['section']['headline']==PROJECT['brief']['key_copy']
        assert provider.context['products']==[]
        assert all(i['subhead']=='' for i in job['result']['items'])
        request['target']='both'
        assert c.post('/api/am/copy/jobs',json=request).status_code==400


def test_polish_keeps_main_and_passes_original_to_provider():
    provider=Provider();app,c=client(provider)
    request=copy.deepcopy(REQUEST);request.update(task='polish',target='subhead')
    with c:
        response=c.post('/api/am/copy/jobs',json=request)
        assert response.status_code==200
        result=completed(c,response.json()['id'])['result']
        assert provider.context['task']=='polish'
        assert provider.context['section']['subhead']==request['draft']['subhead']
        assert provider.context['rules']['locked_fields']==['headline']
        assert result['task']=='polish' and result['original_text']==request['draft']['subhead']
        assert all(i['headline']==request['draft']['headline'] for i in result['items'])


@pytest.mark.parametrize('change,status', [({'target':'both'},400),({'scope':'brief'},400),({'empty':True},409)])
def test_polish_requires_section_subhead_and_nonempty_original(change,status):
    app,c=client();request=copy.deepcopy(REQUEST);request.update(task='polish',target='subhead')
    if change.get('empty'):request['draft']['subhead']='   '
    else:request.update(change)
    with c:
        assert c.post('/api/am/copy/jobs',json=request).status_code==status


def test_polish_changes_context_hash_and_instructs_meaning_preservation():
    from copy_test_package.domain import SYSTEM
    _,_,a=build_context(PROJECT,REQUEST['draft'],'subhead','브랜드 기본',CATALOGUE)
    _,_,b=build_context(PROJECT,REQUEST['draft'],'subhead','브랜드 기본',CATALOGUE,'polish')
    assert a!=b
    assert 'section.subhead 원문을 퇴고' in SYSTEM and '핵심 의미' in SYSTEM

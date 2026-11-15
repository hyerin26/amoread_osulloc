"""기존 앱의 Guard/정적 파일/기획안 저장 경로를 함께 확인한다."""
import copy
import json
from pathlib import Path
import sys
import time

from fastapi.testclient import TestClient

APP_ROOT = Path(__file__).resolve().parents[2]/'workspace/amoread_app'
sys.path.insert(0,str(APP_ROOT))


def test_existing_app_guard_generation_and_persistence(tmp_path,monkeypatch):
    from planner import server
    from amoread import store
    from test_feature import PROJECT, REQUEST, Provider
    monkeypatch.setattr(store,'PROJECTS_DIR',tmp_path)
    provider=Provider()
    monkeypatch.setattr(server.app.state.copy_recommender,'provider',provider)
    # No original product dataset is read by this integration test.
    from test_feature import ENGINE
    monkeypatch.setattr(server.app.state.copy_recommender,'engine',ENGINE)
    base='http://127.0.0.1:'+str(server.config.SERVER_PORT)
    with TestClient(server.app,base_url=base) as client:
        assert client.get('/api/am/copy/status').status_code==401
        headers={'x-planner-token':server.TOKEN}
        assert client.get('/api/am/copy/status',headers=headers).status_code==200
        assert client.get('/api/am/copy/status',headers={**headers,'host':'evil.example'}).status_code==403
        # 2026-11-15: 03 구좌 편집 = 신규 구좌편집기(/v2/editor는 /v2/editor-next로 넘어감). 추천 화면은 v2/editor-next-ai.js
        page=client.get('/v2/editor',follow_redirects=True)
        assert page.status_code==200 and "script-src 'self'" in page.headers['content-security-policy']
        assert '/static/v2/editor-next-ai.js' in page.text
        assert client.get('/static/v2/editor-next-ai.js').status_code==200
        for file in ['core.js','editor-plugin.js','editor.css']:
            assert client.get('/copy-recommender-assets/'+file).status_code==200
        saved=client.post('/api/am/projects',json={**copy.deepcopy(PROJECT),'title':'통합 테스트'},headers=headers)
        assert saved.status_code==200
        original=client.get('/api/am/projects/'+PROJECT['id'],headers=headers).json()
        start=client.post('/api/am/copy/jobs',json=REQUEST,headers=headers)
        assert start.status_code==200
        for _ in range(100):
            job=client.get('/api/am/copy/jobs/'+start.json()['id'],headers=headers).json()
            if job['status']!='running':break
            time.sleep(.005)
        assert job['status']=='done'
        assert client.get('/api/am/projects/'+PROJECT['id'],headers=headers).json()==original
        updated=copy.deepcopy(original)
        updated['page']['sections'][0]['headline']=job['result']['items'][0]['headline']
        updated['page']['sections'][0]['subhead']=job['result']['items'][0]['subhead']
        assert client.post('/api/am/projects',json=updated,headers=headers).status_code==200
        reopened=client.get('/api/am/projects/'+PROJECT['id'],headers=headers).json()
        assert reopened['page']['sections'][0]['headline']==job['result']['items'][0]['headline']
        assert reopened['page']['sections'][1]==original['page']['sections'][1]

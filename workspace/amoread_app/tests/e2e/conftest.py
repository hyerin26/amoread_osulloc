# -*- coding: utf-8 -*-
"""실제 앱 서버를 띄우고 브라우저(Playwright Chromium)로 쓰는 통합 테스트 공통 준비.

    .venv\\Scripts\\python.exe -m pytest tests/e2e -q      (requirements-dev.txt, playwright install chromium)

- 서버: python -m planner.server를 빈 포트로 띄운다 (127.0.0.1만). 데이터는 이 PC의 planner/data·원천 파일을 그대로 읽는다
- 기획안: 테스트마다 API로 만들고 끝나면 지운다 (다른 기획안은 건드리지 않음)
- 상품: /api/products에서 정가가 있는 상품을 고른다. 후기가 있는 상품을 하나 이상 포함 (없으면 해당 단언은 건너뜀)
"""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[2]   # workspace/amoread_app


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server:
    def __init__(self, extra_env=None):
        self.port = _free_port()
        self.base = f"http://127.0.0.1:{self.port}"
        env = {**os.environ, "PYTHONUTF8": "1", "PLANNER_PORT": str(self.port), **(extra_env or {})}
        # E2E_SERVER_LOG=파일경로 를 주면 서버 출력(오류 추적 포함)을 그 파일에 남긴다 (실패 원인 찾기용)
        log = open(os.environ["E2E_SERVER_LOG"], "ab") if os.environ.get("E2E_SERVER_LOG") else subprocess.DEVNULL
        self.proc = subprocess.Popen([sys.executable, "-m", "planner.server", "--no-browser"], cwd=APP, env=env,
                                     stdout=log, stderr=subprocess.STDOUT if log is not subprocess.DEVNULL else subprocess.DEVNULL)
        for _ in range(240):
            try:
                html = urllib.request.urlopen(self.base + "/v2/home", timeout=2).read().decode("utf-8")
                self.token = re.search(r'planner-token" content="([^"]+)"', html).group(1)
                return
            except (urllib.error.URLError, ConnectionError, OSError):
                time.sleep(0.5)
        self.stop()
        raise RuntimeError("서버가 뜨지 않았어요")

    def api(self, path, body=None):
        req = urllib.request.Request(self.base + path, method="GET" if body is None else "POST",
                                     data=None if body is None else json.dumps(body).encode("utf-8"),
                                     headers={"x-planner-token": self.token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")

    def stop(self):
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()


@pytest.fixture(scope="session")
def server():
    s = Server()
    yield s
    s.stop()


@pytest.fixture(scope="session")
def server_off():
    s = Server({"AMOREAD_EDITOR_NEXT": "0"})
    yield s
    s.stop()


@pytest.fixture(scope="session")
def products(server):
    """정가가 있는 상품 3개 (첫 번째는 후기가 있는 상품을 우선)."""
    st, d = server.api("/api/products")
    assert st == 200, d
    priced = [p for p in d["products"] if (p.get("price") or 0) > 0]
    assert len(priced) >= 3
    with_reviews = None
    for p in priced[:80]:
        st, det = server.api(f"/api/product/{p['seq']}")
        if st == 200 and det.get("reviews") and det["reviews"].get("n"):
            with_reviews = {**p, "reviews": det["reviews"]}
            break
    rest = [p for p in priced if not with_reviews or p["seq"] != with_reviews["seq"]]
    return ([with_reviews] if with_reviews else []) + rest[: 3 - (1 if with_reviews else 0)]


@pytest.fixture
def plan(server, products):
    """테스트 기획안: 할인 행 2개(20%·10%), 첫 상품에 추가 혜택(할인가에서 10% 더), 구좌 3개(메인·2열 상품·서비스)."""
    a, b = products[0], products[1]
    doc = {
        "title": "E2E 신규 편집기 테스트", "status": "planning",
        "promo_rows": [{"promo": "E2E", "type": "상시", "seq": a["seq"], "rate": 0.2, "appeal": "E2E 소구문구"},
                       {"promo": "E2E", "type": "상시", "seq": b["seq"], "rate": 0.1, "appeal": ""}],
        "v2": {"stage": "editor", "extras": [{"id": "x1", "name": "쿠폰", "calc": "sale_pct", "val": 10, "seqs": [a["seq"]]}]},
        "page": {"sections": [
            {"sectionId": "e1", "order": 0, "name": "E2E 메인", "headline": "E2E 메인", "subhead": "E2E 부제", "layoutId": "hero"},
            {"sectionId": "e2", "order": 1, "name": "E2E 상품", "headline": "E2E 상품", "layoutId": "grid2",
             "slots": [{"slotId": "c1", "seq": a["seq"], "placeholderStatus": "AVAILABLE"}, {"slotId": "c2", "seq": b["seq"], "placeholderStatus": "AVAILABLE"}]},
            {"sectionId": "e3", "order": 2, "name": "E2E 서비스", "headline": "E2E 서비스", "layoutId": "service"},
        ]},
    }
    st, saved = server.api("/api/am/projects", doc)
    assert st == 200, saved
    yield {"id": saved["id"], "a": a, "b": b, "doc": saved}
    server.api(f"/api/am/projects/{saved['id']}/delete", {})


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        # E2E_BROWSER_CHANNEL=msedge: Chromium을 따로 받지 않고 이 PC의 Edge로 (사내망에서 playwright install이 막힐 때)
        b = p.chromium.launch(channel=os.environ.get("E2E_BROWSER_CHANNEL") or None)
        yield b
        b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={"width": 1600, "height": 1000})
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: pg.errors.append(f"console: {m.text}") if m.type == "error" else None)
    pg.on("response", lambda r: pg.errors.append(f"HTTP {r.status} {r.url}") if r.status >= 400 and "/api/am/projects" not in r.url else None)
    yield pg
    ctx.close()


def open_editor_next(page, server, pid):
    page.goto(f"{server.base}/v2/editor-next?id={pid}", wait_until="networkidle")
    page.wait_for_function("() => /가져왔어요|열었어요/.test(document.getElementById('enNotice').textContent)", timeout=30000)


def wait_saved(page):
    page.wait_for_function("() => /저장했어요/.test(document.getElementById('v2saved').textContent)", timeout=15000)

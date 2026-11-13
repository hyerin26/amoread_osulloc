"""Check legacy preservation, Green UI precedence and new editor iframe.

Run from any directory: python amoread-editor/integration/tests/test_launcher.py
Requires: pip install playwright; python -m playwright install chromium
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from contextlib import contextmanager
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

@contextmanager
def serve():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=str(ROOT)))
    worker=Thread(target=server.serve_forever,daemon=True)
    worker.start()
    try: yield "http://127.0.0.1:%s" % server.server_port
    finally: server.shutdown();server.server_close()

with serve() as origin, sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":900})
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.goto(origin+"/integration/tests/legacy-fixture.html")
    assert page.locator("#legacy-title").inner_text()=="기존 구좌편집기 (삭제되면 안 됨)"
    assert page.locator(".host-primary").count()==1
    page.locator("#amoread-open-new-editor").click()
    overlay=page.locator(".amx-dialog")
    assert overlay.is_visible()
    iframe=page.frame_locator(".amx-frame")
    iframe.locator("#page [data-page]").first.wait_for(timeout=20000)
    assert page.locator(".host-primary").count()==1,"Legacy button was removed"
    assert page.locator("#legacy-title").count()==1,"Legacy editor was removed"
    accent=page.locator(".amx-frame").evaluate(
      "el=>getComputedStyle(el.contentDocument.documentElement).getPropertyValue('--accent').trim()")
    assert accent=="#1b6a94",accent
    page.get_by_role("button",name="Green UI 충돌 비교").click()
    assert page.locator(".amx-compare").is_visible()
    assert page.locator(".amx-row").count()==12
    state=page.locator(".amx-row").first.locator(".amx-badge").inner_text()
    assert state=="일치",state
    assert page.locator(".amx-compare").inner_text().find("주요 버튼 배경")>=0
    # An image that people can inspect locally after running this test.
    out=Path(__file__).resolve().parent/"green-ui-conflicts-preview.png"
    page.screenshot(path=str(out),full_page=False)
    page.get_by_role("button",name="← 기존 구좌편집기로 돌아가기").click()
    assert not overlay.is_visible()
    assert page.locator(".host-primary").count()==1
    assert page.locator(".host-field").input_value()=="기존 데이터"
    assert not errors,errors
    browser.close()
    print("PASS legacy editor preserved, new entry, host token priority, 12 visual comparison rows, return to old editor")
    print("Screenshot:",out)

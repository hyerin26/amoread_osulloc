# -*- coding: utf-8 -*-
"""기획안 저장 안전장치: 다른 창에서 바뀐 기획안을 말없이 덮어쓰지 않는다 (2026-11-14). 임시 폴더만 쓴다."""
import json
import re
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from amoread import api, store
from amoread.ai import discover

V2 = Path(__file__).resolve().parents[1] / "planner" / "static" / "v2"


class SaveConflict(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.object(store, "PROJECTS_DIR", Path(self.tmp.name))
        self.p.start()

    def tearDown(self):
        self.p.stop()
        self.tmp.cleanup()

    def save(self, **kw):
        return api.save_project(api.ProjectReq(**kw))

    def test_stale_save_is_refused_and_keeps_the_newer_one(self):
        a = self.save(title="처음")
        mine = a["updated_at"]
        with mock.patch.object(store, "_now", return_value="2099-01-01 00:00:01"):   # 다른 창이 저장
            self.save(id=a["id"], title="다른 창이 고침", base_updated_at=mine)
        res = self.save(id=a["id"], title="내가 고침", base_updated_at=mine)
        self.assertEqual(res.status_code, 409)
        body = json.loads(res.body)
        self.assertEqual(body["code"], "stale")
        self.assertEqual(body["updated_at"], "2099-01-01 00:00:01")
        self.assertEqual(store.load(a["id"])["title"], "다른 창이 고침")

    def test_force_and_no_base_still_save(self):
        a = self.save(title="처음")
        with mock.patch.object(store, "_now", return_value="2099-01-01 00:00:01"):
            self.save(id=a["id"], title="다른 창", base_updated_at=a["updated_at"])
        self.assertEqual(self.save(id=a["id"], title="덮어쓰기", base_updated_at=a["updated_at"], force=True)["title"], "덮어쓰기")
        self.assertEqual(self.save(id=a["id"], title="예전 화면")["title"], "예전 화면")   # base를 안 보내는 예전 화면은 그대로

    def test_base_fields_are_not_stored(self):
        a = self.save(title="처음", base_updated_at="2000-01-01 00:00:00", force=True)
        self.assertNotIn("base_updated_at", a)
        self.assertNotIn("force", a)


class ScreenSide(unittest.TestCase):
    def test_plan_sends_base_and_api_renews_token(self):
        plan, api_js = (V2 / "plan.js").read_text(encoding="utf-8"), (V2 / "api.js").read_text(encoding="utf-8")
        self.assertIn("base_updated_at", plan, "plan.js가 읽은 저장 시각을 같이 보내야 다른 창 덮어쓰기를 막아요")
        self.assertIn("'stale'", plan)
        self.assertRegex(api_js, r"status === 401[\s\S]{0,80}v2renewToken", "서버를 다시 켠 뒤에도 저장되려면 401에서 토큰을 새로 받아야 해요")

    def test_no_raw_token_fetch_outside_api(self):
        """토큰을 직접 붙여 fetch하면 서버를 다시 켠 뒤 그 요청만 계속 실패한다 → v2fetch/v2api를 쓴다 (떠날 때 보내는 keepalive 한 곳만 예외)."""
        bad = []
        for f in V2.glob("*.js"):
            if f.name == "api.js":
                continue
            for i, ln in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if "x-planner-token" in ln and "keepalive" not in ln:
                    bad.append(f"{f.name}:{i}")
        self.assertEqual(bad, [])


class DiscoverCache(unittest.TestCase):
    def test_view_is_cached_until_files_change(self):
        discover._view_cache.clear()
        with mock.patch.object(discover, "_view", wraps=discover._view) as v:
            a = discover.view(); b = discover.view()
            self.assertEqual(a, b)
            self.assertEqual(v.call_count, 1)
            a.append("x")   # 받은 쪽이 고쳐도 저장해 둔 값은 그대로
            self.assertEqual(discover.view(), b)


if __name__ == "__main__":
    unittest.main()

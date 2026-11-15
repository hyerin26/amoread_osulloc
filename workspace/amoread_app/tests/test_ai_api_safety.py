# -*- coding: utf-8 -*-
"""API 입력 검증·안전장치·기록·스냅샷. 사용자 데이터는 건드리지 않는다(임시 폴더 사용)."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from pydantic import ValidationError

from amoread.ai import api, collect, feedback, intake, snapshot_pack


class Validation(unittest.TestCase):
    def bad(self, model, **kw):
        with self.assertRaises(ValidationError):
            model(**kw)

    def test_refs_request_limits(self):   # 화면이 보내는 값이 한도를 넘으면 422가 된다 (editor.js가 잘라 보낸다)
        ok = lambda **sec: api.RefsReq(section=sec, n=sec.pop("n", 3))
        ok(layoutId="grid2", name="가" * 40, purpose="가" * 20, n=8)
        self.bad(api.RefsReq, section={"name": "가" * 41})
        self.bad(api.RefsReq, section={"purpose": "가" * 21})
        self.bad(api.RefsReq, section={"layoutId": "x" * 41})
        self.bad(api.RefsReq, section={}, n=9)
        self.bad(api.RefsReq, section={}, n=0)

    def test_doc_limits(self):
        api.DocIn(title="가" * 80)
        self.bad(api.DocIn, title="가" * 81)
        self.bad(api.DocIn, v2={"cls": "weird"})
        self.bad(api.DocIn, v2={"keywords": ["가" * 21]})
        self.bad(api.DocIn, v2={"keywords": ["a"] * 31})
        self.bad(api.DocIn, brief={"key_copy": "가" * 121})

    def test_compose_per_section_range(self):
        self.bad(api.ComposeReq, doc={}, per_section=4)

    def test_hide_and_draft_id_patterns(self):
        for bad in ["../x", "a/b", "", "a" * 61, "x y"]:
            self.bad(api.HideReq, id=bad)
        self.bad(api.CommitReq, draft_id="../../etc")
        self.bad(api.CommitReq, draft_id="G" * 16)
        api.CommitReq(draft_id="0123456789abcdef")

    def test_feedback_event_enum(self):
        self.bad(api.FeedbackReq, event="hack")
        self.bad(api.DiscoverReq, market="A/B")

    def test_capture_id_rejects_traversal(self):
        for i in ["../x", "a/../b", "", "x" * 61, "a b"]:
            r = api.ai_capture(i)
            self.assertEqual(r.status_code, 400, i)
        self.assertEqual(api.ai_capture("zzz-no-such").status_code, 404)

    def test_collect_url_limits(self):
        self.bad(api.CollectReq, urls=["http://a.com"] * 61)
        self.bad(api.CollectReq, urls=["http://a.com/" + "x" * 500])


class Safety(unittest.TestCase):
    def test_private_addresses_are_refused(self):
        for ip in ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1", "0.0.0.0", "172.16.0.1", "224.0.0.1"]:
            with self.assertRaises(intake.IntakeError, msg=ip):
                intake._check_ip(ip)
        intake._check_ip("8.8.8.8")

    def test_non_http_and_credentials_urls_refused(self):
        for u in ["file:///etc/passwd", "ftp://a.com/x", "javascript:alert(1)", "http://127.0.0.1:9731/", "http://localhost/", "http://[::1]/", "//a.com"]:
            with self.assertRaises(intake.IntakeError, msg=u):
                intake.fetch(u)

    def test_clean_urls(self):
        out = collect.clean_urls(["", "ftp://x", " https://www.a.com/p/?utm_source=x&id=1#f ", "https://a.com/p?id=1", "http://" + "a" * 600, "javascript:1"])
        self.assertEqual(out, ["https://www.a.com/p/?utm_source=x&id=1#f"])   # 추적 파라미터·www·끝 슬래시가 달라도 같은 주소는 하나
        self.assertEqual(len(collect.clean_urls([f"https://a.com/{i}" for i in range(100)])), collect.MAX_URLS)

    def test_normalize(self):
        self.assertEqual(collect.normalize("HTTPS://WWW.Example.com/Path/?utm_x=1&b=2#z"), "https://example.com/Path?b=2")


class Feedback(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = (feedback.LOG_DIR, feedback.LOG)
        feedback.LOG_DIR = Path(self.tmp.name)
        feedback.LOG = feedback.LOG_DIR / "events.jsonl"
        feedback._cache.update(mt=None)

    def tearDown(self):
        feedback.LOG_DIR, feedback.LOG = self.old
        feedback._cache.update(mt=None)
        self.tmp.cleanup()

    def test_unknown_event_ignored_and_ids_only(self):
        self.assertFalse(feedback.record("hack", x=1))
        self.assertTrue(feedback.record("pick_ref", ref_id="r1", section="", doc_id=None))
        row = json.loads(feedback.LOG.read_text(encoding="utf-8").splitlines()[0])
        self.assertEqual(set(row), {"t", "event", "ref_id"})   # 빈 값은 적지 않는다

    def test_adjust_caps_and_direction(self):
        for _ in range(10):
            feedback.record("pick_ref", ref_id="a")
        for _ in range(10):
            feedback.record("drop_ref", ref_id="b")
        self.assertEqual(feedback.adjust("a"), feedback.CAP)
        self.assertEqual(feedback.adjust("b"), -feedback.CAP)
        self.assertEqual(feedback.adjust("none"), 0)

    def test_section_aware_adjust(self):   # 한 구좌에서 고른 사례가 다른 구좌에서는 조금만 앞서야 한다
        for _ in range(4):
            feedback.record("pick_ref", ref_id="a", section="hero")
        self.assertAlmostEqual(feedback.adjust("a", "hero"), 1.0)
        self.assertAlmostEqual(feedback.adjust("a", "grid2"), feedback.GLOBAL_W * 1.0)
        self.assertAlmostEqual(feedback.adjust("a"), 1.0)

    def test_size_cap(self):
        feedback.LOG.write_text("x" * (feedback.MAX_BYTES + 1), encoding="utf-8")
        self.assertFalse(feedback.record("pick_ref", ref_id="a"))

    def test_corrupt_log_is_survivable(self):
        feedback.LOG.write_text("not json\n{\"event\":\"pick_ref\",\"ref_id\":\"q\"}\n", encoding="utf-8")
        self.assertEqual(feedback.summary()["events"], {})   # 한 줄이 깨지면 요약을 포기하되 죽지 않는다
        self.assertEqual(feedback.adjust("q"), 0)

    def test_summary_rates(self):
        feedback.record("compose", cands=["A", "C"])
        feedback.record("compose", cands=["A", "C"])
        feedback.record("pick_cand", cand_id="C")
        s = feedback.summary()["candidates"]
        self.assertEqual(s["C"], {"shown": 2, "picked": 1, "pick_rate": 0.5})


class SnapshotPack(unittest.TestCase):
    def test_import_rejects_unsafe_paths_and_bad_hash(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            z = d / "evil.zip"
            with zipfile.ZipFile(z, "w") as f:
                f.writestr("manifest.json", json.dumps({"version": 1, "created": "x", "files": {"../escape.txt": {"sha256": "0", "bytes": 1}}}))
                f.writestr("../escape.txt", "x")
            with self.assertRaises(SystemExit):
                snapshot_pack.import_(z, yes=True)
            z2 = d / "bad.zip"
            with zipfile.ZipFile(z2, "w") as f:
                f.writestr("manifest.json", json.dumps({"version": 1, "created": "x", "files": {"ai_refs/pages.json": {"sha256": "0" * 64, "bytes": 2}}}))
                f.writestr("ai_refs/pages.json", "{}")
            with self.assertRaises(SystemExit):
                snapshot_pack.import_(z2, yes=True)
            z3 = d / "notsnap.zip"
            with zipfile.ZipFile(z3, "w") as f:
                f.writestr("a.txt", "x")
            with self.assertRaises(SystemExit):
                snapshot_pack.import_(z3, yes=True)

    def test_safe_path_rules(self):
        self.assertTrue(snapshot_pack._safe("ai_refs/pages.json"))
        self.assertTrue(snapshot_pack._safe("references/refs.json"))
        for bad in ["/etc/passwd", "../x", "ai_refs/../../x", "other/x", ""]:
            self.assertFalse(snapshot_pack._safe(bad), bad)


class IntakeSplit(unittest.TestCase):
    HTML = ('<html><head><title>추석 선물세트 기획전 | 오설록</title></head><body><header><h1>추석 선물세트</h1><p>마음을 전하는 차 선물</p></header>'
            '<section><h2>베스트 상품</h2><p>티백 3종 세트 29,000원 선물 포장 가능</p><img src=a.jpg><img src=b.jpg></section>'
            '<section><h2>혜택</h2><p>쿠폰 10% 사은품 증정</p></section><footer>유의사항 교환 환불 불가</footer></body></html>')

    def test_short_sections_are_not_swallowed(self):   # 짧은 머리글·짧은 혜택·푸터가 앞 구좌에 먹히면 구좌 수와 분류(유의사항 등)가 틀어진다
        d = intake.build_draft(self.HTML, "https://www.osulloc.com/x")
        titles = [s["title"] for s in d["sections"]]
        self.assertEqual(len(d["sections"]), 4, titles)
        self.assertEqual(d["sections"][-1]["role"], "terms_notice")

    def test_broken_or_empty_html_never_raises(self):
        for h in ["", "<p>", "<<<>>>", "x" * 100, "<div>" * 3000, "<h2>a</h2>" * 500]:
            d = intake.build_draft(h)
            self.assertLessEqual(len(d["sections"]), intake.MAX_SECTIONS)
            self.assertTrue(d["name"])


if __name__ == "__main__":
    unittest.main()

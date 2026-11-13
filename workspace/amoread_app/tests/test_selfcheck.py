# -*- coding: utf-8 -*-
"""자체 점검이 '오류' 없이 통과해야 한다 = 지금 이 PC의 AI 데이터가 서로 맞는다. 데이터를 바꾸거나 스냅샷을 새로 받은 뒤 한 번 돌려 보면 된다."""
import unittest

from amoread.ai import refs, selfcheck


@unittest.skipUnless(refs._load(), "레퍼런스 색인 없음")
class SelfCheck(unittest.TestCase):
    def test_no_errors_in_data(self):
        s = selfcheck.summary()
        errs = [x for x in s["items"] if x["level"] == "error"]
        self.assertFalse(errs, errs)

    def test_rows_have_all_fields(self):
        for x in selfcheck.run():
            self.assertEqual(set(x), {"level", "title", "detail", "fix"})
            self.assertIn(x["level"], ("ok", "warn", "error"))

    def test_missing_index_is_reported_not_raised(self):
        old = refs._load
        try:
            refs._load = lambda: False
            r = selfcheck.run()
        finally:
            refs._load = old
        self.assertEqual(r[0]["level"], "error")


if __name__ == "__main__":
    unittest.main()

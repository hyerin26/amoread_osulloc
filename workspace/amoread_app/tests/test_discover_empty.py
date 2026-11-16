# -*- coding: utf-8 -*-
"""신규 프로모션 찾기: 하나도 못 찾으면 실패로 알리고 이전 결과(first_seen)는 그대로 둔다 (2026-11-17 리뷰)."""
import unittest
from unittest import mock

from amoread.ai import discover, intake


class EmptyScan(unittest.TestCase):
    def test_empty_scan_keeps_previous_items(self):
        db = {"kurly": {"at": "2026-11-16 09:30", "items": [{"url": "https://www.kurly.com/collections/a", "title": "a", "first_seen": "2026-11-01"}]}}
        saved = []
        with mock.patch.object(discover, "_scan_pages", return_value=[]), mock.patch.object(discover, "_load", return_value=db), \
                mock.patch.object(discover, "_save", side_effect=saved.append):
            with self.assertRaises(intake.IntakeError):
                discover.scan_and_save("kurly")
        self.assertEqual(saved, [], "아무것도 저장하지 않는다")


if __name__ == "__main__":
    unittest.main()

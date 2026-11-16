# -*- coding: utf-8 -*-
"""트렌드 키워드 (amoread/trend): AI가 지어낸 이름·상품을 서버가 지우는지, 저장된 결과를 화면용으로 줄이는지. 네트워크는 쓰지 않는다."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from amoread.trend import ai, service, weekly


class AIGuards(unittest.TestCase):
    def test_filter_keeps_only_candidate_names(self):
        ctx = {"candidates": [{"term": "떡픈런"}, {"term": "쫀득 모찌 밀크티"}]}
        res = ai.validate("rising_filter", {"items": [{"term": "떡픈런", "age_group": "10·20대"}, {"term": "지어낸 이름"},
                                                      {"term": "쫀득 모찌 밀크티", "age_group": "아무나"}, {"term": "떡픈런"}]}, ctx)
        self.assertEqual([i["term"] for i in res["items"]], ["떡픈런", "쫀득 모찌 밀크티"], "후보에 없는 이름·중복은 버린다")
        self.assertEqual(res["items"][1]["age_group"], "전 연령", "모르는 연령대는 '전 연령'으로")

    def test_moves_drop_unknown_products_and_flag_claims(self):
        ctx = {"brief": {"product": "티: 제주 말차 밀크티, 말차 마들렌 컬렉션"}}
        res = ai.validate("rising_moves", {"moves": [{"theme_label": "x", "move_title": "t", "what_to_do": "말차 밀크티를 30% 할인", "placement": "어딘가",
                                                      "example_phrase": "아주아주아주아주아주아주 긴 문구입니다 스물두 자 넘음", "products": ["제주 말차 밀크티", "없는 상품 세트"]}]}, ctx)
        m = res["moves"][0]
        self.assertEqual(m["products"], ["제주 말차 밀크티"], "확인된 목록 밖 상품은 지운다")
        self.assertTrue(any("할인" in c for c in m["checks"]))
        self.assertTrue(any("구좌" in c for c in m["checks"]))
        self.assertTrue(any("22자" in c for c in m["checks"]))

    def test_mock_provider_needs_no_network(self):
        with mock.patch.dict("os.environ", {"AMOREAD_TREND_AI": "mock"}):
            res, model = ai.generate("rising_filter", {"candidates": [{"term": "a"}, {"term": "b"}]})
        self.assertEqual(model, "mock")
        self.assertEqual([i["term"] for i in res["items"]], ["a", "b"])


class Latest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.object(weekly, "DIR", Path(self.tmp.name)); self.p.start()

    def tearDown(self):
        self.p.stop(); self.tmp.cleanup()

    def put(self, name, items, moves=None):
        (Path(self.tmp.name) / name).write_text(json.dumps({"date": name[:10], "items": items, "moves": moves or {}}, ensure_ascii=False), encoding="utf-8")

    def test_empty_is_not_an_error(self):
        d = service.latest()
        self.assertIsNone(d["general"]["date"]); self.assertEqual(d["category"]["items"], [])

    def test_newest_file_live_first_and_idea_attached(self):
        self.put("2026-11-09.json", [{"term": "옛것", "stage": "초기 급상승"}])
        self.put("2026-11-16.json", [{"term": "지난 유행", "stage": "이미 대중화"},
                                     {"term": "떡픈런", "stage": "초기 급상승", "stories": {"last_14d": 9, "d15_45": 1, "d46_365": 0},
                                      "evidence": [{"title": "t", "url": "javascript:alert(1)", "platform": "p", "published_day": "2026-11-15"}]}],
                 {"떡픈런": {"move_title": "아이디어", "what_to_do": "w", "example_phrase": "e", "placement": "p", "products": []}})
        g = service.latest()["general"]
        self.assertEqual(g["date"], "2026-11-16")
        self.assertEqual([i["term"] for i in g["items"]], ["떡픈런", "지난 유행"], "지금 뜨는 것이 앞")
        self.assertEqual(g["items"][0]["counts"]["recent"], 9)
        self.assertEqual(g["items"][0]["idea"]["title"], "아이디어")
        self.assertEqual(g["items"][0]["evidence"][0]["url"], "", "http·https가 아닌 링크는 버린다")

    def test_category_file_is_separate(self):
        self.put("2026-11-16_category.json", [{"term": "호지차 초콜릿", "stage": "반응 포착", "field": "차"}])
        d = service.latest()
        self.assertEqual(d["category"]["items"][0]["field"], "차")
        self.assertIsNone(d["general"]["date"])


class Period(unittest.TestCase):
    def test_period_is_checked_and_capped(self):
        self.assertIsNone(service._period("", ""))
        self.assertIsNone(service._period("2026-12-10", "2026-12-01"))
        self.assertEqual(service._period("2026-01-01", "2026-12-31")["end"], "2026-04-03", "탐색은 93일까지")


if __name__ == "__main__":
    unittest.main()


class InspireTrendCards(unittest.TestCase):
    """오늘의 영감에 섞이는 트렌드 카드: 지금 뜨는 것만, 하루 TREND_DECK장, 저장·넘기기 뒤에는 다시 안 나옴."""

    def setUp(self):
        from amoread.ai import inspire
        self.inspire = inspire
        self.tmp = tempfile.TemporaryDirectory()
        rising = Path(self.tmp.name) / "rising"; rising.mkdir()
        (rising / "2026-11-16_category.json").write_text(json.dumps({"date": "2026-11-16", "items": [
            {"term": "쫀득 모찌 밀크티", "stage": "초기 급상승", "reason": "r1", "field": "차"},
            {"term": "호지차 초콜릿", "stage": "확산 중", "reason": "r2", "field": "차"},
            {"term": "약과", "stage": "이미 대중화", "reason": "r3", "field": "티푸드"},
            {"term": "말차 라떼", "stage": "반응 포착", "reason": "r4", "field": "차"}], "moves": {}}, ensure_ascii=False), encoding="utf-8")
        self.ps = [mock.patch.object(weekly, "DIR", rising), mock.patch.object(inspire, "DIR", Path(self.tmp.name) / "inspire"),
                   mock.patch.object(inspire, "candidates", lambda: [])]
        for p in self.ps:
            p.start()

    def tearDown(self):
        for p in self.ps:
            p.stop()
        self.tmp.cleanup()

    def test_only_live_items_and_deck_limit(self):
        names = [c["title"] for c in self.inspire.trend_cards()]
        self.assertNotIn("약과", names, "이미 대중화된 것은 카드로 내지 않는다")
        cards = [c for c in self.inspire.deck()["cards"] if c["kind"] == "trend"]
        self.assertEqual(len(cards), self.inspire.TREND_DECK)
        self.assertEqual(cards[0]["note"]["why"], "r1", "왜 볼 만한가 = 단계를 그렇게 본 이유")

    def test_saved_card_does_not_come_back_and_undo_restores(self):
        first = [c for c in self.inspire.deck()["cards"] if c["kind"] == "trend"][0]
        self.assertTrue(self.inspire.swipe(first["id"], "save")["ok"])
        self.assertEqual([x["title"] for x in self.inspire.saved()["items"]], [first["title"]])
        self.assertNotIn(first["id"], [c["id"] for c in self.inspire.deck()["cards"]])
        self.inspire.swipe(first["id"], "undo")
        self.assertEqual(self.inspire.saved()["items"], [])

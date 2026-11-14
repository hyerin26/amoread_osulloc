# -*- coding: utf-8 -*-
"""오늘의 영감: 글 분류 규칙, 덱 구성(안 본 것만·고르게), 저장/넘기기/되돌리기, 취향 반영. 임시 폴더만 쓴다(사용자 데이터 그대로)."""
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from amoread.ai import api, inspire


def cand(i, kind="mech", brand="A", mech=("미니게임·뽑기",), src="new"):
    return {"id": f"c{i}", "src": src, "brand": brand, "title": f"카드 {i}", "url": f"https://x.test/{i}", "text": "글", "first_seen": "2026-11-13", "score": 60, "low": False,
            "kind": kind, "kinds": [kind], "mech": list(mech) if kind == "mech" else [], "phrases": ["문장 하나", "문장 둘"] if kind == "copy" else [], "struct": "", "why": "이유"}


class Rules(unittest.TestCase):
    def test_mechanics_found_and_plain_sale_is_not(self):
        self.assertIn("미니게임·뽑기", inspire.mechanics("매일 돌리는 룰렛 이벤트"))
        self.assertIn("출석·스탬프", inspire.mechanics("출석체크하고 스탬프 모으기"))
        self.assertIn("구매금액별 혜택", inspire.mechanics("6만원 이상 구매 시 사은품"))
        self.assertEqual(inspire.mechanics("겨울 신상 최대 30% 할인"), [])

    def test_review_count_is_not_a_review_event(self):   # 상품 카드의 '리뷰 301' 같은 글에 걸리면 모든 카드가 '후기 이벤트'가 된다
        self.assertNotIn("후기·인증", inspire.mechanics("르메 후드 패딩 4.7 리뷰 301"))
        self.assertIn("후기·인증", inspire.mechanics("리뷰 작성 시 자동 응모"))

    def test_phrases_skip_notices_and_prices(self):
        text = "뿌리는 향에서 바르는 향으로. 주문번호 당 사은품 1개 증정합니다. 일부 상품은 쿠폰 적용이 불가할 수 있습니다. 포근하고 세련된 분위기를 동시에 담았어요. 45,520원 24% 할인."
        ph = inspire.phrases(text)
        self.assertIn("포근하고 세련된 분위기를 동시에 담았어요", ph)
        self.assertFalse([p for p in ph if "쿠폰" in p or "증정" in p or "할인" in p])

    def test_structure_needs_three_steps_in_order(self):
        self.assertTrue(inspire.structure("BENEFIT 1 선발매 BENEFIT 2 할인 BENEFIT 3 사은품"))
        self.assertEqual(inspire.structure("혜택 1 무료배송 혜택 2 할인"), "")

    def test_common_tags_alone_do_not_make_a_mechanic_card(self):
        a = inspire.analyze("겨울 세일", "구매 시 사은품을 드려요. 포근한 겨울을 준비해 보세요. 따뜻한 차 한 잔의 여유를 느껴보세요.")
        self.assertNotEqual(a["kind"], "mech")
        self.assertIn("사은품", a["mech"])


class Explain(unittest.TestCase):
    """카드가 '무엇을·왜·좋은지'를 스스로 설명하는가."""

    def test_mechanic_card_says_how_it_was_used_and_what_it_is(self):
        a = inspire.analyze("출석 이벤트", "겨울 한정 혜택. 매일 출석체크하고 스탬프 5개를 모으면 텀블러를 드려요. 유의사항을 확인해 주세요.")
        self.assertEqual(a["kind"], "mech")
        self.assertIn("출석", a["hits"][0]["hit"])
        self.assertIn(a["hits"][0]["hit"], a["hits"][0]["snip"])
        self.assertLessEqual(len(a["hits"][0]["snip"]), 140)
        self.assertTrue(a["desc"], "기법 설명 한 줄이 있어야 이름만 보고도 뭔지 알아요")
        self.assertEqual(a["focus"], a["hits"][0]["snip"][:120], "화면에서 표시할 자리는 그 문장")

    def test_every_mechanic_has_a_description(self):
        self.assertEqual(set(inspire.MECH), set(inspire.MECH_DESC), "MECH에 기법을 더하면 MECH_DESC에 한 줄 설명도 넣어 주세요")

    def test_game_idiom_is_not_a_minigame(self):
        self.assertNotIn("미니게임·뽑기", inspire.mechanics("게임의 판도를 바꾸고, 변화를 이끕니다"))

    def test_steps_are_named(self):
        st = inspire.steps("BENEFIT 1 단독 선발매 상품 BENEFIT 2 ~25% 단독 할인 BENEFIT 3 6만원 이상 구매 이벤트")
        self.assertEqual(st[:2], ["단독 선발매 상품", "~25% 단독 할인"])

    def test_grade_rewards_what_osulloc_has_not_tried(self):
        mk = lambda i, mech, own=False, src="new", brand="A": {"id": f"x{i}", "src": src, "brand": brand, "own": own, "kind": "mech", "kinds": ["mech"], "mech": mech, "phrases": [], "steps": [], "score": None, "low": False}
        cands = [mk(0, ["미니게임·뽑기"])] + [mk(i, ["응모·래플"], brand=f"B{i % 4}") for i in range(1, 40)] + [mk(99, ["응모·래플"], own=True, src="lib")]
        inspire._enrich(cands)
        new, common = cands[0], cands[1]
        self.assertIn("오설록 페이지에는 아직 없는 방식", [s["t"] for s in new["signals"]])
        self.assertEqual(new["grade"], 3)
        self.assertIn("오설록도 써 본 방식", [s["t"] for s in common["signals"]])
        self.assertLess(common["grade"], new["grade"])


class NoRepeats(unittest.TestCase):
    """같은 얘기가 되풀이되지 않게 (2026-11-14: 29CM의 '선발매'·'당첨자'가 카드마다 나왔음)."""

    def mk(self, i, brand, hit, name="얼리버드·사전예약"):
        return {"id": f"t{i}", "src": "new", "brand": brand, "own": False, "url": f"https://x.test/{i}", "title": f"t{i}", "text": "", "first_seen": "2026-11-13", "score": 60, "low": False,
                "kind": "mech", "kinds": ["mech"], "mech": [name], "hits": [{"name": name, "hit": hit, "snip": f"{hit} 문장", "near": hit}], "phrases": [], "steps": [], "struct": "", "desc": "", "why": ""}

    def test_market_template_phrase_is_not_a_mechanic(self):
        tpl = [self.mk(i, "29CM", "선발매") for i in range(inspire.TEMPLATE_MIN + 2)]
        real = self.mk(900, "29CM", "얼리버드")
        other = self.mk(901, "지그재그", "선발매")
        out = inspire._drop_templates(tpl + [real, other])
        self.assertEqual({c["id"] for c in out}, {"t900", "t901"}, "틀 문구만 있던 카드는 빠지고, 같은 낱말이라도 다른 마켓 것과 다른 낱말은 남아요")

    def test_template_card_falls_back_to_its_other_merit(self):
        tpl = [dict(self.mk(i, "29CM", "선발매"), phrases=["포근하고 세련된 분위기를 동시에 담았어요", "둘째 문장이에요"]) for i in range(inspire.TEMPLATE_MIN)]
        out = inspire._drop_templates(tpl)
        self.assertEqual({c["kind"] for c in out}, {"copy"})
        self.assertEqual(out[0]["focus"], "포근하고 세련된 분위기를 동시에 담았어요")

    def test_one_card_per_mechanic_and_per_page_in_a_deck(self):
        cands = [self.mk(i, f"B{i % 5}", f"hit{i}") for i in range(10)] + [dict(self.mk(50 + i, "C", f"q{i}", "미니게임·뽑기"), url="https://same.test/p") for i in range(3)]
        with tempfile.TemporaryDirectory() as t, mock.patch.object(inspire, "DIR", Path(t)), mock.patch.object(inspire, "candidates", return_value=inspire._enrich(cands)):
            names = [c["hits"][0]["name"] for c in inspire.deck()["cards"]]
        self.assertEqual(sorted(names), sorted(set(names)))


class Deck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cands = [cand(i, "mech", "A") for i in range(20)] + [cand(100 + i, "copy", "B") for i in range(20)] + [cand(200 + i, "design", "C", src="lib") for i in range(20)]
        self.ps = [mock.patch.object(inspire, "DIR", Path(self.tmp.name)), mock.patch.object(inspire, "candidates", return_value=cands), mock.patch.object(inspire, "_favorite")]
        for p in self.ps:
            p.start()

    def tearDown(self):
        for p in self.ps:
            p.stop()
        self.tmp.cleanup()

    def ids(self):
        return [c["id"] for c in inspire.deck(today=date(2026, 11, 14))["cards"]]

    def test_deck_size_mix_and_stable_within_a_day(self):
        d = inspire.deck(today=date(2026, 11, 14))
        self.assertEqual(len(d["cards"]), inspire.DECK)
        kinds = {c["kind"] for c in d["cards"]}
        self.assertEqual(kinds, {"mech", "copy", "design"}, "한 종류만 몰리면 안 돼요")
        self.assertEqual(self.ids(), self.ids(), "같은 날 다시 열면 같은 카드여야 해요")

    def test_seen_cards_do_not_come_back_and_undo_restores(self):
        first = self.ids()
        self.assertTrue(inspire.swipe(first[0], "save")["ok"])
        self.assertTrue(inspire.swipe(first[1], "pass")["ok"])
        again = self.ids()
        self.assertNotIn(first[0], again); self.assertNotIn(first[1], again)
        self.assertEqual([x["id"] for x in inspire.saved()["items"]], [first[0]])
        inspire.swipe(first[0], "undo")
        self.assertEqual(inspire.saved()["items"], [])
        self.assertIn(first[0], self.ids())

    def test_own_pages_are_not_shown_as_cards(self):
        mine = dict(cand(777, "mech", "오설록"), own=True)
        with mock.patch.object(inspire, "candidates", return_value=[mine, cand(1)]):
            self.assertEqual([c["id"] for c in inspire.deck()["cards"]], ["c1"])

    def test_cards_with_a_real_screen_come_first(self):
        a, b = cand(1), cand(2)
        with mock.patch.object(inspire, "candidates", return_value=[a, b]), mock.patch.object(inspire, "shot_info", side_effect=lambda c: {"shot": "/refimg/inspire/x", "shot_h": 900, "spot": {"y": 10, "h": 20}} if c["id"] == "c2" else {}):
            d = inspire.deck()
        self.assertEqual(d["cards"][0]["id"], "c2")
        self.assertTrue(d["cards"][0]["cap"]); self.assertEqual(d["no_screen"], 1)
        self.assertEqual(d["cards"][0]["spot"], {"y": 10, "h": 20})

    def test_shot_file_only_serves_known_ids(self):
        self.assertIsNone(inspire.shot_file("../../x"))
        self.assertIsNone(inspire.shot_file("d0123456789ab"))   # 없는 사진
        self.assertNotEqual(inspire.shot_id({"id": "s1", "src": "lib", "url": "https://a.test/1"}), inspire.shot_id({"id": "s2", "src": "lib", "url": "https://a.test/2"}))
        self.assertEqual(inspire.shot_id({"id": "s1", "src": "lib", "url": "https://a.test/1"}), inspire.shot_id({"id": "s9", "src": "lib", "url": "https://a.test/1"}), "같은 페이지의 구좌는 사진 한 장을 같이 써요")

    def test_preview_id_is_checked(self):
        self.assertIsNone(inspire.load_preview("../../etc/passwd"))
        self.assertIsNone(inspire.load_preview("d0123456789ab"))   # 없는 화면

    def test_unknown_card_is_refused(self):
        self.assertFalse(inspire.swipe("nope", "save")["ok"])

    def test_taste_moves_the_mix_but_keeps_variety(self):
        base = sum(c["kind"] == "copy" for c in inspire.deck(today=date(2026, 11, 14))["cards"])
        for i in range(8):
            inspire.swipe(f"c{100 + i}", "save")   # 워딩을 계속 저장
            inspire.swipe(f"c{i}", "pass")         # 판매 기법은 계속 넘김
        d = inspire.deck(today=date(2026, 11, 14))
        kinds = [c["kind"] for c in d["cards"]]
        self.assertGreater(kinds.count("copy"), base)
        self.assertGreaterEqual(kinds.count("mech"), 1, "넘긴 종류도 1장은 남겨요 (취향이 굳지 않게)")
        self.assertIn("워딩", d["taste"]["likes"])

    def test_memo_remove_and_reset(self):
        inspire.swipe("c1", "save")
        self.assertTrue(inspire.edit("c1", memo="가" * 400)["ok"])
        self.assertEqual(len(inspire.saved()["items"][0]["memo"]), 300)
        inspire.swipe("c2", "pass")
        inspire.reset_taste()
        self.assertEqual(len(inspire.saved()["items"]), 1, "취향을 지워도 저장한 카드는 남아요")
        self.assertIn("c2", self.ids() + [c["id"] for c in inspire.deck(60)["cards"]])
        inspire.edit("c1", remove=True)
        self.assertEqual(inspire.saved()["items"], [])
        self.assertFalse(inspire.edit("c1", memo="x")["ok"])

    def test_saving_a_library_section_also_favorites_it(self):
        c = dict(cand(999, "design", "C", src="lib"), ref="sec-1")
        with mock.patch.object(inspire, "candidates", return_value=[c]), mock.patch.object(inspire, "_favorite") as fav:
            inspire.swipe("c999", "save")
            fav.assert_called_with("sec-1", True)


class RealData(unittest.TestCase):
    def test_real_candidates_have_what_the_screen_needs(self):
        with tempfile.TemporaryDirectory() as t, mock.patch.object(inspire, "DIR", Path(t)):
            d = inspire.deck()
        for c in d["cards"]:
            self.assertTrue(c["id"] and c["title"] and c["kind"] in inspire.KIND_KO and c["why"], c)
            self.assertLessEqual(len(c["text"]), 320)

    def test_request_shapes(self):
        api.SwipeReq(id="d0123456789ab", act="save")
        with self.assertRaises(Exception):
            api.SwipeReq(id="../x", act="save")
        with self.assertRaises(Exception):
            api.SwipeReq(id="a", act="delete")


if __name__ == "__main__":
    unittest.main()

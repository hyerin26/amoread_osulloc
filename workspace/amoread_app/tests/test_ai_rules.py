# -*- coding: utf-8 -*-
"""유형 규칙(rules.py): 브리프 → 유형 → 구좌 구성. 표준 라이브러리 unittest만 쓴다.
실행: .venv/bin/python -m unittest discover -s tests -v   (amoread_app 폴더에서)"""
import unittest

from amoread.ai import rules

LAYOUTS = {"hero", "grid2", "grid3", "split", "benefit", "deal-banner", "text-cta"}


def doc(title="", purpose="", cls="", kw=(), **b):
    return {"id": "", "title": title, "brief": {"purpose": purpose, **b}, "v2": {"cls": cls, "seed": "", "keywords": list(kw)}}


class Classify(unittest.TestCase):
    def test_empty_brief_is_generic_not_guessed(self):
        p = rules.generate(doc())
        self.assertEqual(p["type"], "generic")
        self.assertEqual(p["confidence"], "low")
        self.assertTrue(p["notes"])
        self.assertEqual([s["role"] for s in p["sections"]][0], "hero")

    def test_keywords_pick_type(self):
        for title, want in [("블랙위크 메가세일", "mega_sale"), ("신규 가입 쿠폰팩", "coupon_acquisition"), ("셰프 협업 콜라보", "brand_collab"),
                            ("출석체크 이벤트", "participation_event"), ("신한카드 제휴 혜택", "card_partner")]:
            with self.subTest(title=title):
                self.assertEqual(rules.generate(doc(title))["type"], want)

    def test_english_keywords_need_word_boundary(self):
        # 'new'·'top'이 desktop·renewal·stopover 같은 낱말 안의 조각에 반응하면 안 된다
        for t in ["Desktop banner", "stopover", "renewal news", "Anewhome"]:
            with self.subTest(t=t):
                self.assertEqual(rules.generate(doc(t))["type"], "generic")
        self.assertEqual(rules.generate(doc("NEW 컬렉션"))["type"], "new_product_launch")
        self.assertEqual(rules.generate(doc("TOP 10 베스트"))["type"], "curation")

    def test_korean_keyword_still_matches_inside_word(self):
        self.assertEqual(rules.generate(doc("선물세트 기획"))["type"], "gift_curation")   # 조사·접미가 붙어도 잡힌다

    def test_prior_only_is_low_confidence(self):
        # 단어 근거 없이 목적·분류 가중치만 → '중간' 신뢰도로 보이면 안 된다
        p = rules.generate(doc("봄 한정판 티", purpose="전환·매출", cls="season"))
        self.assertEqual(p["matched"], [])
        self.assertEqual(p["confidence"], "low")
        self.assertTrue(any("목적·분류만" in n for n in p["notes"]))

    def test_name_keywords_weigh_more(self):
        a = rules.classify(doc("쿠폰"))[0]["score"]
        b = rules.classify(doc("x", concept="쿠폰"))[0]["score"]
        self.assertGreater(a, b)

    def test_regex_metacharacters_in_input_are_harmless(self):
        for t in ["(((", "[a-z", "\\", "*+?", "최대 99%", "💥세일💥"]:
            with self.subTest(t=t):
                rules.generate(doc(t, key_copy=t))

    def test_huge_keyword_list(self):
        rules.generate(doc("x", kw=["가" * 20] * 30))

    def test_missing_keys_tolerated(self):
        rules.generate({})
        rules.generate({"brief": None, "v2": None})


class Sections(unittest.TestCase):
    def test_every_type_is_well_formed(self):
        for t, d in rules.TYPES.items():
            with self.subTest(t=t):
                self.assertTrue(d["sections"] and d["sections"][0]["required"])   # 첫 구좌는 필수 (참여형 이벤트만 hero 대신 참여 방법이 첫 화면)
                for s in d["sections"]:
                    self.assertIn(s["role"], rules.ROLE_NAME)
                self.assertIn(d["conf"], rules.CONF_KO)
                self.assertTrue(d["evidence"])

    def test_layouts_are_known_to_the_screen(self):
        for t in list(rules.TYPES) + ["generic"]:
            seed = {"generic": doc()}.get(t) or doc(rules.TYPES[t]["name"])
            for s in rules.generate(seed)["sections"]:
                self.assertIn(s["layoutId"], LAYOUTS, s)
                self.assertTrue(s["name"] and s["purpose"])

    def test_layout_for_every_role(self):
        for r in rules.ROLE_NAME:
            self.assertIn(rules.layout_for(r), LAYOUTS)
            self.assertTrue(rules.goal_for(r))
        self.assertEqual(rules.layout_for("sale_offer", "하루 특가 오늘만"), "deal-banner")
        self.assertEqual(rules.layout_for("sale_offer", "최대 30% 할인"), "benefit")

    def test_product_names_follow_keywords(self):
        p = rules.generate(doc("추석 선물세트 모음전", kw=["티백", "선물"]))
        names = [s["name"] for s in p["sections"] if s["role"] == "product_list"]
        self.assertEqual(names[0], "티백 추천")
        self.assertEqual(rules.product_name(doc(), 5, gift=True), "받는 사람별 선물 추천")

    def test_secondary_type_adds_missing_required_only_not_hero(self):
        p = rules.generate(doc("블랙위크 신규 가입 쿠폰 대형 세일"))
        roles = [s["role"] for s in p["sections"]]
        self.assertEqual(roles.count("hero"), 1)
        self.assertEqual(len(roles), len(set(r for r in roles if r != "product_list")) + roles.count("product_list"))

    def test_app_mention_adds_app_promo_once(self):
        p = rules.generate(doc("앱 전용 쿠폰"))
        self.assertEqual([s["role"] for s in p["sections"]].count("app_promo"), 1)

    def test_goal_depends_on_purpose(self):
        self.assertEqual(rules.goal_for("hero", "신규 유입"), "유입")
        self.assertEqual(rules.goal_for("product_list", "객단가 상승"), "객단가")


if __name__ == "__main__":
    unittest.main()

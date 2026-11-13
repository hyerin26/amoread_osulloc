# -*- coding: utf-8 -*-
"""레퍼런스 검색(refs.py)·구성 추천(compose.py)·라이브러리(library.py). 수집 색인(planner/data/ai_refs)이 있어야 돌고, 없으면 건너뛴다. 읽기만 한다."""
import unittest

from amoread.ai import compose, library, refs, rules

READY = refs._load()


def doc(title="추석 선물세트", purpose="선물 수요", cls="season", kw=("선물", "티백"), **b):
    return {"id": "", "title": title, "brief": {"purpose": purpose, "myeongbun": "추석", **b}, "v2": {"cls": cls, "seed": "", "keywords": list(kw)}}


@unittest.skipUnless(READY, "레퍼런스 색인 없음")
class Search(unittest.TestCase):
    def test_role_filter_and_k(self):
        for k in (1, 3, 8):
            r = refs.search("선물 세트 쿠폰", ["coupon_offer"], k=k)
            self.assertLessEqual(len(r), k)
            for x in r:
                self.assertTrue(x["role"] in ("coupon_offer", *refs.ROLE_FALLBACK.get("coupon_offer", [])))
                self.assertGreaterEqual(len(x["text"]), 20)

    def test_blank_query_returns_nothing(self):
        self.assertEqual(refs.search("   ", ["hero"]), [])
        self.assertEqual(refs.search_pages(""), [])

    def test_unknown_role_returns_nothing(self):
        self.assertEqual(refs.search("선물", ["no_such_role"]), [])

    def test_special_characters_do_not_crash(self):
        for q in ["(((", "%%%", "\\", "a", "가", "💥" * 50, "가" * 5000]:
            refs.search(q, ["hero"], k=3)

    def test_near_duplicates_removed(self):
        r = refs.search("브랜드 쇼케이스", ["hero"], k=8)
        for i, a in enumerate(r):
            for b in r[i + 1:]:
                self.assertFalse(refs._near_dup(a["text"], b["text"]))

    def test_search_in_page_stays_in_page(self):
        pid = next(iter(refs._page_index()))
        for x in refs.search_in_page("추천 상품 혜택", ["product_list", "benefit_overview", "hero"], pid, k=3):
            self.assertEqual(x["page_id"], pid)

    def test_roles_for_every_layout(self):
        for lay in ("hero", "grid2", "grid3", "split", "deal-banner", "benefit", "text-cta", "nonsense", ""):
            self.assertTrue(refs.roles_for(lay, "x", ""))
        self.assertEqual(refs.roles_for("benefit", "쿠폰 발급")[0], "coupon_offer")
        self.assertEqual(refs.roles_for("benefit", "출석 이벤트")[0], "participation_event")

    def test_editor_only_layouts_map_to_matching_roles(self):   # 구좌 편집 화면에만 있는 구좌 종류도 엉뚱한 스토리 사례로 몰리지 않는다
        self.assertEqual(refs.roles_for("notice", "유의사항"), ["terms_notice"])
        self.assertEqual(refs.roles_for("ev-ugc", "사진 인증")[0], "participation_event")
        self.assertEqual(refs.roles_for("ev-coupon", "쿠폰 받기")[0], "coupon_offer")
        self.assertEqual(refs.roles_for("feat", "대표 1 + 2열"), ["product_list"])
        for lay in ("story", "service", "detail", "timeline", "countdown", "ev-share", "ev-quiz", "ev-stamp", "ev-draw", "review"):
            self.assertTrue(all(r in rules.ROLE_NAME for r in refs.roles_for(lay, "x")), lay)

    def test_as_ref_shape(self):
        r = refs.search("선물", ["product_list"], k=1)[0]
        a = refs.as_ref(r, "이유")
        for k in ("id", "title", "campaign", "cat", "applicable", "layout", "reason", "summary", "role", "brand", "from", "url", "page", "images", "cap", "sx"):
            self.assertIn(k, a)
        self.assertLessEqual(len(a["summary"]), 83)
        self.assertLessEqual(len(a["sx"]["t"]), 120)
        self.assertEqual(a["sx"]["n"], len(r["text"]))

    def test_recommend_limits_and_shape(self):
        sec = {"layoutId": "grid2", "name": "티백 추천", "purpose": "전환"}
        out = refs.recommend(sec, doc(), 5)
        self.assertEqual(out["mode"], "ai")
        self.assertLessEqual(len(out["items"]), 5)
        for it in out["items"]:
            self.assertTrue(it["why"] and it["id"])

    def test_capture_info_miss_is_empty_and_cheap(self):
        self.assertEqual(refs.capture_info("no-such-page"), {})
        self.assertEqual(refs.capture_info(""), {})

    def test_hidden_pages_are_not_searched(self):
        hid = refs.hidden()
        for r in refs._state["rows"]:
            self.assertNotIn(r["page_id"], hid)


@unittest.skipUnless(READY, "레퍼런스 색인 없음")
class Compose(unittest.TestCase):
    def test_shape_and_consistency(self):
        out = compose.build(doc())
        self.assertEqual(out["mode"], "ai")
        ids = [c["id"] for c in out["candidates"]]
        self.assertEqual(ids[:2], ["A", "C"])
        a, c = out["candidates"][0], out["candidates"][1]
        self.assertTrue(len(a["secs"]) <= len(c["secs"]))
        ref_ids = {r["id"] for r in out["refs"]}
        for row in c["secs"]:
            self.assertGreaterEqual(len(row), 3)
            if len(row) > 3:
                src = row[3]
                self.assertIn(src["src"][0], out["pages"])   # 쓰인 페이지는 pages에 있다
                self.assertIn(src["refId"], ref_ids)

    def test_no_ref_roles_never_get_a_source(self):
        out = compose.build(doc("신규 가입 쿠폰", "신규 유입", ""))
        names = {rules.ROLE_NAME[r] for r in compose.NO_REF}
        for row in out["candidates"][1]["secs"]:
            if row[0] in names:
                self.assertEqual(len(row), 3, row)

    def test_basis_mentions_anchor_page(self):
        out = compose.build(doc())
        self.assertTrue(any("기준 페이지" in b for b in out["basis"]))

    def test_per_section_does_not_break(self):
        for n in (1, 2, 3):
            compose.build(doc(), n)

    def test_empty_doc(self):
        out = compose.build({})
        self.assertIn(out["type"]["id"], list(rules.TYPES) + ["generic"])
        self.assertTrue(out["candidates"][0]["secs"])

    def test_sections_have_valid_layouts(self):
        out = compose.build(doc())
        for c in out["candidates"]:
            for row in c["secs"]:
                self.assertIn(row[1], {"hero", "grid2", "grid3", "split", "benefit", "deal-banner", "text-cta"})


@unittest.skipUnless(READY, "레퍼런스 색인 없음")
class Library(unittest.TestCase):
    def test_items_shape(self):
        d = library.items()
        self.assertEqual(d["mode"], "ai")
        self.assertEqual(sum(d["counts"].values()), len(d["items"]))
        ids = [x["id"] for x in d["items"]]
        self.assertEqual(len(ids), len(set(ids)), "항목 id 중복")
        for x in d["items"]:
            self.assertIn(x["kind"], ("page", "sec", "event"))
            if x["kind"] != "page":
                self.assertIn("tl", x)
                self.assertTrue(x.get("page"))

    def test_kinds_filter(self):
        d = library.items(("event",))
        self.assertTrue(all(x["kind"] == "event" for x in d["items"]))


# ---- 추천 품질 지키기 (데이터가 바뀌거나 점수 식을 고쳐도 아래 '지켜야 할 성질'이 깨지면 바로 알린다) ----
def _brief(title, myeongbun="", purpose="", kw=(), cls=""):
    return {"id": "", "title": title, "brief": {"myeongbun": myeongbun, "purpose": purpose}, "v2": {"cls": cls, "seed": "", "keywords": list(kw)}}


@unittest.skipUnless(READY, "레퍼런스 색인 없음")
class Quality(unittest.TestCase):
    def test_brief_season_detection(self):
        for t, want in [("추석 선물세트", "가을"), ("벚꽃 한정판", "봄"), ("여름 냉침", "여름"), ("크리스마스 티", "겨울"), ("블랙프라이데이", "겨울"), ("그냥 티", "")]:
            self.assertEqual(refs.brief_season(_brief(t)), want, t)

    def test_season_mismatch_is_not_silent(self):
        # 계절이 맞는 사례가 없어 다른 계절 페이지를 기준으로 삼더라도 사용자에게 알린다
        out = compose.build(_brief("봄 벚꽃 한정판 티", "벚꽃", "전환·매출", ["벚꽃"], "season"))
        anchor = next((b for b in out["basis"] if b.startswith("기준 페이지")), "")
        if anchor:
            pid = next(iter(out["pages"]))
            ps = refs.page_season(pid)
            if ps and ps != "봄":
                self.assertTrue(any(b.startswith("주의: 기준 페이지는") for b in out["basis"]))

    def test_other_season_pages_are_minor_for_chuseok(self):
        # 계절이 다른 페이지가 한두 구좌 보충으로 들어가는 것은 허용(그 역할의 사례가 거기뿐일 수 있음)하되, 기준이 되거나 절반을 넘으면 안 된다
        out = compose.build(_brief("추석 선물세트", "추석", "선물 수요", ["선물"], "season"))
        winter = [pid for pid in out["pages"] if refs.page_season(pid) == "겨울"]
        self.assertLessEqual(len(winter), 1, [out["pages"][p]["name"] for p in winter])
        self.assertFalse(any(b.startswith("주의: 기준 페이지는") for b in out["basis"]))

    def test_own_mall_pages_appear_for_tea_briefs(self):
        # 자사몰 사례가 전체의 2%뿐이어도, 차 브리프 12개 중 대부분에서는 자사몰 사례가 최소 하나 들어가야 한다 (패션·화장품 일색 방지)
        briefs = [_brief("겨울 신제품 출시", "", "브랜드·신제품", ["신제품", "허브티"], "launch"), _brief("크리스마스 홀리데이 티", "크리스마스", "선물 수요", ["크리스마스", "선물"], "season"),
                  _brief("여름 냉침 아이스티", "여름", "전환·매출", ["냉침"], "season"), _brief("셰프 협업 티", "", "", ["셰프", "협업"], "collab"),
                  _brief("블랙프라이데이 세일", "블프", "전환·매출", ["블프", "세일"], "season"), _brief("출석체크 이벤트", "", "", ["출석"])]
        with_own = sum(1 for b in briefs if any(p["from"] == "자사몰" for p in compose.build(b)["pages"].values()))
        self.assertGreaterEqual(with_own, 5, "자사몰 사례가 거의 안 나와요 — 기준 페이지 점수(ANCHOR_AFFINITY)나 데이터를 확인하세요")


if __name__ == "__main__":
    unittest.main()

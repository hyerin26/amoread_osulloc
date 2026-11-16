# -*- coding: utf-8 -*-
"""오늘의 영감: 글 분류 규칙, 덱 구성(안 본 것만·고르게), 저장/넘기기/되돌리기, 취향 반영. 임시 폴더만 쓴다(사용자 데이터 그대로)."""
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from amoread.ai import api, inspire

# 이 파일의 덱 테스트는 페이지 카드만 본다. 트렌드 카드(이 PC의 주간 결과를 읽음)는 tests/test_trend.py 에서 따로 본다
_no_trend = mock.patch.object(inspire, "trend_cards", lambda: [])


def setUpModule():
    _no_trend.start()


def tearDownModule():
    _no_trend.stop()


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

    def test_menu_labels_are_not_evidence(self):
        """메뉴·탭 이름에서만 걸린 기법은 버린다 (2026-11-14: 탭 이름 '라이브 특가' 때문에 '라이브' 카드가 나왔는데 화면에는 근거가 없었음)."""
        nav = "겨울 방한템 모아보기 베스트 천원의 행복 크리에이터 PICK 에블린 릴레이 세일 라이브 특가 다다익선 직잭단독 최저가 카테고리 특가"
        self.assertNotIn("라이브", inspire.mechanics(nav))
        real = nav + " 11월 12일 19시 라이브 방송에서만 최대 30% 쿠폰을 드려요."
        hit = next(h for h in inspire.mech_hits(real) if h["name"] == "라이브")
        self.assertIn("방송에서만", hit["snip"], "같은 낱말이 메뉴에도 있으면 설명하는 문장 쪽을 써요")

    def test_product_labels_are_not_the_page_mechanic(self):
        """상품 이름의 딱지·상품 목록 줄·유의사항에서 걸린 낱말은 그 페이지의 기획이 아니다 (2026-11-14 담당자 지적: 상품 목록이 '사전예약'·'골라담기' 카드로 나옴)."""
        rows = ("에이햅스 [프리오더] 포피 플리스 오브 팬츠 15% 56,430 223 포근한 타월 테리 점프수트 얇은 스모킹사로 한 줄 한 줄 잡았어요. "
                "니코트 르블랑 파스타볼 세트 2P MADE IN JAPAN 37% 18,040 1,431 니코트 [1+1] 니코트 르블랑 달항아리 둥근 면기 MADE IN JAPAN 38% 21,000 "
                "[퓨리나] 팬시피스트 주식용 습식캔 9종 골라담기 (택5) 엄선된 원료를 담은 습식캔이에요. 사은품은 한정 수량으로 재고 소진 시 종료될 수 있습니다.")
        self.assertEqual([m for m in inspire.mechanics(rows) if m not in inspire.COMMON], [])
        real = rows + " 시즌 한정 티를 11월 20일까지 사전 예약으로 먼저 만나 보세요."
        hit = next(h for h in inspire.mech_hits(real) if h["name"] == "얼리버드·사전예약")
        self.assertIn("먼저 만나", hit["snip"], "같은 페이지에 기획을 설명하는 문장이 있으면 그쪽을 써요")

    def test_comment_says_why_and_what_to_try(self):
        c = {"kind": "mech", "hits": [{"name": "구매금액별 혜택", "hit": "3만원 이상 구매", "snip": "3만원 이상 구매 시 최대 5천원 할인"}], "signals": [{"t": "오설록 페이지에는 아직 없는 방식", "good": True}]}
        n = inspire.comment(c, {"txt": "온라인 2026.11.01 ~ 2026.11.28 3만원 이상 구매 시 최대 5천원 할인 3장"})
        self.assertIn("아직 안 써 본", n["why"]); self.assertIn("3만원 이상", n["why"])
        self.assertEqual(inspire.facts("오푸스 그라인더 29% 280,000"), [], "할인율·가격은 조건이 아니에요")
        self.assertEqual(inspire.facts("20만원 이상 구매 고객 중 추첨 10분 증정"), ["20만원 이상", "10명"])
        self.assertTrue(n["do"])
        self.assertNotIn("2026", " ".join(n["facts"]), "날짜는 조건 숫자가 아니에요")
        own = inspire.comment(dict(c, signals=[{"t": "오설록도 써 본 방식", "good": False}]), None)
        self.assertIn("써 본 방식", own["why"])
        self.assertIn("맞세워", inspire.comment({"kind": "copy", "phrases": ["뿌리는 향에서 바르는 향으로"]})["why"])

    def test_every_real_mechanic_has_a_try_line(self):
        self.assertEqual(set(inspire.MECH) - inspire.COMMON, set(inspire.MECH_TRY), "MECH에 기법을 더하면 MECH_TRY에 '오설록이라면' 한 줄도 넣어 주세요")

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

    def test_market_template_structure_is_not_an_insight(self):
        mk = lambda i, brand: dict(self.mk(i, brand, "x"), kind="struct", kinds=["struct"], mech=[], hits=[], struct="혜택·이벤트를 3단계로 나눈 구성", steps=["a", "b", "c"], phrases=["포근하고 세련된 분위기를 담았어요"])
        out = inspire._drop_templates([mk(i, "29CM") for i in range(inspire.TEMPLATE_MIN)] + [mk(99, "컬리")])
        self.assertEqual([c["id"] for c in out if c["kind"] == "struct"], ["t99"], "기획전마다 같은 틀이면 구조 카드로 내지 않아요")
        self.assertTrue(all(c["kind"] == "copy" and not c["struct"] for c in out if c["brand"] == "29CM"))

    def test_one_card_per_mechanic_and_per_page_in_a_deck(self):
        cands = [self.mk(i, f"B{i % 5}", f"hit{i}") for i in range(10)] + [dict(self.mk(50 + i, "C", f"q{i}", "미니게임·뽑기"), url="https://same.test/p") for i in range(3)]
        with tempfile.TemporaryDirectory() as t, mock.patch.object(inspire, "DIR", Path(t)), mock.patch.object(inspire, "candidates", return_value=inspire._enrich(cands)), \
                mock.patch.object(inspire, "evidence", return_value=("ok", {"y": 1, "h": 2, "txt": ""})):
            names = [c["hits"][0]["name"] for c in inspire.deck()["cards"]]
        self.assertEqual(sorted(names), sorted(set(names)))


class Deck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cands = [cand(i, "mech", "A") for i in range(20)] + [cand(100 + i, "copy", "B") for i in range(20)] + [cand(200 + i, "design", "C", src="lib") for i in range(20)]
        # 이 묶음은 덱 구성 규칙을 본다: 근거 확인은 통과한 것으로 둔다 (근거 확인 자체는 Evidence 묶음에서)
        self.ps = [mock.patch.object(inspire, "DIR", Path(self.tmp.name)), mock.patch.object(inspire, "candidates", return_value=cands), mock.patch.object(inspire, "_favorite"),
                   mock.patch.object(inspire, "evidence", return_value=("ok", {"y": 1, "h": 2, "txt": ""}))]
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

    def test_blank_part_of_the_picture_gets_no_mark(self):
        """사진에서 비어 있는 자리(스크롤해도 안 그려진 구역)에는 표시를 붙이지 않는다 (2026-11-14: 흰 칸에 노란 표시만 떴음)."""
        import json
        c = {"id": "d0123456789ab", "src": "new"}
        d = Path(self.tmp.name) / "capture" / c["id"]; d.mkdir(parents=True)
        for n in range(3):
            (d / f"shot_{n}.jpg").write_bytes(b"x")
        meta = {"h": 2532, "v": 1, "tiles": [{"n": 0, "y": 0, "h": 844, "bytes": 60000}, {"n": 1, "y": 844, "h": 844, "bytes": 3000}, {"n": 2, "y": 1688, "h": 844, "bytes": 50000}]}
        for y, want in ((900, None), (1800, {"y": 1800, "h": 40})):
            (d / "meta.json").write_text(json.dumps({**meta, "spots": {c["id"]: {"y": y, "h": 40}}}), encoding="utf-8")
            info = inspire.shot_info(c)
            self.assertEqual(info["spot"], want)
            self.assertEqual([t["y"] for t in info["tiles"]], [0, 844, 1688])
        self.assertTrue(inspire.shot_file(c["id"], 2)); self.assertIsNone(inspire.shot_file(c["id"], 9)); self.assertIsNone(inspire.shot_file(c["id"], 99))

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


class Evidence(unittest.TestCase):
    """원칙: 카드가 말하는 글이, 표시한 자리의 실제 화면 글 안에 들어 있을 때만 카드로 낸다 (2026-11-14).
    빈 화면에 표시 / 메뉴 낱말을 기법으로 / 분류가 바뀐 뒤 남은 옛 표시 / 엉뚱한 자리 — 전부 이 검사에서 걸려야 한다."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.object(inspire, "DIR", Path(self.tmp.name)); self.p.start()
        self.c = {"id": "d0123456789ab", "src": "new", "brand": "A", "url": "https://x.test/1", "title": "t", "text": "", "first_seen": "2026-11-13", "score": 60, "low": False, "own": False,
                  "kind": "mech", "kinds": ["mech"], "mech": ["출석·스탬프"], "hits": [{"name": "출석·스탬프", "hit": "스탬프", "snip": "스탬프 4개를 모으면 적립금을 드려요", "near": "스탬프 4개를"}],
                  "phrases": [], "steps": [], "struct": "", "desc": "", "why": "", "focus": "스탬프 4개를 모으면 적립금을 드려요", "focus_alt": ["스탬프 4개를"]}

    def tearDown(self):
        self.p.stop(); self.tmp.cleanup()

    def put(self, c, spot, tried=True, tiles=None, old=False):
        import json
        d = Path(self.tmp.name) / "capture" / inspire.shot_id(c); d.mkdir(parents=True, exist_ok=True)
        (d / ("shot.jpg" if old else "shot_0.jpg")).write_bytes(b"x")
        meta = {"h": 844, "v": 1, "spots": {c["id"]: spot} if spot else {}, "tried": {c["id"]: inspire.sig(c)} if tried else {}}
        if not old:
            meta["tiles"] = tiles or [{"n": 0, "y": 0, "h": 844, "bytes": 60000}]
        (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")

    def test_ok_when_the_marked_place_really_says_it(self):
        self.put(self.c, {"y": 100, "h": 40, "txt": "스탬프 챌린지를 완수하면 응모권을 드려요"})
        st, spot = inspire.evidence(self.c)
        self.assertEqual(st, "ok"); self.assertEqual(spot["y"], 100)

    def test_no_picture_or_old_picture_is_pending(self):
        self.assertEqual(inspire.evidence(self.c)[0], "pending")
        self.put(self.c, {"y": 1, "h": 2, "txt": "스탬프"}, old=True)
        self.assertEqual(inspire.evidence(self.c)[0], "pending")

    def test_marked_place_says_something_else_is_rejected(self):   # 엉뚱한 자리
        self.put(self.c, {"y": 100, "h": 40, "txt": "BENEFIT 1 단독 선발매 상품"})
        self.assertEqual(inspire.evidence(self.c), ("rejected", None))

    def test_whole_block_is_not_a_place_to_point_at(self):   # 상품 목록 통째로 표시
        self.put(self.c, {"y": 100, "h": inspire.SPOT_MAX_H + 200, "txt": "포피 플리스 오브 팬츠 가볍지만 따뜻해요 … 스탬프 …"})
        self.assertEqual(inspire.evidence(self.c), ("rejected", None))

    def test_nothing_found_on_screen_is_rejected(self):   # 메뉴에서만 걸렸거나 숨은 글
        self.put(self.c, None)
        self.assertEqual(inspire.evidence(self.c)[0], "rejected")

    def test_blank_part_of_the_picture_is_rejected(self):   # 빈 화면에 표시
        self.put(self.c, {"y": 900, "h": 40, "txt": "스탬프"}, tiles=[{"n": 0, "y": 0, "h": 844, "bytes": 60000}, {"n": 1, "y": 844, "h": 844, "bytes": 2000}])
        self.assertEqual(inspire.evidence(self.c)[0], "rejected")

    def test_stale_mark_after_the_card_changed_is_not_reused(self):   # 분류가 바뀐 뒤 남은 옛 표시
        self.put(self.c, {"y": 100, "h": 40, "txt": "단독 선발매 상품"})
        copy = dict(self.c, kind="copy", kinds=["copy"], hits=[], phrases=["여유로운 루즈핏으로 감각적인 레이어드 스타일을 연출할 수 있어요"], focus="여유로운 루즈핏으로 감각적인 레이어드 스타일을 연출할 수 있어요", focus_alt=[])
        self.assertEqual(inspire.evidence(copy)[0], "pending", "찾을 글이 달라졌으면 옛 확인 결과를 쓰지 않고 다시 확인해요")

    def test_deck_shows_only_verified_cards_and_counts_the_rest(self):
        good, bad, wait = self.c, dict(self.c, id="d1111111111aa", url="https://x.test/2"), dict(self.c, id="d2222222222bb", url="https://x.test/3")
        self.put(good, {"y": 100, "h": 40, "txt": "스탬프를 모으면 드려요"})
        self.put(bad, {"y": 100, "h": 40, "txt": "전혀 다른 글"})
        with mock.patch.object(inspire, "candidates", return_value=inspire._enrich([good, bad, wait])):
            d = inspire.deck()
            self.assertEqual([x["id"] for x in d["cards"]], [good["id"]])
            self.assertEqual(d["pending"], 1)
            self.assertEqual([x["id"] for x in inspire.to_verify(12)], [wait["id"]], "확인할 차례는 아직 안 본 후보뿐 (떨어진 것을 되풀이해 받지 않아요)")
            self.assertEqual(d["cards"][0]["spot"]["txt"], "스탬프를 모으면 드려요")


class RealData(unittest.TestCase):
    def test_real_candidates_have_what_the_screen_needs(self):
        with tempfile.TemporaryDirectory() as t, mock.patch.object(inspire, "DIR", Path(t)), mock.patch.object(inspire, "evidence", return_value=("ok", {"y": 1, "h": 2, "txt": ""})):
            d = inspire.deck()
        self.assertEqual(len(d["cards"]), inspire.DECK)
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

# -*- coding: utf-8 -*-
"""
레퍼런스 구좌 유형 분류 + 구좌 템플릿 정의

  python -m amoread.ai.section_templates [--out section_templates.json] [--md plans/26_구좌_템플릿_정의.md]

1. 손으로 뽑아 둔 와이어프레임(planner/data/wireframes/wireframes.json)의 구좌를 설명 문구·역할로 유형(type)에 나눈다 (classify).
2. 유형마다 '템플릿 정의'(칸 slots · 켜고 끌 옵션 options · 기존 구좌 종류와의 관계)를 붙이고, 레퍼런스에서 센 근거(건수·페이지 수·구성요소 등장률·열 수)와
   구조를 그려 볼 예시({site, sec})를 채워 section_templates.json 으로 쓴다.

템플릿 정의(TEMPLATES)는 사람이 정한 값이고, 근거 숫자와 예시는 와이어프레임 파일을 다시 돌리면 갱신된다.
status: new = 지금 구좌 종류에 없음 · extend = 있는 구좌 종류에 옵션을 더함 · existing = 이미 있음(대응만 적어 둠)
slots[].kind: text · image · card · button · chips · group · toggle · media   (repeat = [최소, 최대] 반복 칸 수)
options[].type: toggle · select · multi · number · text
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WIRE = ROOT / "planner" / "data" / "wireframes" / "wireframes.json"
OUT = ROOT / "planner" / "data" / "wireframes" / "section_templates.json"
MD = ROOT.parents[1] / "plans" / "26_구좌_템플릿_정의.md"

# ---------------------------------------------------------------- 1. 분류 (설명 문구 + 역할)
# 위에서부터 처음 맞는 규칙. skip = 푸터·헤더
RULES = [
    ("hero", r"히어로|키비주얼|풀블리드|인트로|캠페인 타이틀|프로모션 제목"),
    ("notice", r"^(이벤트 )?유의사항|꼭 읽어|통이미지 하단: 유의사항"),
    ("share_bar", r"공유 아이콘|공유 \+|하단 고정"),
    ("app_banner", r"앱 열기|앱 유도"),
    ("countdown_bar", r"^종료 카운트다운"),
    ("nav_tabs", r"탭바|내비|칩 3개\(큼|이동 카드|메인 이동"),
    ("deal", r"카운트다운.*상품|마감 세일|메가블랙딜|하루특가|날짜 탭|브랜드데이|카테고리데이|릴레이|라이브"),
    ("product_grid", r"랭킹|TOP 100|탭 \d개.*그리드|칩.*그리드|카테고리 칩|카테고리:|칩 가로 스크롤|그리드"),
    ("product_slider", r"슬라이드|스택 가로"),
    ("promo_cards", r"기획전 카드|콘텐츠 카드|프로모션 카드|YOU MAY|연관 이벤트|그룹사|지도 배너"),
    ("coupon", r"쿠폰|티켓"),
    ("benefit_tiles", r"타일|혜택 한눈|요약"),
    ("benefit_cards", r"결제 혜택|카드사|포인트 카드|웰컴|포인트 2종|리워드|단계별|일정보기"),
    ("mission_list", r"리스트|미션|아이콘 메뉴"),
    ("participation", r"게임|응모|포인트팟|래플|체험단"),
    ("lookbook", r"룩북|장문 카피"),
    ("brand_story", r"스토리|소개|라인업|MASTER"),
    ("image_banner", r"프로모션 이미지|프로모션 안내 이미지|통이미지|롱 프로모션|컬렉션 이미지|이미지 2|포인트 배너"),
]


def classify(label: str, role: str) -> str:
    if role == "ui_noise" or re.search(r"^(푸터|헤더)$|푸터", label or ""):
        return "skip"
    for tid, rx in RULES:
        if re.search(rx, label or ""):
            return tid
    return "other"


# ---------------------------------------------------------------- 2. 템플릿 정의 (사람이 정한 값)
def S(id, name, kind, required=False, repeat=None, note=""):
    d = {"id": id, "name": name, "kind": kind, "required": required}
    if repeat:
        d["repeat"] = list(repeat)
    if note:
        d["note"] = note
    return d


def O(id, label, type, default, choices=None, note=""):
    d = {"id": id, "label": label, "type": type, "default": default}
    if choices:
        d["choices"] = choices
    if note:
        d["note"] = note
    return d


CARD_PARTS = ["이미지", "브랜드", "상품명", "할인율", "가격", "배지", "담기 버튼"]

TEMPLATES = [
    # ---- 상품
    {"id": "product-slider", "type": "product_slider", "name": "상품 가로 슬라이드", "status": "new", "existing_layout": None, "roles": ["product_list", "sale_offer"],
     "summary": "상품 카드가 옆으로 넘어가는 한 줄(또는 두 줄) 목록. 칩 필터와 더보기를 붙일 수 있다.",
     "slots": [S("title", "구좌 제목", "text", True), S("sub", "보조 문구", "text"), S("chips", "칩 필터", "chips", repeat=(3, 6), note="누르면 아래 카드가 바뀜"),
               S("card", "상품 카드", "card", True, (3, 12), "카드 모양은 기존 '카드 모양'(이미지·브랜드·상품명·할인율·가격·배지·버튼) 설정을 그대로 쓴다"),
               S("more", "더보기 버튼", "button"), S("note", "안내 한 줄", "text", note="예: 마일리지 페이백 10%")],
     "options": [O("rows", "줄 수", "select", 1, [1, 2]), O("cols_visible", "화면에 보이는 카드 수", "select", 3, [2, 3]), O("peek", "다음 카드 살짝 보이기", "toggle", True),
                 O("card_parts", "카드에 보이는 것", "multi", ["이미지", "브랜드", "상품명", "할인율", "가격"], CARD_PARTS), O("rank_badge", "순위 배지", "toggle", False),
                 O("chips_on", "칩 필터", "toggle", False), O("more_on", "더보기 버튼", "toggle", False), O("progress", "스크롤 진행 막대", "toggle", True)]},
    {"id": "product-grid", "type": "product_grid", "name": "상품 그리드 (옵션 추가)", "status": "extend", "existing_layout": ["grid2", "grid3", "feat"], "roles": ["product_list"],
     "summary": "지금의 2열·3열 상품 구좌. 레퍼런스에서 자주 보이는 '순위 배지', '더보기', '머리글'을 옵션으로 더한다.",
     "slots": [S("title", "구좌 제목", "text", True), S("sub", "보조 문구", "text"), S("tabs", "탭·칩 필터", "chips", repeat=(2, 6)), S("card", "상품 카드", "card", True, (2, 24)), S("more", "더보기 버튼", "button")],
     "options": [O("rank_badge", "순위 배지 (1, 2, 3…)", "toggle", False, note="랭킹 구좌에서 사용"), O("more_on", "더보기 버튼", "toggle", False), O("sub_on", "보조 문구", "toggle", False),
                 O("rows", "보여 줄 줄 수", "number", 2, note="원본 목록은 수백 개라도 앞 2~3줄만 보여 주는 경우가 대부분")]},
    {"id": "deal", "type": "deal", "name": "딜 (카운트다운·날짜 탭) + 상품", "status": "extend", "existing_layout": ["deal-banner", "countdown"], "roles": ["sale_offer", "product_list"],
     "summary": "시간·날짜로 열리는 특가 구좌. 카운트다운, 날짜 탭, 알림 신청, 상품 목록(슬라이드 또는 그리드)이 한 묶음이다.",
     "slots": [S("title", "구좌 제목", "text", True), S("sub", "보조 문구", "text"), S("countdown", "카운트다운 (시:분:초)", "group", note="종료·시작까지 남은 시간"), S("date_tabs", "날짜 탭", "chips", repeat=(2, 7)),
               S("alarm", "알림 신청", "toggle"), S("info4", "안내 4칸 (시작·종료·참여 방법·TIP)", "group"), S("products", "상품 목록", "card", True, (3, 12))],
     "options": [O("countdown_on", "카운트다운", "toggle", True), O("date_tabs_on", "날짜 탭", "toggle", False), O("alarm_on", "알림 신청 스위치", "toggle", False), O("info4_on", "안내 4칸", "toggle", False),
                 O("products_shape", "상품 모양", "select", "slider", ["slider", "grid"], "slider=가로 슬라이드, grid=그리드"), O("badge_only_today", "'ONLY TODAY' 배지", "toggle", False)]},
    # ---- 혜택·쿠폰·참여
    {"id": "coupon", "type": "coupon", "name": "쿠폰 카드 (옵션 추가)", "status": "extend", "existing_layout": ["ev-coupon"], "roles": ["coupon_offer"],
     "summary": "쿠폰 금액·조건·받기 버튼이 있는 카드 묶음. 알림 신청, 안내 4칸, 전체 받기를 옵션으로 더한다.",
     "slots": [S("title", "구좌 제목", "text", True), S("info4", "안내 4칸", "group"), S("coupon", "쿠폰 카드 (금액/비율 + 쿠폰명 + 기간 + 받기 버튼)", "card", True, (1, 6)),
               S("claim_all", "전체 받기 버튼", "button"), S("alarm", "알림 신청", "toggle"), S("notice_link", "유의사항 링크", "text")],
     "options": [O("cols", "카드 줄 모양", "select", 1, [1, 2], "1=한 줄에 하나"), O("claim_all_on", "전체 받기 버튼", "toggle", False), O("alarm_on", "알림 신청", "toggle", False),
                 O("info4_on", "안내 4칸", "toggle", False), O("limit_badge", "'선착순 N장' 배지", "toggle", False)]},
    {"id": "benefit-tiles", "type": "benefit_tiles", "name": "혜택 타일", "status": "new", "existing_layout": None, "roles": ["benefit_overview"],
     "summary": "혜택 수치(~50%, 1만P)와 라벨을 작은 타일로 모아 한눈에 보여 준다.",
     "slots": [S("title", "구좌 제목", "text", True), S("tile", "타일 (수치 + 라벨)", "card", True, (4, 8)), S("note", "안내 문구", "text")],
     "options": [O("cols", "한 줄 타일 수", "select", 4, [2, 3, 4]), O("tile_link", "타일을 누르면 해당 구좌로 이동", "toggle", False), O("emphasis", "수치 강조", "toggle", True)]},
    {"id": "benefit-cards", "type": "benefit_cards", "name": "혜택 카드 리스트", "status": "new", "existing_layout": ["benefit"], "roles": ["benefit_overview", "sale_offer", "partner_benefit"],
     "summary": "카드사·포인트·리워드처럼 혜택을 한 줄 카드로 쌓는다. 단계형(1→2→3)으로도 쓴다.",
     "slots": [S("title", "구좌 제목", "text", True), S("card", "혜택 카드 (아이콘·로고 + 혜택명 + 조건)", "card", True, (2, 6)), S("button", "카드별 버튼 (받기·혜택받기)", "button"), S("alarm", "알림 신청", "toggle")],
     "options": [O("style", "모양", "select", "list", ["list", "steps"], "list=목록, steps=단계형"), O("numbering", "번호 표시", "toggle", False), O("button_on", "카드별 버튼", "toggle", False),
                 O("logo_on", "로고·아이콘", "toggle", True)]},
    {"id": "mission-list", "type": "mission_list", "name": "참여 리스트", "status": "new", "existing_layout": None, "roles": ["participation_event"],
     "summary": "아이콘 + 제목 + 보상 문구 + 참여 버튼이 한 줄인 리스트. 미션·참여 혜택 모음에 쓴다.",
     "slots": [S("title", "구좌 제목", "text", True), S("more", "더보기 링크", "text"), S("row", "리스트 행 (아이콘 + 제목 + 보상 + 버튼)", "card", True, (2, 8))],
     "options": [O("button_label", "버튼 문구", "text", "참여하기"), O("reward_on", "보상 문구", "toggle", True), O("progress_on", "진행 상태 (n/m)", "toggle", False)]},
    {"id": "participation", "type": "participation", "name": "응모·게임·래플 (옵션 추가)", "status": "extend", "existing_layout": ["ev-draw", "ev-quiz", "ev-stamp", "ev-ugc", "ev-share"], "roles": ["participation_event"],
     "summary": "지금의 이벤트 구좌 종류. 경품 표·참여 방법·당첨자 발표를 한 묶음(HOW TO)으로 옵션에 더한다.",
     "slots": [S("title", "구좌 제목", "text", True), S("visual", "대표 이미지", "image"), S("cta", "응모·참여 버튼", "button", True), S("prize", "경품 표 (1등~4등)", "group"), S("how", "참여 방법", "group"), S("winner", "당첨자 발표 일정", "text")],
     "options": [O("prize_on", "경품 표", "toggle", False), O("how_on", "참여 방법 단계", "toggle", False), O("winner_on", "당첨자 발표", "toggle", False), O("consent_on", "수신 동의 문구", "toggle", False)]},
    # ---- 이야기·이미지
    {"id": "hero", "type": "hero", "name": "히어로 (옵션 추가)", "status": "extend", "existing_layout": ["hero"], "roles": ["hero"],
     "summary": "지금의 메인 비주얼. 제목 겹치기, 기간 표기, 버튼, 통이미지 여부를 옵션으로 더한다.",
     "slots": [S("image", "키비주얼 이미지", "image", True), S("title", "제목 (이미지 위)", "text"), S("period", "기간", "text"), S("cta", "버튼", "button")],
     "options": [O("overlay_title", "이미지 위 제목", "toggle", True), O("period_on", "기간 표기", "toggle", False), O("cta_on", "버튼", "toggle", False), O("fullbleed", "화면 폭에 꽉 채우기", "toggle", True),
                 O("image_text", "이미지 안에 글자 포함(통이미지)", "toggle", False, note="이미지 안 글자는 디자이너가 만들어 넣음")]},
    {"id": "brand-story", "type": "brand_story", "name": "브랜드 스토리 (옵션 추가)", "status": "extend", "existing_layout": ["story"], "roles": ["brand_story", "editorial_story", "brand_intro"],
     "summary": "이미지 + 제목 + 본문 단락 + 버튼. 어두운 배경, 버튼 개수, 이미지 위치를 옵션으로 더한다.",
     "slots": [S("image", "이미지", "image"), S("kicker", "소제목", "text"), S("title", "제목", "text", True), S("body", "본문 단락", "text", True, (1, 4)), S("cta", "버튼", "button", repeat=(0, 2))],
     "options": [O("dark", "어두운 배경", "toggle", False), O("cta_count", "버튼 수", "select", 1, [0, 1, 2]), O("image_pos", "이미지 위치", "select", "top", ["top", "bg"], "top=위, bg=배경")]},
    {"id": "lookbook", "type": "lookbook", "name": "룩북·장문 스토리", "status": "new", "existing_layout": None, "roles": ["editorial_story", "lookbook"],
     "summary": "소제목·제목·장문 소개 아래에 롱 이미지가 이어지고, 이미지 위에 번호 캡션(STYLING·DETAIL·COLOR)이 놓인다.",
     "slots": [S("kicker", "소제목", "text"), S("title", "제목", "text", True), S("intro", "장문 소개", "text", True), S("video", "영상", "media"), S("long_image", "롱 이미지", "image", True),
               S("caption", "번호 캡션 (NO.1 제목 + 설명)", "card", repeat=(2, 4))],
     "options": [O("numbered", "번호 캡션", "toggle", True), O("video_on", "영상", "toggle", False), O("caption_align", "캡션 위치", "select", "left", ["left", "right"]), O("brand_tag", "브랜드 표기", "toggle", False)]},
    {"id": "image-banner", "type": "image_banner", "name": "통이미지·배너", "status": "new", "existing_layout": None, "roles": ["brand_story", "benefit_overview", "related_promotions"],
     "summary": "이미지 한 장(또는 여러 장)이 구좌의 전부인 구좌. 글은 이미지 안에 들어가 있다.",
     "slots": [S("image", "이미지 (글자 포함)", "image", True, (1, 4)), S("link", "연결 주소", "text"), S("alt", "대체 문구 (이미지 설명)", "text", True, note="이미지 속 글자를 글로도 적어 둠")],
     "options": [O("count", "이미지 수", "number", 1), O("fullbleed", "화면 폭에 꽉 채우기", "toggle", True), O("link_on", "누르면 이동", "toggle", False)]},
    {"id": "promo-cards", "type": "promo_cards", "name": "기획전·콘텐츠 카드", "status": "new", "existing_layout": None, "roles": ["related_promotions", "editorial_story"],
     "summary": "다른 기획전·콘텐츠로 보내는 이미지 카드 묶음 (2열 2×2 등).",
     "slots": [S("title", "구좌 제목", "text", True), S("tabs", "탭", "chips", repeat=(2, 4)), S("card", "카드 (이미지 + 배지 + 제목 + 설명)", "card", True, (2, 8)), S("more", "더보기", "button")],
     "options": [O("cols", "열 수", "select", 2, [1, 2]), O("ratio", "이미지 비율", "select", "3:4", ["1:1", "3:4", "16:9"]), O("badge_on", "배지 (진행 중·Special)", "toggle", False), O("desc_on", "설명 문구", "toggle", True),
                 O("tabs_on", "탭", "toggle", False)]},
    # ---- 내비·보조
    {"id": "nav-tabs", "type": "nav_tabs", "name": "앵커·탭 내비", "status": "new", "existing_layout": None, "roles": ["section_navigation"],
     "summary": "페이지 안 다른 구좌로 이동하는 탭 줄. 가로로 넘기거나 상단에 고정한다.",
     "slots": [S("tab", "탭 이름", "chips", True, (3, 7)), S("target", "이동할 구좌", "group", note="탭마다 이동할 구좌를 연결")],
     "options": [O("sticky", "상단 고정", "toggle", True), O("scroll", "가로 스크롤", "toggle", False), O("style", "모양", "select", "chip", ["chip", "underline", "box"])]},
    {"id": "share-bar", "type": "share_bar", "name": "공유·고정 CTA 바", "status": "new", "existing_layout": None, "roles": ["share"],
     "summary": "하단에 고정된 버튼 바(친구 초대·공유·찜·기간).",
     "slots": [S("cta", "주 버튼", "button", True), S("icons", "공유 아이콘", "group", repeat=(1, 6)), S("period", "기간", "text"), S("like", "찜", "toggle")],
     "options": [O("fixed", "하단 고정", "toggle", True), O("like_on", "찜 버튼", "toggle", False), O("period_on", "기간 표기", "toggle", False)]},
    {"id": "app-banner", "type": "app_banner", "name": "앱 설치 유도 배너", "status": "new", "existing_layout": None, "roles": ["app_promo"],
     "summary": "상단 한 줄 배너: 앱 아이콘 + 혜택 문구 + 앱 열기 버튼.",
     "slots": [S("message", "문구", "text", True), S("button", "앱 열기 버튼", "button", True), S("icon", "앱 아이콘", "image")],
     "options": [O("sticky", "상단 고정", "toggle", True), O("closable", "닫기 버튼", "toggle", True)]},
    {"id": "notice", "type": "notice", "name": "유의사항 (옵션 추가)", "status": "extend", "existing_layout": ["notice"], "roles": ["terms_notice"],
     "summary": "지금의 유의사항. 접고 펼치는 아코디언, 이미지형을 옵션으로 더한다.",
     "slots": [S("title", "제목", "text", True), S("item", "항목", "text", True, (3, 12))],
     "options": [O("accordion", "접고 펼치기", "toggle", True), O("as_image", "이미지로 대체", "toggle", False)]},
]


# ---------------------------------------------------------------- 3. 근거 숫자·예시
KINDS = ["image", "title", "body", "caption", "name", "brand", "price", "discount", "badge", "button", "box"]
KIND_KO = {"image": "이미지", "title": "제목", "body": "본문", "caption": "작은 글씨", "name": "상품명", "brand": "브랜드", "price": "가격", "discount": "할인율", "badge": "배지", "button": "버튼", "box": "상자"}


def evidence() -> dict:
    d = json.loads(WIRE.read_text(encoding="utf-8"))
    groups: dict[str, list] = {}
    for site in d["sites"]:
        for sec in site["sections"]:
            groups.setdefault(classify(sec["label"], sec["role"]), []).append((site, sec))
    ev = {}
    for tid, v in groups.items():
        if tid == "skip":
            continue
        rate = {k: round(sum(1 for _, s in v if s["kinds"].get(k)) / len(v), 2) for k in KINDS}
        ex = sorted(v, key=lambda x: -len(x[1]["elements"]))[:3]
        ev[tid] = {"count": len(v), "pages": len({s["id"] for s, _ in v}), "components": {k: r for k, r in rate.items() if r >= 0.3},
                   "cols": dict(Counter(s["cols"] for _, s in v if s["cols"])), "carousel": sum(1 for _, s in v if s["carousel"]), "fullbleed": sum(1 for _, s in v if s["fullbleed"]),
                   "examples": [{"site": a["id"], "sec": s["i"], "title": a["title"], "label": s["label"], "role": s["role"]} for a, s in ex]}
    return ev


def build() -> dict:
    ev = evidence()
    out, used = [], set()
    for t in TEMPLATES:
        e = ev.get(t["type"], {})
        used.add(t["type"])
        out.append({**t, "evidence": e, "wire": (e.get("examples") or [None])[0] and {"site": e["examples"][0]["site"], "sec": e["examples"][0]["sec"]}})
    other = {k: v for k, v in ev.items() if k not in used}
    pages = sum(1 for x in json.loads(WIRE.read_text(encoding="utf-8"))["sites"] if x["sections"])
    return {"version": 1, "source": "wireframes.json", "pages": pages, "total_sections": sum(v["count"] for v in ev.values()), "templates": out, "unassigned": other}


def markdown(d: dict) -> str:
    st = {"new": "신규", "extend": "옵션 추가", "existing": "기존"}
    L = ["# 26. 레퍼런스 구좌 유형 분류와 구좌 템플릿 정의", "",
         "레퍼런스를 와이어프레임으로 바로 가져오는 대신, **레퍼런스의 구좌를 유형으로 분류하고 템플릿으로 정의해 구좌 옵션을 늘리는** 방향의 기초 자료다.",
         f"근거는 손으로 뽑아 둔 와이어프레임 {d['pages']}개 페이지의 구좌 {d['total_sections']}개(푸터·헤더 제외)이다.",
         "정의·근거는 `workspace/amoread_app/planner/data/wireframes/section_templates.json`에 있고, `python -m amoread.ai.section_templates`로 다시 만든다.", "",
         "분류는 구좌 설명 문구와 역할로 나눈 **1차 분류**라서 일부 구좌는 어긋날 수 있다.", "", "## 1. 요약", "",
         "| 템플릿 | 상태 | 레퍼런스 구좌 수 | 페이지 수 | 지금 구좌 종류 |", "|---|---|---|---|---|"]
    for t in d["templates"]:
        e = t["evidence"]
        L.append(f"| {t['name']} | {st[t['status']]} | {e.get('count', 0)} | {e.get('pages', 0)} | {', '.join(t['existing_layout']) if t['existing_layout'] else '없음'} |")
    for t in d["templates"]:
        e = t["evidence"]
        L += ["", f"## {t['name']}  (`{t['id']}`, {st[t['status']]})", "", t["summary"], ""]
        if e:
            comp = ", ".join(f"{KIND_KO[k]} {int(v * 100)}%" for k, v in e["components"].items())
            L.append(f"- 근거: {e['count']}개 구좌 / {e['pages']}개 페이지" + (f" · 슬라이드 {e['carousel']}개" if e["carousel"] else "") + (f" · 통이미지 {e['fullbleed']}개" if e["fullbleed"] else "")
                     + (f" · 열 수 {e['cols']}" if e["cols"] else ""))
            if comp:
                L.append(f"- 구성요소 등장률: {comp}")
            L.append("- 예시: " + " / ".join(f"{x['title'][:14]} · {x['label'][:30]}" for x in e["examples"]))
        L += ["", "**칸 (slots)**", "", "| 칸 | 종류 | 필수 | 반복 | 설명 |", "|---|---|---|---|---|"]
        for s in t["slots"]:
            rp = f"{s['repeat'][0]}~{s['repeat'][1]}" if s.get("repeat") else "-"
            L.append(f"| {s['name']} | {s['kind']} | {'●' if s['required'] else ''} | {rp} | {s.get('note', '')} |")
        L += ["", "**옵션 (options)**", "", "| 옵션 | 종류 | 기본값 | 선택지 | 설명 |", "|---|---|---|---|---|"]
        for o in t["options"]:
            df = "·".join(map(str, o["default"])) if isinstance(o["default"], list) else ("켬" if o["default"] is True else "끔" if o["default"] is False else str(o["default"]))
            ch = ", ".join(map(str, o["choices"])) if o.get("choices") else "-"
            L.append(f"| {o['label']} | {o['type']} | {df} | {ch} | {o.get('note', '')} |")
    L += ["", "## 분류되지 않은 구좌", ""]
    for k, v in d["unassigned"].items():
        L.append(f"- `{k}`: {v['count']}개 — " + " / ".join(x["label"][:30] for x in v["examples"]))
    if not d["unassigned"]:
        L.append("- 없음")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--md", default=str(MD))
    a = ap.parse_args()
    d = build()
    Path(a.out).write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.md != "-":
        Path(a.md).write_text(markdown(d), encoding="utf-8")
    new = sum(1 for t in d["templates"] if t["status"] == "new")
    ext = sum(1 for t in d["templates"] if t["status"] == "extend")
    print(f"템플릿 {len(d['templates'])}개 (신규 {new} · 옵션 추가 {ext}) · 근거 구좌 {d['total_sections']}개 → {a.out}")
    for t in d["templates"]:
        e = t["evidence"]
        print(f"  {t['id']:<16}{t['status']:<7}{e.get('count', 0):>3}개 · {e.get('pages', 0)}페이지  슬롯 {len(t['slots'])} 옵션 {len(t['options'])}")
    if d["unassigned"]:
        print("미분류:", {k: v["count"] for k, v in d["unassigned"].items()})


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
브리프 → 프로모션 유형 → 구좌 구성안 (규칙 기반, 모델·외부 호출 없음).

- 입력: 통합 기획안 문서(amoread.api.ProjectReq.model_dump()와 같은 모양, 일부 필드만 있어도 됨)
- 출력: 구좌 목록 [{role, name, layoutId, purpose, required, why}] + 판단 근거(유형·키워드·근거 사례·신뢰도)
- 유형 9개의 표준 구성은 수집한 레퍼런스 페이지(컬리·오설록·29cm)에서 관찰한 것에 기획 상식을 더한 '초안'이다.
  기획자 검토 전이며, 신뢰도가 낮은 유형(근거 사례 1~3개)은 결과에 그대로 표시한다.
- 화면의 레이아웃 ID(hero·grid2·grid3·split·benefit·deal-banner·text-cta)와 구좌 목표(브랜딩·전환·…)는
  planner/static/js/am/sources/outline.js · zones.js와 같은 값을 쓴다.
"""
import json
import os
import re
from pathlib import Path

AI_DIR = Path(os.getenv("AMOREAD_AI_DIR") or (Path(__file__).resolve().parents[2] / "planner" / "data" / "ai_refs"))

# ----------------------------------------------------------------------
# 구좌 역할(role) → 화면 레이아웃·구좌 목표·이름
# ----------------------------------------------------------------------
ROLE_NAME = {
    "hero": "메인 비주얼", "section_navigation": "섹션 바로가기", "coupon_offer": "쿠폰 발급", "sale_offer": "특가·세일",
    "benefit_overview": "혜택 안내", "partner_benefit": "제휴 혜택", "product_list": "추천 상품", "editorial_story": "소개·스토리",
    "brand_story": "브랜드 스토리", "brand_intro": "브랜드 소개", "lookbook": "룩북", "visual_gallery": "이미지 갤러리",
    "participation_event": "참여 이벤트", "terms_notice": "유의사항", "share": "공유하기", "app_promo": "앱 설치 안내",
    "related_promotions": "관련 기획전", "live_commerce": "라이브 연계",
}
ROLE_CAT = {   # 레퍼런스 분류(references.js의 cat)
    "hero": "메인·비주얼", "lookbook": "메인·비주얼", "visual_gallery": "메인·비주얼", "product_list": "상품 큐레이션",
    "coupon_offer": "혜택·프로모션", "sale_offer": "혜택·프로모션", "benefit_overview": "혜택·프로모션", "partner_benefit": "혜택·프로모션",
    "participation_event": "혜택·프로모션", "editorial_story": "스토리", "brand_story": "스토리", "brand_intro": "스토리",
}
DEAL_WORDS = re.compile(r"하루\s*특가|타임\s*(딜|어택)|특가|한정")


def layout_for(role: str, text: str = "") -> str:
    """역할 → 우리 레이아웃 ID. 레이아웃이 일곱 가지뿐이라 일부 역할은 text-cta로 모인다(손실 있음)."""
    if role in ("hero", "lookbook", "visual_gallery", "live_commerce"):
        return "hero"
    if role == "product_list":
        return "grid2"
    if role == "sale_offer":
        return "deal-banner" if DEAL_WORDS.search(text or "") else "benefit"
    if role in ("coupon_offer", "benefit_overview", "partner_benefit", "participation_event"):
        return "benefit"
    if role == "brand_story":
        return "split"
    return "text-cta"   # editorial_story·brand_intro·terms_notice·share·app_promo·related_promotions·section_navigation


def goal_for(role: str, purpose: str = "") -> str:
    """역할 → 구좌 목표(구좌 편집의 '섹션 목표' 값: 브랜딩·전환·객단가·혜택 안내·정보 안내·유입)."""
    if role == "hero":
        return "유입" if purpose == "신규 유입" else "전환" if purpose in ("재고 소진",) else "브랜딩"
    if role == "product_list":
        return "객단가" if purpose == "객단가 상승" else "전환"
    if role == "sale_offer":
        return "전환"
    if role in ("coupon_offer", "benefit_overview", "partner_benefit"):
        return "혜택 안내"
    if role in ("brand_story", "brand_intro", "lookbook", "visual_gallery"):
        return "브랜딩"
    if role == "participation_event":
        return "유입"
    return "정보 안내"


def S(role, required, why):
    return {"role": role, "required": required, "why": why}


# ----------------------------------------------------------------------
# 유형 9개: 판단 키워드(가중치), 표준 구성, 근거 사례, 신뢰도
# ----------------------------------------------------------------------
TYPES = {
    "mega_sale": {"name": "대형 세일/시즌 기획전", "conf": "medium", "evidence": ["컬리 블랙위크", "컬리 메가세일", "오설록 블랙프라이데이"],
        "kw": {"블랙위크": 3, r"블랙\s?프라이데이": 3, "블프": 3, "메가세일": 3, "빅세일": 3, "대형 세일": 3, "연말 세일": 2, "세일": 1.5, "특가": 1, r"최대 \d+%": 1.5, "시즌 오프": 2, "재고": 1.5},
        "sections": [S("hero", True, "행사명·기간·최대 혜택을 한 번에 제시"), S("section_navigation", False, "섹션이 많을 때 바로가기 탭 (블랙위크 사례)"),
                     S("coupon_offer", True, "대형 세일은 쿠폰 발급이 앞쪽에 배치됨"), S("sale_offer", True, "특가·타임딜 핵심 구좌"),
                     S("product_list", True, "혜택별 상품 진열"), S("terms_notice", False, "유의사항")]},
    "coupon_acquisition": {"name": "쿠폰/신규 가입 혜택", "conf": "medium", "evidence": ["컬리 신규 쿠폰팩", "컬리 블랙위크 100% 당첨쿠폰"],
        "kw": {"쿠폰": 3, "신규 가입": 3, "가입": 1.5, "첫 구매": 3, "웰컴": 2, "당첨 쿠폰": 3, "할인권": 2, "쿠폰팩": 3, "신규": 1.5},
        "sections": [S("hero", True, "쿠폰 금액·조건을 헤드라인으로"), S("coupon_offer", True, "쿠폰 발급 구좌 (핵심)"), S("sale_offer", False, "쿠폰 적용 상품·특가"),
                     S("share", False, "친구 초대·공유 혜택"), S("terms_notice", True, "쿠폰 사용 조건·유의사항"), S("app_promo", False, "앱 전용 쿠폰이면 설치 유도")]},
    "card_partner": {"name": "카드·결제 제휴 혜택", "conf": "medium", "evidence": ["컬리 신한카드"],
        "kw": {"카드": 3, "제휴": 2.5, "페이": 2, "결제 혜택": 3, "무이자": 2, "적립": 1},
        "sections": [S("hero", True, "제휴 카드와 핵심 혜택"), S("coupon_offer", True, "발급·결제 혜택"), S("partner_benefit", True, "제휴사 혜택 상세"),
                     S("share", False, "공유"), S("terms_notice", True, "카드 이용 유의사항 (제휴는 법적 고지가 길다)")]},
    "curation": {"name": "상품 큐레이션/특가전", "conf": "medium", "evidence": ["컬리 떡볶이 특가전", "컬리 셰프 모음전", "컬리 희소가치 프로젝트"],
        "kw": {"모음전": 3, "큐레이션": 3, "특가전": 2.5, "기획전": 2, "베스트": 1.5, "추천": 1, "TOP": 1.5, "랭킹": 1.5, "신상": 1, "세트": 1.5},
        "sections": [S("hero", True, "기획전 타이틀·콘셉트"), S("editorial_story", False, "큐레이션 의도 소개"), S("product_list", True, "주제별 상품 진열 (반복 가능)"),
                     S("share", False, "공유"), S("app_promo", False, "앱 이동 안내")]},
    "gift_curation": {"name": "선물 큐레이션", "conf": "low", "evidence": ["오설록 선물 가이드(부분)", "AMOREAD 샘플 기획안"],
        "kw": {"선물": 3, "기프트": 3, "gift": 3, "연말": 1, "명절": 2, "추석": 2, "설날": 2, "감사": 1, "마음을 전": 2, "받는 사람": 2, "보자기": 2},
        "sections": [S("hero", True, "선물 시즌 감성 비주얼"), S("editorial_story", False, "대상별 선물 고르는 법 안내"), S("product_list", True, "받는 사람·가격대별 선물 상품"),
                     S("benefit_overview", True, "선물 구매 혜택(포장·사은품 등)"), S("brand_story", False, "브랜드·제품 이야기"), S("terms_notice", False, "배송·교환 유의사항")]},
    "new_product_launch": {"name": "신제품/신규 컬렉션 론칭", "conf": "low", "evidence": ["29cm NEW PRODUCT 히어로(부분)"],
        "kw": {"신제품": 3, "신상": 2, "런칭": 3, "론칭": 3, "출시": 2.5, "new": 1.5, "컬렉션": 1.5, "에디션": 2, "리뉴얼": 2},
        "sections": [S("hero", True, "신제품 메인 비주얼"), S("editorial_story", True, "제품 스토리·특징"), S("lookbook", False, "사용·연출 이미지"),
                     S("product_list", True, "신제품 진열"), S("benefit_overview", False, "론칭 기념 혜택"), S("terms_notice", False, "유의사항")]},
    "brand_showcase": {"name": "브랜드 쇼케이스(입점 브랜드 기획전)", "conf": "high", "evidence": ["29cm 쇼케이스 76개 중 49개가 이 구성"],
        "kw": {"쇼케이스": 3, "showcase": 3, "브랜드관": 2.5, "브랜드 기획": 2.5, "입점": 2, "단독": 1},
        "sections": [S("hero", True, "브랜드·시즌 소개"), S("benefit_overview", True, "단독 혜택 요약"), S("visual_gallery", False, "무드 이미지"),
                     S("brand_intro", True, "브랜드 소개와 홈 이동"), S("lookbook", False, "룩북"), S("product_list", True, "상품 진열")]},
    "brand_collab": {"name": "셰프·브랜드 협업 스토리", "conf": "low", "evidence": ["컬리 정지선 셰프관", "오설록 손종원 셰프 협업"],
        "kw": {"셰프": 3, "협업": 3, "콜라보": 3, "에디터": 1.5, "인터뷰": 2},
        "sections": [S("hero", True, "협업 주체 소개 비주얼"), S("brand_story", True, "협업 스토리·에디터 노트"), S("product_list", True, "협업 상품"),
                     S("partner_benefit", False, "협업 기념 혜택"), S("share", False, "공유")]},
    "participation_event": {"name": "참여형 이벤트(출석·리뷰·응모)", "conf": "medium", "evidence": ["오설록 출석체크"],
        "kw": {"출석": 3, "리뷰 이벤트": 3, "응모": 3, "경품": 3, "참여": 1.5, "미션": 2, "룰렛": 3, "댓글": 1.5},
        "sections": [S("participation_event", True, "참여 방법과 보상 (첫 화면)"), S("coupon_offer", False, "참여 보상 쿠폰"), S("terms_notice", True, "참여 조건·유의사항"),
                     S("share", False, "공유"), S("related_promotions", False, "다른 진행 중 행사")]},
}
FALLBACK = "curation"

# 브리프의 '목적'(6가지)과 '분류'(5가지)는 유형 점수의 사전 가중치로만 쓴다 (키워드 근거가 없으면 이 가중치만으로 판단)
PURPOSE_PRIOR = {"선물 수요": {"gift_curation": 4}, "전환·매출": {"mega_sale": 2, "curation": 2}, "신규 유입": {"coupon_acquisition": 4},
                 "객단가 상승": {"curation": 3}, "브랜드·신제품": {"new_product_launch": 3, "brand_collab": 1}, "재고 소진": {"mega_sale": 3}}
CLS_PRIOR = {"season": {"gift_curation": 1, "mega_sale": 1}, "brand": {"brand_showcase": 2, "brand_collab": 1}, "launch": {"new_product_launch": 4},
             "collab": {"brand_collab": 4}, "clear": {"mega_sale": 3}}
CLS_NAME = {"season": "시즌", "brand": "브랜드기획전", "launch": "런칭", "collab": "콜라보", "clear": "클리어런스"}
CONF_KO = {"high": "높음", "medium": "중간", "low": "낮음"}

# 유형을 못 정할 때 쓰는 범용 구성 (그럴듯한 유형을 억지로 고르지 않는다)
GENERIC = {"name": "유형 미정 (범용 기본 구성)", "conf": "low", "evidence": ["어느 프로모션에나 들어가는 기본 구좌"],
           "sections": [S("hero", True, "행사명·기간·핵심 메시지"), S("product_list", True, "행사 상품 진열"), S("benefit_overview", True, "혜택 안내"), S("terms_notice", False, "유의사항")]}
MIN_PRIOR_ONLY = 3   # 키워드·명분 사전 근거 없이 목적·분류 가중치만으로 유형을 정하려면 이 점수 이상이어야 한다

# ----------------------------------------------------------------------
# 명분 사전(planner/settings/명분사전.csv, 화면에서 담당자가 관리)의 '종류' → 유형 가중치.
# 새 명분은 사전에만 올리면 되고 이 파일은 고칠 필요가 없다 (종류가 9개로 고정돼 있어서).
# ----------------------------------------------------------------------
SEASON_KIND_PRIOR = {"명절·대목": {"gift_curation": 4}, "기념일": {"gift_curation": 4}, "쇼핑": {"mega_sale": 4},
                     "차 고유": {"curation": 3}, "절기·세시": {"curation": 3}, "날씨·계절": {"curation": 3}, "학사·생활": {"curation": 3}, "직장": {"curation": 3},
                     "트렌드": {"curation": 3}}
_season_cache = {"mt": None, "items": []}


def _seasons() -> list[dict]:
    """명분 사전 읽기. 사전이 없거나 읽지 못하면 []로 두어 키워드·목적 규칙만으로 동작한다."""
    try:
        from planner import config, schedule
        mt = config.SEASON_CSV.stat().st_mtime if config.SEASON_CSV.exists() else 0
        if _season_cache["mt"] != mt:
            _season_cache.update(mt=mt, items=schedule.read_seasons())
        return _season_cache["items"]
    except Exception:
        return []


def _norm(t) -> str:
    return re.sub(r"[\s·,()]+", "", str(t or "")).lower()


def season_hit(doc: dict) -> dict | None:
    """브리프의 명분·제목·키워드(또는 고른 명분)가 명분 사전의 이름·지난행사키워드·이름 조각과 겹치면 그 명분. 가장 긴 이름이 우선."""
    b, v2 = doc.get("brief") or {}, doc.get("v2") or {}
    ref = b.get("season_ref")
    text = _norm(" ".join([str(doc.get("title") or ""), str(b.get("myeongbun") or ""), (ref.get("name") if isinstance(ref, dict) else str(ref or "")), " ".join(v2.get("keywords") or []), str(v2.get("seed") or "")]))
    best = None
    for e in _seasons():
        names = {_norm(e["name"]), _norm(e["name"].replace("시즌", "")), _norm(e.get("keyword"))} | {_norm(x) for x in re.split(r"[·]", e["name"])}
        hit = max((n for n in names if len(n) >= 3 and n in text), key=len, default="")
        if hit and (best is None or len(hit) > best[0]):
            best = (len(hit), e)
    return best[1] if best else None


def brief_text(doc: dict) -> tuple[str, str]:
    """(전체 글, 이름 글). 통합 기획안 문서의 브리프·분류·키워드를 한 문장으로 모은다. 이름 글은 키워드 가중치를 1.5배 준다."""
    b = doc.get("brief") or {}
    v2 = doc.get("v2") or {}
    title = str(doc.get("title") or "")
    name = " ".join([title, str(b.get("myeongbun") or ""), " ".join(v2.get("keywords") or [])])
    rest = [b.get(k) for k in ("concept", "customer", "target", "audience", "background", "benefits_note", "key_copy", "purpose")]
    return (name + " " + " ".join(str(x) for x in rest if x)).lower(), name.lower()


def _kw_re(k: str) -> "re.Pattern":
    """판단 키워드 정규식. 영문 단어(new·top·gift)는 낱말 경계를 둬서 'desktop'·'renewal' 안의 조각에는 반응하지 않는다 (한글은 조사가 붙으므로 부분 일치 그대로)."""
    k = k.lower()
    return re.compile(f"(?<![a-z0-9]){k}(?![a-z0-9])" if re.fullmatch(r"[a-z0-9 ]+", k) else k)


def classify(doc: dict) -> list[dict]:
    text, name = brief_text(doc)
    v2, b = doc.get("v2") or {}, doc.get("brief") or {}
    score, hits = {}, {}
    for t, d in TYPES.items():
        for k, w in d["kw"].items():
            rx = _kw_re(k)
            if rx.search(text):
                score[t] = score.get(t, 0) + w * (1.5 if rx.search(name) else 1)
                hits.setdefault(t, []).append(k.replace(r"\s?", " ").replace(r"\d+", "N"))
    prior = {}
    season = season_hit(doc)
    for src, key in ((PURPOSE_PRIOR, b.get("purpose")), (CLS_PRIOR, v2.get("cls")), (SEASON_KIND_PRIOR, season and season["kind"])):
        for t, w in (src.get(key) or {}).items():
            prior[t] = prior.get(t, 0) + w
    for t in prior:
        if season and SEASON_KIND_PRIOR.get(season["kind"], {}).get(t):
            hits.setdefault(t, []).append(f"명분 사전: {season['name']}({season['kind']})")
    for t, w in prior.items():
        score[t] = score.get(t, 0) + w
    out = [{"type": t, "score": round(s, 2), "matched": sorted(hits.get(t, [])), "prior": prior.get(t, 0)} for t, s in score.items()]
    out.sort(key=lambda x: -x["score"])
    for x in out:
        x["season"] = season["name"] if season else ""
    return out or [{"type": FALLBACK, "score": 0, "matched": [], "prior": 0, "note": "판단할 단서가 없어 기본 큐레이션 구성을 냈어요"}]


def product_name(doc: dict, kw_index: int, gift: bool) -> str:
    kws = (doc.get("v2") or {}).get("keywords") or []
    if kw_index < len(kws):
        return f"{kws[kw_index]} 추천"
    return "받는 사람별 선물 추천" if gift else ROLE_NAME["product_list"]


def decide(doc: dict) -> tuple[list[dict], dict, bool]:
    """(순위, 1위, 유형 미정 여부). 단서(명분 사전·키워드)가 없고 목적·분류 점수도 약하면 유형을 찍지 않는다."""
    ranked = classify(doc)
    main = ranked[0]
    second = ranked[1]["score"] if len(ranked) > 1 else 0
    return ranked, main, (not main["matched"] and (main["score"] < MIN_PRIOR_ONLY or main["score"] <= second))


_stats_cache = {"mt": None, "d": {}}


def type_stats() -> dict:
    """수집한 페이지를 같은 규칙으로 유형 분류해 센 통계 (build_index가 만든다): {유형: {pages, roles: {역할: 가진 페이지 수}}}. 없으면 {}."""
    f = AI_DIR / "type_stats.json"
    try:
        mt = f.stat().st_mtime
        if _stats_cache["mt"] != mt:
            _stats_cache.update(mt=mt, d=json.loads(f.read_text(encoding="utf-8")))
        return _stats_cache["d"]
    except (OSError, ValueError):
        return {}


def generate(doc: dict, secondary_ratio: float = 0.6) -> dict:
    ranked, main, undecided = decide(doc)
    t = GENERIC if undecided else TYPES[main["type"]]
    if undecided:
        main = dict(main, type="generic", matched=[])
    purpose = (doc.get("brief") or {}).get("purpose") or ""
    secs = [dict(s, source=main["type"]) for s in t["sections"]]
    notes = ["판단할 단서(명분 사전·키워드·목적)가 부족해 유형을 정하지 않고 범용 구성을 냈어요. 명분 사전에 명분을 등록하거나 목적·분류를 고르면 유형에 맞춰 짜 줘요"] if undecided else []
    for r in ([] if undecided else ranked[1:3]):   # 보조 유형: 2위·3위의 '필수' 구좌 중 빠진 것을 끼운다 (메인 비주얼은 주 유형에서만)
        if main["score"] and r["score"] >= main["score"] * secondary_ratio:
            have = {s["role"] for s in secs}
            for s in TYPES[r["type"]]["sections"]:
                if s["required"] and s["role"] not in have and s["role"] != "hero":
                    pos = next((i for i, x in enumerate(secs) if x["role"] in ("terms_notice", "share", "app_promo", "related_promotions")), len(secs))
                    secs.insert(pos, dict(s, source=r["type"], why=s["why"] + f" (보조 유형: {TYPES[r['type']]['name']})"))
                    have.add(s["role"])
            notes.append(f"보조 유형 반영: {TYPES[r['type']]['name']}")
    text, _ = brief_text(doc)
    if "앱" in text and not any(s["role"] == "app_promo" for s in secs):
        secs.append(dict(S("app_promo", False, "브리프에 앱 전용 언급"), source="modifier"))
    st = type_stats().get(main["type"]) or {}
    n_pages, have_n = st.get("pages", 0), st.get("roles", {})
    if n_pages >= 6:   # 수집 사례로 규칙을 점검한다: 같은 유형 사례에 거의 없는 필수 구좌는 선택으로, 대부분이 가진 구좌는 선택 구좌로 제안
        for s in secs:
            if s["required"] and s["role"] != "hero" and have_n.get(s["role"], 0) / n_pages < 0.2:
                s["required"] = False
                notes.append(f"'{ROLE_NAME[s['role']]}'은 같은 유형 사례 {n_pages}개 중 {have_n.get(s['role'], 0)}개에만 있어 선택으로 낮췄어요")
        present = {s["role"] for s in secs}
        extra = sorted((r for r, c in have_n.items() if r not in present and r in ROLE_NAME and r not in ("section_navigation", "terms_notice", "share", "app_promo", "related_promotions") and c / n_pages >= 0.6 and len((st.get("role_brands") or {}).get(r, [])) >= 2),   # 한 몰에만 있는 구좌(예: 29cm 룩북)는 제안하지 않는다
                       key=lambda r: -have_n[r])[:2]
        for r in extra:
            pos = next((i for i, x in enumerate(secs) if x["role"] in ("terms_notice", "share", "app_promo", "related_promotions")), len(secs))
            secs.insert(pos, dict(S(r, False, f"같은 유형 사례 {n_pages}개 중 {have_n[r]}개({have_n[r] * 100 // n_pages}%)가 가진 구좌"), source="data"))
    gift = main["type"] == "gift_curation"
    n_prod = 0
    out = []
    for s in secs:
        role = s["role"]
        name = product_name(doc, n_prod, gift) if role == "product_list" else ROLE_NAME[role]
        n_prod += role == "product_list"
        item = {"role": role, "name": name, "layoutId": layout_for(role, text), "purpose": goal_for(role, purpose),
                "required": s["required"], "why": s["why"] + (f" (같은 유형 수집 사례 {n_pages}개 중 {have_n.get(role, 0)}개에 있음)" if n_pages >= 3 and s.get("source") != "data" else ""),
                "source": s.get("source", main["type"])}
        if n_pages:
            item["support"] = {"pages": n_pages, "have": have_n.get(role, 0)}
        out.append(item)
    conf = "low" if undecided else t["conf"] if main["score"] else "low"
    if not undecided and not main["matched"]:   # 키워드·명분 근거 없이 목적·분류 가중치만으로 정한 유형은 높게 보이지 않게 한다
        conf = "low"
        notes.append("브리프에 유형을 가리키는 단어가 없어 목적·분류만으로 정한 유형이에요. 명분·콘셉트를 적으면 더 정확해져요")
    if n_pages and n_pages < 5:   # 같은 유형 사례가 5개 미만이면 신뢰도를 높게 두지 않는다
        conf = "low"
    elif n_pages and n_pages < 15 and conf == "high":
        conf = "medium"
    return {"type": main["type"], "type_name": t["name"], "confidence": conf, "matched": main["matched"], "support_pages": n_pages,
            "evidence": t["evidence"], "notes": notes, "ranking": ranked[:3], "sections": out}

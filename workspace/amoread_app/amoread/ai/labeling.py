# -*- coding: utf-8 -*-
"""
수집한 프로모션 페이지·구좌에 분류 라벨을 붙인다 (규칙 기반, 모델·외부 호출 없음). 자동 수집 파이프라인이 새 페이지를 가져올 때마다 같은 함수를 부르면 된다.

  classify_page(page)    → {season, season_basis, cls, type, ben[], mode[], concept, month, evidence{}, confidence, labeled_by}
  classify_section(sec)  → {stype, mode[]}
  page: 수집 페이지 JSON(id, brand, listing_label/title, text, sections[]…) 또는 같은 키를 가진 dict

라벨은 원본 JSON을 고치지 않고 따로 저장한다(planner/data/ai_refs/page_labels.json). 사람이 고친 값은 label_overrides.json에 두고
색인을 다시 만들어도 그대로 덮어쓴다 (labeled_by = "human"). 어휘는 레퍼런스 화면(library.js)의 값과 같다:
  season = 명분 사전 이름(블프·설·추석…) 또는 계절(봄·여름·가을·겨울)   cls = season·brand·launch·collab·clear
  ben = 쿠폰·하루특가·사은품·페이백·포인트(+무료배송·카드혜택)   stype = 구좌 종류   mode = 참여 방식
"""
import csv
import json
import re
from datetime import date

from . import rules

CLS_KO = {"season": "시즌", "brand": "브랜드기획전", "launch": "런칭", "collab": "콜라보", "clear": "클리어런스"}
# 분류(cls) 단서: 먼저 맞는 것이 이긴다 (제목·첫 화면 글 기준, 세일 같은 흔한 말은 단서로 쓰지 않는다)
CLS_RULES = [
    ("collab", r"콜라보|협업|collab|\bx\s[가-힣A-Z]|셰프와"),
    ("clear", r"클리어런스|리퍼브|시즌\s?오프|땡처리|재고\s?(소진|정리)|마지막\s?할인|최종\s?할인|아울렛|outlet"),
    ("launch", r"new\s?product|신제품|런칭|론칭|신규\s?출시|신상품\s?출시|출시\s?기념"),
    ("brand", r"쇼케이스|showcase|브랜드관|브랜드\s?(기획|위크|데이|특가전)|입점"),
]
BEN = [("쿠폰", r"쿠폰"), ("하루특가", r"하루\s?특가|타임\s?(딜|어택)|오늘\s?단\s?하루|단\s?하루|매일\s?(오전|오후)?\s?\d+시|선착순"), ("사은품", r"사은품|증정|gift"),
       ("페이백", r"페이백|캐시백|payback"), ("포인트", r"포인트|적립금|적립"), ("무료배송", r"무료\s?배송"), ("카드혜택", r"무이자|즉시\s?할인|카드\s?(혜택|할인)")]
MODE = [("출석·스탬프", r"출석|스탬프|출첵"), ("퀴즈·테스트", r"퀴즈|테스트|정답|맞히|맞추"), ("공유 유도", r"공유|초대|친구에게"), ("댓글·사진 인증", r"댓글|인증|후기|리뷰\s?(이벤트|작성)|포토"),
        ("응모·추첨", r"응모|추첨|당첨|경품")]
STYPE = {"hero": "메인 비주얼", "product_list": "상품 그리드", "coupon_offer": "혜택 안내", "sale_offer": "혜택 안내", "benefit_overview": "혜택 안내", "partner_benefit": "혜택 안내",
         "brand_story": "스토리", "editorial_story": "스토리", "brand_intro": "스토리", "lookbook": "이미지 갤러리", "visual_gallery": "이미지 갤러리",
         "participation_event": "참여 이벤트", "terms_notice": "유의사항", "section_navigation": "바로가기", "related_promotions": "관련 기획전", "share": "공유",
         "app_promo": "앱 안내", "live_commerce": "라이브 연계"}
SEASON_WORDS = [("연말", r"연말|크리스마스|홀리데이|송년"), ("겨울", r"겨울|윈터|한파|방한|동지"), ("가을", r"가을|단풍|추석|환절기"), ("봄", r"봄|벚꽃|피크닉|스프링"), ("여름", r"여름|휴가|쿨링|서머|열대야")]
LABELED_BY = "auto-v1"


def _text(page: dict) -> tuple[str, str, str]:
    """(제목, 첫 화면 글, 전체 글) — 앞의 둘로 유형·분류를, 전체로 혜택·참여 방식을 본다."""
    title = " ".join(str(x) for x in (page.get("listing_label"), page.get("page_title"), page.get("title")) if x and x != "None").split("\n")[0][:120]
    secs = sorted(page.get("sections") or [], key=lambda s: int(s.get("order") or 0))
    texts = [(s.get("text") or "") for s in secs if (s.get("text") or "") not in ("", "None")]
    return title, " ".join(texts[:2])[:500], " ".join(texts)[:6000]


def _month(page: dict, full: str) -> int | None:
    """페이지 글에서 기간(예: 11.02 - 11.16, 2026. 11. 03.)의 월을 찾고, 없으면 수집일의 월."""
    m = re.search(r"(?<!\d)(1[0-2]|0?[1-9])\s?[.\-/월]\s?(?:0?[1-9]|[12]\d|3[01])\s?(?:일)?\s*[-~]", full[:1500]) or re.search(r"20\d\d\.\s?(1[0-2]|0?[1-9])\.", full[:1500])
    if m:
        return int(m.group(1))
    try:
        return int(str(page.get("collected_date") or "")[5:7])
    except ValueError:
        return None


def classify_section(sec: dict) -> dict:
    t = (sec.get("text") or "")
    t = "" if t == "None" else t
    return {"stype": STYPE.get(sec.get("role", ""), ""), "mode": [k for k, rx in MODE if re.search(rx, t)] if sec.get("role") == "participation_event" else []}


def classify_page(page: dict) -> dict:
    title, hero, full = _text(page)
    head = f"{title} {hero}"
    doc = {"title": title, "brief": {"myeongbun": title, "concept": hero}, "v2": {}}
    _, main, undecided = rules.decide(doc)
    ptype = "generic" if undecided else main["type"]
    evidence = {}
    season = rules.season_hit(doc)
    cls = ""
    for c, rx in CLS_RULES:
        m = re.search(rx, title, re.I)   # 분류는 제목만 본다 (본문에는 '신상품' 같은 메뉴 글이 섞여 있다)
        if m:
            cls, evidence["cls"] = c, m.group(0)
            break
    if not cls and (season or ptype in ("mega_sale", "gift_curation")):
        cls, evidence["cls"] = "season", (season["name"] if season else f"유형 {ptype}")
    month = _month(page, full)
    if season:
        label, basis = (season.get("keyword") or season["name"]), "명분 사전"
    else:   # 사전에 없으면 제목·첫 화면 글의 계절 말에서 (수집한 달로 계절을 정하면 전부 같은 값이 되므로 쓰지 않는다)
        label, basis = next(((k, "글의 계절 말") for k, rx in SEASON_WORDS if re.search(rx, head)), ("", ""))
    ben = [k for k, rx in BEN if re.search(rx, full, re.I)]
    mode = [k for k, rx in MODE if re.search(rx, full)] if ptype == "participation_event" or any(s.get("role") == "participation_event" for s in page.get("sections") or []) else []
    strong = sum(bool(x) for x in (season, evidence.get("cls"), main.get("matched") and not undecided))
    return {"season": label, "season_basis": basis, "cls": cls, "type": ptype, "ben": ben, "mode": mode, "month": month,
            "concept": "", "evidence": {**evidence, **({"season": season["name"]} if season else {}), **({"type": main["matched"][:3]} if main.get("matched") else {})},
            "confidence": "medium" if strong >= 2 else "low" if strong == 0 else "low-medium", "labeled_by": LABELED_BY}


# ---------------------------------------------------------------- 사람 검수 (CSV 내보내기·가져오기)
FIELDS = ["page_id", "brand", "name", "url", "season", "cls", "type", "ben", "mode", "confidence", "labeled_by"]


def export_csv(labels: dict, pages: dict, path) -> int:
    """검수용 CSV(엑셀에서 열림). ben·mode는 쉼표로 이은 글. 고친 뒤 import_overrides()로 가져온다."""
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(FIELDS)
        for pid, lb in sorted(labels.items()):
            p = pages.get(pid, {})
            w.writerow([pid, p.get("brand", ""), p.get("name", ""), p.get("url", ""), lb["season"], lb["cls"], lb["type"], ",".join(lb["ben"]), ",".join(lb["mode"]), lb["confidence"], lb["labeled_by"]])
    return len(labels)


def import_overrides(csv_path, labels_path, overrides_path) -> int:
    """검수한 CSV에서 자동 라벨(page_labels.json)과 달라진 칸만 label_overrides.json에 저장한다 (색인을 다시 만들어도 유지). 반환 = 고친 페이지 수."""
    auto = json.loads(open(labels_path, encoding="utf-8").read())
    try:
        cur = json.loads(open(overrides_path, encoding="utf-8").read())
    except (OSError, ValueError):
        cur = {}
    n = 0
    for row in csv.DictReader(open(csv_path, encoding="utf-8-sig", newline="")):
        pid = row["page_id"]
        if pid not in auto:
            continue
        new = {"season": row["season"].strip(), "cls": row["cls"].strip(), "type": row["type"].strip(),
               "ben": [x.strip() for x in row["ben"].split(",") if x.strip()], "mode": [x.strip() for x in row["mode"].split(",") if x.strip()]}
        diff = {k: v for k, v in new.items() if v != auto[pid].get(k)}
        if diff:
            cur.setdefault(pid, {}).update(diff)
            n += 1
    json.dump(cur, open(overrides_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return n


def apply_overrides(labels: dict, overrides: dict) -> dict:
    """사람이 고친 값을 자동 라벨 위에 덮는다."""
    for pid, o in overrides.items():
        if pid in labels:
            labels[pid] = {**labels[pid], **o, "labeled_by": "human", "confidence": "confirmed"}
    return labels

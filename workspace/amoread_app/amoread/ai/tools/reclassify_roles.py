"""Rule-based first pass: refine 'content' sections into finer roles (roles_v2).
Non-content roles are kept. Rows left as 'content' go to manual/agent review."""
import json, re, collections, pathlib
d = pathlib.Path(__file__).resolve().parent
R = [  # (role_v2, regex on text) first match wins
 ("terms_notice",   r"^.{0,30}(유의\s?사항|약관|주의\s?사항)|본 이벤트는.{0,40}(변경|종료)|고지 없이|대리·중개"),
 ("live_commerce",  r"29\s?LIVE|라이브"),
 ("lookbook",       r"COLLECTION"),
 ("benefit_overview", r"단독\s?(혜택|~?\d)"),
 ("app_promo",      r"앱(으로| 설치|에서|을 설치)|APP 설치|스캔하면|QR"),
 ("ui_noise",       r"(발급되었습니다|신청되었습니다|해제되었습니다|다운\s?(로드\s?)?받았습니다|대상이 아닙니다)|^종료까지 남은 시간|Fullscreen.{0,10}PIP|^Now And Only$"),   # 팝업·플레이어 안의 결과 문구
 ("ui_noise",       r"^(팝업 닫기|닫기\s?X?|취소\s?확인|확인|취소|마켓 뷰티|마켓|뷰티|더보기)$"),
 ("brand_intro",    r"브랜드 홈 바로가기|브랜드 소개|BRAND STORY"),
 ("partner_benefit",r"(신한|삼성|현대|국민|롯데|하나|BC|우리)\s?카드|카드 혜택|제휴"),
 ("participation_event", r"참여\s?방법|응모|당첨|이벤트 참여|미션"),
 ("coupon_offer",   r"쿠폰(을|팩|받기| 받기)|적립금|할인\s?쿠폰|포인트.{0,12}받"),
 ("related_promotions", r"W컨셉에서 만나보세요"),
 ("benefit_overview", r"최대\s?혜택|페이백"),
 ("product_list",   r"더\s?보러\s?가기|전체\s?보기|전체\s?보러|메뉴 보러|큐레이션|모아보기|목록보기"),
 ("sale_offer",     r"특가|타임\s?어택|세일|최대\s?\d+\s?%\s?(할인|OFF)|~\d+%"),
 ("share",          r"공유(하기)?|URL 복사|카카오톡"),
]
def v2(s):
    if s["role"] != "content": return s["role"], "kept"
    t = (s["text"] if s["text"] != "None" else "").strip()
    t = re.sub(r"(마켓 뷰티\s*)+", "", t).strip()  # kurly nav label leaks into text
    if not t and s["text"] not in ("", "None"): return "ui_noise", "nav_label_only"
    if not t:
        if s["n_images"] >= 3: return "visual_gallery", "no_text_multi_image"
        if s["n_images"] >= 1: return ("hero", "no_text_first_image") if str(s.get("order")) == "1" else ("image_block", "no_text_image")   # 글 없는 첫 구좌의 이미지는 메인 비주얼
        return "empty", "no_text_no_image"
    for role, rx in R:
        if re.search(rx, t): return role, "rule:" + rx[:20]
    if re.search(r"베스트순.*신상품순|연관 상품", t): return "ui_noise", "sort_or_label"
    if len(t) < 14 and s["n_links"] <= 1: return "ui_noise", "short_text"
    if len(t) > 150 and s["n_images"] >= 3: return "editorial_story", "long_text_images"
    if s["n_images"] >= 10: return "visual_gallery", "many_images"
    return "content", "unresolved"
if __name__ == "__main__":   # 가져다 쓸 때(build_unified.py)는 파일을 쓰지 않는다
    S = [json.loads(l) for l in open(d / "sections.jsonl", encoding="utf-8")]
    for s in S: s["role_v2"], s["v2_evidence"] = v2(s)
    with open(d / "sections_v2.jsonl", "w", encoding="utf-8") as fh:
        for s in S: fh.write(json.dumps(s, ensure_ascii=False) + "\n")
    c = [s for s in S if s["role"] == "content"]
    print("content:", len(c)); print(collections.Counter(s["role_v2"] for s in c).most_common())

# -*- coding: utf-8 -*-
"""
오늘의 영감: 아침에 카드 몇 장만 넘겨 보며(오른쪽 = 저장, 왼쪽 = 넘기기) 참고할 것을 모으는 화면의 서버 쪽.

무엇을 카드로 만드나
- 매일 아침 '신규 프로모션 찾기'가 찾아 둔 새 프로모션 (discover.json: 제목 + 본문 글). 아직 수집 전이라 화면은 없고 글·원본 링크만 있다.
- 이미 수집해 둔 구좌 (sections.jsonl): 화면 크롭이 있다.

카드마다 '왜 보여 주는지'를 규칙으로 붙인다 (외부 AI 호출 없음 → 이 PC에서만 돌고, 같은 입력이면 같은 결과)
- 판매 기법·이벤트(mech): 미니게임·출석·응모·퀴즈·선착순·구매금액별 혜택 등 낱말 규칙. 드문 기법일수록 앞에 온다
- 워딩(copy): 본문에서 참고할 만한 문장 2~3개
- 구조(struct): 혜택 1·2·3처럼 계단식으로 짠 구성
- 디자인(design): 화면 크롭이 있는 구좌 (메인 비주얼·룩북 등)

순서 = 새로움 + 드문 기법 + 참고 가치 점수 + 취향(저장/넘기기 기록). 같은 브랜드·같은 분류가 몰리지 않게 섞고,
몇 장은 일부러 취향 밖에서 골라 취향이 한쪽으로 굳지 않게 한다.

저장: planner/data/ai_inspire/state.json (본 카드, 저장한 카드, 메모). 지워도 화면은 처음 상태로 돌아갈 뿐 다른 데이터는 그대로다.
"""
import hashlib
import json
import math
import os
import re
import threading
from datetime import date, datetime
from pathlib import Path

from . import discover, refs

DIR = Path(os.getenv("AMOREAD_AI_INSPIRE_DIR") or (refs.AI_DIR.parent / "ai_inspire"))
DECK = 12          # 하루 한 번에 보여 주는 장수 (아침 5분)
EXPLORE = 2        # 그중 취향과 상관없이 고르는 장수
MAX_SAVED = 1000
_lock = threading.Lock()

KIND_KO = {"mech": "판매 기법·이벤트", "copy": "워딩", "struct": "구조", "design": "디자인"}
# 판매 기법·이벤트 낱말 규칙. 흔한 낱말(리뷰 수, 공유 버튼)에 걸리지 않게 '이벤트로 쓰인' 표현만 잡는다
MECH = {
    "미니게임·뽑기": r"룰렛|뽑기|가챠|스크래치|복권|랜덤\s*(박스|쿠폰|혜택|뽑)|미니\s*게임|게임\s*(참여|이벤트|하고|에\s*참여)",
    "출석·스탬프": r"출석\s*(체크|이벤트)?|스탬프|매일\s*(받|응모|참여)",
    "응모·래플": r"래플|응모|추첨|당첨자",
    "퀴즈·투표": r"퀴즈|투표|밸런스\s*게임|취향\s*테스트|심리\s*테스트",
    "선착순·타임딜": r"선착순|타임\s*(딜|세일|특가)|오픈런|한정\s*수량|\d+\s*시\s*오픈",
    "구매금액별 혜택": r"\d+\s*만\s*원\s*이상\s*구매|구매\s*금액별|금액대별",
    "친구 초대·공유": r"친구\s*(초대|추천)|공유\s*(이벤트|하면|하고)|소문내",
    "후기·인증": r"(리뷰|후기)\s*(이벤트|작성\s*시|쓰면)|인증샷|인증\s*이벤트",
    "라이브": r"라이브\s*(방송|특가|혜택)|LIVE\s*특가",
    "골라담기·묶음": r"골라\s*담|세트\s*구성|묶음\s*(할인|구매)|1\s*\+\s*1|2\s*\+\s*1",
    "얼리버드·사전예약": r"얼리버드|사전\s*(예약|알림|신청)|오픈\s*알림|프리\s*오더|선발매",
    "콜라보": r"콜라보|협업|컬래버",
    "미션·챌린지": r"미션|챌린지",
    "사은품": r"사은품|증정",
    "단독·한정": r"단독\s*(특가|할인|상품|구성)|한정판|리미티드",
}
# 기법마다 '이게 뭔지' 한 줄 (카드에서 이름만으로는 감이 안 올 때 읽는 설명)
MECH_DESC = {
    "미니게임·뽑기": "룰렛·뽑기처럼 결과를 '뽑게' 해서, 혜택을 받는 과정 자체를 놀이로 만드는 방식",
    "출석·스탬프": "매일 들어와 도장을 모으게 해서, 행사 기간 내내 다시 오게 만드는 방식",
    "응모·래플": "구매나 참여를 하면 추첨 기회를 주는 방식 (적은 비용으로 큰 경품을 걸 수 있음)",
    "퀴즈·투표": "문제를 풀거나 고르게 해서, 상품·브랜드를 한 번 더 읽게 만드는 방식",
    "선착순·타임딜": "수량이나 시간을 정해 두고 '지금 사야 하는 이유'를 만드는 방식",
    "구매금액별 혜택": "얼마 이상 사면 혜택이 커지게 해서, 한 번에 더 담게 만드는 방식",
    "친구 초대·공유": "공유하거나 친구를 데려오면 혜택을 주어, 고객이 대신 알리게 하는 방식",
    "후기·인증": "후기나 인증 사진을 올리면 혜택을 주어, 구매 뒤 콘텐츠가 쌓이게 하는 방식",
    "라이브": "정해진 시간의 방송에서만 주는 혜택으로 사람을 모으는 방식",
    "골라담기·묶음": "여러 개를 골라 담거나 묶어 사면 싸지는 방식 (객단가를 올림)",
    "얼리버드·사전예약": "정식 판매 전에 먼저 알리고 예약·알림을 받아 수요를 모으는 방식",
    "콜라보": "다른 브랜드·작가와 함께 만든 한정 상품이나 기획",
    "미션·챌린지": "정해진 행동을 끝내면 보상을 주어 참여를 이어 가게 하는 방식",
    "사은품": "구매하면 덤을 주는 방식",
    "단독·한정": "여기서만, 지금만 살 수 있다는 점을 내세우는 방식",
}
COMMON = {"사은품", "단독·한정"}   # 어디에나 있어서 이것만으로는 '판매 기법 카드'로 치지 않는다 (태그로만 붙임)
_MECH_RX = {k: re.compile(v, re.I) for k, v in MECH.items()}
_STRUCT = re.compile(r"(?:BENEFIT|EVENT|STEP|POINT|혜택|이벤트)\s*0?([1-9])(?!\d)", re.I)
_NOISE = re.compile(r"유의사항|확인해|확인하세요|주문|상품\s*보기|더\s*보기|바로가기|증정|드립니다|적립|환불|교환|품절|로그인|쿠폰|다운로드|배송|고객센터|종료되었|화면을|밀어보세요|^\s*확인"
                    r"|금융|권리|소비자|법률|적합성|운영상|종합적|해제됨|카테고리|콘텐츠를|찜해|필터|약관|상품설명서|보러가기|랭킹|브랜드를\s*찜"
                    r"|불가|않습니다|없습니다|경우|순서입니다|스크롤|알림\s*신청|알려드릴|의무|변제|제외|적용|안내|당첨|응모|ID\s*당|1인|기간|이후|이내|한정|수량|혜택은|포인트|캐시백|결제|카드|할인|특가|세일|원\b|[*※]|^\s*-|\(\d|\d{4}")
_UI_NOISE = re.compile(r"댓글|로그인|전체\s*보기|더\s*보기|필터|정렬|장바구니|이전|다음|공유하기|목록")   # 구좌 제목이 화면 조작 글이면 내용 있는 구좌가 아니다
SKIP_ROLES = {"terms_notice", "section_navigation", "related_promotions", "app_promo", "share", "content", "ui_noise", "empty"}
VISUAL_ROLES = {"hero", "lookbook", "visual_gallery", "brand_intro", "brand_story", "editorial_story", "image_block"}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ---------------- 글 분석 ----------------
def mechanics(text: str) -> list[str]:
    return [h["name"] for h in mech_hits(text)]


def _around(text: str, a: int, b: int) -> str:
    """찾은 낱말이 든 문장 한 토막 (앞뒤 문장 끝에서 자르고, 너무 길면 줄인다)."""
    lo = max((text.rfind(ch, 0, a) for ch in ".!?…\n"), default=-1)
    lo = max(lo + 1, a - 50)
    his = [i for i in (text.find(ch, b) for ch in ".!?…\n") if i >= 0]
    hi = min(min(his) + 1 if his else len(text), b + 60)
    return re.sub(r"\s+", " ", text[lo:hi]).strip()


# 설명하는 글인지: 조사·어미·조건(~ 시)·금액이 둘레에 있어야 한다. 메뉴·탭 이름처럼 낱말만 늘어선 곳('릴레이 세일 라이브 특가 다다익선')은 근거가 못 된다
_SENTENCE = re.compile(r"[가-힣](을|를|는|은|에게|에서|으로|하면|하고|하여|해요|세요|니다|어요|아요|드려|받아|받으|까지|부터|마다)(?![가-힣])|\s시\s|\d\s*(원|%|명|개|장|일)|이벤트|참여")


def mech_hits(text: str) -> list[dict]:
    """기법마다 {name, hit(걸린 낱말), snip(그 낱말이 든 문장)} — 카드에서 '이 페이지에서는 이렇게 썼어요'로 보여 준다.
    낱말이 여러 번 나오면 설명하는 문장 속에 든 첫 번째 것을 쓴다. 메뉴·탭 이름에서만 걸리면 그 기법은 버린다 (근거를 보여 줄 수 없다)."""
    out = []
    for k, rx in _MECH_RX.items():
        for m in rx.finditer(text or ""):
            ctx = text[max(0, m.start() - 28):m.end() + 28]
            if not _SENTENCE.search(ctx):
                continue
            out.append({"name": k, "hit": m.group(0).strip(), "snip": _around(text, m.start(), m.end()),
                        "near": re.sub(r"\s+", " ", text[max(0, m.start() - 10):m.end() + 10]).strip()})   # 문장째로 화면에서 못 찾을 때 쓰는 짧은 토막
            break
    return out


def steps(text: str) -> list[str]:
    """계단식 구성의 단계 이름들: 'BENEFIT 1 단독 선발매 상품 BENEFIT 2 …' → ['단독 선발매 상품', …]"""
    ms = list(_STRUCT.finditer(text or ""))
    out, want = [], 1
    for i, m in enumerate(ms):
        if int(m.group(1)) != want:
            continue
        end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        label = re.sub(r"\s+", " ", text[m.end():min(end, m.end() + 26)]).strip(" :·-,.")
        out.append(label[:22] or f"{want}단계")
        want += 1
    return out if len(out) >= 3 else []


def phrases(text: str, title: str = "", n: int = 3) -> list[str]:
    """참고할 만한 문장: 8~48자, 숫자·안내 문구 위주가 아닌 것. 쉼표·대구가 있거나 말맛이 있는 문장을 앞에."""
    out, seen = [], set()
    for m in re.finditer(r"[^.!?…\n]{8,60}?(?:[.!?…]|(?<=[요다죠])\s)", text or ""):
        s = re.sub(r"\s+", " ", m.group(0)).strip(" .")
        if not 10 <= len(s) <= 48 or _NOISE.search(s) or s[0].isdigit():
            continue
        digits = sum(c.isdigit() or c in "%~," for c in s)
        hangul = sum("가" <= c <= "힣" for c in s)
        if digits > len(s) * 0.12 or hangul < len(s) * 0.55:
            continue
        key = re.sub(r"\W", "", s)[:14]
        if key in seen or (title and key and key in re.sub(r"\W", "", title)):
            continue
        seen.add(key)
        sc = (2 if "," in s else 0) + (2 if re.search(r"에서 .+으로|보다 |처럼|만의|담은|닮은|위한", s) else 0) + (1 if re.search(r"[요다죠]$", s) else 0) + (1 if 14 <= len(s) <= 36 else 0)
        out.append((sc, len(out), s))
    return [s for _sc, _i, s in sorted(out, key=lambda x: (-x[0], x[1]))[:n]]


def structure(text: str) -> str:
    """혜택 1·2·3… 계단식 구성이면 그 설명. 아니면 빈 글."""
    nums = sorted({int(x) for x in _STRUCT.findall(text or "")})
    run = 0
    for i, v in enumerate(nums, 1):
        if v != i:
            break
        run = i
    return f"혜택·이벤트를 {run}단계로 나눈 구성" if run >= 3 else ""


def analyze(title: str, text: str, role: str = "", visual: bool = False) -> dict:
    """글 한 덩이 → 분류(kind), 태그, 참고 문장, 보여 주는 이유."""
    full = f"{title} {text}"
    hits = mech_hits(full)
    mech = [h["name"] for h in hits]
    rare = [m for m in mech if m not in COMMON]
    ph = phrases(text, title)
    st = structure(text)
    stp = steps(text) if st else []
    kinds = [k for k, on in (("mech", rare), ("struct", st), ("copy", len(ph) >= 2), ("design", visual and role in VISUAL_ROLES)) if on]
    kind = kinds[0] if kinds else ("design" if visual else "copy" if ph else "")
    why = {"mech": f"판매 기법·이벤트: {' · '.join(rare[:3])}", "struct": st, "copy": "참고할 만한 문장이 있어요", "design": "화면 구성을 볼 수 있어요"}.get(kind, "")
    rare_hits = [h for h in hits if h["name"] not in COMMON]
    # 원본 화면에서 찾아 표시할 글: 기법은 그 낱말이 든 문장, 워딩은 첫 참고 문장, 구조는 첫 단계
    focus = {"mech": rare_hits[0]["snip"] if rare_hits else "", "copy": ph[0] if ph else "", "struct": stp[0] if stp else ""}.get(kind, "") or ""
    return {"kind": kind, "kinds": kinds or ([kind] if kind else []), "mech": mech, "hits": rare_hits[:3], "phrases": ph, "struct": st, "steps": stp[:6], "why": why, "focus": focus[:120],
            "focus_alt": ([h["near"] for h in rare_hits[:2]] if kind == "mech" else ph[1:3] if kind == "copy" else stp[1:3] if kind == "struct" else []),
            "desc": MECH_DESC.get(rare[0], "") if kind == "mech" else ""}


# ---------------- 후보 모으기 ----------------
BRAND = {"osulloc": "오설록", "kurly": "컬리", "29cm": "29CM", "zigzag": "지그재그", "oliveyoung": "올리브영", "shinsegaev": "신세계V", "kakao_gift": "카카오 선물하기", "user": "직접 추가"}


def _brand(key) -> str:
    m = discover.MARKETS.get(key) if key else None
    return (m or {}).get("label") or BRAND.get(key, key or "")


def _cid(prefix: str, key: str) -> str:
    return f"{prefix}{hashlib.sha1(key.encode('utf-8')).hexdigest()[:12]}"


_cand_cache: dict = {}


def _mt(p: Path) -> float:
    try:
        return p.stat().st_mtime
    except OSError:
        return 0.0


def candidates() -> list[dict]:
    """카드 후보 전체 (본 것 포함). 원천 파일이 그대로면 지난 계산을 그대로 쓴다."""
    key = (str(discover._file()), _mt(discover._file()), _mt(refs.USER_DIR / "sections.jsonl"), _mt(refs.USER_DIR / "pages.json"), _mt(refs.USER_DIR / "hidden.json"))
    if _cand_cache.get("key") != key:
        _cand_cache.update(key=key, out=_enrich(_new_promos() + _sections()))
    return _cand_cache["out"]


TEMPLATE_MIN = 8   # 한 마켓의 페이지 이만큼에 똑같은 낱말로 나오면 그 마켓의 '틀 문구'로 본다


def _drop_templates(cands: list[dict]) -> list[dict]:
    """마켓이 기획전마다 똑같이 넣는 틀 문구(29CM의 '단독 선발매 상품'·'당첨자 발표'·'리뷰 이벤트' 등)는 그 페이지만의 기법이 아니다.
    같은 마켓에서 같은 기법이 같은 낱말로 TEMPLATE_MIN개 넘는 페이지에 나오면 기법에서 뺀다 → 매일 같은 카드가 되풀이되던 문제.
    빼고 나서 남는 게 없으면 워딩·구조·디자인 카드로 다시 분류하고, 그것도 아니면 후보에서 뺀다."""
    cnt: dict = {}
    for c in cands:
        for h in c.get("hits") or []:
            k = (c["brand"], h["name"], h["hit"])
            cnt[k] = cnt.get(k, 0) + 1
    # 구조도 마찬가지: 한 마켓의 기획전이 전부 같은 '혜택 1·2·3' 틀이면 그 페이지만의 구성이 아니다
    st_n: dict = {}
    for c in cands:
        if c.get("struct"):
            st_n[c["brand"]] = st_n.get(c["brand"], 0) + 1
    out = []
    for c in cands:
        tpl = {h["name"] for h in c.get("hits") or [] if cnt.get((c["brand"], h["name"], h["hit"]), 0) >= TEMPLATE_MIN}
        st_tpl = bool(c.get("struct")) and st_n.get(c["brand"], 0) >= TEMPLATE_MIN and not c.get("own")
        if st_tpl:
            c = dict(c, struct="", steps=[], kinds=[k for k in c["kinds"] if k != "struct"])
            if c["kind"] == "struct":
                if not c["kinds"] and c["phrases"]:
                    c["kinds"] = ["copy"]
                if not c["kinds"]:
                    continue
                c["kind"] = c["kinds"][0]
                c["why"] = {"mech": c["why"], "copy": "참고할 만한 문장이 있어요", "design": "화면 구성을 볼 수 있어요"}[c["kind"]]
                if c["kind"] != "mech":
                    c["focus"], c["focus_alt"] = (c["phrases"][0] if c["phrases"] else "")[:120], c["phrases"][1:3]
        if not tpl or c.get("own"):
            out.append(c); continue
        c = dict(c)
        c["hits"] = [h for h in c["hits"] if h["name"] not in tpl]
        c["mech"] = [m for m in c["mech"] if m not in tpl]
        if c["kind"] == "mech" and not c["hits"]:
            kinds = [k for k in c["kinds"] if k != "mech"]
            if not kinds and len(c["phrases"]) >= 1:
                kinds = ["copy"]
            if not kinds:
                continue
            c["kinds"], c["kind"], c["desc"] = kinds, kinds[0], ""
            c["why"] = {"struct": c["struct"], "copy": "참고할 만한 문장이 있어요", "design": "화면 구성을 볼 수 있어요"}[c["kind"]]
            c["focus"] = (c["steps"][0] if c["kind"] == "struct" and c["steps"] else c["phrases"][0] if c["phrases"] else "")[:120]
            c["focus_alt"] = c["steps"][1:3] if c["kind"] == "struct" else c["phrases"][1:3]
        elif c["kind"] == "mech":
            h = c["hits"][0]
            c["desc"], c["focus"], c["focus_alt"] = MECH_DESC.get(h["name"], ""), h["snip"][:120], [x["near"] for x in c["hits"][:2]]
            c["why"] = f"판매 기법·이벤트: {' · '.join(x['name'] for x in c['hits'][:3])}"
        out.append(c)
    return out


GRADE_KO = {3: "눈여겨볼 만해요", 2: "참고할 만해요", 1: "가볍게 보기"}


def _enrich(cands: list[dict]) -> list[dict]:
    """카드마다 '좋은지 아닌지' 판단 근거(signals)와 3단계 평가(grade)를 붙인다. 근거는 전체 후보를 놓고 센 값이라 여기서 한꺼번에 계산한다.
    - 오설록 페이지에서 써 본 방식인가 (안 써 봤으면 새로 시도해 볼 거리)
    - 드문 방식인가 (전체의 5% 미만) / 요즘 여러 브랜드가 같이 쓰는가 (새 프로모션 기준 3곳 이상)
    - 참고 가치 점수(신규 찾기 규칙), 새로 올라왔나, 참고 문장이 있나"""
    cands = _drop_templates(cands)
    n = max(1, len(cands))
    df, brands, own = {}, {}, set()
    for c in cands:
        for m in c["mech"]:
            df[m] = df.get(m, 0) + 1
            if c["src"] == "new":
                brands.setdefault(m, set()).add(c["brand"])
            if c.get("own"):
                own.add(m)
    for c in cands:
        sig, pts = [], 0
        rare = [m for m in c["mech"] if m not in COMMON]
        if c["kind"] == "mech" and rare:
            m = min(rare, key=lambda x: df.get(x, 0))
            if not any(x in own for x in rare):
                sig.append({"t": "오설록 페이지에는 아직 없는 방식", "good": True}); pts += 2
            else:
                sig.append({"t": "오설록도 써 본 방식", "good": False})
            if df.get(m, 0) / n < 0.05:
                sig.append({"t": f"드문 방식 · 모아 둔 {n}개 중 {df[m]}개", "good": True}); pts += 2
            b = max((len(brands.get(x, ())) for x in rare), default=0)
            if b >= 3:
                sig.append({"t": f"요즘 {b}개 마켓이 같이 쓰는 중", "good": True}); pts += 1
        if c["kind"] == "copy":
            pts += 1 + (1 if len(c["phrases"]) >= 3 else 0)
            sig.append({"t": f"참고 문장 {len(c['phrases'])}개", "good": len(c["phrases"]) >= 3})
        if c["kind"] == "struct":
            pts += 2
            sig.append({"t": f"{len(c.get('steps') or [])}단계 구성", "good": True})
        if c.get("score") is not None:
            if c["score"] >= 70:
                sig.append({"t": f"참고 가치 {c['score']}점", "good": True}); pts += 1
            elif c.get("low"):
                sig.append({"t": f"참고 가치 낮음 {c['score']}점", "good": False}); pts -= 2
        if c.get("own"):
            sig.append({"t": "우리 페이지", "good": False})
        c["signals"], c["pts"] = sig[:4], pts
        c["grade"] = 3 if pts >= 4 else 2 if pts >= 2 else 1
    return cands


def _new_promos() -> list[dict]:
    out = []
    raw = discover._load()
    for m in discover.view():
        fp = {x["url"]: x.get("fp") or "" for x in (raw.get(m["key"]) or {}).get("items", [])}
        for x in m["items"]:
            text = fp.get(x["url"], "")
            if len(text) < 40:   # 제목만 있고 내용을 못 읽은 링크는 카드로 만들 게 없다
                continue
            a = analyze(x["title"], text)
            if not a["kind"]:
                continue
            out.append({"id": _cid("d", x["url"]), "src": "new", "brand": m["label"], "title": x["title"][:80], "url": x["url"], "text": re.sub(r"\s+", " ", text)[:320],
                        "first_seen": x.get("first_seen", ""), "score": x.get("score"), "low": bool(x.get("low")), "own": m["key"] == "osulloc", **a})
    return out


def _sections() -> list[dict]:
    out, pages, hidden = [], {}, set()
    try:
        pages = json.loads((refs.USER_DIR / "pages.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    try:
        hidden = set(json.loads((refs.USER_DIR / "hidden.json").read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError):
        pass
    try:
        lines = (refs.USER_DIR / "sections.jsonl").read_text(encoding="utf-8").splitlines()
    except OSError:
        lines = []
    for l in lines:
        if not l.strip():
            continue
        r = json.loads(l)
        text, pid = r.get("text") or "", r.get("page_id")
        if r.get("role") in SKIP_ROLES or len(text) < 30 or pid in hidden or pid not in pages or _UI_NOISE.search((r.get("title") or "")[:30]):
            continue
        cap = bool(refs.capture_info(pid))
        a = analyze(r.get("title") or "", text, r.get("role") or "", cap)
        if not a["kind"]:
            continue
        pg = pages[pid]
        out.append({"id": f"s{r['id']}", "src": "lib", "ref": r["id"], "page": pid, "psec": r.get("title") or "", "tl": len(text), "role": r.get("role") or "", "cap": cap,
                    "brand": _brand(r.get("brand")),
                    "title": (r.get("title") or pg.get("name") or "")[:80], "campaign": (pg.get("name") or "")[:80], "url": pg.get("url") or r.get("url") or "",
                    "text": re.sub(r"\s+", " ", text)[:320], "first_seen": (pg.get("collected_at") or "")[:10], "score": None, "low": False, "own": r.get("brand") == "osulloc", **a})
    return out


# ---------------- 상태(본 것·저장한 것) ----------------
def _file() -> Path:
    return DIR / "state.json"


def _load() -> dict:
    try:
        d = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        d = {}
    d.setdefault("seen", {}); d.setdefault("saved", {})
    return d


def _save(d: dict):
    DIR.mkdir(parents=True, exist_ok=True)
    tmp = _file().with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_file())


# ---------------- 취향 ----------------
def feats(c: dict) -> list[str]:
    return [f"kind:{k}" for k in c.get("kinds") or []] + [f"mech:{m}" for m in c.get("mech") or [] if m not in COMMON] + ([f"brand:{c['brand']}"] if c.get("brand") else []) + ([f"src:{c['src']}"] if c.get("src") else [])


def weights(state: dict) -> dict:
    """특징(분류·기법·브랜드)마다 저장/넘기기 횟수 → 선호 점수. 기록이 적으면 0에 가깝게(성급하게 치우치지 않게)."""
    like, nope = {}, {}
    for v in state["seen"].values():
        for f in v.get("f") or []:
            (like if v.get("act") == "save" else nope)[f] = (like if v.get("act") == "save" else nope).get(f, 0) + 1
    out = {}
    for f in set(like) | set(nope):
        a, b = like.get(f, 0), nope.get(f, 0)
        out[f] = round(math.log((a + 2) / (b + 2)) * min(1.0, (a + b) / 6), 3)
    return out


def taste(state: dict | None = None) -> dict:
    """화면에 보여 줄 취향 요약: 자주 저장한 것 / 자주 넘긴 것."""
    state = state or _load()
    w = weights(state)
    name = lambda f: KIND_KO.get(f[5:], f[5:]) if f.startswith("kind:") else f.split(":", 1)[1]
    pick = lambda items: [name(f) for f, _v in items if not f.startswith("src:")][:4]
    acts = [v.get("act") for v in state["seen"].values()]
    return {"likes": pick(sorted(((f, v) for f, v in w.items() if v >= 0.25), key=lambda x: -x[1])),
            "passes": pick(sorted(((f, v) for f, v in w.items() if v <= -0.25), key=lambda x: x[1])),
            "saved": acts.count("save"), "passed": acts.count("pass")}


# ---------------- 덱 만들기 ----------------
def _base(c: dict, df: dict, n: int, today: date) -> float:
    s = 50.0
    try:
        age = (today - date.fromisoformat((c.get("first_seen") or "")[:10])).days
    except ValueError:
        age = 99
    if c["src"] == "new":
        s += 22 if age <= 1 else 14 if age <= 3 else 6 if age <= 7 else 0
        if c.get("score") is not None:
            s += (c["score"] - 50) * 0.2
        if c.get("low"):
            s -= 25
    s += min(28.0, sum(math.log(n / (1 + df.get(m, 0))) * 5 for m in c["mech"] if m not in COMMON))   # 드문 기법일수록 높게
    s += len(c["phrases"]) * 3 + (6 if c["struct"] else 0)
    s += (c.get("grade", 1) - 1) * 8          # 평가가 높은 카드를 앞에
    return s


# ---------------- 근거 검증 ----------------
# 원칙 하나 (2026-11-14): **카드가 말하는 글이, 표시한 자리의 실제 화면 글 안에 들어 있을 때만 카드로 낸다.**
# 지금까지 따로따로 나온 문제(빈 화면에 표시, 메뉴 낱말을 기법으로 잡음, 분류가 바뀐 뒤 남은 옛 표시, 엉뚱한 자리 표시)는 전부 이 검사 하나에서 걸린다.
#   ok       사진이 있고, 표시 자리의 화면 글에 카드의 핵심 글(claim)이 들어 있다 → 덱에 낸다
#   pending  아직 사진으로 확인하지 못했다 (사진 없음·옛 방식 사진·분석 규칙이 바뀌어 다시 봐야 함) → 덱에 내지 않고 '확인 전 후보'로 센다
#   rejected 확인했는데 화면에서 근거를 못 찾았다 → 내지 않는다
def _nz(t: str) -> str:
    return re.sub(r"[^0-9a-zㄱ-ㆎ가-힣]", "", (t or "").lower())


def claim(c: dict) -> str:
    """이 카드가 화면에서 꼭 보여야 하는 글: 기법은 걸린 낱말, 워딩은 첫 문장, 구조는 첫 단계, 디자인은 구좌 글 앞부분."""
    k = c.get("kind")
    if k == "mech":
        return ((c.get("hits") or [{}])[0].get("hit") or "")
    if k == "copy":
        return ((c.get("phrases") or [""])[0])[:16]
    if k == "struct":
        return ((c.get("steps") or [""])[0])[:12]
    return (c.get("psec") or c.get("text") or "")[:10]


def sig(c: dict) -> str:
    """무엇을 찾아 확인했는지의 지문. 분석 규칙이나 분류가 바뀌어 찾을 글이 달라지면 지문도 달라져, 옛 확인 결과를 다시 쓰지 않는다."""
    return hashlib.sha1("|".join([c.get("kind") or "", claim(c), *_texts(c)]).encode("utf-8")).hexdigest()[:10]


def evidence(c: dict) -> tuple[str, dict | None]:
    """(상태, 표시 자리). 상태는 ok / pending / rejected."""
    info = shot_info(c)
    if not info or info.get("old_shot"):
        return "pending", None
    m = _meta(shot_id(c))
    if (m.get("tried") or {}).get(c["id"]) != sig(c):
        return "pending", None   # 이 카드(지금 내용)로는 아직 확인한 적이 없다
    spot = info.get("spot")
    want = _nz(claim(c))
    if not spot or len(want) < 2 or want not in _nz(spot.get("txt") or ""):
        return "rejected", None
    return "ok", spot


def deck(n: int = DECK, today: date | None = None) -> dict:
    """오늘 볼 카드 n장 (안 본 것, 화면에서 근거가 확인된 것만). 점수순으로 고르되 같은 브랜드·분류가 몰리지 않게 하고, 몇 장은 취향과 상관없이 넣는다."""
    today = today or date.today()
    state = _load()
    cands = candidates()
    # 우리 페이지는 '써 본 방식' 판단에만 쓰고 카드로는 내지 않는다 (영감은 밖에서)
    fresh = [c for c in cands if c["id"] not in state["seen"] and not c.get("own")]
    ev = {c["id"]: evidence(c) for c in fresh}
    pool = [c for c in fresh if ev[c["id"]][0] == "ok"]
    pending = sum(1 for c in fresh if ev[c["id"]][0] == "pending")
    df: dict = {}
    for c in cands:
        for m in c["mech"]:
            df[m] = df.get(m, 0) + 1
    w = weights(state)
    scored = []
    shown: dict = {}   # 기법마다 지금까지 카드로 본 횟수 → 이미 여러 번 본 기법은 뒤로 (날마다 같은 얘기가 되풀이되지 않게)
    for v in state["seen"].values():
        for f in v.get("f") or []:
            if f.startswith("mech:"):
                shown[f[5:]] = shown.get(f[5:], 0) + 1
    for c in pool:
        pref = max(-18.0, min(18.0, sum(w.get(f, 0) for f in feats(c)) * 7))
        tired = min(20.0, shown.get((c.get("hits") or [{}])[0].get("name"), 0) * 5.0) if c["kind"] == "mech" else 0.0
        scored.append((_base(c, df, len(cands), today) - tired, pref, c))
    picked, brand_n, kind_n, mech_seen, page_seen = [], {}, {}, set(), set()
    lead_of = lambda c: (c.get("hits") or [{}])[0].get("name") if c["kind"] == "mech" else "구조" if c["kind"] == "struct" else None   # 같은 기법은 하루에 한 장만 (같은 얘기를 여러 번 보지 않게)
    # 분류마다 고르게(기본 n/3장), 자주 저장한 분류는 조금 더·자주 넘긴 분류는 조금 덜 (그래도 1장은 남긴다)
    cap = {k: max(1, round(n / 3 + max(-2.0, min(2.0, w.get(f"kind:{k}", 0) * 3)))) for k in KIND_KO}

    def take(rank, limit):
        for b, p, c in sorted(scored, key=rank, reverse=True):
            if len(picked) >= limit:
                break
            if c in picked:
                continue
            if brand_n.get(c["brand"], 0) >= max(3, n // 3) or kind_n.get(c["kind"], 0) >= cap.get(c["kind"], 4) or (lead_of(c) and lead_of(c) in mech_seen) or c.get("url") in page_seen:
                continue
            page_seen.add(c.get("url") or c["id"])   # 같은 페이지에서는 한 장만
            picked.append(c); brand_n[c["brand"]] = brand_n.get(c["brand"], 0) + 1; kind_n[c["kind"]] = kind_n.get(c["kind"], 0) + 1; mech_seen.add(lead_of(c))
    take(lambda x: x[0] + x[1], n - EXPLORE)
    # 취향 밖에서 고르는 장: 취향 점수는 빼고, 날짜로 정한 순서로 (같은 날 다시 열어도 같은 카드)
    take(lambda x: (x[0] * 0.3 + int(hashlib.sha1(f"{today}{x[2]['id']}".encode()).hexdigest()[:6], 16) % 60), n)
    if len(picked) < n:   # 고르게 섞는 규칙 때문에 모자라면 남은 것에서 점수순으로 채운다
        for b, p, c in sorted(scored, key=lambda x: x[0] + x[1], reverse=True):
            if len(picked) >= n:
                break
            if c not in picked and not (lead_of(c) and lead_of(c) in mech_seen):
                picked.append(c); mech_seen.add(lead_of(c))
    cards = [_card(c) for c in picked]
    return {"cards": cards, "left": len(pool) - len(picked), "total": len(cands), "taste": taste(state), "saved_n": len(state["saved"]),
            "kinds": KIND_KO, "today": today.isoformat(), "pending": pending, "no_screen": 0}


def to_verify(n: int) -> list[dict]:
    """아직 화면으로 확인하지 못한 후보 중 먼저 확인할 것 n개 (점수순, 같은 페이지는 한 번). 화면 받기가 이 목록을 받아 확인한다."""
    state, today = _load(), date.today()
    cands = candidates()
    df: dict = {}
    for c in cands:
        for m in c["mech"]:
            df[m] = df.get(m, 0) + 1
    w = weights(state)
    rows = []
    for c in cands:
        if c["id"] in state["seen"] or c.get("own") or not c.get("url") or evidence(c)[0] != "pending":
            continue
        rows.append((_base(c, df, len(cands), today) + max(-18.0, min(18.0, sum(w.get(f, 0) for f in feats(c)) * 7)), c))
    out, seen_sid, kind_n = [], set(), {}
    for _sc, c in sorted(rows, key=lambda x: -x[0]):
        sid = shot_id(c)
        if sid in seen_sid or kind_n.get(c["kind"], 0) >= max(2, n // 2):   # 한 분류만 확인하지 않게
            continue
        seen_sid.add(sid); kind_n[c["kind"]] = kind_n.get(c["kind"], 0) + 1
        out.append(c)
        if len(out) >= n:
            break
    return out


def _card(c: dict) -> dict:
    sid = screen_id(c)
    return {k: c.get(k) for k in ("id", "src", "brand", "title", "campaign", "url", "text", "kind", "kinds", "phrases", "struct", "steps", "hits", "desc", "focus", "focus_alt", "why", "psec", "tl", "role", "ref",
                                  "first_seen", "signals", "grade")} | {
        "tags": list(c["mech"]), "kind_name": KIND_KO.get(c["kind"], ""), "grade_name": GRADE_KO.get(c.get("grade", 1), ""), "page": sid, **shot_info(c)} | {
        "cap": bool(sid or shot_info(c)), "spot": evidence(c)[1], "claim": claim(c)}


# ---------------- 실제 화면 ----------------
# 카드마다 '실제 페이지에서 어떻게 쓰였는지'를 보여 주려면 진짜 화면이 필요하다. 레퍼런스 라이브러리는 이미지 파일을 저장하지 않아서(정책)
# 쿠폰·배너가 이미지인 페이지는 다시 그리면 글자만 남아 깨져 보였다 → 이 화면만은 페이지를 사진(JPEG)으로 찍어 둔다 (2026-11-14 결정).
# - 저장 위치: ai_inspire/capture/<화면 id>/shot.jpg + meta.json (이 PC에만. 라이브러리·스냅샷 공유에는 들어가지 않는다)
# - 언제: 아침 자동 확인이 끝난 뒤, 또는 화면의 [화면 받아 오기]. 곧 보여 줄 카드 것만 받는다
# - 표시할 자리(spot): 사진을 찍는 그 순간의 페이지에서 카드의 글을 찾아 세로 위치를 재 둔다 (다시 그려서 재면 이미지가 빠져 위치가 틀어진다)
# - 지우기: 넘긴 카드 것과 2주 넘은 것은 지운다. 저장한 카드 것은 남긴다
PREVIEW_KEEP_DAYS = 14
SHOT_MAX_H = 14000     # 사진 세로 한도(px). 그보다 긴 페이지는 위에서부터 이만큼만
SHOT_QUALITY = 60
BLANK_BYTES = 7000     # 화면 한 장(390×844 JPEG)이 이보다 작으면 거의 빈 화면으로 본다 (그 자리에는 표시를 붙이지 않는다)


def _pdir() -> Path:
    return DIR / "capture"


def shot_id(c: dict) -> str:
    """카드의 화면 id: 새 프로모션은 카드 id, 모아 둔 구좌는 페이지 주소로 (같은 페이지의 구좌들이 사진 한 장을 같이 쓴다)."""
    if c.get("src") == "lib":
        return _cid("p", c.get("url") or c.get("page") or c["id"])
    return c["id"]


def _meta(sid: str) -> dict:
    try:
        return json.loads((_pdir() / sid / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def shot_info(c: dict) -> dict:
    """카드에 붙일 화면 정보: {shot: 첫 장 주소, tiles: [{src, y, h}], shot_h: 전체 세로 px(폭 390 기준), spot: {y, h} | None}. 사진이 없으면 {}.
    사진은 화면 높이만큼씩 내려가며 나눠 찍은 여러 장이다(tiles). 화면이 y 위치에 차례로 쌓아 한 장처럼 보여 준다."""
    sid = shot_id(c)
    d = _pdir() / sid
    m = _meta(sid)
    tiles = m.get("tiles")
    if not tiles and (d / "shot.jpg").exists():   # 예전에 통째로 한 장 찍어 둔 것
        tiles = [{"n": 0, "y": 0, "h": m.get("h") or 0, "bytes": BLANK_BYTES}]
    if not tiles or not shot_file(sid, tiles[0]["n"]):
        return {}
    v = int(m.get("v") or 0) or int((d / "meta.json").stat().st_mtime if (d / "meta.json").exists() else 0)
    out = [{"src": f"/refimg/inspire/{sid}/{t['n']}?v={v}", "y": t["y"], "h": t["h"]} for t in tiles]
    spot = (m.get("spots") or {}).get(c["id"])
    if spot and any(t["y"] <= spot["y"] < t["y"] + t["h"] and t.get("bytes", BLANK_BYTES) < BLANK_BYTES for t in tiles):
        spot = None   # 그 자리가 사진에서 비어 있다 (스크롤해도 안 그려진 구역) → 엉뚱한 흰 칸에 표시하지 않는다
    return {"shot": out[0]["src"], "tiles": out, "shot_h": m.get("h") or 0, "spot": spot} | ({} if m.get("tiles") else {"old_shot": True})


def shot_file(sid: str, n: int = 0) -> Path | None:
    if not re.fullmatch(r"[dp][0-9a-f]{12}", sid or "") or not 0 <= int(n) < 40:
        return None
    d = _pdir() / sid
    f = d / f"shot_{int(n)}.jpg"
    if not f.exists() and int(n) == 0:
        f = d / "shot.jpg"
    return f if f.exists() else None


def screen_id(c: dict) -> str:
    """사진이 없을 때 쓰는 대신 화면: 모아 둔 구좌는 레퍼런스의 화면 수집본(이미지 없이 다시 그림). 새 프로모션은 없음."""
    return c["page"] if c.get("src") == "lib" and c.get("cap") else ""


def load_preview(cid: str) -> str | None:
    """예전 방식(HTML로 받아 둔 새 프로모션 화면). 이제는 사진을 쓰지만 이미 받아 둔 것은 읽을 수 있게 둔다."""
    import gzip
    if not re.fullmatch(r"d[0-9a-f]{12}", cid or ""):
        return None
    try:
        return gzip.decompress((_pdir() / cid / "page.html.gz").read_bytes()).decode("utf-8", "replace")
    except OSError:
        return None


# 페이지 안에서 글이 든 가장 안쪽 요소를 찾아 세로 위치를 잰다 (공백·기호·대소문자는 무시하고 비교). 받는 값 {카드 id: [찾을 글…]} → {카드 id: {y, h}}
_FIND_JS = r"""(want) => {
  const nz = t => String(t || '').toLowerCase().replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, '');
  const els = [...document.body.querySelectorAll('*')].filter(e => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(e.tagName));
  const txt = new Map(els.map(e => [e, nz(e.textContent)]));
  // 눈에 보이는 요소만: 접혀 있거나 투명한(아직 안 나타난) 글에 표시하면 사진에서는 빈 자리다
  const seen = e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.2) return false; } const r = e.getBoundingClientRect(); return r.left < innerWidth && r.right > 0; };
  const out = {};
  for (const [id, texts] of Object.entries(want)) {
    for (const t of texts) {
      const full = nz(t); if (full.length < 4) continue;
      const keys = [full.slice(0, 22), full.slice(Math.max(0, Math.floor(full.length / 2) - 8), Math.floor(full.length / 2) + 8), full.slice(-14)].filter(k => k.length >= 4);
      let best = null;
      for (const k of keys) {
        for (const e of els) { const s = txt.get(e); if (!s.includes(k)) continue; const r = e.getBoundingClientRect(); if (r.height < 8 || r.width < 20 || !seen(e)) continue; if (!best || s.length < txt.get(best).length) best = e; }
        if (best) break;
      }
      if (!best) continue;
      while (best.parentElement && best.getBoundingClientRect().height < 28 && txt.get(best.parentElement).length < full.length * 3 + 60) best = best.parentElement;   // 한 줄짜리 글은 그 묶음까지
      const r = best.getBoundingClientRect();
      if (r.height > 900) continue;   // 페이지 통째로 잡힌 것은 표시로 쓸모가 없다
      out[id] = { y: Math.round(r.top + scrollY), h: Math.round(r.height), t: t.slice(0, 80), txt: String(best.innerText || best.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) }; break;
    }
  }
  return out;
}"""

_job = {"state": "idle", "done": 0, "total": 0, "ok": 0, "msg": ""}


def _texts(c: dict) -> list[str]:
    alt = list(c.get("focus_alt") or [])
    first = alt + [c.get("focus")] if c.get("kind") == "mech" else [c.get("focus")] + alt   # 기법은 그 낱말 바로 둘레(짧은 토막)를 먼저 찾아야 표시가 좁게 잡힌다
    return [t for t in [*first, (c.get("text") or "")[:60] if c.get("src") == "lib" else ""] if t]


def prefetch(n: int = DECK, pause: float = 2.0, job: dict | None = None) -> dict:
    """아직 화면으로 확인하지 못한 후보 n개의 실제 화면을 받아, 카드가 말하는 글이 그 화면에 보이는지 확인한다. 확인된 것만 덱에 나온다."""
    import time
    from . import render
    job = job if job is not None else {}
    if not render.available():
        job.update(state="done", msg="브라우저 수집 도구(playwright·Chrome)가 없어요")
        return job
    cands = {c["id"]: c for c in candidates()}
    todo: dict = {}   # 화면 id → 주소 (같은 페이지는 한 번만)
    for c in to_verify(n):
        todo.setdefault(shot_id(c), c["url"])
    job.update(state="running", total=len(todo), done=0, ok=0, msg="")
    for sid, url in todo.items():
        d = _pdir() / sid
        want = {c["id"]: _texts(c) for c in cands.values() if shot_id(c) == sid}   # 이 사진을 같이 쓰는 카드 전부의 자리를 한 번에 잰다

        def grab(pg, d=d, want=want):
            """화면 높이만큼씩 내려가며 한 장씩 찍는다. 한 번에 통째로 찍으면 스크롤해야 나타나는 구역이 빈 채로 찍혔다 (2026-11-14)."""
            import shutil
            shutil.rmtree(d, ignore_errors=True)
            d.mkdir(parents=True, exist_ok=True)
            vh = render.VIEW_H
            h = int(min(pg.evaluate("document.documentElement.scrollHeight"), SHOT_MAX_H))
            tiles, y, n = [], 0, 0
            while y < h and n < 40:
                pg.evaluate(f"window.scrollTo(0,{y})")
                pg.wait_for_timeout(380)   # 스크롤로 나타나는 구역이 다 그려질 때까지
                at = int(pg.evaluate("scrollY"))
                if n == 1:   # 둘째 장부터는 화면에 붙어 다니는 머리띠·버튼을 숨긴다 (장마다 되풀이돼 찍히지 않게)
                    pg.evaluate("[...document.querySelectorAll('*')].forEach(e => { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') e.style.setProperty('visibility', 'hidden', 'important'); })")
                    pg.wait_for_timeout(60)
                f = d / f"shot_{n}.jpg"
                pg.screenshot(path=str(f), type="jpeg", quality=SHOT_QUALITY)
                tiles.append({"n": n, "y": at, "h": vh, "bytes": f.stat().st_size})
                if at + vh >= h or at < y:   # 끝까지 왔다
                    break
                y += vh; n += 1
            h = min(h, tiles[-1]["y"] + vh)
            spots = pg.evaluate(_FIND_JS, want)
            return {"h": h, "tiles": tiles, "v": int(time.time()), "spots": {k: v for k, v in spots.items() if v["y"] < h},
                    "tried": {k: sig(cands[k]) for k in want}}   # 이 카드들을 이 내용으로 확인해 봤다는 기록 (못 찾은 것도 남겨, 같은 것을 되풀이해 받지 않는다)
        try:
            res = render.capture(url, extra=grab)
            ex = res.get("extra") if res.get("ok") else None
            if ex and ex.get("tiles"):
                (d / "meta.json").write_text(json.dumps({"url": url, "captured_at": _now(), **ex}, ensure_ascii=False), encoding="utf-8")
                job["ok"] = job.get("ok", 0) + 1
        except Exception:
            pass
        job["done"] = job.get("done", 0) + 1
        time.sleep(pause)
    _prune_previews()
    job.update(state="done", msg=f"{job.get('ok', 0)}개 화면을 확인했어요" if todo else "확인할 후보가 없어요")
    return job


def _prune_previews():
    """넘긴 카드의 화면, 2주 넘은 화면은 지운다 (저장한 카드 것은 남긴다)."""
    import shutil
    import time
    state = _load()
    keep = {shot_id(c) for c in state["saved"].values()}
    try:
        dirs = list(_pdir().iterdir())
    except OSError:
        return
    for d in dirs:
        if d.name in keep:
            continue
        old = time.time() - d.stat().st_mtime > PREVIEW_KEEP_DAYS * 86400
        if old or state["seen"].get(d.name, {}).get("act") == "pass":
            shutil.rmtree(d, ignore_errors=True)


def prefetch_start(n: int = DECK) -> dict:
    with _lock:
        if _job["state"] == "running":
            return dict(_job)
        _job.update(state="running", done=0, total=0, ok=0, msg="")
    threading.Thread(target=prefetch, args=(n, 2.0, _job), daemon=True).start()
    return dict(_job)


def prefetch_status() -> dict:
    return dict(_job)


def _find(cid: str) -> dict | None:
    return next((c for c in candidates() if c["id"] == cid), None)


def swipe(cid: str, act: str) -> dict:
    """act: save(오른쪽) / pass(왼쪽) / undo(방금 것 되돌리기)."""
    with _lock:
        state = _load()
        if act == "undo":
            state["seen"].pop(cid, None)
            was = state["saved"].pop(cid, None)
            _save(state)
            if was and was.get("ref"):
                _favorite(was["ref"], False)
            return {"ok": True, "saved_n": len(state["saved"]), "taste": taste(state)}
        c = _find(cid)
        if not c:
            return {"ok": False, "error": "없는 카드예요 (목록이 바뀌었을 수 있어요)"}
        state["seen"][cid] = {"act": act, "at": _now(), "f": feats(c)}
        if act == "save":
            state["saved"][cid] = {**_card(c), "memo": "", "saved_at": _now()}
            if len(state["saved"]) > MAX_SAVED:
                for k in sorted(state["saved"], key=lambda k: state["saved"][k]["saved_at"])[:len(state["saved"]) - MAX_SAVED]:
                    state["saved"].pop(k)
        _save(state)
    if act == "save" and c.get("ref"):
        _favorite(c["ref"], True)   # 수집된 구좌는 레퍼런스 즐겨찾기에도 넣어, 레퍼런스 화면·구좌 편집에서 먼저 보이게
    return {"ok": True, "saved_n": len(state["saved"]), "taste": taste(state)}


def _favorite(ref_id: str, on: bool):
    try:
        from .. import references
        references.set_favorite(ref_id, on)
    except Exception:
        pass   # 즐겨찾기 연동이 실패해도 보관함 저장은 그대로


def saved() -> dict:
    state = _load()
    items = sorted(state["saved"].values(), key=lambda x: x["saved_at"], reverse=True)
    for it in items:   # 저장한 뒤에 화면을 받았을 수도 있으므로 지금 기준으로 다시 본다
        keep = it.get("spot")   # 저장할 때 확인된 표시 자리는 그대로 둔다 (지금 다시 잰 값으로 바꾸지 않는다)
        for k in ("shot", "tiles", "shot_h", "spot", "old_shot"):
            it.pop(k, None)
        it.update(shot_info(it))
        it["spot"] = keep if it.get("shot") and not it.get("old_shot") else None
        it["cap"] = bool(it.get("page") or it.get("shot"))
    return {"items": items, "kinds": KIND_KO, "taste": taste(state)}


def edit(cid: str, memo: str | None = None, remove: bool = False) -> dict:
    with _lock:
        state = _load()
        it = state["saved"].get(cid)
        if not it:
            return {"ok": False, "error": "보관함에 없는 카드예요"}
        if remove:
            state["saved"].pop(cid)
            if cid in state["seen"]:
                state["seen"][cid]["act"] = "pass"   # 뺀 것은 다시 덱에 나오지 않고, 취향에서도 '저장'으로 세지 않는다
        elif memo is not None:
            it["memo"] = memo[:300]
        _save(state)
    if remove and it.get("ref"):
        _favorite(it["ref"], False)
    return {"ok": True, "saved_n": len(state["saved"])}


def reset_taste() -> dict:
    """취향 기록만 지운다: 넘긴 카드는 다시 나올 수 있고, 저장한 카드는 보관함에 그대로 남는다."""
    with _lock:
        state = _load()
        state["seen"] = {k: {"act": "save", "at": v.get("at", ""), "f": []} for k, v in state["seen"].items() if k in state["saved"]}
        _save(state)
    return {"ok": True, "taste": taste(state)}


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="오늘의 영감: 새 프로모션 카드의 화면을 미리 받아 두기")
    ap.add_argument("cmd", choices=["prefetch"])
    ap.add_argument("--n", type=int, default=DECK)
    a = ap.parse_args(argv)
    print(prefetch(a.n).get("msg", ""))


if __name__ == "__main__":
    main()

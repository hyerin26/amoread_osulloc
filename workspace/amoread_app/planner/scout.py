# -*- coding: utf-8 -*-
"""
트렌드 스카우트: 정해 둔 상품 키워드 없이 '요즘 뜨는 것'을 찾고 오설록과 엮는다. (AI 호출 없음, 비용 없음)

1 넓은 그물  네이버 검색 API(뉴스·블로그, 최신순)로 상위 개념 질의(settings/스카우트질의.csv)를 긁는다
2 후보 뽑기  제목·요약에서 규칙으로 후보 말을 뽑는다
             - 따옴표·꺾쇠로 감싼 말, '열풍·유행·대란·품절·오픈런' 같은 말 바로 앞의 말, #해시태그
             - 여러 글에 반복해서 나오는 먹거리·음료 말(접미어 사전)
             - 최근 7일 글 수 vs 그 전 글 수로 '새로 늘어난' 정도를 잰다
3 검증       네이버 데이터랩 검색량(주별 12주)으로 진짜 오르는지 확인 → 떠오르는 중/정점/식는 중/꾸준
4 엮기       규칙 사전으로 연결 유형을 고른다: 같은 것 / 곁들임 / 상황 / 대체 / 가치 → 추천 상품군·카피 씨앗
5 쌓기       기획자가 [계속 보기]한 말은 다음 실행 때 다시 검증한다(감시 목록이 스스로 자람)

보내는 것: 질의어·후보 말뿐 (실적·고객 정보 없음). 키는 .env(NAVER_CLIENT_ID/SECRET)에만 둔다.
네이버 검색 API는 하루 25,000회 무료, 한 번 실행에 질의 수 × 2(뉴스·블로그) + 데이터랩 3~4회.
"""
import csv
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from . import config, engine, trends
from .engine import DATA, _f
from .schedule import efficacy_flags

SEARCH_URL = config.NAVER_API_BASE + "/search/v1/{kind}"   # NAVER API HUB (응답 모양은 예전과 같음)
QUERY_CSV = config.SETTINGS_DIR / "스카우트질의.csv"
RESULT = config.DATA_DIR / "scout.json"
STATE = config.DATA_DIR / "scout_state.json"
MIN_GAP_MIN = 10
DEFAULT_QUERIES = ["요즘 유행 디저트", "디저트 열풍", "품절 대란 간식", "편의점 신상 디저트", "카페 신메뉴", "오픈런 디저트",
                   "요즘 뜨는 음료", "홈카페 레시피", "SNS 화제 간식", "선물 추천 요즘", "건강 음료 트렌드", "저당 간식 인기",
                   "차 음료 트렌드", "말차 신메뉴", "티 브랜드 신제품", "겨울 간식 유행"]

STOP = set("""
요즘 유행 열풍 대란 인기 화제 트렌드 신상 신메뉴 출시 한정 메뉴 디저트 간식 음료 카페 편의점 브랜드 제품 상품 시장 업계 소비자
고객 매출 판매 증가 감소 올해 지난해 이번 최근 오늘 내일 하루 주말 가을 겨울 여름 봄 시즌 기념 이벤트 행사 할인 쿠폰 무료 추천
레시피 홈카페 만들기 방법 후기 리뷰 맛집 서울 국내 해외 글로벌 한국 대한민국 전국 매장 오픈 선물 건강 다이어트 사진 영상 공개 기자
뉴스 블로그 포스팅 인스타 유튜브 틱톡 SNS 국민 대표 최고 최대 처음 첫 진짜 정말 너무 완전 대박 역대 기록 돌파 누적 성장 전망 분석
참가자 신제품 제과점 업체 회사 기업 그룹 계열 협업 콜라보 팝업 스토어 매대
티젠 공차 스타벅스 메가커피 빽다방 이디야 투썸 컴포즈 올리브영 쿠팡 컬리 햇반 루피시아 다비드 TWG 알디프 CU GS25 세븐일레븐 이마트
오설록 osulloc 그리고 하지만 위해 대한 통해 관련 이상 이하 가능 진행 모든 다양 다양한 새로운 새 본격 확대 강화 선보 선보여 선보인
""".split())
JOSA = ("으로", "에서", "에게", "까지", "부터", "처럼", "보다", "이랑", "랑", "과", "와", "은", "는", "이", "가", "을", "를", "의", "도", "로", "에", "만")
TRIGGER = re.compile(r"([가-힣A-Za-z0-9]{2,12})\s*(?:열풍|유행|대란|품절|오픈런|신드롬|돌풍|붐|인기몰이|완판|웨이팅|줄서기|챌린지)")
QUOTED = re.compile(r"[‘'\"“「『<《]([^‘'\"“”’」』>》]{2,14})[’'\"”」』>》]")
HASHTAG = re.compile(r"#([가-힣A-Za-z0-9]{2,14})")
FOOD_SUFFIX = ("티", "차", "라떼", "밀크티", "쿠키", "케이크", "떡", "빵", "초콜릿", "초코", "젤리", "커피", "말차", "콤부차", "스무디",
               "에이드", "아이스크림", "타르트", "마카롱", "푸딩", "약과", "도넛", "크림", "쿠쿠", "칩", "바", "쿠", "과자", "스낵",
               "버터", "치즈", "베이글", "크로플", "와플", "빙수", "주스", "음료", "디저트", "모찌", "롤", "파이", "브라우니", "샌드")

# 엮기 사전 — 연결 유형별 신호 말 → 오설록 상품을 찾는 말(상품명 포함어) · 카피 씨앗
SAME_WORDS = ["말차", "호지", "녹차", "세작", "우전", "밀크티", "얼그레이", "블랙티", "홍차", "허브", "캐모마일", "민트", "콤부차",
              "콜드브루", "영귤", "꿀배", "동백", "랑드샤", "롤케이크", "그린티", "티라떼"]
PAIR = [  # (디저트 신호, 어울리는 우리 상품 포함어, 카피 씨앗)
    (("쫀득", "쫀쿠", "피스타치오", "초코", "초콜릿", "브라우니", "크림", "버터", "치즈", "카다이프"), ["세작", "녹차", "우전"],
     "진하고 단 {t} 뒤엔, 개운한 녹차 한 잔"),
    (("떡", "약과", "한과", "모찌", "인절미", "곶감"), ["세작", "녹차", "호지"], "{t}엔 구수한 녹차·호지차"),
    (("케이크", "타르트", "마카롱", "쿠키", "와플", "베이글", "빵", "도넛", "파이"), ["블랙티", "얼그레이", "밀크티"],
     "{t}와 어울리는 블랙티 · 밀크티"),
    (("과일", "딸기", "무화과", "귤", "감귤", "자몽", "레몬", "복숭아"), ["블렌디드", "영귤", "무화과", "꿀배"], "{t} 향 블렌디드 티"),
]
SITUATION = [  # (상황 신호, 상품 포함어, 카피 씨앗), 효능 표현 금지
    (("수능", "시험", "중간고사", "기말", "합격"), ["말차", "세트", "랑드샤"], "{t} 응원 · 수고한 나에게 한 잔"),
    (("한파", "추위", "환절기", "일교차", "첫눈", "겨울"), ["밀크티", "블렌디드", "꿀배", "호지"], "{t}엔 따뜻하게 우리는 한 잔"),
    (("장마", "폭염", "열대야", "무더위", "여름"), ["콜드브루", "아이스", "말차"], "{t}엔 차갑게 우리는 차"),
    (("재택", "야근", "출근", "사무실", "오피스"), ["티백", "세작", "말차"], "{t} 책상 위 티백"),
    (("캠핑", "피크닉", "여행", "나들이"), ["티백", "콜드브루"], "{t} 가방에 챙기는 티백"),
]
SUBSTITUTE = (("라떼", "카페", "커피", "프랜차이즈", "스타벅스", "메가", "빽다방", "공차", "웨이팅", "음료"),
              ["말차", "밀크티", "호지", "티라떼"], "{t} 대신 집에서 만드는 말차·밀크티")
VALUE = (("저당", "제로", "무설탕", "디카페인", "카페인", "웰니스", "저속노화", "비건", "단백질", "저칼로리", "알룰로스"),
         ["무카페인", "허브", "캐모마일", "민트", "루이보스"], "{t}: 카페인 걱정 없는 허브·무카페인 차")


class ScoutError(Exception):
    pass


# ----------------------------------------------------------------------
# 설정·상태
# ----------------------------------------------------------------------
def read_queries():
    if not QUERY_CSV.exists():
        return DEFAULT_QUERIES
    with open(QUERY_CSV, encoding="utf-8-sig", newline="") as f:
        qs = [r[0].strip() for r in list(csv.reader(f))[1:] if r and r[0].strip()]
    return qs[:40] or DEFAULT_QUERIES


def save_queries(items):
    qs = [str(q).strip()[:30] for q in items if str(q).strip()][:40]
    config.SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(QUERY_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["넓은 질의 (상품명 말고 상위 개념)"])
        w.writerows([[q] for q in qs])
    return len(qs)


def _load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _save(path, obj):
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def mark(term, status):
    st = _load(STATE, {})
    if status not in ("keep", "dismiss", "planned", "clear"):
        raise ScoutError("잘못된 상태")
    if status == "clear":
        st.pop(term, None)
    else:
        st[term[:30]] = {"status": status, "at": datetime.now().strftime("%Y-%m-%d")}
    _save(STATE, st)
    return st


# ----------------------------------------------------------------------
# 1 수집
# ----------------------------------------------------------------------
def _clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", str(s or ""))).strip()


def _search(kind, query, display=100):
    url = SEARCH_URL.format(kind=kind) + "?" + urllib.parse.urlencode({"query": query, "display": display, "sort": "date"})
    req = urllib.request.Request(url, headers=config.naver_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8")).get("items") or []
    except urllib.error.HTTPError as e:
        msg = {401: "네이버 API 키가 올바르지 않습니다 (NAVER API HUB에서 받은 키인지 확인하세요. 예전 개발자센터 키는 안 됩니다).",
               403: "이 Application에 '검색' API가 없습니다. 네이버 클라우드 콘솔 › NAVER API HUB › Application에서 추가하세요.",
               429: "네이버 검색 하루 한도를 넘었습니다."}.get(e.code, f"네이버 검색 오류 (HTTP {e.code})")
        raise ScoutError(msg)
    except (urllib.error.URLError, TimeoutError):
        raise ScoutError("네이버 검색에 연결하지 못했습니다.")


def _pubdate(item):
    if item.get("pubDate"):          # 뉴스: 'Fri, 16 Oct 2026 09:00:00 +0900'
        try:
            return datetime.strptime(item["pubDate"][:16], "%a, %d %b %Y").date()
        except ValueError:
            return None
    if item.get("postdate"):         # 블로그: '20261016'
        try:
            return datetime.strptime(item["postdate"], "%Y%m%d").date()
        except ValueError:
            return None
    return None


def collect(queries):
    docs = []
    for q in queries:
        for kind in ("news", "blog"):
            for it in _search(kind, q):
                docs.append({"q": q, "kind": kind, "title": _clean(it.get("title")), "desc": _clean(it.get("description")),
                             "url": it.get("originallink") or it.get("link"), "date": _pubdate(it)})
            time.sleep(0.12)
    return docs


# ----------------------------------------------------------------------
# 2 후보 뽑기 (규칙)
# ----------------------------------------------------------------------
def _strip_josa(w):
    for j in JOSA:
        if len(w) > len(j) + 1 and w.endswith(j):
            return w[: -len(j)]
    return w


def _ok(w):
    if len(w) < 2 or len(w) > 14 or w in STOP or w.isdigit() or re.fullmatch(r"[0-9.%]+[가-힣]?", w):
        return False
    if re.search(r"\d{2,}", w) and not re.search(r"[가-힣]{2,}", w):
        return False
    return True


def _is_food(w):
    return any(w.endswith(s) or s in w for s in FOOD_SUFFIX)


def extract(docs, today=None):
    """글 묶음 → 후보 말 목록. 점수 = 글 수 + 강한 신호(따옴표·트리거·해시태그) 가산 + 최근 7일 증가."""
    today = today or date.today()
    df, strong, recent, prior, src = Counter(), Counter(), Counter(), Counter(), defaultdict(list)
    for d in docs:
        text = f"{d['title']} {d.get('desc', '')}"
        found = set()
        for rx in (TRIGGER, QUOTED, HASHTAG):
            for m in rx.finditer(text):
                w = _strip_josa(m.group(1).strip())
                if _ok(w):
                    found.add(w)
                    strong[w] += 1
        toks = [_strip_josa(t) for t in re.findall(r"[가-힣A-Za-z0-9]{2,}", text)]
        for i, t in enumerate(toks):
            if _ok(t) and _is_food(t):
                found.add(t)
            if i + 1 < len(toks):
                bi = f"{t} {toks[i + 1]}"
                if _ok(toks[i + 1]) and _is_food(toks[i + 1]) and _ok(t) and len(bi) <= 14:
                    found.add(bi)
        for w in found:
            df[w] += 1
            dd = d.get("date")
            if dd and (today - dd).days <= 7:
                recent[w] += 1
            elif dd:
                prior[w] += 1
            if len(src[w]) < 4:
                src[w].append({"title": d["title"][:80], "url": d.get("url"), "date": dd.isoformat() if dd else None,
                               "kind": d.get("kind"), "q": d.get("q")})
    rows = []
    for w, n in df.items():
        if n < 2 and strong[w] == 0:
            continue
        # 짧은 말이 긴 말에 포함되면(‘말차’ ⊂ ‘말차 라떼’) 긴 말이 더 구체적일 때만 남긴다
        growth = (recent[w] + 1) / (prior[w] / 3 + 1)      # 그 전 3주 평균 대비 최근 1주
        score = n + 2 * strong[w] + (2 if growth >= 1.5 else 0)
        rows.append({"term": w, "docs": n, "strong": strong[w], "recent7": recent[w], "prior": prior[w],
                     "growth": round(growth, 2), "score": score, "sources": src[w]})
    rows.sort(key=lambda r: -r["score"])
    keep, seen = [], []
    for r in rows:
        if any(r["term"] in s and r["term"] != s for s in seen):   # 이미 더 긴 말이 있으면 생략
            continue
        seen.append(r["term"])
        keep.append(r)
    return keep[:40]


# ----------------------------------------------------------------------
# 3 검증 (데이터랩)
# ----------------------------------------------------------------------
def verify(terms):
    if not terms or not trends.has_keys():
        return {}
    end = trends._last_sunday()
    start = end - timedelta(days=7 * 12)
    out = {}
    for i in range(0, len(terms), 5):
        chunk = terms[i:i + 5]
        try:
            res = trends._post({"startDate": start.isoformat(), "endDate": end.isoformat(), "timeUnit": "week",
                                "keywordGroups": [{"groupName": t[:20], "keywords": [t]} for t in chunk]})
        except trends.TrendError:
            break
        for t, r in zip(chunk, res.get("results") or []):
            vals = [float(x["ratio"]) for x in r.get("data") or []]
            out[t] = status_of(vals)
    return out


def status_of(vals):
    if len(vals) < 6 or max(vals) <= 0:
        return {"status": "검색 적음", "momentum": None, "series": vals}
    r4, p4 = sum(vals[-4:]) / 4, sum(vals[-8:-4]) / 4 if len(vals) >= 8 else sum(vals[:-4]) / max(1, len(vals) - 4)
    mom = r4 / p4 - 1 if p4 > 0 else None
    peak_i = vals.index(max(vals))
    if mom is not None and mom >= 0.25 and peak_i >= len(vals) - 2:
        st = "떠오르는 중"
    elif peak_i >= len(vals) - 4 and (mom is None or mom > -0.15):
        st = "정점 근처"
    elif mom is not None and mom <= -0.25:
        st = "식는 중"
    else:
        st = "꾸준"
    m = max(vals)
    return {"status": st, "momentum": round(mom, 2) if mom is not None else None, "series": [round(v / m * 100, 1) for v in vals]}


# ----------------------------------------------------------------------
# 4 엮기 (규칙)
# ----------------------------------------------------------------------
def _products_by_words(words, limit=5):
    ws = [w.replace(" ", "") for w in words]
    hits = [p for p in DATA.products.values() if p.get("active") and p.get("cost") is not None
            and any(w in str(p.get("name", "")).replace(" ", "") for w in ws) and not str(p.get("name", "")).startswith("[")]
    hits.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    return [{"seq": str(p["seq"]), "name": p["name"], "sales_28": _f(p.get("sales_28")), "max_discount": _f(p.get("max_discount")),
             "days_since_deal": p.get("days_since_deal")} for p in hits[:limit]]


def bridge(term):
    t = term.replace(" ", "")
    same = [w for w in SAME_WORDS if w in t]
    if same:
        return {"type": "같은 것", "why": f"우리도 '{same[0]}' 상품이 있어요", "copy": f"요즘 뜨는 {term}, 오설록 {same[0]}로",
                "products": _products_by_words(same)}
    for sig, words, cp in PAIR:
        if any(s in t for s in sig):
            return {"type": "곁들임", "why": "우리가 팔지 않는 먹거리: 함께 마시는 차로 엮기", "copy": cp.format(t=term),
                    "products": _products_by_words(words)}
    for sig, words, cp in SITUATION:
        if any(s in t for s in sig):
            return {"type": "상황", "why": "생활 맥락: 그 상황에 마시는 차로 엮기", "copy": cp.format(t=term),
                    "products": _products_by_words(words)}
    if any(s in t for s in SUBSTITUTE[0]):
        return {"type": "대체", "why": "밖에서 사 먹는 음료: 집에서 만드는 차로 대신하기", "copy": SUBSTITUTE[2].format(t=term),
                "products": _products_by_words(SUBSTITUTE[1])}
    if any(s in t for s in VALUE[0]):
        return {"type": "가치", "why": "건강·습관 흐름: 효능 말고 '가볍게·카페인 없이'로", "copy": VALUE[2].format(t=term),
                "products": _products_by_words(VALUE[1])}
    if _is_food(t):
        return {"type": "곁들임", "why": "먹거리 유행: 어울리는 차를 직접 골라 보세요", "copy": f"{term}와 함께 마시는 오설록 한 잔",
                "products": _products_by_words(["세작", "녹차", "밀크티"])}
    return {"type": "직접 판단", "why": "자동으로 엮을 근거가 없어요. 계속 볼지 판단해 주세요", "copy": "", "products": []}


# ----------------------------------------------------------------------
# 실행 · 조회
# ----------------------------------------------------------------------
_last = {"t": 0.0}


def run():
    if not trends.has_keys():
        raise ScoutError("네이버 API 키가 없습니다. 트렌드 스카우트 화면의 안내대로 키를 넣어 주세요(검색 + 데이터랩).")
    gap = time.time() - _last["t"]
    if gap < MIN_GAP_MIN * 60:
        raise ScoutError(f"방금 모았습니다. {MIN_GAP_MIN - int(gap // 60)}분 뒤 다시 시도하세요.")
    _last["t"] = time.time()
    qs = read_queries()
    docs = collect(qs)
    cands = extract(docs)
    state = _load(STATE, {})
    keep_terms = [t for t, v in state.items() if v.get("status") == "keep"]
    terms = [c["term"] for c in cands if state.get(c["term"], {}).get("status") != "dismiss"][:15]
    ver = verify(list(dict.fromkeys(terms + keep_terms))[:20])
    doc = {"run_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "queries": qs, "docs": len(docs),
           "candidates": cands, "verify": ver}
    _save(RESULT, doc)
    trends._log({"service": "naver_search+datalab", "queries": len(qs), "docs": len(docs), "success": True})
    return overview()


def overview():
    DATA.ensure()
    doc = _load(RESULT, {})
    state = _load(STATE, {})
    ver = doc.get("verify") or {}
    cards = []
    for c in doc.get("candidates") or []:
        st = state.get(c["term"], {}).get("status")
        if st == "dismiss":
            continue
        v = ver.get(c["term"])
        b = bridge(c["term"])
        cards.append({**c, "verify": v, "bridge": b, "state": st,
                      "flags": efficacy_flags(b.get("copy"))})
    # 계속 보기인데 이번 수집에 안 나온 말도 감시 카드로
    seen = {c["term"] for c in cards}
    for t, v in state.items():
        if v.get("status") == "keep" and t not in seen:
            cards.append({"term": t, "docs": 0, "strong": 0, "recent7": 0, "prior": 0, "growth": None, "score": 0, "sources": [],
                          "verify": ver.get(t), "bridge": bridge(t), "state": "keep", "flags": []})
    order = {"떠오르는 중": 0, "정점 근처": 1, "꾸준": 2, None: 3, "검색 적음": 4, "식는 중": 5}
    cards.sort(key=lambda c: (c["state"] != "keep", order.get((c.get("verify") or {}).get("status"), 3), -c["score"]))
    return {"has_keys": trends.has_keys(), "run_at": doc.get("run_at"), "docs": doc.get("docs", 0), "queries": read_queries(),
            "cards": cards, "dismissed": [t for t, v in state.items() if v.get("status") == "dismiss"],
            "note": "후보 말은 규칙으로 뽑았어요(AI 아님). 검색량 검증이 없으면 '말만 많은' 유행일 수 있어요. "
                    "연결·카피는 규칙 사전의 씨앗이라 그대로 쓰지 말고 다듬어 쓰세요. 효능 표현은 쓰지 마세요."}


def plan_rows(term, start=None, limit=6):
    from .ideas import _pick_rate, _pool, next_monday
    DATA.ensure()
    b = bridge(term)
    d0 = engine._d(start) if start else next_monday()
    d1 = d0 + timedelta(days=6)
    free = {str(p["seq"]) for p in _pool(d0, d1)}
    rows = []
    for x in b["products"]:
        p = DATA.products.get(x["seq"])
        if not p or x["seq"] not in free:
            continue
        rate = _pick_rate(p, "상시")
        if rate:
            rows.append({"promo": f"{term} 기획전"[:30], "type": "상시", "start": d0.isoformat(), "end": d1.isoformat(),
                         "seq": x["seq"], "items": None, "rate": rate, "appeal": b.get("copy", "")[:40],
                         "category_tag": f"{b['type']} · {term}"[:30], "clearance": False,
                         "memo": f"트렌드 '{term}' ({b['type']}) · 28일 매출 {(x['sales_28'] or 0) / 10000:,.0f}만원"})
        if len(rows) >= limit:
            break
    return {"term": term, "bridge": b, "start": d0.isoformat(), "end": d1.isoformat(), "rows": rows}

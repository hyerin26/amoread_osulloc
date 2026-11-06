# -*- coding: utf-8 -*-
"""
브리프 키워드 확장 재료: 씨앗 키워드 하나 → 연관 키워드(+월간 검색수)와 최신 기사·글.

출처 (출처마다 연결 상태를 같이 돌려준다. 키가 없으면 'no_key' → 화면은 '연결 안 됨'으로 표시)
- 네이버 검색광고 키워드 도구: 연관 키워드 + 월간 PC·모바일 검색수 + 경쟁 정도 → 마인드맵 가지
- 네이버 데이터랩 검색어 트렌드: 씨앗 + 연관 상위 4개의 주별 지수 52주 → 언제 많이 찾나 (trends._post 재사용)
- 네이버 검색 API(뉴스·블로그): 씨앗 키워드의 최신 글 → 근거 패널 (scout._search 재사용)
빅카인즈·구글 트렌드·캐릿은 공식 이용 조건·명세 확인 전이라 연결하지 않는다 (plans/20 §3).

보내는 것: 키워드뿐 (실적·원가·고객 정보 없음). 키는 .env에만 두고 화면·로그·오류 문구에 쓰지 않는다.
"""
import base64
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import timedelta

from . import config, scout, trends, usage

AD_HOST = "https://api.searchad.naver.com"
AD_PATH = "/keywordstool"
CACHE_TTL_SEC = 6 * 3600   # 같은 씨앗은 6시간 동안 다시 부르지 않음 (호출 한도 보호)
CACHE_MAX = 200
SEED = re.compile(r"^[가-힣A-Za-z0-9 ]{1,20}$")


class KeywordError(Exception):
    pass


def has_ad_keys():
    return bool(config.NAVER_AD_API_KEY and config.NAVER_AD_SECRET and config.NAVER_AD_CUSTOMER_ID)


def clean_seed(q):
    q = re.sub(r"\s+", " ", str(q or "")).strip()
    if not SEED.match(q):
        raise ValueError("키워드는 한글·영문·숫자 20자 이내로 넣어 주세요.")
    return q


def _sign(ts, method, path):
    msg = f"{ts}.{method}.{path}".encode()
    return base64.b64encode(hmac.new(config.NAVER_AD_SECRET.encode(), msg, hashlib.sha256).digest()).decode()


def _count(v):
    """월간 검색수: 숫자, 또는 '< 10' 같은 글자. 글자면 None(10 미만)."""
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v or "").replace(",", "").strip()
    return int(s) if s.isdigit() else None


def parse_related(body, seed, limit=30):
    me = seed.replace(" ", "")
    out = []
    for it in (body or {}).get("keywordList") or []:
        kw = str(it.get("relKeyword") or "").strip()[:40]
        if not kw or kw.replace(" ", "") == me:
            continue
        pc, mo = _count(it.get("monthlyPcQcCnt")), _count(it.get("monthlyMobileQcCnt"))
        out.append({"keyword": kw, "monthly": (pc or 0) + (mo or 0), "few": pc is None or mo is None,
                    "mobile_share": round(mo / ((pc or 0) + mo), 2) if mo else None,
                    "competition": str(it.get("compIdx") or "")[:4]})
    out.sort(key=lambda x: -x["monthly"])
    return out[:limit]


def _related(seed):
    ts = str(int(time.time() * 1000))
    # 검색광고 키워드 도구는 띄어쓰기가 있는 힌트 키워드를 받지 않는다
    url = AD_HOST + AD_PATH + "?" + urllib.parse.urlencode({"hintKeywords": seed.replace(" ", ""), "showDetail": 1})
    req = urllib.request.Request(url, headers={"X-Timestamp": ts, "X-API-KEY": config.NAVER_AD_API_KEY,
                                               "X-Customer": str(config.NAVER_AD_CUSTOMER_ID),
                                               "X-Signature": _sign(ts, "GET", AD_PATH)})
    usage.take("naver_searchad", KeywordError)   # 자체 한도 (config.API_LIMITS)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return parse_related(json.loads(res.read().decode("utf-8")), seed)
    except urllib.error.HTTPError as e:
        raise KeywordError({401: "검색광고 API 키가 올바르지 않습니다.",
                            403: "검색광고 API 인증에 실패했습니다 (키·광고계정 ID, 또는 이 PC 시각 확인).",
                            429: "검색광고 API 호출이 너무 잦습니다. 잠시 뒤 다시 해 주세요."}.get(e.code, f"검색광고 API 오류 (HTTP {e.code})"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise KeywordError("검색광고 API에 연결하지 못했습니다.")


def _safe_link(u):
    u = str(u or "")
    return u if urllib.parse.urlparse(u).scheme in ("http", "https") else ""


def _articles(seed):
    out = []
    for kind, label in (("news", "뉴스"), ("blog", "블로그")):
        for it in scout._search(kind, seed, display=10, sort="sim"):   # 근거 패널은 관련 높은 글부터
            out.append({"kind": label, "title": scout._clean(it.get("title"))[:120],
                        "summary": scout._clean(it.get("description"))[:200],
                        "link": _safe_link(it.get("originallink") or it.get("link")),
                        "date": str(scout._pubdate(it) or "")})
    return out


def _change(vals):
    a, b = vals[-4:], vals[-8:-4]
    if len(b) < 4 or not sum(b):
        return None
    return round(sum(a) / sum(b) - 1, 2)


def _trend(words):
    """데이터랩 주별 검색 지수 52주. 한 요청 안의 상대값이라 이 키워드들끼리는 크기 비교가 된다."""
    end = trends._last_sunday()
    res = trends._post({"startDate": (end - timedelta(days=7 * 52)).isoformat(), "endDate": end.isoformat(),
                        "timeUnit": "week", "keywordGroups": [{"groupName": w, "keywords": [w]} for w in words]})
    out = []
    for w, r in zip(words, res.get("results") or []):
        pts = [(str(d["period"]), float(d["ratio"])) for d in r.get("data") or [] if d.get("period")]
        vals = [v for _, v in pts]
        peak = max(pts, key=lambda p: p[1])[0] if pts else ""
        out.append({"keyword": w, "weekly": pts, "change_4w": _change(vals), "peak_month": int(peak[5:7]) if peak else None})
    return out


def _load():
    try:
        return json.loads(config.KEYWORD_CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(cache):
    if len(cache) > CACHE_MAX:
        cache = dict(sorted(cache.items(), key=lambda kv: kv[1].get("t", 0))[-CACHE_MAX:])
    config.KEYWORD_CACHE.parent.mkdir(parents=True, exist_ok=True)
    config.KEYWORD_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def _source(fn, ok_keys, seed):
    if not ok_keys:
        return {"status": "no_key", "items": []}
    try:
        return {"status": "ok", "items": fn(seed)}
    except (KeywordError, scout.ScoutError, trends.TrendError) as e:
        return {"status": "error", "message": str(e), "items": []}


WORD = re.compile(r"[가-힣A-Za-z][가-힣A-Za-z0-9]{1,13}")
# 꾸미는 말·움직임 말 끝 (가지로 쓰기 어려운 말). 명사도 조금 걸러질 수 있지만 가지 후보라 괜찮음
NOT_NOUN = ("는", "던", "니다", "했다", "한다", "된다", "했던", "하고", "하며", "해서", "하게", "하는", "있게", "없이", "처럼", "까지", "부터",
            "적인", "스러운", "다운", "로운", "롭게", "같은", "좋은", "많은", "위한", "대한", "통해", "에도", "에는", "으며",
            "다", "다고", "하", "한", "했", "던데", "지만", "는데")
FILLER = set("함께 그런데 대신 가장 여러 분들 담은 전면 주제 시작 진행 이번 이후 지난 오늘 올해 모두 다양 최근 관련 위해 대해 특히 바로 정도 경우 이상 "
             "이하 사이 직접 자신 우리 다시 먼저 하나 처음 마지막 가지 모습 소개 확인 제공 운영 예정 기간 당일 시간 사람 생각 이야기 내용 방문 참여 "
             "에서 이라 이고 역시 또한 때문 그리고 하지만 평소 상대 전년 대비 오후 오전 자정 즐기 즐겨 맛있 배우 앵커 기자 증가 감소 앞두고 앞둔 맞아 맞이해 맞이".split())


def related_words(items, seed, n=8):
    """뉴스·블로그 제목·요약에서 **여러 글에 함께 나온 말** (규칙, AI 아님) → 마인드맵 가지 후보. 부르는 횟수는 늘지 않음."""
    me = seed.replace(" ", "")
    df = Counter()
    for it in items:
        words = {scout._strip_josa(w) for w in WORD.findall(f"{it.get('title', '')} {it.get('summary', '')}")}
        for w in words:
            if (not scout._ok(w) or me in w or w in me or w.endswith(NOT_NOUN) or w in FILLER
                    or re.fullmatch(r"[A-Za-z0-9]+", w)                       # 영문만인 말 (기사 표기·약어)
                    or (len(w) == 2 and w[1] in "에을를은는이가도의로과와")):     # 두 글자 + 조사 (봄에, 회를)
                continue
            df[w] += 1
    return [w for w, c in df.most_common(n * 3) if c >= 2][:n]


def _with_words(data):
    s = data["sources"].get("naver_search") or {}
    return {**data, "words": related_words(s.get("items") or [], data["seed"]) if s.get("status") == "ok" else []}


def expand(q, refresh=False):
    seed = clean_seed(q)
    cache = _load()
    hit = cache.get(seed)
    if hit and not refresh and time.time() - hit.get("t", 0) < CACHE_TTL_SEC:
        return {**_with_words(hit["data"]), "cached": True}
    ad = {"name": "네이버 검색광고 키워드 도구", "basis": "연관 키워드 · 최근 30일 검색수", **_source(_related, has_ad_keys(), seed)}
    top = [seed] + [r["keyword"] for r in ad["items"][:4]]   # 데이터랩은 한 요청에 5개까지
    data = {"seed": seed, "sources": {
        "searchad": ad,
        "datalab": {"name": "네이버 데이터랩 검색어 트렌드", "basis": "주별 검색 지수 52주 (씨앗 + 검색수 상위 연관 4개, 서로 상대값)",
                    **_source(lambda _: _trend(top), trends.has_keys(), seed)},
        "naver_search": {"name": "네이버 검색 (뉴스·블로그)", "basis": "관련 높은 글 10건씩",
                         **_source(_articles, trends.has_keys(), seed)},
    }}
    st = [s["status"] for s in data["sources"].values()]
    if any(s != "no_key" for s in st):   # 실제로 부른 게 있을 때만 남김 (키워드 자체는 적지 않음)
        trends._log({"service": "keywords_expand", **{k: v["status"] for k, v in data["sources"].items()},
                     "success": "error" not in st})
    if "ok" in st and "error" not in st:   # 실패가 섞인 결과는 6시간 붙잡아 두지 않음
        cache[seed] = {"t": time.time(), "data": data}
        _save(cache)
    return {**_with_words(data), "cached": False}

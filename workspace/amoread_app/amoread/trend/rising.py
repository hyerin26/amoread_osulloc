"""Rising named items ("trees, not the forest"): specific products, menus, characters, memes that are
taking off right now, caught while coverage is still small.

Method (headline metadata only, Google News search RSS):
  1. Seed: recent headlines for buzz cues (열풍, 대란, 품절, 오픈런, 신상 ...).
  2. Candidates: quoted names, words right before a buzz cue, proper nouns that co-occur with a cue.
  3. Velocity: per candidate, distinct stories in the last 14 days vs days 15-45 vs days 46-365.
  4. Stage by fixed rules: 초기 급상승 / 확산 중 / 이미 대중화 / 근거 부족.
Counts are news stories among search results, not search volume, SNS reactions or sales.
"""
import asyncio
import html
import os
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

import httpx

from .discovery import NEWS_INDEX, NEWS_NOISE, UA, _host, _news_title, _safe_text
from .evidence import STOPWORDS, _kiwi, assign_stories, parse_day

SEED_QUERIES = ["열풍", "대란 품절", "오픈런", "요즘 유행", "SNS 화제 디저트", "편의점 신상", "신메뉴 화제", "Z세대 유행",
                "MZ 인기 굿즈", "팝업 오픈런", "챌린지 유행", "품귀", "완판 행렬", "카페 신메뉴", "디저트 유행", "캐릭터 굿즈 인기",
                "말차 신제품", "간식 인기 SNS", "줄서는 맛집 디저트", "릴스 유행 음식"]
# Age-targeted seeds. The young groups are also covered by the newsletter/YouTube sources below.
AGE_GROUPS = ("10·20대", "30대", "40대", "50대 이상")
# Searching "30대 인기" mostly returns crime and accident news, so older groups are searched through
# life contexts instead. Which context belongs to which age is a working hypothesis, not customer data.
AGE_SEEDS = {
    "10·20대": ["Z세대 유행", "10대 사이 인기", "대학생 유행", "20대 인기 디저트"],
    "30대": ["직장인 인기", "육아템 품절", "집들이 선물", "러닝크루", "하이볼 인기", "답례품 인기", "캠핑 신상",
             "직장인 간식", "오마카세 유행", "신혼 인기"],
    "40대": ["학부모 인기", "영포티", "골프 인기", "저속노화", "혈당 간식", "주부 입소문", "건강기능식품 품절",
             "밀키트 인기", "아이 간식 품절", "갱년기 인기"],
    "50대 이상": ["트로트 굿즈", "파크골프", "맨발 걷기", "건강차", "홈쇼핑 완판", "효도 선물", "시니어 인기",
                "황톳길", "중장년 취미", "부모님 선물 인기"],
}
RISING_NOISE = re.compile(r"검거|체포|구속|사망|숨져|시신|폭행|살해|횡령|중상|추돌|화재|실종|징역|혐의|부고|\[액티브 시니어\]|"
                          r"복지관|경로당|도의원|군수|구청장|시장 ?은|RTX|그래픽카드|아파트 매수|주차")
CUE = r"열풍|대란|품절|오픈런|유행|인기|난리|화제|신드롬|돌풍|완판|품귀|줄 ?서|핫한|뜨는|신상|신메뉴|챌린지"
CUE_RE = re.compile(CUE)
BEFORE_CUE = re.compile(r"([가-힣A-Za-z0-9]{2,12})\s?(?:열풍|대란|신드롬|돌풍|품귀|챌린지|오픈런)")
QUOTED = re.compile(r"[‘'“\"「『]([^’'”\"」』]{2,14})[’'”\"」』]")
GENERIC = set("""올해 요즘 이번 최근 연말 겨울 가을 시즌 세대 브랜드 제품 상품 신제품 출시 매장 고객 소비자 업계 시장 국내 해외 한국 서울 전국
인기 유행 화제 열풍 대란 품절 완판 오픈런 신상 신메뉴 디저트 간식 카페 편의점 팝업 굿즈 캐릭터 챌린지 가격 할인 행사 이벤트 한정 한정판
콜라보 협업 추천 맛집 음식 메뉴 음료 커피 케이크 선물 트렌드 SNS 인스타그램 유튜브 틱톡 릴스 MZ Z세대 MZ세대 2030 크리스마스 홀리데이
블랙프라이데이 수능 빼빼로데이 주말 오늘 내일 정부 대통령 삼성 현대 LG SK 롯데 신세계 CJ GS25 CU 세븐일레븐 이마트24 스타벅스 다이소
올리브영 무신사 쿠팡 네이버 카카오 배민 투자 주식 부동산 물가 한파 독감""".split())


# Non-news sources (public feeds only; sites whose robots.txt forbids collection are not used:
# gift.kakao.com, theqoo.net, oliveyoung.co.kr were checked 2026-11-14 and excluded).
NEWSLETTERS = {"Trend A Word": "https://maily.so/trendaword/feed"}
YOUTUBE_CHANNELS = {"스브스뉴스": "UCxPClUl0bh7BgJajD5k483g", "14F 일사에프": "UCLKuglhGlMmDteQKoniENIQ",
                    "문명특급": "UCJDDxyOq0mXmPQOH1lkrtMQ", "odg": "UCUat6P8WYHOtlWqQZNS_lJw"}
SEARCH_SPIKES = "https://trends.google.com/trending/rss?geo=KR"
WIKI_API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia/all-access/user/{}/daily/{}/{}"
SOURCE_LABEL = {"news": "뉴스", "newsletter": "MZ 뉴스레터", "youtube": "유튜브 채널", "search_spike": "검색 급상승",
                "shorts": "유튜브 쇼츠 검색"}
# YouTube Data API v3 (official, needs YOUTUBE_API_KEY). search.list costs 100 quota units, daily quota 10,000:
# 14 seed searches + up to 30 per-item checks is about 4,400 units per run.
YT_API = "https://www.googleapis.com/youtube/v3/"
SHORTS_SEEDS = [("요즘 난리난", None), ("요즘 유행", None), ("품절대란", None), ("편의점 신상", None), ("신상 디저트", None),
                ("오픈런 후기", None), ("챌린지 유행", "10·20대"), ("요즘 뜨는 카페", None), ("다이소 신상", None),
                ("직장인 간식 추천", "30대"), ("육아템 추천 요즘", "30대"), ("살림템 추천 요즘", "40대"),
                ("부모님 선물 추천", "50대 이상"), ("건강 간식 요즘", "40대")]
# three searches per item. Daily budget 10,000: 14 seeds (1,400) + 20 items (6,000) + 8 category items (2,400) = 9,800
MAX_YT_CHECKS = int(os.getenv("RISING_YT_CHECKS", "20"))
MIN_SEED_VIEWS = int(os.getenv("RISING_MIN_VIEWS", "5000"))      # seed videos below this are ignored
STRONG_VIEWS = int(os.getenv("RISING_STRONG_VIEWS", "50000"))    # top video views needed to count as a shorts signal


def youtube_key():
    return os.getenv("YOUTUBE_API_KEY", "").strip()


async def _yt(client, endpoint, params):
    try:
        response = await client.get(YT_API + endpoint, params=dict(params, key=youtube_key()), timeout=15)
        if response.status_code != 200:
            return None
        return response.json()
    except (httpx.HTTPError, ValueError):
        return None


async def _yt_search(client, query, today, days=14, limit=25, until_days=0):
    """Short videos published between `days` and `until_days` days ago, most viewed first."""
    params = {"part": "snippet", "q": query, "type": "video", "order": "viewCount",
              "publishedAfter": (today - timedelta(days=days)).isoformat() + "T00:00:00Z", "regionCode": "KR",
              "relevanceLanguage": "ko", "videoDuration": "short", "maxResults": limit}
    if until_days:
        params["publishedBefore"] = (today - timedelta(days=until_days)).isoformat() + "T00:00:00Z"
    data = await _yt(client, "search", params)
    if data is None:
        return None, 0
    items = [i for i in data.get("items", []) if i.get("id", {}).get("videoId")]
    ids = ",".join(i["id"]["videoId"] for i in items)
    stats = await _yt(client, "videos", {"part": "statistics", "id": ids}) if ids else None
    views = {v["id"]: int(v.get("statistics", {}).get("viewCount", 0)) for v in (stats or {}).get("items", [])}
    rows = []
    for i in items:
        sn, vid = i["snippet"], i["id"]["videoId"]
        day = parse_day(sn.get("publishedAt"))
        rows.append({"title": _safe_text(sn.get("title")), "url": "https://www.youtube.com/watch?v=" + vid,
                     "platform": _safe_text(sn.get("channelTitle")), "publisher_host": "youtube.com/" + sn.get("channelId", ""),
                     "published_day": day.isoformat() if day else None, "source_type": "shorts", "views": views.get(vid)})
    return rows, int(data.get("pageInfo", {}).get("totalResults", 0))


async def shorts_seed(today=None):
    """Recent short videos for buzz queries (titles, channel, date, public view count)."""
    today = today or date.today()
    if not youtube_key():
        return [], {"state": "키 없음(YOUTUBE_API_KEY)"}
    rows, failed = {}, 0
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(_yt_search(client, q, today) for q, _ in SHORTS_SEEDS))
    for (_q, age), (found, _total) in zip(SHORTS_SEEDS, results):
        if found is None:
            failed += 1
            continue
        for row in found:
            if (row.get("views") or 0) < MIN_SEED_VIEWS:
                continue  # a barely watched video is not a sign that something is taking off
            kept = rows.setdefault(row["url"], dict(row, age_hints=[]))
            if age and age not in kept["age_hints"]:
                kept["age_hints"].append(age)
    return list(rows.values()), {"state": "ok" if rows else "결과 없음", "queries": len(SHORTS_SEEDS), "failed": failed, "videos": len(rows)}


async def shorts_check(terms, today=None, limit=None):
    """Per item: how many short videos in the last 14 days mention it and the top public view counts."""
    today = today or date.today()
    if not youtube_key():
        return {}
    out = {}
    terms = terms[:MAX_YT_CHECKS if limit is None else limit]
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(_yt_search(client, f'"{t}"', today, limit=10) for t in terms))
        earlier = await asyncio.gather(*(_yt_search(client, f'"{t}"', today, days=45, limit=10, until_days=14) for t in terms))
        # long-running things (an old challenge, a classic brand) also score high views: look further back too
        older = await asyncio.gather(*(_yt_search(client, f'"{t}"', today, days=365, limit=10, until_days=45) for t in terms))

    def named(rows, term):
        hit = [r for r in rows or [] if term.replace(" ", "") in r["title"].replace(" ", "")]
        return sorted(hit, key=lambda r: r.get("views") or 0, reverse=True)
    for term, (rows, total), (prior_rows, _pt), (old_rows, _ot) in zip(terms, results, earlier, older):
        if rows is None:
            continue
        hit, prior, old = named(rows, term), named(prior_rows, term), named(old_rows, term)
        out[term] = {"videos_in_top10_with_name": len(hit), "api_total_estimate": total,
                     "views_recent": sum(r.get("views") or 0 for r in hit),
                     # the prior window is 31 days long, so compare per-day view rates rather than raw sums
                     "views_prior": sum(r.get("views") or 0 for r in prior) if prior_rows is not None else None,
                     "videos_prior": len(prior) if prior_rows is not None else None,
                     "videos_old": len(old) if old_rows is not None else None,
                     "old_top_views": ((old[0].get("views") or 0) if old else 0) if old_rows is not None else None,
                     "top_views": (hit[0].get("views") or 0) if hit else 0,
                     "channels": len({r["publisher_host"] for r in hit}),
                     "top": [{"title": r["title"], "url": r["url"], "channel": r["platform"], "views": r.get("views"),
                              "published_day": r["published_day"]} for r in hit[:3]]}
    return out
BOILERPLATE = re.compile(r"뉴스레터|메일리|수신 동의|구독|Trend A Word|^용례$|^활용$|^뜻$|^유래$|©|쪽지 보내기|광고|shorts", re.I)
SECOND = re.compile(r"제 ?2의 ([가-힣A-Za-z0-9]{2,10})")
HASHTAG = re.compile(r"#([가-힣A-Za-z0-9_]{2,14})")


async def _get(client, url):
    try:
        response = await client.get(url, headers=UA)
        response.raise_for_status()
        return response.text
    except (httpx.HTTPError, ValueError):
        return None


async def extra_sources(today=None, days=14):
    """Newsletter issue titles and section headings, YouTube video titles, daily search spikes. Titles only."""
    today = today or date.today()
    rows, status = [], {}
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for name, feed in NEWSLETTERS.items():
            page = await _get(client, feed)
            count = 0
            for block in re.findall(r"<item>(.*?)</item>", page or "", re.S)[:6]:
                title = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", block, re.S)
                link = re.search(r"<link>(.*?)</link>", block, re.S)
                pub = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
                day = parse_day(pub.group(1)) if pub else None
                if not (title and link and day) or (today - day).days > days + 7:
                    continue
                url = link.group(1).strip()
                base = {"platform": name, "publisher_host": _host(url), "published_day": day.isoformat(), "source_type": "newsletter"}
                rows.append(dict(base, title=_safe_text(re.sub(r"^\[[^\]]*\]\s*", "", html.unescape(title.group(1)))), url=url))
                count += 1
                post = await _get(client, url)
                # section headings and bold phrases only (short labels), never body paragraphs
                heads = re.findall(r"<(?:h[1-4]|strong|b)\b[^>]*>(.*?)</(?:h[1-4]|strong|b)>", post or "", re.S)
                for n, head in enumerate(dict.fromkeys(_safe_text(h) for h in heads)):
                    if 2 <= len(head) <= 40 and not BOILERPLATE.search(head):
                        rows.append(dict(base, title=head, url=f"{url}#h{n}"))
                        count += 1
            status[name] = count
        for name, channel in YOUTUBE_CHANNELS.items():
            page = await _get(client, "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel)
            count = 0
            for entry in re.findall(r"<entry>(.*?)</entry>", page or "", re.S):
                title = re.search(r"<title>(.*?)</title>", entry, re.S)
                vid = re.search(r"<yt:videoId>(.*?)</yt:videoId>", entry)
                pub = re.search(r"<published>(.*?)</published>", entry)
                day = parse_day(pub.group(1)) if pub else None
                if title and vid and day and (today - day).days <= days:
                    rows.append({"title": _safe_text(title.group(1)), "url": "https://www.youtube.com/watch?v=" + vid.group(1),
                                 "platform": name, "publisher_host": "youtube.com/" + channel, "published_day": day.isoformat(),
                                 "source_type": "youtube"})
                    count += 1
            status[name] = count
        page = await _get(client, SEARCH_SPIKES)
        count = 0
        for block in re.findall(r"<item>(.*?)</item>", page or "", re.S):
            title = re.search(r"<title>(.*?)</title>", block, re.S)
            if title:
                rows.append({"title": "'" + _safe_text(title.group(1)) + "'", "url": SEARCH_SPIKES + "#" + quote(title.group(1)),
                             "platform": "Google 검색 급상승", "publisher_host": "trends.google.com",
                             "published_day": today.isoformat(), "source_type": "search_spike"})
                count += 1
        status["Google 검색 급상승"] = count
    return rows, status


async def wiki_views(client, term, today):
    """Daily Korean Wikipedia pageviews (official API): avg of last 14 days vs the 30 days before. None if no article."""
    start, end = (today - timedelta(days=45)).strftime("%Y%m%d"), (today - timedelta(days=1)).strftime("%Y%m%d")
    try:
        response = await client.get(WIKI_API.format(quote(term.replace(" ", "_"), safe=""), start, end), headers=UA)
        if response.status_code != 200:
            return None
        views = [i["views"] for i in response.json().get("items", [])]
    except (httpx.HTTPError, ValueError, KeyError):
        return None
    if len(views) < 20:
        return None
    recent, prior = views[-14:], views[:-14]
    return {"recent_avg": round(sum(recent) / len(recent), 1), "prior_avg": round(sum(prior) / max(1, len(prior)), 1)}


# generic hashtags and category words that are not item names
TAG_GENERIC = re.compile(r"(추천|추천템|꿀템|꿀팁|리뷰|먹방|후기|브이로그|일상|쇼츠|룸투어|댄스|신상\w*|\w*템)$|"
                         r"^(shorts?|fyp|challenge|dance|kpop|funny|asmr|mukbang|cat|viral|trending|vlog|food|korea\w*|foryou\w*)$", re.I)


def _clean(term):
    term = re.sub(r"\s+", " ", term).strip(" ·,.!?…-‘’'“”\"「」『』")
    return term


def _ok(term):
    if not 2 <= len(term) <= 14 or term in GENERIC or term.lower() in STOPWORDS or BOILERPLATE.search(term):
        return False
    if TAG_GENERIC.search(term):
        return False
    if re.fullmatch(r"[\d\s.,%원만억조개명위년월일차]+", term) or CUE_RE.fullmatch(term):
        return False
    return not NEWS_NOISE.search(term)


def extract_candidates(headlines, limit=60):
    """headlines: [{title, publisher_host, url, published_day}] -> ranked candidate names with their headlines."""
    kiwi = _kiwi()
    found = {}

    def add(term, row, weight):
        term = _clean(term)
        if not _ok(term):
            return
        entry = found.setdefault(term, {"term": term, "rows": {}, "score": 0, "sources": set(), "ages": set()})
        entry["ages"].update(row.get("age_hints") or ())
        if row.get("source_type") in ("newsletter", "youtube"):
            entry["ages"].add("10·20대")
        entry["views"] = max(entry.get("views", 0), row.get("views") or 0)
        entry["sources"].add(row.get("source_type", "news"))
        if row["url"] not in entry["rows"]:
            entry["rows"][row["url"]] = row
        entry["score"] += weight

    for row in headlines:
        title = row["title"]
        early = row.get("source_type", "news") != "news"  # curated MZ sources: a quoted name is a signal by itself
        # age-context searches already asked for "인기/유행", so a quoted name there counts without a cue word
        has_cue = bool(CUE_RE.search(title)) or early or bool(row.get("age_hints")) or bool(row.get("field"))
        for match in SECOND.findall(title) + HASHTAG.findall(title):
            add(match, row, 4)
        if row.get("source_type") == "newsletter" and "#h" in row["url"] and len(title) <= 14:
            add(title, row, 3)  # a short newsletter section heading is usually the item name
        for match in QUOTED.findall(title):
            add(match, row, 3 if has_cue else 1)
        for match in BEFORE_CUE.findall(title):
            add(match, row, 4)
        if has_cue and kiwi:
            for token in kiwi.tokenize(title):
                if token.tag == "NNP" and len(token.form) >= 2:
                    add(token.form, row, 1)
    ranked = []
    for entry in found.values():
        rows = list(entry["rows"].values())
        hosts = {r["publisher_host"] for r in rows}
        # one outlet repeating a name is weak; a quoted/buzz-cued name seen once is still worth a velocity check
        if len(rows) >= 2 or entry["score"] >= 3:
            sources = sorted(entry["sources"])
            ranked.append({"term": entry["term"], "seed_stories": len(rows), "seed_publishers": len(hosts),
                           "sources": sources, "age_hints": sorted(entry["ages"]), "seed_top_views": entry.get("views", 0), "score": entry["score"] + 2 * len(hosts) + 3 * len([x for x in sources if x != "news"]),
                           "headlines": [r["title"] for r in rows[:4]]})
    ranked.sort(key=lambda c: (-c["score"], c["term"]))
    # drop a candidate that is a substring of a stronger one with the same headlines
    kept = []
    for cand in ranked:
        if any(cand["term"] in k["term"] and set(cand["headlines"]) <= set(k["headlines"]) for k in kept):
            continue
        kept.append(cand)
    return kept[:limit]


def _parse(page):
    rows = []
    for block in re.findall(r"<item>(.*?)</item>", page, re.S)[:100]:
        link = re.search(r"<link>(.*?)</link>", block, re.S)
        title = re.search(r"<title>(.*?)</title>", block, re.S)
        pub = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
        source = re.search(r'<source url="([^"]+)">(.*?)</source>', block, re.S)
        if not (link and title and source):
            continue
        name = _safe_text(source.group(2))
        headline = _news_title(_safe_text(title.group(1)), name)
        if NEWS_NOISE.search(headline) or RISING_NOISE.search(headline):
            continue
        day = parse_day(pub.group(1) if pub else None)
        rows.append({"url": html.unescape(link.group(1).strip()), "title": headline, "platform": name,
                     "publisher_host": _host(html.unescape(source.group(1))), "published_day": day.isoformat() if day else None})
    return rows


async def _search(client, semaphore, query):
    async with semaphore:
        try:
            response = await client.get(f"{NEWS_INDEX}?q={quote(query)}&hl=ko&gl=KR&ceid=KR:ko", headers=UA)
            response.raise_for_status()
            return _parse(response.text)
        except (httpx.HTTPError, ValueError):
            return None


async def seed_headlines(today=None, days=14):
    today = today or date.today()
    after = (today - timedelta(days=days)).isoformat()
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        plan = [(q, None) for q in SEED_QUERIES] + [(q, age) for age, qs in AGE_SEEDS.items() for q in qs]
        pages = await asyncio.gather(*(_search(client, semaphore, f"{q} after:{after}") for q, _ in plan))
    rows, failed = {}, 0
    for (_q, age), page in zip(plan, pages):
        if page is None:
            failed += 1
            continue
        for row in page:
            day = parse_day(row["published_day"])
            if day and (today - day).days <= days:
                kept = rows.setdefault(row["url"], dict(row, age_hints=[]))
                if age and age not in kept["age_hints"]:
                    kept["age_hints"].append(age)
    return list(rows.values()), {"queries": len(plan), "failed": failed, "headlines": len(rows)}


CATEGORY_FILE = Path(__file__).resolve().parent / "data" / "category_keywords.txt"
CATEGORY_YT_CHECKS = int(os.getenv("RISING_CATEGORY_YT_CHECKS", "8"))
NOUN_TAGS = ("NNG", "NNP", "SL", "XR")
CATEGORY_CUES = "신메뉴 OR 신상 OR 출시 OR 인기 OR 유행 OR 화제 OR 레시피 OR 오픈런 OR 품절"
CATEGORY_NOISE = re.compile(r"고향사랑|기부|기탁|협약|품평회|교육지원청|군수|시장 ?은|도서관|체액|폐업|병원|캠페인|일일찻집|하루찻집|"
                            r"박람회|수출|주가|축제|참숭어|파자마|실적|매출|영업이익|특징주|커뮤니티|コミュニティ|社区|학습지|스킨케어|화장품")
# words that sit next to a keyword in headlines without naming anything (말차 출시, 선물세트 판매)
CATEGORY_GENERIC = set("""사용 공급 혜택 조회 다양 신규 제공 판매 단독 수요 제안 확대 적용 체험 세계 사업 산업 대상 기반 제품군 제품 식품 소비
라인업 색상 구성 증정 운영 모집 개최 진행 참가 선봬 공개 론칭 강화 추가 관리 실천 문화 전통 시장 브랜드 시리즈 종류 버전 라인 열풍
레시피 맛집 후기 추천 가격 할인 기획전 프로모션 이벤트 컬렉션 에디션 한국 일본 중국 미국 글로벌 국내 프리미엄 스페셜 시그니처""".split())


def load_categories(path=None):
    """Editable keyword file -> [(field, [keyword, ...])]. Lines: 'field | kw, kw'."""
    out = []
    try:
        text = Path(path or CATEGORY_FILE).read_text(encoding="utf-8")
    except OSError:
        return out
    for line in text.splitlines():
        if line.strip().startswith("#") or "|" not in line:
            continue
        field, words = line.split("|", 1)
        words = [w.strip() for w in words.split(",") if w.strip()]
        if field.strip() and words:
            out.append((field.strip(), words))
    return out


async def category_headlines(today=None, days=14, categories=None):
    """Recent headlines per tea-adjacent keyword. Each row keeps the field and keyword that found it."""
    today = today or date.today()
    categories = load_categories() if categories is None else categories
    plan = [(field, kw) for field, words in categories for kw in words]
    after = (today - timedelta(days=days)).isoformat()
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        # the bare keyword mostly returns municipal and corporate notices; ask for consumer-facing news
        pages = await asyncio.gather(*(_search(client, semaphore, f"{kw} ({CATEGORY_CUES}) after:{after}") for _f, kw in plan))
    rows, failed = {}, 0
    for (field, kw), page in zip(plan, pages):
        if page is None:
            failed += 1
            continue
        for row in page:
            day = parse_day(row["published_day"])
            if CATEGORY_NOISE.search(row["title"]):
                continue
            if day and (today - day).days <= days and kw.replace(" ", "") in row["title"].replace(" ", ""):
                rows.setdefault(row["url"], dict(row, field=field, keyword=kw))
    return list(rows.values()), {"queries": len(plan), "failed": failed, "headlines": len(rows)}


def _noun_runs(title, kiwi):
    """Runs of adjacent nouns as (start, end) character spans. Falls back to plain words without Kiwi."""
    if not kiwi:
        words = [(m.start(), m.end()) for m in re.finditer(r"[가-힣A-Za-z]{2,}", title)]
        runs, run = [], []
        for span in words:
            if run and span[0] - run[-1][1] > 1:
                runs.append(run)
                run = []
            run.append(span)
        return runs + ([run] if run else [])
    runs, run, last_end = [], [], None
    for token in kiwi.tokenize(title):
        end = token.start + token.len
        if token.tag in NOUN_TAGS and (not run or token.start - last_end <= 1):
            run.append((token.start, end))
        else:
            if run:
                runs.append(run)
            run = [(token.start, end)] if token.tag in NOUN_TAGS else []
        last_end = end
    return runs + ([run] if run else [])


def category_candidates(rows, limit=110):
    """Phrases made of a category keyword plus the noun next to it (말차 하이볼, 호지차 라떼, 티 오마카세 코스).

    The keyword itself is too broad to be news; what it is being combined with is the trend signal.
    """
    kiwi = _kiwi()
    found = {}
    for row in rows:
        title, kw = row["title"], row["keyword"].replace(" ", "")
        for run in _noun_runs(title, kiwi):
            for size in (2, 3):
                for i in range(len(run) - size + 1):
                    part = run[i:i + size]
                    phrase = _clean(title[part[0][0]:part[-1][1]])
                    flat = phrase.replace(" ", "")
                    if kw not in flat or flat == kw or not 3 <= len(flat) <= 14:
                        continue
                    rest = [title[s:e] for s, e in part if title[s:e] not in kw]
                    if (not rest or any(w in GENERIC or w in CATEGORY_GENERIC or CUE_RE.fullmatch(w) or len(w) < 2 for w in rest)
                            or not _ok(phrase)):
                        continue
                    entry = found.setdefault(flat, {"term": phrase, "rows": {}, "field": row["field"], "keyword": row["keyword"]})
                    entry["rows"].setdefault(row["url"], row)
    ranked = []
    for entry in found.values():
        seen = list(entry["rows"].values())
        hosts = {r["publisher_host"] for r in seen}
        ranked.append({"term": entry["term"], "field": entry["field"], "keyword": entry["keyword"], "seed_stories": len(seen),
                       "seed_publishers": len(hosts), "sources": ["news"], "age_hints": [], "seed_top_views": 0,
                       "score": len(seen) + 2 * len(hosts), "headlines": [r["title"] for r in seen[:4]]})
    ranked.sort(key=lambda c: (-c["score"], -len(c["term"]), c["term"]))
    kept = []
    for cand in ranked:  # a 2-word phrase inside a 3-word one with the same headlines adds nothing
        flat = cand["term"].replace(" ", "")
        if any(flat in k["term"].replace(" ", "") and set(cand["headlines"]) <= set(k["headlines"]) for k in kept):
            continue
        kept.append(cand)
    return kept[:limit]


DEMAND = re.compile(r"품절|완판|오픈런|매진|대란|줄 ?서|돌파|판매 ?1위|1위|재출시|재입고|입소문|"
                    r"\d+\s?만\s?(?:잔|개|봉|병|팩|명|세트|박스)|\d+\s?(?:일|주|시간)\s?만에")


def demand_cues(titles):
    """Words in headlines that report a buyer reaction (sold out, queues, units sold), not just a launch."""
    found = []
    for title in titles:
        for match in DEMAND.finditer(title or ""):
            if match.group(0) not in found:
                found.append(match.group(0))
    return found[:4]


def category_stage(stage, reason, cues):
    """A launch covered by several outlets is not yet a trend: separate launches from reported demand."""
    if stage == "초기 급상승" and not cues:
        return "출시 단계", f"{reason} · 판매·품절·줄서기 같은 반응을 말한 기사는 아직 없음"
    if stage == "근거 부족" and cues:
        return "반응 포착", f"기사는 적지만 반응을 말함({', '.join(cues)})"
    if cues:
        return stage, f"{reason} · 반응 언급: {', '.join(cues)}"
    return stage, reason


def combine_stage(stage, reason, shorts, seed_top_views=0, shorts_only=False):
    """Adjust the news-based stage with public shorts view counts. Growth over time decides, not raw views.

    Windows: last 14 days / days 15-45 / days 46-365 (top 10 most-viewed short videos naming the item in each).
      - signal needs the name in >=3 recent videos from >=2 channels and a top video of STRONG_VIEWS or more
      - "쇼츠에서 급상승": per-day views of the last 14 days >= 2x the 31 days before AND it was not already big
        earlier in the year (few old videos, or old top views well below the recent top)
      - "오래된 유행": already had several well-watched videos 46-365 days ago: high views now are not news
    An item seen only in shorts that could not be measured is never called early: it is "측정 대기".
    """
    if not shorts:
        if shorts_only and stage == "뉴스 전 선행 포착":
            if seed_top_views < STRONG_VIEWS:
                return "근거 부족", f"쇼츠에만 등장 · 최고 조회 {seed_top_views:,}회로 낮음"
            return "측정 대기", "쇼츠에만 등장 · 기간별 조회 비교를 아직 못 함(유튜브 할당량)"
        return stage, reason
    strong = (shorts["videos_in_top10_with_name"] >= 3 and shorts["channels"] >= 2 and shorts["top_views"] >= STRONG_VIEWS)
    note = f"쇼츠 {shorts['videos_in_top10_with_name']}개·채널 {shorts['channels']}곳·최고 조회 {shorts['top_views']:,}회"
    if not strong:
        if shorts_only and stage == "뉴스 전 선행 포착":
            return "근거 부족", f"쇼츠에만 등장 · {note} · 기준 미달"
        return stage, reason
    prior, old_videos, old_top = shorts.get("views_prior"), shorts.get("videos_old"), shorts.get("old_top_views")
    rate_recent, rate_prior = shorts["views_recent"] / 14, (prior or 0) / 31
    growth = f"하루 평균 조회 {rate_recent:,.0f}회(최근 14일) vs {rate_prior:,.0f}회(직전 31일)"
    long_running = old_videos is not None and old_videos >= 4 and (old_top or 0) >= 0.5 * shorts["top_views"]
    if long_running:
        return "오래된 유행", f"{note} · 46일 이전에도 영상 {old_videos}개·최고 조회 {old_top:,}회 · 새로 뜬 것이 아님"
    rising = prior is not None and rate_recent >= 2 * rate_prior
    if stage in ("근거 부족", "꺾이는 중", "뉴스 전 선행 포착", "측정 대기", "출시 단계", "반응 포착"):
        if rising:
            return "쇼츠에서 급상승", f"{growth} · 2배 이상 · {note} · 뉴스: {reason}"
        return "쇼츠에서 유지", f"{growth} · 뚜렷한 상승 없음 · {note} · 뉴스: {reason}"
    if prior is not None and rate_prior > 0 and rate_recent < 0.5 * rate_prior:
        return "정점 지남", f"{growth} · 쇼츠 조회가 절반 아래로 줄었음(뉴스가 뒤따르는 중) · 뉴스: {reason}"
    return stage, f"{reason} · {growth} · {note}"


def stage_of(recent, mid, old, publishers_recent, early_source=False):
    """Fixed, explainable rules on distinct-story counts: last 14 days / days 15-45 / days 46-365."""
    if (recent < 2 or publishers_recent < 2) and mid + old >= 10:
        return "꺾이는 중", f"최근 2주 {recent}건 · 이전 {mid + old}건 · 보도가 줄어듦"
    if (recent < 2 or publishers_recent < 2) and early_source:
        return "뉴스 전 선행 포착", f"MZ 뉴스레터·유튜브·검색 급상승에 등장 · 뉴스는 아직 {recent}건"
    if recent < 2 or publishers_recent < 2:
        return "근거 부족", "최근 2주 서로 다른 매체 2곳 미만"
    rate_recent, rate_mid, rate_old = recent / 14, mid / 31, old / 320
    if old >= 30 or (old >= 12 and rate_recent < 3 * rate_old):
        return "이미 대중화", f"46일 이전 기사 {old}건 · 이미 널리 보도됨"
    if mid == 0 and old <= 2:
        return "초기 급상승", f"최근 2주에 처음 등장(이전 45일 0건, 그 이전 {old}건)"
    if rate_recent >= 2 * max(rate_mid, 0.03) and old <= 12:
        return "초기 급상승", f"최근 2주 {recent}건 · 직전 한 달 {mid}건 대비 하루 평균 2배 이상"
    if rate_recent >= rate_mid:
        return "확산 중", f"최근 2주 {recent}건 · 직전 한 달 {mid}건 · 유지 또는 증가"
    return "꺾이는 중", f"최근 2주 {recent}건 · 직전 한 달 {mid}건 · 감소"


async def measure(terms, today=None, early_terms=()):
    """Per term: distinct stories and publishers in three windows. Query is the quoted exact name."""
    today = today or date.today()
    d14, d45, d365 = (today - timedelta(days=n) for n in (14, 45, 365))
    semaphore = asyncio.Semaphore(4)

    async def one(client, term):
        q = f'"{term}"'
        recent, mid, old = await asyncio.gather(
            _search(client, semaphore, f"{q} after:{d14.isoformat()}"),
            _search(client, semaphore, f"{q} after:{d45.isoformat()} before:{(d14 + timedelta(days=1)).isoformat()}"),
            _search(client, semaphore, f"{q} after:{d365.isoformat()} before:{(d45 + timedelta(days=1)).isoformat()}"))
        if recent is None or mid is None or old is None:
            return {"term": term, "stage": "측정 실패", "reason": "뉴스 색인 호출 실패"}

        def exact(rows, start, end):
            out = [r for r in rows if term.replace(" ", "") in r["title"].replace(" ", "")
                   and r["published_day"] and start <= parse_day(r["published_day"]) <= end]
            return out
        recent, mid, old = exact(recent, d14, today), exact(mid, d45, d14), exact(old, d365, d45)

        def stories(rows):
            return len(set(assign_stories(rows).values())) if rows else 0
        n_recent, n_mid, n_old = stories(recent), stories(mid), stories(old)
        publishers = {r["publisher_host"] for r in recent}
        stage, reason = stage_of(n_recent, n_mid, n_old, len(publishers), term in early_terms)
        wiki = await wiki_views(client, term, today)
        days = sorted(r["published_day"] for r in recent + mid + old)
        ordered = sorted(recent, key=lambda r: r["published_day"], reverse=True)
        return {"term": term, "stage": stage, "reason": reason,
                "stories": {"last_14d": n_recent, "d15_45": n_mid, "d46_365": n_old},
                "publishers_14d": len(publishers), "first_seen": days[0] if days else None,
                "capped": len(recent) >= 95, "wiki": wiki,
                "evidence": [{"title": r["title"], "url": r["url"], "platform": r["platform"], "published_day": r["published_day"]}
                             for r in ordered[:5]]}

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        return await asyncio.gather(*(one(client, t) for t in terms))

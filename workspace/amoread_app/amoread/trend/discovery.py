"""Public metadata discovery. Never fetch social post bodies or infer engagement."""
import asyncio
import html
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from urllib.parse import quote, urlparse

import httpx

from .evidence import (AREA_TERMS, SIGNAL_ORIGINS, audience_terms, build_signals, emerging_terms, parse_day,
                       plan_windows, publisher_group, query_branches, review_priority, theme_input, tokenizer_name,
                       window_for)
from .semantic import RELEVANCE_MIN, relevance_scores, semantic_groups

SOCIAL = {
    "Instagram": ("instagram.com", ("instagram.com/p/", "instagram.com/reel/")),
    "Pinterest": ("pinterest.com", "pinterest.com/pin/"),
    "TikTok": ("tiktok.com", "tiktok.com/@"),
    "Threads": ("threads.net", "threads.net/@"),
}
# Latest-posts RSS (no search, ~10-20 newest items each).
MAGAZINES = {
    "Hypebeast KR": "https://hypebeast.kr/feed",
    "Marie Claire Korea": "https://www.marieclairekorea.com/feed/",
    "W Korea": "https://www.wkorea.com/feed/",
    "ELLE Korea": "https://www.elle.co.kr/rss/",
    "Esquire Korea": "https://www.esquirekorea.co.kr/rss/",
    "Cosmopolitan Korea": "https://www.cosmopolitan.co.kr/rss/",
    "Harper's BAZAAR Korea": "https://www.harpersbazaar.co.kr/rss/",
}
# Publisher WordPress search feeds that honour ?s=, &year=, &monthnum= (verified 2026-11-13).
ARCHIVE_PUBLISHERS = {
    "Marie Claire Korea": "https://www.marieclairekorea.com",
    "W Korea": "https://www.wkorea.com",
    "Vogue Korea": "https://www.vogue.co.kr",
    "Allure Korea": "https://www.allurekorea.com",
    "GQ Korea": "https://www.gqkorea.co.kr",
    "Dazed Korea": "https://www.dazedkorea.com",
    "디에디트": "https://www.the-edit.co.kr",
    "월간 디자인": "https://design.co.kr",
}
# Search works but date filters do not: fetch recent search pages and filter by publish date afterwards.
UNDATED_ARCHIVES = {"월간 디자인"}
NEWS_INDEX = "https://news.google.com/rss/search"
MAX_NEWS_REQUESTS = 14
MAX_NEWS_PER_QUERY = 40
# Fan-community posts, photo captions and fortune columns are not consumer-taste coverage.
NEWS_NOISE = re.compile(r"커뮤니티 포스트|\[포토\]|\[사진\]|오늘의 운세|별자리 운세|\[부고\]|\[인사\]|"
                        r"주가|실적|매출액|영업이익|수주|MOU|업무협약|맞손|선임|증권|상장|분기|특징주|공시|"
                        # finance
                        r"국채|선물거래|선물옵션|코스피|코스닥|환율|기준금리|증시|채권|펀드|ETF|배당|공모주|"
                        # travel packages and tours (food/gift packages stay)
                        r"여행 ?상품|여행 ?패키지|패키지 ?여행|항공권|항공사|하나투어|모두투어|숙박 ?패키지|객실 ?패키지|관광 ?상품|"
                        # politics, sports, construction business
                        r"국회|국정감사|대통령|여당|야당|탄핵|선거|야구|KBO|월드컵|분양|착공|준공|입주 ?예정|"
                        # semiconductor / overseas-trip 'package' and TV-drama news (words overlap with 패키지·기프트)
                        r"패키지 ?기판|반도체|CoWoS|해외 ?패키지|패키지 ?특가|가족 ?패키지|패키지 ?투어|"
                        r"드라마|예능|첫 방송|시청률|티저 공개|무기한 ?선물|달러 ?선물|나스닥|"
                        # lodging/trip packages, corporate social-contribution campaigns, start-up funding news
                        r"객실|경품 ?패키지|체험형 ?패키지|리조트|기프트카|사회공헌|유소년|후원금|기부금|딥테크|팁스|창업기업|스타트업|투자 ?유치")
CACHE_TTL = 900
_CACHE = {}
PUBLISHER_SEARCH = {"Marie Claire Korea": ARCHIVE_PUBLISHERS["Marie Claire Korea"] + "/"}
CURATED_FEEDS = {"MAPA 숏폼 레퍼런스": "https://maily.so/mapa/feed"}
SEARCH_ALIASES = {"크리스마스": ("홀리데이", "연말", "겨울"), "홈카페": ("홈 카페",)}
BRAND_CASE = re.compile(r"캠페인|콜라보|컬래버|협업|팝업|에디션|브랜드|기프트 ?세트|패키지", re.I)
MAX_BYTES = 900_000
MAX_ARCHIVE_REQUESTS = 96
MAX_EMBED_ARTICLES = 40
ARCHIVE_DEADLINE = 22
EMBED_DEADLINE = 12
UA = {"User-Agent": "ConceptExplorer/0.4 (public RSS metadata)", "Accept-Encoding": "gzip, deflate"}


def _safe_text(value):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value or "")).split())[:500]


def _host_matches(url, host):
    parsed = urlparse(url)
    return parsed.scheme == "https" and (parsed.hostname == host or (parsed.hostname or "").endswith("." + host))


def _host(url):
    return (urlparse(url).hostname or "").removeprefix("www.")


def _rss_items(data):
    try:
        root = ET.fromstring(data)
        return root.findall("./channel/item")[:30]
    except ET.ParseError:
        # Some publisher feeds use undeclared namespace prefixes. Read only the plain RSS fields.
        text = data.decode("utf-8", "replace") if isinstance(data, bytes) else data
        if "<rss" not in text[:2000] and "<channel" not in text[:4000]:
            raise
        nodes = []
        for block in re.findall(r"<item\b[^>]*>(.*?)</item>", text, re.S)[:30]:
            node = ET.Element("item")
            for tag in ("title", "link", "description", "pubDate"):
                match = re.search(rf"<{tag}\b[^>]*>(.*?)</{tag}>", block, re.S)
                if match:
                    value = match.group(1).strip()
                    value = re.sub(r"^<!\[CDATA\[(.*)\]\]>$", r"\1", value, flags=re.S)
                    ET.SubElement(node, tag).text = value if tag == "description" else html.unescape(value)
            nodes.append(node)
        if not nodes and "<item" in text:
            raise
        return nodes


async def _fetch(client, url):
    response = await client.get(url, headers=UA)
    response.raise_for_status()
    if len(response.content) > MAX_BYTES:
        raise ValueError("피드 크기 초과")
    return _rss_items(response.content)


def _record(platform, node, origin, limit):
    url = (node.findtext("link") or "").strip()
    title = _safe_text(node.findtext("title"))
    if not url.startswith("https://") or not title:
        return None
    published = _safe_text(node.findtext("pubDate")) or None
    day = parse_day(published)
    return {
        "platform": platform, "url": url, "title": title,
        "summary": _safe_text(node.findtext("description")),
        "published": published, "published_day": day.isoformat() if day else None,
        "observed": datetime.now(timezone.utc).isoformat(),
        "visual": None, "reaction": None, "origin": origin,
        "publisher_host": _host(url),
        "limitations": limit,
    }


def _topic_terms(query):
    terms = [term.lower() for term in query.split() if len(term) > 1 and not re.fullmatch(r"20\d{2}", term)]
    return terms + [alias for term in terms for alias in SEARCH_ALIASES.get(term, ())]


def _match_level(item, terms):
    if not terms:
        return "fulltext"
    if any(term in item["title"].lower() for term in terms):
        return "title"
    if any(term in (item.get("summary") or "").lower() for term in terms):
        return "excerpt"
    return "fulltext"


def _curated_rows(page, query, article_url, article_date):
    """Use only a publisher's explicit reference table, never social post contents."""
    years = re.findall(r"\b20\d{2}\b", query)
    if years and not any(year in article_date for year in years):
        return []
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    terms = _topic_terms(query)
    found = []
    for row in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.I | re.S):
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.I | re.S)
        if len(cells) < 2:
            continue
        label = _safe_text(cells[0])
        if not label or (terms and not any(term in label.lower() for term in terms)):
            continue
        links = re.findall(r'''href=["'](https://(?:www\.)?instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+)''',
                           html.unescape(cells[1]), re.I)
        day = parse_day(article_date)
        for link in links[:2]:
            found.append({"platform": "Instagram", "url": link + "/", "title": label,
                          "summary": "MAPA 뉴스레터가 소개한 레퍼런스: " + label,
                          "published": None, "observed": datetime.now(timezone.utc).isoformat(),
                          "visual": None, "reaction": None, "origin": "curated_reference",
                          "source_url": article_url, "source_published": article_date,
                          "source_day": day.isoformat() if day else None,
                          "publisher_host": _host(article_url), "source_title": "MAPA 뉴스레터",
                          "limitations": "뉴스레터의 설명·원본 링크만 확인. SNS 게시물 본문·게시일·이미지·반응은 확인하지 않음"})
    return found


async def _curated_search(client, feed_url, query):
    articles = await _fetch(client, feed_url)
    candidates = [(node.findtext("link") or "", node.findtext("pubDate") or "")
                  for node in articles[:20]]
    semaphore = asyncio.Semaphore(6)

    async def read_article(url, date_text):
        if not _host_matches(url, "maily.so") or "/posts/" not in url:
            return []
        async with semaphore:
            response = await client.get(url, headers=UA)
            response.raise_for_status()
            if len(response.content) > MAX_BYTES:
                return []
            return _curated_rows(response.text, query, url, date_text)

    results = await asyncio.gather(*(read_article(url, d) for url, d in candidates),
                                   return_exceptions=True)
    failures = [result for result in results if isinstance(result, Exception)]
    if results and len(failures) == len(results):
        raise failures[0]
    return [item for result in results if isinstance(result, list) for item in result]


def _article_embeds(page, article):
    """Read only Instagram embed permalinks explicitly present in a public article."""
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    urls = dict.fromkeys(re.findall(
        r'''data-instgrm-permalink=["'](https://(?:www\.)?instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+)''',
        html.unescape(page), re.I))
    return [{"platform": "Instagram", "url": url + "/", "title": article["title"] + " · 기사 내 원본 링크",
             "summary": "기사에 삽입된 Instagram 원본 링크. 기사 주제: " + article["title"],
             "published": None, "observed": datetime.now(timezone.utc).isoformat(),
             "visual": None, "reaction": None, "origin": "publisher_embed",
             "source_url": article["url"], "source_published": article.get("published"),
             "source_day": article.get("published_day"), "source_title": article["title"],
             "source_platform": article.get("platform"),
             "publisher_host": article.get("publisher_host") or _host(article["url"]),
             "period_role": article.get("period_role"), "branches": article.get("branches", []),
             "areas": article.get("areas", []),
             "limitations": "기사의 임베드 URL만 확인. SNS 게시물 자체의 게시일·내용·이미지·반응은 미확인"}
            for url in urls][:4]


def _archive_requests(branches, windows):
    """Ordered (publisher, url, branch, role) list; the requested period comes first."""
    requests = []
    if windows:
        order = {"in_period": 0, "lead_in": 0, "reference": 1, "previous": 2}
        for window in sorted(windows, key=lambda w: order[w["role"]]):
            # previous uses the same branches so the year-over-year comparison has equal search depth
            use = branches if window["role"] in ("in_period", "lead_in", "previous") else branches[:1]
            for branch in use:
                for year, month in window["months"]:
                    for name, base in ARCHIVE_PUBLISHERS.items():
                        if name in UNDATED_ARCHIVES:
                            continue
                        url = f"{base}/feed/?s={quote(branch['query'])}&year={year}&monthnum={month}"
                        requests.append((name, url, branch, window["role"]))
        for branch in branches:
            for name in UNDATED_ARCHIVES:
                for page in (1, 2):
                    url = f"{ARCHIVE_PUBLISHERS[name]}/feed/?s={quote(branch['query'])}&paged={page}"
                    requests.append((name, url, branch, "undated"))
    else:
        for index, branch in enumerate(branches):
            for page in range(1, 3 if index == 0 else 2):
                for name, base in ARCHIVE_PUBLISHERS.items():
                    url = f"{base}/feed/?s={quote(branch['query'])}&paged={page}"
                    requests.append((name, url, branch, None))
    return requests[:MAX_ARCHIVE_REQUESTS], max(0, len(requests) - MAX_ARCHIVE_REQUESTS)


async def _gather_with_deadline(coros, deadline):
    tasks = [asyncio.ensure_future(c) for c in coros]
    if not tasks:
        return []
    done, pending = await asyncio.wait(tasks, timeout=deadline)
    for task in pending:
        task.cancel()
    return [task.result() if task in done and not task.exception() else
            (task.exception() if task in done else asyncio.TimeoutError()) for task in tasks]


async def _publisher_archive(client, branches, windows, query_years, include_instagram, statuses):
    """Search several publishers' archives per branch and period; then read explicit Instagram embeds."""
    plan, skipped = _archive_requests(branches, windows)
    semaphore = asyncio.Semaphore(12)
    # Same-group publisher servers refuse bursts; keep at most two connections per host and retry once.
    per_host = {urlparse(b).hostname: asyncio.Semaphore(2) for b in ARCHIVE_PUBLISHERS.values()}

    async def get(url):
        async with semaphore, per_host[urlparse(url).hostname]:
            try:
                return await _fetch(client, url)
            except (httpx.ConnectTimeout, httpx.ConnectError, httpx.ReadTimeout):
                await asyncio.sleep(0.4)
                return await _fetch(client, url)

    pages = await _gather_with_deadline((get(url) for _, url, _, _ in plan), ARCHIVE_DEADLINE)
    if plan and all(isinstance(page, BaseException) for page in pages):
        raise pages[0] if isinstance(pages[0], Exception) else asyncio.TimeoutError()
    per_publisher = {name: {"ok": 0, "failed": 0, "timeout": 0, "items": set()} for name in ARCHIVE_PUBLISHERS}
    articles = {}
    for (name, _url, branch, role), page in zip(plan, pages):
        stat = per_publisher[name]
        if isinstance(page, BaseException):
            stat["timeout" if isinstance(page, (asyncio.TimeoutError, httpx.TimeoutException)) else "failed"] += 1
            continue
        stat["ok"] += 1
        host = urlparse(ARCHIVE_PUBLISHERS[name]).hostname
        for node in page:
            article = _record(name, node, "publisher_archive",
                              "발행처 검색 RSS 메타데이터(제목·요약·발행일). 본문·이미지·반응 미확인")
            if not article or not _host_matches(article["url"], host):
                continue
            day = parse_day(article["published_day"])
            if windows:
                window = window_for(day, windows)
                if not window:
                    continue
                article["period_role"] = window["role"]
            elif query_years and not any(y in (article["published"] or "") for y in query_years):
                continue
            existing = articles.get(article["url"])
            if existing:
                if branch["label"] not in existing["branches"]:
                    existing["branches"].append(branch["label"])
                if branch["area"] and branch["area"] not in existing["areas"]:
                    existing["areas"].append(branch["area"])
                continue
            article["branches"] = [branch["label"]]
            article["areas"] = [branch["area"]] if branch["area"] else []
            article["match_level"] = _match_level(article, _topic_terms(branch["query"]))
            articles[article["url"]] = article
            stat["items"].add(article["url"])
    for name, stat in per_publisher.items():
        tried = stat["ok"] + stat["failed"] + stat["timeout"]
        if not tried:
            continue
        state = ("ok" if stat["items"] else "no_results") if stat["ok"] else ("timeout" if stat["timeout"] else "call_failed")
        reason = None
        if stat["ok"] and (stat["failed"] or stat["timeout"]):
            reason = f"요청 {tried}건 중 {stat['failed'] + stat['timeout']}건 실패·시간 초과"
        statuses.append({"platform": name + " 아카이브", "mode": "publisher_archive", "state": state,
                         "count": len(stat["items"]), "reason": reason})
    if skipped:
        statuses.append({"platform": "발행처 아카이브 요청 상한", "mode": "publisher_archive", "state": "limited",
                         "count": 0, "reason": f"요청 상한으로 {skipped}건 검색 가지를 생략. 관심 분야나 기간을 줄이세요"})
    records = list(articles.values())
    if not include_instagram:
        return records
    order = {"in_period": 0, "lead_in": 0, None: 0, "reference": 1, "previous": 2}
    candidates = sorted(records, key=lambda a: (order.get(a.get("period_role"), 3),
                                                {"title": 0, "excerpt": 1}.get(a["match_level"], 2)))
    candidates = candidates[:MAX_EMBED_ARTICLES]

    async def read_article(article):
        if not any(_host_matches(article["url"], urlparse(b).hostname) for b in ARCHIVE_PUBLISHERS.values()):
            return []
        async with semaphore, per_host[urlparse(article["url"]).hostname]:
            response = await client.get(article["url"], headers=UA)
            response.raise_for_status()
            if len(response.content) > 2 * MAX_BYTES:
                return []
            return _article_embeds(response.text, article)

    embedded = await _gather_with_deadline((read_article(a) for a in candidates), EMBED_DEADLINE)
    embeds = [item for result in embedded if isinstance(result, list) for item in result]
    missed = sum(isinstance(r, BaseException) for r in embedded)
    statuses.append({"platform": "기사 내 Instagram 원본 링크", "mode": "publisher_embed",
                     "state": "ok" if embeds else "no_results", "count": len(embeds),
                     "reason": (f"기사 {len(candidates)}건 확인 · {missed}건 실패·시간 초과" if missed
                                else f"기사 {len(candidates)}건 확인")})
    return embeds + records


def _news_title(title, source):
    if source and title.endswith(" - " + source):
        return title[: -len(source) - 3].strip()
    return title.rsplit(" - ", 1)[0].strip() if " - " in title else title


async def _news_index(client, branches, windows, query_years):
    """Google News search RSS: headline, outlet and publish date only. Article bodies are not read."""
    plan = []
    if windows:
        for window in windows:
            use = branches if window["role"] in ("in_period", "lead_in", "previous") else branches[:1]
            for branch in use:
                after = window["start"].fromordinal(window["start"].toordinal() - 1).isoformat()
                before = window["end"].fromordinal(window["end"].toordinal() + 1).isoformat()
                plan.append((branch, window["role"], f'{branch["query"]} after:{after} before:{before}'))
    else:
        plan = [(branch, None, branch["query"] + (" " + query_years[0] if query_years else "")) for branch in branches]
    plan = plan[:MAX_NEWS_REQUESTS]
    semaphore = asyncio.Semaphore(4)

    async def get(q):
        async with semaphore:
            url = f"{NEWS_INDEX}?q={quote(q)}&hl=ko&gl=KR&ceid=KR:ko"
            response = await client.get(url, headers=UA)
            response.raise_for_status()
            if len(response.content) > 2 * MAX_BYTES:
                raise ValueError("피드 크기 초과")
            return response.text

    pages = await _gather_with_deadline((get(q) for _, _, q in plan), ARCHIVE_DEADLINE)
    if plan and all(isinstance(page, BaseException) for page in pages):
        raise pages[0] if isinstance(pages[0], Exception) else asyncio.TimeoutError()
    found = {}
    for (branch, role, _q), page in zip(plan, pages):
        if isinstance(page, BaseException):
            continue
        for block in re.findall(r"<item>(.*?)</item>", page, re.S)[:MAX_NEWS_PER_QUERY]:
            link = re.search(r"<link>(.*?)</link>", block, re.S)
            title = re.search(r"<title>(.*?)</title>", block, re.S)
            pub = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
            source = re.search(r'<source url="([^"]+)">(.*?)</source>', block, re.S)
            if not (link and title and source):
                continue
            url = html.unescape(link.group(1).strip())
            source_url, source_name = html.unescape(source.group(1)), _safe_text(source.group(2))
            if not url.startswith("https://news.google.com/") or not source_url.startswith("http"):
                continue
            day = parse_day(pub.group(1) if pub else None)
            item_role = role
            if windows:
                window = window_for(day, windows)
                if not window:
                    continue
                item_role = window["role"]
            elif query_years and not (day and str(day.year) in query_years):
                continue
            headline = _news_title(_safe_text(title.group(1)), source_name)
            if NEWS_NOISE.search(headline):
                continue
            existing = found.get(url)
            if existing:
                if branch["label"] not in existing["branches"]:
                    existing["branches"].append(branch["label"])
                continue
            found[url] = {
                "platform": source_name or _host(source_url), "url": url, "title": headline, "summary": "",
                "published": pub.group(1).strip() if pub else None, "published_day": day.isoformat() if day else None,
                "observed": datetime.now(timezone.utc).isoformat(), "visual": None, "reaction": None,
                "origin": "news_index", "publisher_host": _host(source_url), "period_role": item_role,
                "branches": [branch["label"]], "areas": [branch["area"]] if branch["area"] else [],
                "match_level": "title" if any(t in headline.lower() for t in _topic_terms(branch["query"])) else "fulltext",
                "limitations": "Google 뉴스 검색 색인의 헤드라인·매체·발행일만 확인. 기사 본문 미확인. 링크는 Google 뉴스를 거쳐 원문으로 이동",
            }
    return list(found.values())


def _period_payload(period, windows, state):
    if not period:
        return None
    return {"label": period.get("label") or "", "start": period.get("start"), "end": period.get("end"),
            "state": state,
            "windows": [{"role": w["role"], "start": w["start"].isoformat(), "end": w["end"].isoformat()}
                        for w in windows],
            "note": ("요청 기간이 아직 오지 않았습니다. 결과는 최근 30일 선행 관측과 과거 같은 기간 참고 자료이며, "
                     "요청 기간의 실제 관측이 아닙니다." if state == "future" else
                     "요청 기간 중 오늘까지의 자료만 포함합니다." if state == "partial" else
                     "기사 발행일 기준으로 기간을 판정합니다. SNS 게시일은 확인하지 않습니다.")}


async def discover(query, platforms, areas=None, audience=None, period=None, compare_previous=False, today=None, youth=False):
    """Cached wrapper: identical searches within CACHE_TTL reuse the earlier observation snapshot."""
    key = json.dumps([query, sorted(platforms or []), areas or [], audience or {}, period, compare_previous,
                      str(today), youth], ensure_ascii=False, sort_keys=True)
    hit = _CACHE.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL:
        return dict(hit[1], cached=True)
    result = await _discover(query, platforms, areas, audience, period, compare_previous, today, youth)
    if result.get("items"):
        _CACHE[key] = (time.monotonic(), result)
        for stale in [k for k, (at, _) in _CACHE.items() if time.monotonic() - at >= CACHE_TTL]:
            _CACHE.pop(stale, None)
    return dict(result, cached=False)


async def _discover(query, platforms, areas=None, audience=None, period=None, compare_previous=False, today=None, youth=False):
    """Search publisher archives and a news index by audience branches and period, plus indexed public links."""
    query = " ".join((query or "").split())[:80]
    areas = [a for a in (areas or []) if a in AREA_TERMS]
    audience = audience or {}
    branches = query_branches(query, areas, audience.get("interests", ""), youth)
    if not branches:
        return {"items": [], "providers": [], "signals": [], "branches": [], "period": None,
                "reason": "검색어를 입력하거나 관심 분야를 하나 이상 선택하세요"}
    today = today or date.today()
    try:
        windows, period_state = plan_windows(period, today, compare_previous)
    except ValueError as exc:
        return {"items": [], "providers": [], "signals": [], "branches": branches, "period": None,
                "reason": str(exc), "invalid": True}
    platforms = set(platforms or [])
    selected_social = [p for p in SOCIAL if not platforms or p in platforms]
    include_youtube = not platforms or "YouTube" in platforms
    query_years = [] if windows else re.findall(r"\b20\d{2}\b", query)
    branch_terms = list(dict.fromkeys(t for b in branches for t in _topic_terms(b["query"])))
    tasks, statuses = [], []
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        if query:
            for platform in selected_social:
                host, path = SOCIAL[platform]
                index_path = path[0] if isinstance(path, tuple) else path
                url = "https://www.bing.com/search?format=rss&q=" + quote(f"site:{index_path} {query}")
                tasks.append((platform, "search_index", asyncio.create_task(_fetch(client, url))))
        for name, url in MAGAZINES.items():
            tasks.append((name, "official_feed", asyncio.create_task(_fetch(client, url))))
        tasks.append(("발행처 검색 아카이브", "publisher_archive", asyncio.create_task(
            _publisher_archive(client, branches, windows, query_years, "Instagram" in selected_social, statuses))))
        if os.getenv("NEWS_INDEX", "1") != "0":
            tasks.append(("Google 뉴스 검색 색인", "news_index", asyncio.create_task(
                _news_index(client, branches, windows, query_years))))
        if query:
            for name, feed_url in CURATED_FEEDS.items():
                tasks.append((name, "curated_reference", asyncio.create_task(_curated_search(client, feed_url, query))))
        youtube_key = os.getenv("YOUTUBE_API_KEY")
        if include_youtube and youtube_key and query:
            params = {"part": "snippet", "q": query, "type": "video", "maxResults": 10,
                      "regionCode": "KR", "relevanceLanguage": "ko", "key": youtube_key}
            tasks.append(("YouTube Data API", "youtube_api", asyncio.create_task(client.get(
                "https://www.googleapis.com/youtube/v3/search", params=params))))
        items = []
        for platform, mode, task in tasks:
            try:
                before = len(items)
                rejected_index_links = 0
                result = await task
                if mode == "youtube_api":
                    result.raise_for_status()
                    for item in result.json().get("items", []):
                        video_id = item.get("id", {}).get("videoId")
                        snippet = item.get("snippet", {})
                        if video_id and snippet.get("title"):
                            items.append({"platform": "YouTube", "url": "https://www.youtube.com/watch?v=" + video_id,
                                          "title": _safe_text(snippet["title"]), "summary": _safe_text(snippet.get("description")),
                                          "published": snippet.get("publishedAt"), "observed": datetime.now(timezone.utc).isoformat(),
                                          "visual": None, "reaction": None, "origin": "official_api",
                                          "publisher_host": "youtube.com",
                                          "limitations": "검색 메타데이터만 확인. 영상 내용·반응은 미확인"})
                elif mode == "curated_reference":
                    for row in result:
                        if windows:
                            window = window_for(parse_day(row.get("source_day")), windows)
                            if not window:
                                continue
                            row["period_role"] = window["role"]
                        items.append(row)
                elif mode in ("publisher_archive", "news_index"):
                    items.extend(result)
                else:
                    for node in result:
                        record = _record(platform, node, mode,
                            "검색 색인의 제목·설명만 확인. 원본 게시물 내용·반응은 미확인" if mode == "search_index"
                            else "발행처 최신 RSS의 제목·설명만 확인. 본문·이미지·반응은 미확인")
                        if not record:
                            continue
                        if mode == "search_index":
                            host, path = SOCIAL[platform]
                            paths = path if isinstance(path, tuple) else (path,)
                            if not _host_matches(record["url"], host) or not any(p in record["url"] for p in paths):
                                rejected_index_links += 1
                                continue
                        else:
                            feed_host = urlparse(MAGAZINES[platform]).hostname
                            if not _host_matches(record["url"], feed_host):
                                continue
                            if windows:
                                window = window_for(parse_day(record["published_day"]), windows)
                                if not window:
                                    continue
                                record["period_role"] = window["role"]
                            elif query_years and not any(y in (record["published"] or "") for y in query_years):
                                continue
                            if branch_terms and not any(t in (record["title"] + " " + record["summary"]).lower()
                                                        for t in branch_terms):
                                continue
                            record["match_level"] = _match_level(record, _topic_terms(query) if query else branch_terms)
                            record["areas"] = [a for a in areas if any(t in (record["title"] + record["summary"])
                                                                        for t in AREA_TERMS[a])]
                        items.append(record)
                count = len(items) - before
                state = "ok" if count else "index_unverifiable" if mode == "search_index" and rejected_index_links else "no_results"
                statuses.append({"platform": platform, "mode": mode, "state": state, "count": count,
                                 "reason": "검색 색인이 지정 SNS 도메인과 무관한 링크를 반환함. SNS 게시물 유무를 판단할 수 없음" if state == "index_unverifiable" else None})
            except httpx.HTTPStatusError as exc:
                statuses.append({"platform": platform, "mode": mode,
                                 "state": "auth_failed" if exc.response.status_code in (401, 403) else "call_failed",
                                 "count": 0, "reason": f"HTTP {exc.response.status_code}"})
            except (httpx.TimeoutException, asyncio.TimeoutError):
                statuses.append({"platform": platform, "mode": mode, "state": "timeout", "count": 0})
            except (httpx.HTTPError, ValueError, ET.ParseError) as exc:
                statuses.append({"platform": platform, "mode": mode, "state": "call_failed", "count": 0,
                                 "reason": type(exc).__name__})
    unique = list({item["url"]: item for item in items}.values())
    # News headlines also pass a semantic consumer-relevance check (magazines are lifestyle by nature).
    news = [i for i in unique if i.get("origin") == "news_index"]
    scores = await relevance_scores([i["title"] for i in news]) if news else None
    if scores is not None:
        dropped = {i["url"] for i, sc in zip(news, scores) if sc < RELEVANCE_MIN}
        unique = [i for i in unique if i["url"] not in dropped]
        statuses.append({"platform": "소비 관련성 필터(뉴스)", "mode": "analysis", "state": "ok" if dropped else "no_results",
                         "count": len(dropped), "reason": f"뉴스 헤드라인 {len(news)}건 중 {len(dropped)}건 제외(금융·정치·건설·기업 보도자료 등과 의미가 가까움)"})
    strip = [t for b in branches for t in b["query"].split()] + list(SEARCH_ALIASES.get(query, ()))
    signal_rows = sorted([i for i in unique if i.get("origin") in SIGNAL_ORIGINS],
                         key=lambda i: {"in_period": 0, "lead_in": 0, None: 0, "previous": 1, "reference": 2}.get(i.get("period_role"), 3))
    groups, semantic_status = await semantic_groups(signal_rows, strip)
    statuses.append({"platform": "의미 묶음(로컬 임베딩)", "mode": "analysis",
                     "state": "ok" if semantic_status["state"] == "ok" else "no_results",
                     "count": len(groups), "reason": semantic_status["reason"]})
    signals = build_signals(unique, [b["query"] for b in branches] + list(SEARCH_ALIASES.get(query, ())),
                            windows, period_state, groups, semantic_status.get("duplicates"))
    semantic_status.pop("duplicates", None)
    signal_levels = {}
    for signal in signals:
        for url in signal["article_urls"]:
            signal_levels.setdefault(url, []).append(signal["level"])
    terms = audience_terms(areas, audience)
    for item in unique:
        item["publisher_group"] = publisher_group(item.get("publisher_host"))
        item["kind"] = "브랜드 사례" if BRAND_CASE.search(item["title"]) else "시각적 영감"
        item["signal_ids"] = [s["id"] for s in signals if (item.get("source_url") or item["url"]) in s["article_urls"]]
        item["priority"] = review_priority(item, signal_levels, terms)
    origin_rank = {"curated_reference": 0, "publisher_embed": 1, "publisher_archive": 2, "official_feed": 3,
                   "news_index": 4}
    unique.sort(key=lambda item: (-item["priority"]["score"], origin_rank.get(item["origin"], 5)))
    all_unique = list(unique)  # full pool, before the display cut
    # Keep every article cited by a signal so evidence links stay resolvable, then fill by priority.
    cited = {u for s in signals for u in s["article_urls"][:8]}
    unique = [i for i in unique if i["url"] in cited or (i.get("source_url") in cited)][:90] + \
             [i for i in unique if not (i["url"] in cited or i.get("source_url") in cited)]
    unique = unique[:120]
    exclude_terms = [b["query"] for b in branches] + list(SEARCH_ALIASES.get(query, ()))
    full_pool = [i for i in all_unique if i.get("origin") in SIGNAL_ORIGINS]
    return {"items": unique, "providers": statuses, "signals": signals, "branches": branches,
            "theme_input": theme_input(full_pool, period_state),
            "emerging_terms": emerging_terms(full_pool, exclude_terms, period_state),
            "pool_size": len(full_pool),
            "analysis": {"tokenizer": tokenizer_name(), "semantic": semantic_status},
            "period": _period_payload(period, windows, period_state),
            "reason": None if unique else "검증 가능한 공개 URL이 없습니다. 검색어·기간·관심 분야를 바꾸거나 공개 URL을 직접 등록하세요."}

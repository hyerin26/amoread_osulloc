"""Period planning, audience-first query branches and evidence grouping.

Everything here works on publisher metadata (title, excerpt, publish date, host).
It never derives popularity, engagement or social post content.
"""
import re
from datetime import date, datetime, timedelta
from email.utils import parsedate_to_datetime

AREA_TERMS = {
    "홈카페·음식·디저트": ("디저트", "홈카페", "레시피", "베이킹"),
    "라이프스타일·공간·인테리어": ("인테리어", "오브제", "리빙", "공간"),
    "패션·뷰티·디자인": ("디자인", "패키지", "뷰티", "컬러"),
    "선물·기념일·관계": ("선물", "기프트", "파티", "기념일"),
    "문화·전시·음악·영화": ("전시", "팝업", "영화", "공연"),
    "새로운 소비 행동": ("한정판", "콜라보", "굿즈", "오픈런"),
    "시각적 연출과 콘텐츠 형식": ("캠페인", "필름", "연출", "숏폼"),
}

# Publishers that share a media group are not independent evidence of each other.
PUBLISHER_GROUPS = {
    "vogue.co.kr": "두산매거진", "wkorea.com": "두산매거진", "allurekorea.com": "두산매거진",
    "gqkorea.co.kr": "두산매거진", "elle.co.kr": "허스트중앙", "esquirekorea.co.kr": "허스트중앙",
    "cosmopolitan.co.kr": "허스트중앙", "harpersbazaar.co.kr": "허스트중앙",
    "marieclairekorea.com": "마리끌레르코리아", "dazedkorea.com": "데이즈드코리아",
    "hypebeast.kr": "하입비스트", "maily.so": "MAPA 뉴스레터",
    "the-edit.co.kr": "디에디트", "design.co.kr": "디자인하우스",
}

PARTICLES = sorted("""의 를 을 은 는 에 에서 에게 으로 와 과 까지 부터 처럼 보다 하는 하기 하고 해서
이다 입니다 했다 이라는 라는 이란 이자 으로도 에도 에선 들의 들이 들을 같은 위한 위해 다운 스러운 적인""".split(),
                   key=len, reverse=True)
STOPWORDS = set("""추천 방법 이유 올해 이것 가지 그리고 위한 모든 소개 공개 오늘 지금 우리 당신 이번 다시 가장 정말 함께 새로운 모두
최고 완벽한 완성 스타일링 기사 관련 사람 순간 시간 하루 이야기 소식 화보 인터뷰 공식 대한 통해 바로 다양한 vs the and for with
of in to a 에디터 셀럽 PICK 픽 브랜드 컬렉션 아이템 출시 선보인 선보이다 선보여 진행 뉴스 검색결과 검색 korea
가지의 위한 요즘 이제 올 해 그녀 그의 그들 직접 놓치지 마세요 하는법 법 여기 거기 이곳 어디 무엇 누구 이렇게 그렇게
만나 만나는 담은 담아 즐기 즐기는 위한 필요 준비 미리 아직 벌써 감성 세계 매력 느낌 모습 시작 마지막 처음 하나 모든것
다양 특별 특별한 매년 어떤 너무 가득 해도 자리 세상 고민 더욱 정도 모두의 이것만 하나쯤 꼭 첫째 둘째 셋째 넷째 다섯째 이번주 주말 메리 인기 가이드 포토 카드뉴스 운세 서울 한국 국내 글로벌 확대 공략 제품 신제품 프리미엄 출시 참가 개막 오픈 선봬 공개 선사 선정 해외 진행 기념 맞이 선택 순위 리스트 모음 정리 총정리 꿀팁 feat feature newnew 캘린더 에디터 에디터의 2024 2025 2026""".lower().split())
VERB_ENDINGS = ("면", "는", "은", "한", "운", "쁜", "른", "든", "던", "게", "고", "며", "지", "요", "다", "까", "아", "어", "해", "했", "된", "될", "있", "없")


def parse_day(value):
    """RFC822 / ISO / YYYY-MM-DD → date, or None."""
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(text).date()
    except (TypeError, ValueError, IndexError):
        return None


def shift_year(day, years):
    try:
        return day.replace(year=day.year + years)
    except ValueError:  # 29 Feb
        return day.replace(year=day.year + years, day=28)


def months_between(start, end):
    months, cursor = [], date(start.year, start.month, 1)
    while cursor <= end:
        months.append((cursor.year, cursor.month))
        cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
    return months


def plan_windows(period, today, compare_previous=False):
    """Return search windows with explicit roles.

    in_period  – the requested, already elapsed period (actual observation)
    lead_in    – the 30 days up to today when the requested period is in the future
    reference  – the same calendar window in earlier years, used only as planning reference
    previous   – the same window one year earlier, used for coverage-change comparison
    """
    if not period:
        return [], None
    start, end = parse_day(period.get("start")), parse_day(period.get("end"))
    if not start or not end or end < start:
        raise ValueError("기간 시작일과 종료일을 YYYY-MM-DD로 입력하세요")
    if (end - start).days > 92:
        raise ValueError("검색 기간은 93일 이내로 지정하세요")
    windows = []
    if start > today:
        state = "future"
        windows.append({"role": "lead_in", "start": today - timedelta(days=30), "end": today})
        for years in (1, 2):
            windows.append({"role": "reference", "start": shift_year(start, -years), "end": shift_year(end, -years),
                            "years_back": years})
    else:
        state = "partial" if end > today else "past"
        windows.append({"role": "in_period", "start": start, "end": min(end, today)})
        if compare_previous:
            windows.append({"role": "previous", "start": shift_year(start, -1), "end": shift_year(min(end, today), -1)})
    for window in windows:
        window["months"] = months_between(window["start"], window["end"])
    return windows, state


def window_for(day, windows):
    for window in windows:
        if day and window["start"] <= day <= window["end"]:
            return window
    return None


YOUTH_GENERIC = ("Z세대 유행", "MZ세대 트렌드", "2030 인기 소비")
YOUTH_TERMS = ("Z세대", "MZ세대", "2030")


def query_branches(query, areas, audience_interests="", youth=False):
    """Audience-first search branches: the topic alone plus topic×interest-area combinations."""
    query = " ".join((query or "").split())
    branches = []
    if query:
        branches.append({"query": query, "area": None, "label": query})
    for area in areas or []:
        terms = AREA_TERMS.get(area, ())
        picks = terms[:1] if query else terms[:2]
        for term in picks:
            if query and term in query:
                continue
            branches.append({"query": f"{query} {term}".strip(), "area": area, "label": f"{area} · {term}"})
    if not query and not branches:
        for term in [t.strip() for t in re.split(r"[,/·]", audience_interests or "") if len(t.strip()) > 1][:3]:
            branches.append({"query": term, "area": None, "label": "고객군 관심사 · " + term})
    if youth:
        # Younger audiences: pair generation words with each selected area's lead term, plus generic youth searches.
        youth_branches = []
        for index, area in enumerate(areas or []):
            terms = AREA_TERMS.get(area, ())
            if terms:
                youth_branches.append({"query": f"{YOUTH_TERMS[index % 3]} {terms[0]}", "area": area,
                                       "label": f"젊은 층 · {area} · {terms[0]}"})
        for generic in YOUTH_GENERIC if not youth_branches else YOUTH_GENERIC[:1]:
            youth_branches.append({"query": generic, "area": None, "label": "젊은 층 · " + generic})
        branches = youth_branches + ([b for b in branches[:1]] if query else [])
    seen, unique = set(), []
    for branch in branches:
        if branch["query"] not in seen:
            seen.add(branch["query"])
            unique.append(branch)
    return unique[:6 if youth else 5]


_KIWI = None
_KIWI_TRIED = False
# Domain vocabulary the general dictionary splits or mis-tags (tea, dessert, lifestyle, retail slang).
DOMAIN_WORDS = ("오설록", "말차", "녹차", "호지차", "보이차", "디카페인", "티룸", "티백", "잎차", "다도", "찻잔", "다구",
                "홈카페", "티타임", "블렌딩", "블렌드", "말차라떼", "두쫀쿠", "오너먼트", "어드벤트캘린더", "백꾸", "키링",
                "팝업", "굿즈", "오픈런", "한정판", "리추얼", "웰니스", "티코스", "페어링", "디저트", "제철")


def _kiwi():
    """Optional Korean morphological analyzer (kiwipiepy). Falls back to rule-based tokens."""
    global _KIWI, _KIWI_TRIED
    if not _KIWI_TRIED:
        _KIWI_TRIED = True
        try:
            from kiwipiepy import Kiwi
            _KIWI = Kiwi()
            for word in DOMAIN_WORDS:
                _KIWI.add_user_word(word, "NNP" if word in ("오설록",) else "NNG", 0)
        except Exception:  # not installed or model load failure
            _KIWI = None
    return _KIWI


def tokenizer_name():
    return "kiwi" if _kiwi() else "rule"


def _keep(word):
    return len(word) >= 2 and word not in STOPWORDS and not word.isdigit() and not word[0].isdigit()


def tokens(text):
    kiwi = _kiwi()
    if kiwi:
        out = []
        for token in kiwi.tokenize(text or ""):
            word = token.form.lower()
            if token.tag in ("NNG", "NNP", "SL", "XR") and _keep(word):
                out.append(word)
        return out
    out = []
    for raw in re.split(r"[^가-힣A-Za-z0-9]+", (text or "").lower()):
        if not raw or raw[0].isdigit():  # "2025년을", "12월" are dates, not themes
            continue
        word = raw
        for particle in PARTICLES:
            if word.endswith(particle) and len(word) - len(particle) >= 2:
                word = word[: -len(particle)]
                break
        if _keep(word) and not (re.fullmatch(r"[가-힣]+", word) and word.endswith(VERB_ENDINGS)):
            out.append(word)
    return out


def assign_stories(articles, duplicate_groups=None):
    """Collapse syndicated copies (same press release in many outlets) into one story.

    Returns {url: story_id}. Shared title vocabulary (Jaccard >= 0.4) or an embedding near-duplicate = same story.
    """
    stories, result = [], {}
    for item in sorted(articles, key=lambda r: r.get("published_day") or ""):
        words = set(tokens(item["title"]))
        match = None
        if len(words) >= 2:
            for index, known in enumerate(stories):
                if len(words & known) / len(words | known) >= 0.4:
                    match = index
                    break
        if match is None:
            stories.append(words)
            match = len(stories) - 1
        else:
            stories[match] |= words
        result[item["url"]] = match
    for group in duplicate_groups or []:
        ids = {result[u] for u in group if u in result}
        if len(ids) > 1:
            keep = min(ids)
            for url, story in result.items():
                if story in ids:
                    result[url] = keep
    return result


def publisher_group(host):
    host = (host or "").removeprefix("www.")
    return PUBLISHER_GROUPS.get(host, host)


def audience_terms(areas, audience):
    terms = [t for area in areas or [] for t in AREA_TERMS.get(area, ())]
    for key in ("interests", "purpose"):
        terms += [t.strip() for t in re.split(r"[,/·\s]", (audience or {}).get(key, "") or "") if len(t.strip()) > 1]
    return list(dict.fromkeys(terms))


SIGNAL_ORIGINS = ("publisher_archive", "official_feed", "news_index")
LEVEL_RANK = {"트렌드 후보": 0, "선행 신호 후보": 0, "시즌 반복": 1, "과거 기간 참고": 1, "업계 보도 반복": 2, "영감": 2}
EDITORIAL_ORIGINS = ("publisher_archive", "official_feed")


def _label_words(rows, exclude, limit=3):
    counts = {}
    for row in rows:
        for word in set(tokens(row["title"])):
            if word in exclude or any(word.startswith(e) for e in exclude):
                continue
            counts[word] = counts.get(word, 0) + 1
    shared = [w for w, c in sorted(counts.items(), key=lambda x: (-x[1], -len(x[0]), x[0])) if c >= 2]
    return shared[:limit]


def make_signal(kind, rows, words, story_of, roles_current, period_state, compared, label=None, extra=None):
    """One grouped observation -> signal with a level decided by fixed, explainable rules (not by the model)."""
    current = [r for r in rows if r.get("period_role") in roles_current]
    previous = [r for r in rows if r.get("period_role") == "previous"]
    reference = [r for r in rows if r.get("period_role") == "reference"]
    basis = current or reference
    stories = {story_of[r["url"]] for r in basis}
    if len(basis) < 2 or len(stories) < 2:
        return None
    pub_groups = {publisher_group(r["publisher_host"]) for r in basis}
    prev_stories = len({story_of[r["url"]] for r in previous})
    if kind == "ai_theme":
        compared = False  # year-over-year growth is measured on the full pool (emerging_terms), not on cited rows
    editorial = any(r.get("origin") in EDITORIAL_ORIGINS for r in basis)
    if current and len(pub_groups) >= 2 and len(stories) >= 4 and not editorial:
        level = "업계 보도 반복"  # news-only: industry/PR coverage, not evidence of consumer taste
    elif current and len(pub_groups) >= 2 and len(stories) >= 4:
        level = "트렌드 후보"
        if period_state == "future":
            level = "선행 신호 후보"
        elif compared and not (len(stories) >= prev_stories + 2 and len(stories) >= 1.5 * prev_stories):
            level = "시즌 반복"
    elif not current and reference:
        level = "과거 기간 참고"
    else:
        level = "영감"
    ordered = sorted(basis, key=lambda r: r.get("published_day") or "", reverse=True)
    signal = {
        "id": {"semantic": "sem-", "ai_theme": "ai-"}.get(kind, "sig-") + "-".join(sorted(words))[:60],
        "kind": kind,
        "label": label or " · ".join(words),
        "level": level,
        "article_urls": [r["url"] for r in ordered],
        "articles": len(basis),
        "stories": len(stories),
        "publishers": sorted({r["platform"] for r in basis}),
        "publisher_groups": sorted(pub_groups),
        "roles": sorted({r.get("period_role") or "latest" for r in basis}),
        "change": ({"current": len(stories), "previous": prev_stories} if compared else None),
        "sample_titles": [r["title"] for r in ordered[:3]],
        "evidence": [{"url": r["url"], "title": r["title"], "platform": r["platform"],
                      "published_day": r.get("published_day"), "origin": r.get("origin")} for r in ordered[:8]],
        "basis": {"semantic": "의미가 가까운 기사 제목 묶음(로컬 임베딩)",
                  "ai_theme": "AI가 헤드라인에서 찾은 소비 현상 · 근거 기사 번호와 수치는 서버가 검증"}.get(
            kind, "기사 제목에서 같은 명사가 반복된 묶음")
                 + ". 같은 보도자료 재게재는 한 건(story)으로 셈. SNS 반응·검색량·판매량이 아님",
    }
    if extra:
        signal.update(extra)
    return signal


def build_signals(items, exclude_terms, windows, period_state, semantic_groups=None, duplicate_groups=None):
    """Group articles by recurring title nouns (lexical) and, when available, by meaning (semantic).

    Counts are distinct *stories* (syndicated copies collapse) across independent publisher groups.
    This is repetition of editorial/news coverage among searched sources, not social popularity.
    """
    exclude = {t for term in exclude_terms for t in tokens(term)} | {t.lower() for t in exclude_terms}
    exclude |= {t.lower() for term in exclude_terms for t in term.split()}
    articles = {item["url"]: item for item in items if item.get("origin") in SIGNAL_ORIGINS}
    story_of = assign_stories(list(articles.values()), duplicate_groups)
    roles_current = {"in_period", "lead_in"} if period_state else {None}
    compared = any(w["role"] == "previous" for w in windows)
    candidates = []
    for urls in semantic_groups or []:
        rows = [articles[u] for u in urls if u in articles]
        words = _label_words(rows, exclude)
        if len(rows) >= 2 and words:
            candidates.append(("semantic", rows, words))
    index = {}
    for url, item in articles.items():
        # Titles only: excerpts add filler vocabulary that is not an editorial theme.
        for token in {t for t in tokens(item["title"]) if t not in exclude and not any(t.startswith(e) for e in exclude)}:
            index.setdefault(token, set()).add(url)
    groups = {}
    for token, urls in index.items():
        if len(urls) >= 2:
            groups.setdefault(frozenset(urls), []).append(token)
    for urls, words in groups.items():
        candidates.append(("lexical", [articles[u] for u in urls], sorted(words, key=lambda w: (-len(w), w))[:3]))
    signals = []
    for kind, rows, words in candidates:
        signal = make_signal(kind, rows, words, story_of, roles_current, period_state, compared)
        if signal:
            signals.append(signal)
    signals.sort(key=lambda s: (LEVEL_RANK[s["level"]], s["kind"] != "semantic", -len(s["publisher_groups"]),
                                -s["stories"], s["label"]))
    kept, covered = [], []
    for signal in signals:
        urls = set(signal["article_urls"])
        # Skip a signal whose evidence is (almost) the same as a stronger one already kept.
        if any(len(urls & c) >= 0.8 * len(urls) for c in covered):
            continue
        kept.append(signal)
        covered.append(urls)
    return kept[:16]


def review_priority(item, signal_urls, terms):
    """Explainable review order from evidence breadth and audience relevance only."""
    text = (item.get("title", "") + " " + (item.get("summary") or "")).lower()
    matched = [t for t in terms if t.lower() in text]
    reasons, score = [], 0
    hits = signal_urls.get(item.get("source_url") or item["url"], [])
    if hits:
        score += 3 if any(level in ("트렌드 후보", "선행 신호 후보") for level in hits) else 1
        reasons.append("반복 관측 묶음에 포함")
    if matched:
        score += min(len(matched), 3)
        reasons.append("고객군 관심어 일치: " + ", ".join(matched[:4]))
    if item.get("origin") in ("publisher_embed", "curated_reference"):
        score += 1
        reasons.append("원본 시각 레퍼런스 링크 있음")
    if item.get("match_level") == "title":
        score += 1
        reasons.append("제목에 검색 주제 포함")
    if item.get("period_role") in ("reference", "previous"):
        score -= 1
        reasons.append("요청 기간 밖 참고 자료")
    return {"score": score, "reasons": reasons or ["근거 약함 · 직접 검토 필요"], "audience_terms": matched}


def emerging_terms(items, exclude_terms, period_state, limit=14):
    """Title nouns that appear in distinct current-period stories but (almost) not in the comparison period.

    Counts are distinct stories. For a future period the comparison base is the same dates in earlier years.
    """
    exclude = {t for term in exclude_terms for t in tokens(term)} | {t.lower() for t in exclude_terms}
    rows = [i for i in items if i.get("origin") in SIGNAL_ORIGINS]
    story_of = assign_stories(rows)
    roles_current = {"in_period", "lead_in"} if period_state else {None}
    current, base, groups = {}, {}, {}
    for row in rows:
        role = row.get("period_role")
        bucket = current if role in roles_current else base if role in ("previous", "reference") else None
        if bucket is None:
            continue
        for word in set(tokens(row["title"])) - exclude:
            bucket.setdefault(word, set()).add(story_of[row["url"]])
            if bucket is current:
                groups.setdefault(word, set()).add(publisher_group(row.get("publisher_host")))
    found = []
    for word, stories in current.items():
        now, before = len(stories), len(base.get(word, ()))
        # one publisher group repeating a word is a house style, not a shared expression
        if (now >= 2 and len(groups.get(word, ())) >= 2 and (before == 0 or now >= 3 * before)
                and not any(word.startswith(e) for e in exclude)):
            found.append({"term": word, "current": now, "previous": before})
    found.sort(key=lambda x: (-x["current"], x["previous"], x["term"]))
    return found[:limit]


def theme_input(items, period_state, current_limit=75, base_limit=40):
    """Balanced headline sample for the model: mostly current period, plus a comparison-period sample.

    Ids are assigned here; the server later trusts only these ids. Truncating by priority alone would drop the
    comparison year and make every term look 'new'.
    """
    rows = [i for i in items if i.get("origin") in SIGNAL_ORIGINS and i.get("title")]
    current_roles = {"in_period", "lead_in"} if period_state else {None}
    match_rank = {"title": 0, "excerpt": 1}
    current = sorted([r for r in rows if r.get("period_role") in current_roles],
                     key=lambda r: (match_rank.get(r.get("match_level"), 2), r.get("published_day") or ""), reverse=False)
    base = [r for r in rows if r.get("period_role") in ("previous", "reference")]
    base.sort(key=lambda r: (match_rank.get(r.get("match_level"), 2), r.get("published_day") or ""))
    picked = current[:current_limit] + base[:base_limit]
    out = []
    for n, row in enumerate(picked, 1):
        role = "current" if row.get("period_role") in current_roles else row.get("period_role")
        out.append({"id": f"h{n}", "title": row["title"], "publisher": row["platform"], "role": role,
                    "day": row.get("published_day"), "publisher_host": row.get("publisher_host"),
                    "period_role": row.get("period_role"), "url": row["url"], "platform": row["platform"],
                    "origin": row["origin"], "published_day": row.get("published_day")})
    return out


def themes_to_signals(themes, headlines, windows, period_state):
    """Turn model-proposed themes into signals. The model supplies label/interpretation and headline ids;
    everything numeric (stories, publisher groups, change vs previous year, level) is recomputed here.
    """
    by_id = {h["id"]: h for h in headlines if h.get("id")}
    story_of = assign_stories(list(by_id.values()))
    roles_current = {"in_period", "lead_in"} if period_state else {None}
    compared = any(w["role"] == "previous" for w in windows)
    signals, used = [], set()
    for theme in themes if isinstance(themes, list) else []:
        if not isinstance(theme, dict):
            continue
        ids = [i for i in dict.fromkeys(theme.get("headline_ids") or []) if i in by_id]
        label = " ".join(str(theme.get("label", "")).split())[:40]
        if len(ids) < 3 or not label:
            continue
        rows = [by_id[i] for i in ids]
        signal = make_signal("ai_theme", rows, [label], story_of, roles_current, period_state, compared, label=label,
                             extra={"phenomenon": str(theme.get("phenomenon", ""))[:300],
                                    "audience_relevance": str(theme.get("audience_relevance", ""))[:200],
                                    "novelty_claimed": str(theme.get("novelty", ""))[:10],
                                    "dropped_ids": len(theme.get("headline_ids") or []) - len(ids)})
        if not signal:
            continue
        key = frozenset(signal["article_urls"])
        if any(len(key & u) >= 0.8 * len(key) for u in used):
            continue
        used.add(key)
        signals.append(signal)
    signals.sort(key=lambda s: (LEVEL_RANK[s["level"]], -len(s["publisher_groups"]), -s["stories"], s["label"]))
    return signals

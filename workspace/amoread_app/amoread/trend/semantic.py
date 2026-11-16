"""Optional semantic grouping of article titles using a local Ollama embedding model.

Titles are sent only to the local Ollama server (OLLAMA_URL), never to an external API.
If the model is unavailable the caller falls back to lexical signals.
"""
import math
import os
import re

import httpx

DEFAULT_MODEL = "bge-m3"
# Tuned 2026-11-13 on 2025 Christmas titles with query terms stripped: 0.72 merges only near-duplicates,
# 0.62 starts mixing unrelated beauty/pop-up items. 0.64 keeps phenomena such as "트리 카페 인증샷".
THRESHOLD = float(os.getenv("SEMANTIC_THRESHOLD", "0.64"))
DUPLICATE_THRESHOLD = 0.84


def embed_model():
    return os.getenv("EMBED_MODEL", DEFAULT_MODEL).strip()


def _normalize(vector):
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cluster(vectors, threshold=THRESHOLD, min_size=2):
    """Average-link greedy clustering on normalized vectors. Returns lists of indices."""
    vectors = [_normalize(v) for v in vectors]
    clusters = []  # (members, centroid)
    for index, vector in enumerate(vectors):
        best, best_score = None, threshold
        for position, (members, centroid) in enumerate(clusters):
            score = _dot(vector, _normalize(centroid))
            if score >= best_score:
                best, best_score = position, score
        if best is None:
            clusters.append(([index], list(vector)))
        else:
            members, centroid = clusters[best]
            members.append(index)
            clusters[best] = (members, [c + v for c, v in zip(centroid, vector)])
    return [members for members, _ in clusters if len(members) >= min_size]


# Consumer-taste relevance: similarity to lifestyle anchors minus similarity to finance/politics/B2B anchors.
# Calibrated 2026-11-13 on 85 labelled headlines: 0.00 kept 100% of relevant ones, 0.02 kept 95%, 0.04 kept 88%.
# Live check on a gift/design search showed finance, semiconductor and TV-drama items scoring 0.00-0.01, so 0.03.
RELEVANCE_MIN = float(os.getenv("RELEVANCE_MIN", "0.03"))
RELEVANT_ANCHORS = ["카페 디저트 신메뉴 유행 맛집 소개", "팝업스토어 전시 브랜드 체험 공간 방문 줄서기", "선물 추천 기프트 포장 홀리데이 컬렉션",
                    "인테리어 소품 향초 오브제 취향 공간 스타일링", "패션 뷰티 신제품 컬렉션 화보 캠페인",
                    "영화 공연 전시 문화 콘텐츠 소비 트렌드", "홈카페 레시피 티 음료 말차 간식"]
IRRELEVANT_ANCHORS = ["주가 코스피 환율 금리 채권 국채선물 증시 투자", "항공권 여행 패키지 관광 숙박 상품 판매 돌파",
                      "대통령 국회 정당 선거 정치 논란 사퇴", "건설사 아파트 분양 시공 계약 수주 사업 확대",
                      "프로야구 축구 감독 선수 경기 리그", "자동차 전기차 배터리 반도체 기업 실적 투자",
                      "가전 냉장고 정수기 신제품 출시 기업 보도자료", "인사 임명 기부 협약 MOU 사회공헌 행사 개최",
                      "여행 숙박 리조트 호텔 객실 패키지 예약", "스타트업 투자 유치 기업 지원 사업 선정 공공기관 캠페인"]


async def relevance_scores(titles, timeout=12):
    """Per-title consumer-taste relevance margin, or None when the local embedding model is unavailable."""
    model = embed_model()
    if not model or not titles:
        return None
    base = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(base + "/api/embed", json={
                "model": model, "input": RELEVANT_ANCHORS + IRRELEVANT_ANCHORS + list(titles)})
            response.raise_for_status()
            vectors = [_normalize(v) for v in response.json()["embeddings"]]
    except (httpx.HTTPError, KeyError, ValueError):
        return None
    n_pos, n_neg = len(RELEVANT_ANCHORS), len(IRRELEVANT_ANCHORS)
    if len(vectors) != n_pos + n_neg + len(titles):
        return None
    pos, neg, rows = vectors[:n_pos], vectors[n_pos:n_pos + n_neg], vectors[n_pos + n_neg:]
    return [max(_dot(v, p) for p in pos) - max(_dot(v, n) for n in neg) for v in rows]


async def semantic_groups(articles, strip_terms=(), timeout=12):
    """Return (groups_of_urls, status). status explains availability without failing the search."""
    model = embed_model()
    if not model:
        return [], {"state": "disabled", "reason": "EMBED_MODEL 미설정"}
    rows = [a for a in articles if a.get("title")][:200]
    if len(rows) < 4:
        return [], {"state": "skipped", "reason": "기사 수 부족"}
    base = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # The shared search topic dominates similarity; embed what each headline adds beyond it.
            pattern = re.compile("|".join(re.escape(t) for t in sorted(set(strip_terms), key=len, reverse=True) if t)) if strip_terms else None
            texts = [" ".join((pattern.sub(" ", r["title"]) if pattern else r["title"]).split()) or r["title"] for r in rows]
            response = await client.post(base + "/api/embed", json={"model": model, "input": texts})
            response.raise_for_status()
            vectors = response.json()["embeddings"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        return [], {"state": "unavailable", "reason": f"로컬 임베딩 모델 호출 실패({type(exc).__name__}) · 어휘 묶음만 사용"}
    if len(vectors) != len(rows):
        return [], {"state": "unavailable", "reason": "임베딩 결과 수 불일치"}
    groups = [[rows[i]["url"] for i in members] for members in cluster(vectors)]
    # Near-identical headlines (rewritten press releases) are one story, not repeated observation.
    duplicates = [[rows[i]["url"] for i in members] for members in cluster(vectors, DUPLICATE_THRESHOLD)]
    return groups, {"state": "ok", "reason": f"{model} · 기사 제목 {len(rows)}건 · 묶음 {len(groups)}개",
                    "model": model, "duplicates": duplicates}

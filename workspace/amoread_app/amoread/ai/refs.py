# -*- coding: utf-8 -*-
"""
구좌별 레퍼런스 검색: 역할 필터 → 키워드(BM25, 글자 2개씩) 점수 → (있으면) 의미 벡터 점수 섞기 → 거의 같은 글 묶기 → 우리 브랜드 먼저.

- 레퍼런스 색인은 planner/data/ai_refs/ 에 둔다 (git에 올리지 않는 폴더). 없으면 검색은 빈 결과와 이유를 돌려주고 서버는 그대로 동작한다.
  만드는 법: python -m amoread.ai.build_index --help
- 기본은 파이썬 기본 기능만 쓴다 (BM25). 환경변수 AMOREAD_AI_DENSE=1이고 sentence-transformers가 설치돼 있고 vectors.npy가 있으면
  의미 벡터를 섞는다 (측정: 역할 필터 + 키워드·벡터 혼합이 키워드 단독보다 정확했음. 모델은 처음 한 번 내려받아야 함).
- 원천 파일·기획안에는 쓰지 않는다. 읽기만 한다.
"""
import json
import math
import os
import re
from collections import Counter
from pathlib import Path

from . import feedback, rules

AI_DIR = rules.AI_DIR
USER_DIR = Path(os.getenv("AMOREAD_AI_USER_DIR") or (AI_DIR.parent / "ai_refs_user"))   # 담당자가 직접 가져온 레퍼런스의 색인 (intake.py가 씀, 수집 색인과 따로 둬서 색인을 다시 만들어도 남는다)
PREFER_BRANDS = tuple(x for x in (os.getenv("AMOREAD_AI_PREFER_BRANDS") or "osulloc").split(",") if x)   # 결과에서 먼저 보여 줄 브랜드
BRAND_MARGIN = float(os.getenv("AMOREAD_AI_BRAND_MARGIN") or 3.0)   # 우리 브랜드는 1등과 점수 차가 이 값(표준편차 단위) 안일 때만 앞세운다. 크게 뒤처진 사례(엉뚱한 글)까지 올리지 않으려고
AFFINITY = float(os.getenv("AMOREAD_AI_AFFINITY") or 0)   # 우리 브랜드 글과 말투·소재가 가까운 사례를 얼마나 앞세울지 (0 = 끔)
DENSE_MODEL = os.getenv("AMOREAD_AI_DENSE_MODEL") or "intfloat/multilingual-e5-base"
BRAND_FROM = {"osulloc": "자사몰", "kurly": "외부", "29cm": "외부", "user": "직접 추가"}   # 화면의 '출처' 표기(자사몰·외부)

# 해당 역할의 사례가 모자랄 때(k의 3배 미만) 같은 쓰임으로 볼 수 있는 역할을 덧붙여 찾는다 (예: 카드 제휴 구좌는 사례가 1개뿐이라 일반 혜택 안내에서 '카드' 글을 찾는다)
ROLE_FALLBACK = {"partner_benefit": ["benefit_overview", "coupon_offer"], "lookbook": ["visual_gallery"], "app_promo": ["coupon_offer"]}

_state = {"loaded": False, "rows": [], "pages": {}, "tf": [], "df": Counter(), "avg": 1.0, "vec": None, "model": None, "mtime": 0}


def _grams(t: str) -> list[str]:
    t = re.sub(r"\s+", "", (t or "").lower())
    return [t[i:i + 2] for i in range(len(t) - 1)]


def _mt(f: Path):
    try:
        return f.stat().st_mtime
    except OSError:
        return 0


HIDDEN = USER_DIR / "hidden.json"   # 담당자가 삭제한 수집본 페이지 id (색인을 다시 만들어도 다시 나오지 않게 색인 폴더 밖에 둔다)


def hidden() -> set:
    try:
        return set(json.loads(HIDDEN.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return set()


def set_hidden(page_id: str, on: bool) -> int:
    cur = hidden()
    cur.add(page_id) if on else cur.discard(page_id)
    USER_DIR.mkdir(parents=True, exist_ok=True)
    HIDDEN.write_text(json.dumps(sorted(cur), ensure_ascii=False), encoding="utf-8")
    return len(cur)


def _load():
    f, uf = AI_DIR / "sections.jsonl", USER_DIR / "sections.jsonl"
    if not f.exists() and not uf.exists():
        _state.update(loaded=False, rows=[])
        return False
    mt = (_mt(f), _mt(uf), _mt(USER_DIR / "pages.json"), _mt(HIDDEN))
    if _state["loaded"] and _state["mtime"] == mt:   # 파일이 바뀌면 다시 읽는다 (서버를 끄지 않아도 됨)
        return True

    def read(p):
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()] if p.exists() else []

    hid = hidden()
    main_all = read(f)
    keep_main = [i for i, r in enumerate(main_all) if r["page_id"] not in hid]
    main_rows = [main_all[i] for i in keep_main]
    rows = main_rows + [r for r in read(uf) if r["page_id"] not in hid]   # 담당자가 직접 가져온 레퍼런스(사용자 색인)를 뒤에 붙인다
    docs = [_grams(r["text"]) for r in rows]
    df = Counter(g for d in docs for g in set(d))
    pages = {}
    for pf in (AI_DIR / "pages.json", USER_DIR / "pages.json"):
        if pf.exists():
            pages.update(json.loads(pf.read_text(encoding="utf-8")))
    pages = {k: v for k, v in pages.items() if k not in hid}
    vec = None
    vf = AI_DIR / "vectors.npy"
    if os.getenv("AMOREAD_AI_DENSE") == "1" and vf.exists():
        try:
            import numpy as np
            vec = np.load(vf)
            if len(vec) != len(main_all):   # 벡터는 수집 색인 행만 있다 (사용자 행은 아래에서 평균으로 채움)
                vec = None
            elif len(main_rows) != len(main_all):
                vec = vec[keep_main]   # 삭제한 페이지의 벡터 행도 뺀다
        except Exception:   # numpy가 없거나 파일이 깨졌으면 키워드만 쓴다
            vec = None
    _state.update(loaded=True, rows=rows, pages=pages, tf=[Counter(d) for d in docs], df=df,
                  avg=(sum(len(d) for d in docs) / max(1, len(docs))) or 1.0, vec=vec, mtime=mt)
    return True


# ---- 기준 페이지를 고를 때의 보정 (compose.build): 우리 브랜드와 말투·소재가 가까운가 / 브리프와 계절이 맞는가 ----
SEASON_GROUP = {"봄": "봄", "여름": "여름", "가을": "가을", "겨울": "겨울", "연말": "겨울", "블프": "겨울"}   # 페이지 라벨의 시즌 말 → 계절 묶음 (모르는 말은 판단하지 않는다)


def brief_season(doc: dict) -> str:
    """브리프의 계절 묶음 ('' = 모름). 고른 명분·제목·키워드의 계절 말에서 찾는다."""
    from . import labeling
    b, v2 = doc.get("brief") or {}, doc.get("v2") or {}
    ref = b.get("season_ref")
    text = " ".join([str(doc.get("title") or ""), str(b.get("myeongbun") or ""), (ref.get("name") if isinstance(ref, dict) else str(ref or "")), " ".join(v2.get("keywords") or []), str(v2.get("seed") or "")])
    hit = rules.season_hit(doc)
    if hit:
        text += " " + str(hit.get("name") or "") + " " + str(hit.get("keyword") or "")
    for label, rx in labeling.SEASON_WORDS + [("블프", r"블프|블랙\s?프라이데이|블랙위크")]:
        if re.search(rx, text):
            return SEASON_GROUP[label]
    return ""


_pl = {"mt": None, "d": {}}


def page_season(page_id: str) -> str:
    """수집한 페이지의 계절 묶음 ('' = 모름)."""
    fs = [d / "page_labels.json" for d in (AI_DIR, USER_DIR)]
    mt = tuple(_mt(f) for f in fs)
    if _pl["mt"] != mt:
        d = {}
        for f in fs:
            try:
                d.update(json.loads(f.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass
        _pl.update(mt=mt, d=d)
    return SEASON_GROUP.get((_pl["d"].get(page_id) or {}).get("season", ""), "")


def page_affinity() -> dict:
    """페이지별 '우리 브랜드 글과 가까운 정도' (구좌 친화도의 평균, 페이지끼리 표준화). 패션·화장품 위주 외부 사례가 기준 페이지가 되는 것을 누른다."""
    _load()
    if _state.get("paff_mt") != _state["mtime"]:
        by = _page_index()
        aff = _affinity()
        raw = {pid: sum(aff[i] for i in ix) / len(ix) for pid, ix in by.items() if ix}
        v = list(raw.values())
        m = sum(v) / len(v) if v else 0
        sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 if v else 1.0
        _state.update(paff={k: (x - m) / (sd or 1.0) for k, x in raw.items()}, paff_mt=_state["mtime"])
    return _state["paff"]


def _page_index():
    """페이지 단위 검색용 색인 (페이지마다 구좌 글을 이어 붙인 것). 구좌 색인이 바뀌면 다시 만든다."""
    if _state.get("pg_mt") != _state["mtime"]:
        by = {}
        for i, r in enumerate(_state["rows"]):
            by.setdefault(r["page_id"], []).append(i)
        tfs = {pid: Counter(_grams(_state["pages"].get(pid, {}).get("name", "") + " " + " ".join(_state["rows"][i]["text"][:300] for i in ix))) for pid, ix in by.items()}
        df = Counter(g for c in tfs.values() for g in c)
        _state.update(pg_mt=_state["mtime"], pg_rows=by, pg_tf=tfs, pg_df=df, pg_avg=(sum(sum(c.values()) for c in tfs.values()) / max(1, len(tfs))) or 1.0)
    return _state["pg_rows"]


def search_pages(query: str, k: int = 8, k1=1.5, b=0.75) -> list[dict]:
    """브리프에 가까운 레퍼런스 페이지 k개: [{page_id, score(표준편차 단위), roles}]. 색인이 없으면 []."""
    if not _load() or not query.strip():
        return []
    by = _page_index()
    n, qg, sc = len(by), set(_grams(query)), {}
    for pid, c in _state["pg_tf"].items():
        ln = sum(c.values()) or 1
        sc[pid] = sum(math.log(1 + (n - _state["pg_df"][g] + .5) / (_state["pg_df"][g] + .5)) * c[g] * (k1 + 1) / (c[g] + k1 * (1 - b + b * ln / _state["pg_avg"])) for g in qg if c.get(g))
    v = list(sc.values())
    m = sum(v) / len(v)
    sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 or 1.0
    top = sorted(sc, key=lambda p: -sc[p])[:k]
    return [{"page_id": p, "score": (sc[p] - m) / sd, "roles": {_state["rows"][i]["role"] for i in by[p]}} for p in top]


def search_in_page(query: str, roles: list[str], page_id: str, k: int = 1, section: str = "") -> list[dict]:
    """한 페이지 안에서만 역할이 roles인 구좌를 찾는다 (페이지 단위 조합이 한 사례 안에서 이어지게)."""
    if not _load() or not query.strip():
        return []
    rows = _state["rows"]
    idx = [i for i in _page_index().get(page_id, []) if rows[i]["role"] in roles and len(rows[i]["text"]) >= 20]
    if not idx:
        return []
    bm = _bm25(query)
    s = {i: bm[i] + feedback.adjust(rows[i]["id"], section) for i in idx}
    return [dict(rows[i], score=round(s[i], 3)) for i in sorted(idx, key=lambda i: -s[i])[:k]]


def status() -> dict:
    ok = _load()
    brands = Counter(r["brand"] for r in _state["rows"]) if ok else {}
    return {"ready": ok, "sections": len(_state["rows"]), "pages": len(_state["pages"]), "brands": dict(brands),
            "mode": "keyword+vector" if _state["vec"] is not None else "keyword", "prefer": list(PREFER_BRANDS), "index_dir": "planner/data/ai_refs"}


def _bm25(q: str, k1=1.5, b=0.75) -> list[float]:
    n, qg = len(_state["rows"]), set(_grams(q))
    s = [0.0] * n
    for i, c in enumerate(_state["tf"]):
        ln = sum(c.values()) or 1
        for g in qg:
            f = c.get(g)
            if f:
                d = _state["df"][g]
                s[i] += math.log(1 + (n - d + .5) / (d + .5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * ln / _state["avg"]))
    return s


def _affinity() -> list[float]:
    """각 섹션이 우리 브랜드(PREFER_BRANDS) 글의 말뭉치와 얼마나 비슷한지 (글자 2개씩 TF-IDF 코사인). 패션 위주 외부 사례가 앞서는 것을 누른다. 목록은 따로 관리하지 않는다."""
    if "aff" not in _state or _state.get("aff_mt") != _state["mtime"]:
        n, idf = len(_state["rows"]), {g: math.log(1 + len(_state["rows"]) / d) for g, d in _state["df"].items()}
        prof = Counter()
        for r, c in zip(_state["rows"], _state["tf"]):
            if r["brand"] in PREFER_BRANDS:
                for g, f in c.items():
                    prof[g] += f * idf[g]
        pn = math.sqrt(sum(v * v for v in prof.values())) or 1.0
        aff = []
        for c in _state["tf"]:
            v = {g: f * idf[g] for g, f in c.items()}
            vn = math.sqrt(sum(x * x for x in v.values())) or 1.0
            aff.append(sum(x * prof.get(g, 0) for g, x in v.items()) / (vn * pn))
        _state.update(aff=aff, aff_mt=_state["mtime"])
    return _state["aff"]


def _z(xs: list[float], idx: list[int]) -> list[float]:
    v = [xs[i] for i in idx]
    m = sum(v) / len(v)
    sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 or 1.0
    return [(xs[i] - m) / sd for i in range(len(xs))]


def _dense(q: str):
    try:
        if _state["model"] is None:
            from sentence_transformers import SentenceTransformer
            _state["model"] = SentenceTransformer(DENSE_MODEL)
        v = _state["model"].encode(["query: " + q], normalize_embeddings=True)[0]
        d = (_state["vec"] @ v).tolist()
        extra = len(_state["rows"]) - len(d)   # 사용자 색인 행: 벡터가 없으므로 평균 점수를 줘서 키워드 점수로만 가린다
        return d + [sum(d) / len(d)] * extra if d else d
    except Exception:   # 모델을 못 받는 PC(사내망)에서도 키워드 검색은 동작해야 한다
        _state["vec"] = None
        return None


def _near_dup(a: str, b: str, th=0.8) -> bool:
    ga, gb = set(_grams(a)), set(_grams(b))
    return bool(ga and gb) and len(ga & gb) / len(ga | gb) >= th


ROW_UNSHOWN = 0.5   # 수집한 화면이 그 사이 바뀌어(content_changed) 원본 구좌를 잘라 보여 줄 수 없는 페이지의 구좌에서 빼는 점수: 비슷한 후보끼리면 눈으로 확인되는 사례를 먼저 (제외하지는 않음)
ROW_SEASON_MISS = 1.0   # 브리프와 계절이 다른 페이지의 구좌에서 빼는 점수 (표준편차 단위). 계절을 모르는 쪽(둘 중 하나가 '')은 건드리지 않는다


def search(query: str, roles: list[str], k: int = 5, hybrid: float = 0.3, season: str = "", section: str = "") -> list[dict]:
    """역할이 roles 중 하나인 섹션에서 query와 가장 가까운 k개. 색인이 없으면 []. season = 브리프의 계절 묶음(brief_season)."""
    if not _load() or not query.strip():
        return []
    rows = _state["rows"]
    idx = [i for i, r in enumerate(rows) if r["role"] in roles and len(r["text"]) >= 20]   # '룩북 더보기' 같은 이름뿐인 섹션은 뺀다
    if len(idx) < 3 * k:   # 사례가 모자란 역할은 가까운 역할로 보충
        more = [x for r in roles for x in ROLE_FALLBACK.get(r, []) if x not in roles]
        idx += [i for i, r in enumerate(rows) if r["role"] in more and len(r["text"]) >= 20]
    if not idx:
        return []
    idxset = set(idx)
    s = _z(_bm25(query), idx)
    if _state["vec"] is not None:
        d = _dense(query)
        if d is not None:
            dz = _z(d, idx)
            s = [(1 - hybrid) * dz[i] + hybrid * s[i] for i in range(len(rows))]
    if AFFINITY:
        az = _z(_affinity(), idx)
        s = [s[i] + AFFINITY * az[i] for i in range(len(rows))]
    if season:   # 다른 계절 페이지의 구좌는 조금 뒤로 (추석 선물에 크리스마스 사례가 앞서지 않게)
        s = [s[i] - (ROW_SEASON_MISS if i in idxset and page_season(rows[i]["page_id"]) not in ("", season) else 0) for i in range(len(rows))]
    own = _own_items()
    s = [s[i] - (ROW_UNSHOWN if i in idxset and (own.get(rows[i]["page_id"]) or {}).get("content_changed") else 0) for i in range(len(rows))]
    s = [s[i] + feedback.adjust(rows[i]["id"], section) if i in idxset else s[i] for i in range(len(rows))]   # 담당자가 많이 고른/버린 사례는 조금 앞/뒤로
    order = sorted(idx, key=lambda i: -s[i])
    picked = []
    for i in order:   # 거의 같은 글(29cm 쇼케이스처럼 틀이 같은 것)은 하나만
        if not any(_near_dup(rows[i]["text"], rows[j]["text"]) for j in picked):
            picked.append(i)
        if len(picked) >= max(k * 3, 10):
            break
    if picked:   # 우리 브랜드 먼저 (점수 순서는 유지). 단, 1등에 크게 못 미치는 것은 앞세우지 않는다
        top = s[picked[0]]
        picked.sort(key=lambda i: not (rows[i]["brand"] in PREFER_BRANDS and s[i] >= top - BRAND_MARGIN))
    return [dict(rows[i], score=round(s[i], 3)) for i in picked[:k]]


# ----------------------------------------------------------------------
# 화면 레이아웃·구좌 이름 → 찾을 역할
# ----------------------------------------------------------------------
def roles_for(layout_id: str, name: str = "", purpose: str = "") -> list[str]:
    n = name or ""
    if layout_id == "hero":
        return ["hero"]
    if layout_id in ("grid2", "grid3", "feat"):
        return ["product_list"]
    # 구좌 편집 화면에만 있는 구좌 종류 (구성 화면의 7가지 밖): 모두 text-cta 쪽 글 구좌로 몰리면 유의사항·이벤트 구좌에 스토리 사례가 나온다
    if layout_id == "notice":
        return ["terms_notice"]
    if layout_id in ("ev-quiz", "ev-ugc", "ev-stamp", "ev-draw"):
        return ["participation_event"]
    if layout_id == "ev-share":
        return ["share", "participation_event"]
    if layout_id == "ev-coupon":
        return ["coupon_offer", "participation_event"]
    if layout_id == "countdown":
        return ["sale_offer", "hero"]
    if layout_id == "story":
        return ["brand_story", "editorial_story"]
    if layout_id in ("service", "timeline", "detail"):
        return ["editorial_story", "benefit_overview"]
    if layout_id == "split":
        return ["brand_story", "editorial_story", "product_list"] if re.search(r"스토리|이야기|소개", n) else ["product_list", "brand_story"]
    if layout_id == "deal-banner":
        return ["sale_offer"]
    if layout_id == "benefit":
        if re.search(r"쿠폰", n):
            return ["coupon_offer", "benefit_overview"]
        if re.search(r"이벤트|출석|참여", n):
            return ["participation_event", "coupon_offer"]
        return ["benefit_overview", "coupon_offer", "partner_benefit", "sale_offer"]
    return ["editorial_story", "brand_story", "brand_intro"]   # text-cta


_own = {"mt": None, "by_id": {}}


def _own_items() -> dict:
    """직접 가져온 레퍼런스(refs.json)를 id로 찾는 표. 파일이 바뀔 때만 다시 읽는다 (추천 한 번에 카드 수만큼 부르므로 매번 읽지 않는다)."""
    from .. import references
    mt = _mt(references.FILE)
    if _own["mt"] != mt:
        _own.update(mt=mt, by_id={x.get("id"): x for x in references.load().get("items", [])})
    return _own["by_id"]


def capture_info(page_id: str) -> dict:
    """화면 수집본이 있는 페이지면 구좌 띠 배치(layout)를 붙인다 → 화면이 원본 구좌를 잘라 보여 주고 전체 페이지에서 위치를 강조한다."""
    try:
        it = _own_items().get(page_id)
        lay = (it or {}).get("layout")
        if lay and lay.get("bands") and (it or {}).get("rendered"):
            return {"layout": {"ph": lay["ph"], "vw": lay.get("vw", 390), "bands": [{k: b.get(k) for k in ("y", "h", "st", "role")} | {"txt": (b.get("txt") or "")[:40]} for b in lay["bands"]]}, "cap": True}
    except Exception:
        pass
    return {}


def _wire(r: dict):
    """추출해 둔 와이어프레임(planner/data/wireframes)이 있는 페이지면 가장 비슷한 구좌의 요약을 붙인다. 구조 전체는 /api/am/ai/wire로 따로 받는다."""
    try:
        from . import wireframes
        return wireframes.match(r)
    except Exception:
        return None


def as_ref(r: dict, why: str = "") -> dict:
    """색인 행 → 화면 레퍼런스 모양(references.js의 REFS 항목 + 출처)."""
    role = r["role"]
    ci = capture_info(r["page_id"])
    layout = rules.layout_for(role, r["text"]) if role in rules.ROLE_CAT else None   # 레이아웃으로 옮길 수 없는 역할은 '참고 전용'
    return {"id": r["id"], "title": r["title"], "campaign": r["campaign"], "cat": rules.ROLE_CAT.get(role, "스토리"),
            "applicable": layout is not None, "layout": layout, "reason": why or f"'{rules.ROLE_NAME.get(role, role)}' 구좌 사례", "summary": r["text"][:80] + "…",
            "role": role, "brand": r["brand"], "from": BRAND_FROM.get(r["brand"], "외부"), "url": r.get("url", ""), "page": r["page_id"], "images": r.get("images") or [], "cap": bool(ci), "pglayout": ci.get("layout"), "wire": _wire(r), "sx": {"t": (r.get("text") or "")[:120], "n": len(r.get("text") or "")}}   # images = 원본 이미지 주소(화면이 아직 쓰지 않음)


def query_for(doc: dict, name: str, purpose: str = "") -> str:
    """구좌 이름·목표에 브리프의 명분·콘셉트·키워드를 붙여 검색어로 만든다."""
    b, v2 = doc.get("brief") or {}, doc.get("v2") or {}
    parts = [name, purpose, b.get("myeongbun"), b.get("concept"), b.get("key_copy"), " ".join(v2.get("keywords") or []), b.get("audience")]
    return " ".join(str(x) for x in parts if x)


def why_text(query: str, row: dict, role: str) -> str:
    toks = [t for t in re.findall(r"[가-힣A-Za-z0-9%]{2,}", query) if t in row["text"] and t != rules.ROLE_NAME.get(role)][:3]
    base = f"'{rules.ROLE_NAME.get(role, role)}' 역할 일치"
    return base + (f" · 브리프 단어 {', '.join(toks)} 포함" if toks else " · 글 내용이 가까움") + f" · 출처 {BRAND_FROM.get(row['brand'], '외부')}"


def recommend(section: dict, doc: dict, n: int = 3) -> dict:
    """구좌 하나에 맞는 레퍼런스 n개. 결과: { mode, basis, items } (recommend.js recommendRefs와 같은 모양)."""
    lay, name, purpose = section.get("layoutId", ""), section.get("name", ""), section.get("purpose", "")
    st = status()
    if not st["ready"]:
        return {"mode": "demo", "basis": ["레퍼런스 색인이 없어요 (planner/data/ai_refs)"], "items": []}
    roles = roles_for(lay, name, purpose)
    q = query_for(doc, name, purpose)
    items = []
    for r in search(q, roles, k=n, season=brief_season(doc), section=lay):
        items.append({**as_ref(r, why_text(q, r, r["role"])), "why": why_text(q, r, r["role"])})
    return {"mode": "ai", "basis": [f"역할 {', '.join(rules.ROLE_NAME.get(x, x) for x in roles[:2])} 필터 · " + ("키워드+의미 벡터" if st["mode"] != "keyword" else "키워드(BM25)") + " 검색",
                                   "레퍼런스는 수집한 외부 사례(원본 이미지 미연결)"], "items": items}

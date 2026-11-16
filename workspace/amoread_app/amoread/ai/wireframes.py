# -*- coding: utf-8 -*-
"""
레퍼런스 와이어프레임(wireframes_v*.html) → wireframes.json

원본은 사이트마다 390px 모바일 화면을 '이미지 박스·글·패널·가로 슬라이드'로 그려 놓은 HTML이다.
요소마다 소속 구좌(data-sec)·구성요소 종류(data-k)·상품 카드 묶음(data-card)·글자 크기(data-fs)가 붙어 있어,
HTML을 그대로 읽어 구조 데이터로 바꾸면 구좌 편집에서 '이 레퍼런스의 레이아웃 가져오기'에 쓸 수 있다.

  python -m amoread.ai.wireframes [원본.html] [--out wireframes.json]

결과 (사이트 하나):
  {id, title, url, kind, h, refs[색인 페이지 id],
   sections:[{i, role, label, y, h, kinds{종류:개수}, cards, cols, rows, carousel, elements[…]}],
   carousels:[{i, sec, x, y, w, h, inner_w}]}
  elements: {t:img|tx|pn, k, x, y, w, h, card?, label?(이미지 설명), text?, fs?, fw?, al?, one?(한 줄), bg?, c?(글자색), car?(슬라이드 번호), off?(화면 밖)}
  좌표는 본문 폭 300 기준(왼쪽 여백 62를 뺀 값)이고 단위는 px.
"""
import argparse
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "planner" / "data"
DEFAULT_SRC = DATA / "wireframes" / "wireframes_v7_components.html"
DEFAULT_OUT = DATA / "wireframes" / "wireframes.json"
GUTTER = 62          # 원본에서 구좌 이름표가 들어가는 왼쪽 여백
BODY_W = 300         # 본문 폭
ELEMENT_CLASSES = {"img", "tx", "pn"}


def _style(s: str) -> dict:
    return {k.strip(): v.strip() for k, _, v in (p.partition(":") for p in (s or "").split(";") if ":" in p)}


def _px(v, default=0.0):
    try:
        return float(str(v).replace("px", ""))
    except (TypeError, ValueError):
        return default


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sites, self.site = [], None
        self.stack = []          # 열린 div의 종류
        self.cap = None          # 글을 모으는 대상: h2 | meta | tag | lbl | imgspan
        self.el = None           # 읽는 중인 요소
        self.gut = None
        self.car = None
        self.in_a = False
        self.href = ""

    # ---- 시작 태그
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        st = _style(a.get("style"))
        if tag == "section" and "site" in cls:
            self.site = {"id": a.get("id", ""), "title": "", "meta": "", "url": "", "frame_h": 0, "gut": [], "els": [], "cars": []}
            self.sites.append(self.site)
            return
        if not self.site:
            return
        if tag == "h2":
            self.cap = "h2"
        elif tag == "a" and self.cap == "meta":
            self.in_a, self.href = True, a.get("href", "")
            if not self.site["url"]:
                self.site["url"] = self.href
        elif tag == "span":
            if self.gut is not None and "tag" in cls:
                self.cap = "tag"
            elif self.gut is not None and "lbl" in cls:
                self.cap = "lbl"
            elif self.el is not None and self.el["t"] == "img":
                self.cap = "imgspan"
        elif tag == "div":
            kind = "other"
            if "meta" in cls:
                kind, self.cap = "meta", "meta"
            elif "frame" in cls:
                kind, self.site["frame_h"] = "frame", _px(st.get("height"))
            elif "gut" in cls:
                kind, self.gut = "gut", {"y": _px(st.get("top")), "h": _px(st.get("height")), "role": "", "label": ""}
            elif "car" in cls:
                kind = "car"
                self.car = {"i": len(self.site["cars"]), "x": _px(st.get("left")) - GUTTER, "y": _px(st.get("top")), "w": _px(st.get("width")), "h": _px(st.get("height")), "inner_w": 0, "sec": None}
                self.site["cars"].append(self.car)
            elif "cin" in cls:
                kind = "cin"
                if self.car:
                    self.car["inner_w"] = _px(st.get("width"))
            elif ELEMENT_CLASSES & set(cls):
                kind = "el"
                t = next(c for c in cls if c in ELEMENT_CLASSES)
                left, top = _px(st.get("left")), _px(st.get("top"))
                if self.car:   # 슬라이드 안 요소는 슬라이드 안쪽 좌표 → 화면 좌표로
                    x, y = self.car["x"] + left, self.car["y"] + top
                else:
                    x, y = left - GUTTER, top
                k = a.get("data-k") or ""
                self.el = {"t": t, "k": k, "x": round(x, 1), "y": round(y, 1), "w": round(_px(st.get("width")), 1), "h": round(_px(st.get("height")), 1),
                           "sec": int(a.get("data-sec", -1)), "text": ""}
                if a.get("data-card"):
                    self.el["card"] = a["data-card"]
                if t == "tx":
                    fs = a.get("data-fs")
                    if fs:
                        self.el["fs"] = round(float(fs), 1)
                    if st.get("font-weight"):
                        self.el["fw"] = int(st["font-weight"]) if st["font-weight"].isdigit() else 400
                    if a.get("data-a"):
                        self.el["al"] = a["data-a"]
                    if a.get("data-h"):
                        self.el["h"] = float(a["data-h"])   # 한 줄 글은 style에 height가 없어 줄 높이를 쓴다
                    if a.get("data-s") == "1":
                        self.el["one"] = 1
                    if st.get("color"):
                        self.el["c"] = st["color"]
                else:
                    bg = st.get("background") or st.get("background-color")
                    if bg and t == "pn":
                        self.el["bg"] = bg
                if self.car:
                    self.el["car"] = self.car["i"]
                    if not (0 <= x < BODY_W):   # 옆으로 넘기면 보이는 부분
                        self.el["off"] = 1
            self.stack.append(kind)

    def handle_data(self, data):
        if not self.site:
            return
        if self.cap == "h2":
            self.site["title"] += data
        elif self.cap == "meta" and not self.in_a:
            self.site["meta"] += data
        elif self.cap == "tag" and self.gut is not None:
            self.gut["role"] += data.strip()
        elif self.cap == "lbl" and self.gut is not None:
            self.gut["label"] += data.strip()
        elif self.el is not None and self.cap in (None, "imgspan"):
            self.el["text"] += data

    def handle_endtag(self, tag):
        if tag == "h2" and self.cap == "h2":
            self.cap = None
        elif tag == "a":
            self.in_a = False
        elif tag == "span" and self.cap in ("tag", "lbl", "imgspan"):
            self.cap = None
        elif tag == "div" and self.stack:
            kind = self.stack.pop()
            if kind == "meta":
                self.cap = None
            elif kind == "gut" and self.gut is not None:
                self.site["gut"].append(self.gut)
                self.gut = None
            elif kind == "car":
                self.car = None
            elif kind == "el" and self.el is not None:
                self.site["els"].append(self.el)
                self.el = None


def _norm_url(u: str):
    """주소 비교용: (호스트(m./www. 뺌), 경로, 쿼리 목록)"""
    p = urlsplit((u or "").split("#")[0])
    host = re.sub(r"^(www|m)\.", "", p.netloc.lower())
    return host, p.path.rstrip("/"), sorted(q for q in parse_qsl(p.query) if not q[0].startswith("utm_"))


def _match_refs(url: str, pages: dict) -> list[str]:
    h, path, q = _norm_url(url)
    out = []
    for pid, pg in pages.items():
        h2, p2, q2 = _norm_url(pg.get("url", ""))
        if h == h2 and path == p2 and (q == q2 or not q2 or not q):
            out.append(pid)
    return out


def _section_summary(els: list[dict], cars: list[dict], i: int) -> dict:
    kinds = Counter(e["k"] for e in els if e["k"])
    cards = {e["card"] for e in els if e.get("card")}
    # 상품·카드 이미지: 아이콘·통이미지는 빼고 (카드 묶음이 없는 구좌도 크기로 찾는다)
    prod = [e for e in els if e["t"] == "img" and e["k"] == "image" and 50 <= e["w"] <= BODY_W * 0.7 and e["h"] >= 50]
    vis = [e for e in prod if e["x"] >= -2 and e["x"] + e["w"] <= BODY_W + 4 and not e.get("off")]   # 화면에 온전히 보이는 것
    per_row = Counter(round(e["y"] / 20) for e in vis)
    return {"kinds": dict(kinds), "cards": len(cards) or len(prod), "cols": max(per_row.values()) if per_row else 0, "rows": len(per_row),
            "carousel": any(c["sec"] == i for c in cars),
            "fullbleed": any(e["t"] == "img" and e["w"] >= BODY_W - 6 and e["h"] >= 60 for e in els)}


def parse(src: Path = DEFAULT_SRC) -> dict:
    p = _Parser()
    p.feed(Path(src).read_text(encoding="utf-8"))
    pages = {}
    for f in (DATA / "ai_refs" / "pages.json", DATA / "ai_refs_user" / "pages.json"):
        if f.exists():
            pages.update(json.loads(f.read_text(encoding="utf-8")))
    sites = []
    for s in p.sites:
        secs = [{"i": i, "role": g["role"], "label": g["label"], "y": g["y"], "h": g["h"], "els": []} for i, g in enumerate(s["gut"])]
        stray = 0
        for e in s["els"]:
            sec = e.pop("sec")
            if not e["text"]:
                e.pop("text")
            else:
                e["text"] = re.sub(r"\s+", " ", e["text"]).strip()
                if e["t"] == "img":       # 이미지 안의 글자는 '이미지 설명'이다
                    e["label"] = e.pop("text")
            if 0 <= sec < len(secs):
                secs[sec]["els"].append(e)
            else:
                stray += 1
        # 슬라이드가 어느 구좌에 속하는지: 안의 요소가 가장 많이 속한 구좌
        for c in s["cars"]:
            cnt = Counter(i for i, sec in enumerate(secs) for e in sec["els"] if e.get("car") == c["i"])
            c["sec"] = cnt.most_common(1)[0][0] if cnt else None
        for sec in secs:
            sec.update(_section_summary(sec["els"], s["cars"], sec["i"]))
            sec["elements"] = sec.pop("els")
        meta = re.sub(r"\s+", " ", s["meta"]).strip()
        kind = (re.search(r"유형:\s*(.+)$", meta) or [None, ""])[1].strip()
        sites.append({"id": s["id"], "title": re.sub(r"^\d+(-\w)?\.\s*", "", s["title"].strip()), "url": s["url"], "kind": kind,
                      "desc": meta, "w": BODY_W, "h": s["frame_h"], "refs": _match_refs(s["url"], pages),
                      "sections": secs, "carousels": s["cars"], "stray": stray})
    return {"version": 1, "source": Path(src).name, "gutter": GUTTER, "width": BODY_W, "sites": sites}


# ---------------------------------------------------------------- 서버에서 읽어 쓰기 (레퍼런스 추천에 붙인다)
_cache = {"mt": None, "data": {"sites": []}, "by_page": {}, "by_id": {}}
_TOK = re.compile(r"[가-힣A-Za-z0-9%]{2,}")


def load() -> dict:
    """wireframes.json을 읽는다. 파일이 바뀌면 서버를 끄지 않아도 다시 읽는다. 없으면 빈 데이터."""
    try:
        mt = DEFAULT_OUT.stat().st_mtime
    except OSError:
        return _cache["data"] if _cache["mt"] is None else _reset()
    if _cache["mt"] != mt:
        try:
            d = json.loads(DEFAULT_OUT.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return _reset()
        by_page, by_id = {}, {}
        for site in d.get("sites", []):
            by_id[site["id"]] = site
            for pid in site.get("refs") or []:
                by_page[pid] = site
            site["_tok"] = [set(_TOK.findall(" ".join([x["label"]] + [e.get("text", "") or e.get("label", "") for e in x["elements"]]))) for x in site["sections"]]
        _cache.update(mt=mt, data=d, by_page=by_page, by_id=by_id)
    return _cache["data"]


def _reset():
    _cache.update(mt=None, data={"sites": []}, by_page={}, by_id={})
    return _cache["data"]


def brief(site: dict, sec: dict) -> dict:
    """화면 목록용 요약 (요소는 빼고, 필요할 때 section()으로 따로 받는다)"""
    return {"site": site["id"], "sec": sec["i"], "role": sec["role"], "label": sec["label"], "h": sec["h"], "w": site["w"], "cols": sec["cols"], "rows": sec["rows"],
            "cards": sec["cards"], "carousel": sec["carousel"], "fullbleed": sec["fullbleed"], "kinds": sec["kinds"], "n": len(sec["elements"])}


def match(row: dict) -> dict | None:
    """색인 구좌 행 → 같은 페이지 와이어프레임에서 가장 비슷한 구좌의 요약. 없으면 None.
    역할이 같으면 가산점, 글(제목·본문 단어)이 겹칠수록 높게 본다. 근거가 약하면 붙이지 않는다."""
    load()
    site = _cache["by_page"].get(row.get("page_id"))
    if not site:
        return None
    want = set(_TOK.findall(" ".join([row.get("title") or "", row.get("text") or ""])))
    best, best_s = None, 0.0
    for sec, tok in zip(site["sections"], site["_tok"]):
        hit = len(want & tok)
        same = sec["role"] == row.get("role")
        s = hit / max(4, min(len(want), 12)) + (0.35 if same else 0)
        if (same and hit >= 1 or hit >= 3) and s > best_s:   # 역할이 같으면 단어 하나만 겹쳐도, 다르면 세 개 이상 겹쳐야
            best, best_s = sec, s
    return brief(site, best) if best else None


def section(site_id: str, i: int) -> dict | None:
    """구좌 하나의 전체 구조(요소 포함)."""
    load()
    site = _cache["by_id"].get(site_id)
    if not site or not (0 <= i < len(site["sections"])):
        return None
    sec = site["sections"][i]
    return {**brief(site, sec), "elements": sec["elements"], "carousels": [c for c in site["carousels"] if c["sec"] == i], "title": site["title"], "url": site["url"], "y": sec["y"]}


def main():
    ap = argparse.ArgumentParser(description="와이어프레임 HTML → wireframes.json")
    ap.add_argument("src", nargs="?", default=str(DEFAULT_SRC))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    a = ap.parse_args()
    d = parse(Path(a.src))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_sec = sum(len(s["sections"]) for s in d["sites"])
    n_el = sum(len(x["elements"]) for s in d["sites"] for x in s["sections"])
    print(f"사이트 {len(d['sites'])}개 · 구좌 {n_sec}개 · 요소 {n_el}개 → {out} ({out.stat().st_size // 1024}KB)")
    for s in d["sites"]:
        print(f"  {s['id']:<12} 구좌 {len(s['sections']):>2} · 슬라이드 {len(s['carousels']):>2} · 색인연결 {s['refs'] or '-'}{' · 구좌 없는 요소 ' + str(s['stray']) if s['stray'] else ''}")


if __name__ == "__main__":
    main()

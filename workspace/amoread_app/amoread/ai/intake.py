# -*- coding: utf-8 -*-
"""
새 레퍼런스 가져오기: 링크(서버가 HTML을 내려받음) 또는 HTML 파일 → 읽기·구좌 나누기·자동 분류 → 초안(preview) → 담당자가 확인·수정 → 추가(commit).

  preview_url(url) / preview_html(html, filename)  → 초안 dict (draft_id, name, kind, season, cls, ben, sections[...], warnings[...], fields_from{...})
  commit(draft_id, edits)                          → 라이브러리 항목(references.save_item) + AI 검색용 사용자 색인(planner/data/ai_refs_user/)

- 초안은 planner/data/references/intake/<id>/ 에 24시간만 둔다 (HTML은 스크립트·이벤트 속성을 뺀 뒤 gzip). 원본 HTML을 화면에 그대로 내보내지 않는다.
- 링크 내려받기는 안전하게: http/https만, 80·443 포트만, 사설·내부 주소 차단(DNS로 풀린 IP를 직접 검사하고 그 IP로 접속, 리다이렉트도 매번 검사),
  5MB·15초 제한, HTML 형식만. 브라우저에서 그려야 보이는 페이지(본문이 거의 빈 경우)는 경고하고 HTML 파일로 올리게 한다.
- 이미지는 내용을 읽지 않는다(OCR 보류). 이름·종류만 파일명으로 채우고 나머지는 담당자가 고른다 (화면에서 처리).
"""
import gzip
import html as htmllib
import http.client
import ipaddress
import json
import re
import shutil
import socket
import ssl
import time
import urllib.parse
import uuid
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path

from . import labeling, refs, roles, rules

MAX_HTML = 5 * 1024 * 1024
MAX_SECTIONS = 40
DRAFT_TTL = 24 * 3600
USER_DIR = refs.USER_DIR
SKIP = {"script", "style", "noscript", "svg", "template", "iframe", "head", "canvas", "object", "embed"}
BOUNDARY = {"section", "article", "header", "footer", "nav", "aside", "h1", "h2"}
BLOCK = {"p", "div", "li", "ul", "ol", "tr", "table", "h3", "h4", "h5", "h6", "br", "main", "figure", "figcaption", "dl", "dt", "dd", "button", "a"} | BOUNDARY
_DRAFT_ID = re.compile(r"^[0-9a-f]{16}$")


class IntakeError(Exception):
    """사용자에게 그대로 보여 줄 문구."""


# ---------------------------------------------------------------- 안전한 내려받기
def _check_ip(ip: str):
    a = ipaddress.ip_address(ip)
    if a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or a.is_reserved or a.is_unspecified or getattr(a, "is_site_local", False):
        raise IntakeError("내부 주소는 가져올 수 없어요")


def _resolve(host: str, port: int) -> str:
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise IntakeError("주소를 찾을 수 없어요")
    ips = []
    for i in infos:
        _check_ip(i[4][0])   # 하나라도 내부 주소면 거절
        ips.append(i[4][0])
    return ips[0]


class _Conn(http.client.HTTPConnection):
    ip = ""

    def connect(self):
        self.sock = socket.create_connection((self.ip, self.port), timeout=15)


class _SConn(http.client.HTTPSConnection):
    ip = ""

    def connect(self):
        sock = socket.create_connection((self.ip, self.port), timeout=15)
        self.sock = ssl.create_default_context().wrap_socket(sock, server_hostname=self.host)


def fetch(url: str, accept: str = "text/html,application/xhtml+xml", max_bytes: int = MAX_HTML, want=("text/html", "application/xhtml")) -> tuple[bytes, str, str]:
    """(본문 바이트, 최종 주소, content-type). 실패하면 IntakeError."""
    for _ in range(6):   # 리다이렉트는 5번까지, 매번 다시 검사
        u = urllib.parse.urlsplit(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            raise IntakeError("http나 https로 시작하는 주소를 넣어 주세요")
        port = u.port or (443 if u.scheme == "https" else 80)
        if port not in (80, 443):
            raise IntakeError("80·443 포트가 아닌 주소는 가져올 수 없어요")
        ip = _resolve(u.hostname, port)
        conn = (_SConn if u.scheme == "https" else _Conn)(u.hostname, port, timeout=15)
        conn.ip = ip
        try:
            path = (u.path or "/") + (f"?{u.query}" if u.query else "")
            conn.request("GET", path, headers={"User-Agent": "Mozilla/5.0 (AMOREAD planner; reference intake)", "Accept": accept, "Accept-Encoding": "gzip", "Accept-Language": "ko,en;q=0.8"})
            r = conn.getresponse()
            if r.status in (301, 302, 303, 307, 308) and r.getheader("Location"):
                url = urllib.parse.urljoin(url, r.getheader("Location"))
                continue
            if r.status != 200:
                raise IntakeError(f"페이지를 열 수 없어요 (응답 {r.status})")
            ctype = (r.getheader("Content-Type") or "").split(";")[0].strip().lower()
            if want and not any(ctype.startswith(w) for w in want):
                raise IntakeError(f"가져올 수 없는 형식이에요 ({ctype or '알 수 없음'})")
            if int(r.getheader("Content-Length") or 0) > max_bytes:
                raise IntakeError("파일이 너무 커요")
            raw = r.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise IntakeError("파일이 너무 커요")
            if (r.getheader("Content-Encoding") or "").lower() == "gzip":
                try:
                    raw = gzip.GzipFile(fileobj=__import__("io").BytesIO(raw)).read(max_bytes + 1)
                except OSError:
                    raise IntakeError("내려받은 내용을 읽지 못했어요")
                if len(raw) > max_bytes:
                    raise IntakeError("파일이 너무 커요")
            return raw, url, ctype
        except (OSError, http.client.HTTPException) as e:
            if isinstance(e, IntakeError):
                raise
            raise IntakeError("페이지에 연결하지 못했어요")
        finally:
            conn.close()
    raise IntakeError("주소가 너무 여러 번 다른 곳으로 넘어가요")


def decode(raw: bytes) -> str:
    head = raw[:3000].decode("ascii", "ignore")
    m = re.search(r"charset=['\"]?([\w-]+)", head, re.I)
    for enc in ([m.group(1)] if m else []) + ["utf-8", "euc-kr", "cp949"]:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", "replace")


# ---------------------------------------------------------------- HTML 읽기·구좌 나누기
class _Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.title, self._in_title, self.skip, self.blocks, self.imgs = {}, "", False, 0, [], []
        self.cur, self.cur_boundary, self.cur_img, self.cur_link, self.cur_tag = [], None, 0, 0, ""
        self.bid = self.cur_bid = 0   # 구좌 경계 태그가 열릴 때마다 번호를 올려, 같은 경계 안의 블록을 한 구좌로 묶는다

    def _flush(self, boundary=None):
        t = re.sub(r"\s+", " ", " ".join(self.cur)).strip()
        if t or self.cur_img:
            self.blocks.append({"text": t, "tag": self.cur_boundary or "", "n_images": self.cur_img, "n_links": self.cur_link, "head": self.cur_tag in ("h1", "h2", "h3"), "bid": self.cur_bid if self.cur_boundary else 0})
        self.cur, self.cur_img, self.cur_link, self.cur_tag = [], 0, 0, ""
        self.cur_boundary = boundary

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            k = (a.get("property") or a.get("name") or "").lower()
            if k and a.get("content"):
                self.meta.setdefault(k, a["content"].strip())
        if tag == "link" and (a.get("rel") or "").lower() == "canonical" and a.get("href"):
            self.meta.setdefault("canonical", a["href"])
        if tag in SKIP:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "img":
            self.cur_img += 1
            src = a.get("src") or a.get("data-src") or ""
            if src and len(self.imgs) < 200:
                self.imgs.append({"url": src, "alt": (a.get("alt") or "").strip()})
            if (a.get("alt") or "").strip():
                self.cur.append(a["alt"].strip())
        if tag == "a":
            self.cur_link += 1
        if tag in BOUNDARY:
            self._flush(tag)
            self.bid += 1
            self.cur_bid = self.bid
        elif tag in BLOCK:
            self._flush(self.cur_boundary)
        if tag in ("h1", "h2", "h3"):
            self.cur_tag = tag

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag in BOUNDARY or tag in BLOCK:
            self._flush(self.cur_boundary if tag not in BOUNDARY else None)

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self.skip and data.strip():
            self.cur.append(data.strip())

    def close(self):
        super().close()
        self._flush()


def parse(html: str) -> dict:
    p = _Page()
    try:
        p.feed(html)
        p.close()
    except Exception:   # 깨진 HTML도 가능한 만큼만 읽는다
        pass
    return {"title": re.sub(r"\s+", " ", htmllib.unescape(p.title)).strip(), "meta": p.meta, "blocks": p.blocks, "images": p.imgs}


def sections_from(blocks: list[dict]) -> list[dict]:
    """블록을 구좌로 묶는다: section·article·header·footer·nav·h1/h2가 새 구좌를 열고, 한 구좌가 너무 길면(900자) 끊는다. 너무 짧은 것은 앞에 붙인다."""
    secs, cur = [], None

    def start(b):
        return {"tags": {b["tag"]} if b["tag"] else set(), "texts": [], "heads": [], "n_images": 0, "n_links": 0, "bid": b["bid"]}

    for b in blocks:
        new = cur is None or (b["tag"] and b["bid"] != cur["bid"] and (len(" ".join(cur["texts"])) > 30 or cur["n_images"] > 0)) or len(" ".join(cur["texts"])) > 900
        if new:
            cur = start(b)
            secs.append(cur)
        if b["tag"]:
            cur["tags"].add(b["tag"])
        if b["text"]:
            cur["texts"].append(b["text"])
            if b["head"]:
                cur["heads"].append(b["text"][:60])
        cur["n_images"] += b["n_images"]
        cur["n_links"] += b["n_links"]
    out = []
    for s in secs:
        text = " ".join(s["texts"]).strip()
        if len(text) < 6 and not s["n_images"]:
            continue
        if out and len(text) < 15 and not s["n_images"] and not (s["tags"] & {"footer", "nav"}):
            out[-1]["text"] += " " + text
            continue
        out.append({"text": text[:1500], "headings": s["heads"][:3], "n_images": s["n_images"], "n_links": s["n_links"], "tags": sorted(s["tags"])})
    return out[:MAX_SECTIONS]


def role_of(sec: dict, order: int) -> str:
    row = {"role": "content", "text": sec["text"], "n_images": sec["n_images"], "n_links": sec["n_links"], "order": order}
    role, _ = roles.v2(row)
    if role == "content":
        if "nav" in sec["tags"]:
            role = "section_navigation"
        elif "footer" in sec["tags"]:
            role = "terms_notice" if re.search(r"유의|약관|주의", sec["text"]) else "ui_noise"
        elif order == 1:
            role = "hero"
        elif sec["n_images"] >= 3:
            role = "visual_gallery"
    return role


def short_name(title: str, fallback: str) -> str:
    t = re.split(r"\s+[|\-–—·]\s+", title or "")[0].strip() if title else ""
    if len(t) < 4:
        t = (title or fallback or "").strip()
    return (t or fallback)[:60]


def build_draft(html: str, url: str = "", filename: str = "") -> dict:
    pg = parse(html)
    host = urllib.parse.urlsplit(url).hostname or "" if url else ""
    meta = pg["meta"]
    title = meta.get("og:title") or pg["title"]
    secs_raw = sections_from(pg["blocks"])
    from_body = False
    if not title and secs_raw:   # <title>이 없는 조각 HTML이면 첫 제목(없으면 첫 구좌 글)으로 이름을 짓는다
        title = next((b["text"] for b in pg["blocks"] if b["head"] and len(b["text"]) >= 4), "") or secs_raw[0]["text"][:40]
        from_body = bool(title)
    sections = []
    for i, s in enumerate(secs_raw, 1):
        r = role_of(s, i)
        row = {"id": f"s{i:02d}", "order": i, "role": r, "text": s["text"], "headings": s["headings"], "n_images": s["n_images"], "n_links": s["n_links"]}
        sections.append(row)
    fallback = filename.rsplit(".", 1)[0] if filename else host.removeprefix("www.")
    name = short_name(title, fallback) or "이름 없는 레퍼런스"
    page = {"listing_label": name, "page_title": title, "collected_date": date.today().isoformat(), "sections": sections}
    lb = labeling.classify_page(page)
    total = sum(len(s["text"]) for s in sections)
    warnings = []
    if total < 200 or len(sections) <= 1:
        warnings.append("본문이 거의 비어 있어요. 브라우저에서 그려야 보이는 페이지일 수 있어요 — 브라우저에서 '페이지를 HTML로 저장'한 파일을 올려 보세요.")
    if from_body:
        warnings.append("페이지 제목(<title>)이 없어 본문 첫 글에서 이름을 지었어요. 확인해 주세요")
    if not title:
        warnings.append("페이지 제목을 찾지 못해 이름을 직접 적어야 해요")
    if lb["cls"] == "":
        warnings.append("분류를 정할 단서가 없어 비워 뒀어요")
    host_l = host.lower()
    brand = "osulloc" if "osulloc" in host_l else (host_l.removeprefix("www.").split(".")[0] if host_l else "user")
    og = meta.get("og:image", "")
    if og:
        og = urllib.parse.urljoin(url, og) if url else og
    ptype = lb["type"]
    return {"name": name, "kind": "page", "season": lb["season"], "cls": lb["cls"], "ben": lb["ben"], "mode": lb["mode"], "type": ptype,
            "type_name": (rules.TYPES.get(ptype) or rules.GENERIC)["name"], "confidence": lb["confidence"], "evidence": lb["evidence"], "season_basis": lb["season_basis"],
            "link": (meta.get("canonical") if meta.get("canonical", "").startswith("http") else url) or url, "brand": brand, "from": "자사몰" if brand == "osulloc" else "외부",
            "description": (meta.get("og:description") or meta.get("description") or "")[:200], "og_image": og if og.startswith("http") else "",
            "sections": [{"id": s["id"], "order": s["order"], "title": (s["headings"][0] if s["headings"] else re.split(r"[.|/]| {2,}", s["text"])[0] or s["text"])[:30].strip(),
                          "role": s["role"], "stype": labeling.STYPE.get(s["role"], ""), "chars": len(s["text"]), "text": s["text"], "headings": s["headings"],
                          "n_images": s["n_images"], "n_links": s["n_links"]} for s in sections],
            "warnings": warnings,
            "fields_from": {"name": "og:title" if meta.get("og:title") else "페이지 제목" if pg["title"] else "본문 첫 글" if from_body else "파일·주소 이름", "season": lb["season_basis"] or "단서 없음",
                            "cls": "제목의 말" if lb["cls"] else "단서 없음", "ben": "본문의 말", "sections": f"HTML 구조에서 {len(sections)}개로 나눔"}}


# ---------------------------------------------------------------- 초안 보관
def _dir() -> Path:
    from . import references_dir
    return references_dir() / "intake"


def _sweep():
    d = _dir()
    if not d.exists():
        return
    now = time.time()
    for p in d.iterdir():
        try:
            if p.is_dir() and now - p.stat().st_mtime > DRAFT_TTL:
                shutil.rmtree(p, ignore_errors=True)
        except OSError:
            pass


def _strip_html(html: str) -> str:
    html = re.sub(r"<(script|iframe|object|embed)\b.*?</\1\s*>", "", html, flags=re.I | re.S)
    html = re.sub(r"<(script|iframe|object|embed)\b[^>]*>", "", html, flags=re.I)
    return re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", html, flags=re.I)


def _save_draft(draft: dict, html: str) -> dict:
    _sweep()
    did = uuid.uuid4().hex[:16]
    d = _dir() / did
    d.mkdir(parents=True, exist_ok=True)
    (d / "draft.json").write_text(json.dumps(draft, ensure_ascii=False), encoding="utf-8")
    (d / "page.html.gz").write_bytes(gzip.compress(_strip_html(html).encode("utf-8")))
    return {"draft_id": did, **{k: v for k, v in draft.items() if k != "sections"}, "sections": [{k: v for k, v in s.items() if k not in ("text", "headings")} | {"text": s["text"][:140]} for s in draft["sections"]]}


def preview_url(url: str) -> dict:
    raw, final, _ = fetch(url.strip())
    html = decode(raw)
    return _save_draft(build_draft(html, final), html)


def preview_html(html: str, filename: str = "", url: str = "") -> dict:
    if len(html.encode("utf-8", "ignore")) > MAX_HTML:
        raise IntakeError("HTML 파일이 너무 커요 (5MB까지)")
    if not re.search(r"<\s*(html|body|div|section|p|h1)\b", html[:200000], re.I):
        raise IntakeError("HTML 파일이 아닌 것 같아요")
    u = url.strip() if url.strip().startswith(("http://", "https://")) else ""
    return _save_draft(build_draft(html, u, filename), html)


# ---------------------------------------------------------------- 추가
def commit(draft_id: str, edits: dict) -> dict:
    """초안 + 담당자가 고친 값 → 라이브러리 항목 저장, AI 검색용 사용자 색인에 반영."""
    if not _DRAFT_ID.match(draft_id or ""):
        raise IntakeError("초안을 찾을 수 없어요. 다시 불러와 주세요")
    d = _dir() / draft_id
    try:
        draft = json.loads((d / "draft.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise IntakeError("초안이 만료됐어요(24시간). 다시 불러와 주세요")
    from .. import references
    name = (edits.get("name") or draft["name"]).strip()[:60] or "이름 없는 레퍼런스"
    ben = [x for x in (edits.get("ben") if edits.get("ben") is not None else draft["ben"])][:10]
    item = {"kind": edits.get("kind") or "page", "kind_label": edits.get("kind_label", ""), "name": name, "season": edits.get("season", draft["season"]), "cls": edits.get("cls", draft["cls"]),
            "source": "직접 추가", "link": draft.get("link", ""), "pts": edits.get("pts", [])[:10], "tags": edits.get("tags", [])[:20], "memo": edits.get("memo", "")[:300],
            "ben": ben, "secs": [x["title"] for x in draft["sections"]], "mode": (edits.get("mode") or draft["mode"] or [""])[0] if isinstance(edits.get("mode") or draft["mode"], list) else edits.get("mode", ""), "ai_type": draft["type"], "from_intake": True}
    out = references.save_item(item)
    rid = out["id"]
    # AI 검색용 사용자 색인
    secs = draft["sections"]
    _user_write(rid, {"name": name, "brand": "user", "url": draft.get("link", ""), "secs": [s["title"] for s in secs]},
                [{"id": f"{rid}:{s['id']}", "page_id": rid, "brand": "user", "role": s["role"], "title": s["title"], "campaign": f"직접 추가 · {name}"[:70], "url": draft.get("link", ""),
                  "order": s["order"], "text": re.sub(r"\s+", " ", s["text"]).strip()[:600], "images": [], **labeling.classify_section(s)} for s in secs
                 if s["role"] not in ("ui_noise", "empty") and s["text"].strip()],
                {"season": item["season"], "season_basis": "사람이 확인", "cls": item["cls"], "type": edits.get("type") or draft["type"], "ben": ben, "mode": [item["mode"]] if item["mode"] else [], "month": None,
                 "concept": "", "evidence": draft["evidence"], "confidence": "confirmed", "labeled_by": "human"})
    try:
        (USER_DIR / "html").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(d / "page.html.gz", USER_DIR / "html" / f"{rid}.html.gz")
    except OSError:
        pass
    if draft.get("og_image"):   # 대표 이미지(있으면)를 받아 썸네일로
        try:
            raw, _, ctype = fetch(draft["og_image"], accept="image/*", max_bytes=references.MAX_IMG, want=("image/",))
            import base64
            out["img_file"] = references.save_image(rid, f"data:{ctype};base64,{base64.b64encode(raw).decode()}")
        except Exception:
            pass
    shutil.rmtree(d, ignore_errors=True)
    return out


def _user_write(rid: str, page: dict, rows: list[dict], label: dict):
    USER_DIR.mkdir(parents=True, exist_ok=True)
    secf, pgf, lbf = USER_DIR / "sections.jsonl", USER_DIR / "pages.json", USER_DIR / "page_labels.json"
    keep = [x for x in (json.loads(l) for l in secf.read_text(encoding="utf-8").splitlines() if l.strip())] if secf.exists() else []
    keep = [x for x in keep if x["page_id"] != rid] + rows
    secf.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in keep) + ("\n" if keep else ""), encoding="utf-8")
    for f, key, val in ((pgf, rid, page), (lbf, rid, label)):
        cur = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        cur[key] = val
        f.write_text(json.dumps(cur, ensure_ascii=False), encoding="utf-8")


def remove(rid: str):
    """레퍼런스를 지우면 사용자 색인에서도 뺀다."""
    for f in (USER_DIR / "pages.json", USER_DIR / "page_labels.json"):
        try:
            cur = json.loads(f.read_text(encoding="utf-8"))
            if cur.pop(rid, None) is not None:
                f.write_text(json.dumps(cur, ensure_ascii=False), encoding="utf-8")
        except (OSError, ValueError):
            pass
    secf = USER_DIR / "sections.jsonl"
    try:
        rows = [x for x in (json.loads(l) for l in secf.read_text(encoding="utf-8").splitlines() if l.strip()) if x["page_id"] != rid]
        secf.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + ("\n" if rows else ""), encoding="utf-8")
    except OSError:
        pass
    try:
        (USER_DIR / "html" / f"{rid}.html.gz").unlink()
    except OSError:
        pass

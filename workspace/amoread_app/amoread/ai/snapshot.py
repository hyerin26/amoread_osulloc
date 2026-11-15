# -*- coding: utf-8 -*-
"""
수집본 화면: 저장해 둔 페이지 HTML을 안전한 읽기용 화면으로 바꿔 준다. 외부 링크가 바뀌거나 만료돼도 수집 당시 모습(구조·글·이미지 자리)을 볼 수 있다.

- 저장: 색인을 만들 때(build_index --html-dir) 또는 가져오기 확정(intake) 때 스크립트·스타일을 뺀 HTML을 gzip으로 `<색인 폴더>/html/<페이지 id>.html.gz`에 둔다.
- 보기: render()가 허용한 태그(제목·문단·목록·표 등)만 남기고 속성은 모두 버린다. 이미지는 그림 자리(alt 글)로, 링크는 글로만 보인다.
  그래서 화면의 보안 설정(CSP)을 그대로 두고 일반 요소로 넣을 수 있고, 외부 서버에 요청하지 않는다. 이미지 파일 자체는 저장하지 않는다(팀 데이터 보호로 보류한 항목).
"""
import gzip
import json
import html as htmllib
import re
from html.parser import HTMLParser
from pathlib import Path

from . import refs

KEEP = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "div", "section", "article", "header", "main", "span", "strong", "b", "em", "i", "br", "dl", "dt", "dd", "figure", "figcaption", "blockquote", "small", "label"}
SKIP = {"script", "style", "noscript", "svg", "iframe", "object", "embed", "template", "canvas", "video", "audio", "form", "select", "textarea", "head", "title", "meta", "link", "input", "button"}
VOID = {"br", "img", "hr", "input", "meta", "link"}
MAX_CHARS = 400_000


def strip_for_store(html: str) -> str:
    """저장용: 스크립트·스타일·svg 등 화면에 필요 없는 덩어리를 뺀다 (원본보다 훨씬 작다)."""
    html = re.sub(r"<(script|style|noscript|svg|iframe|object|embed|template)\b.*?</\1\s*>", "", html, flags=re.I | re.S)
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    return re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", html, flags=re.I)


def stats(html: str) -> dict:
    """원본 HTML에서 무엇을 받았는지 센다 (스트립 전 원본 기준). '수집 범위' 표에 쓴다."""
    t = re.sub(r"<(script|style|noscript|svg)\b.*?</\1\s*>", " ", html, flags=re.S | re.I)
    t = re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
    c = lambda p: len(re.findall(p, html, re.I))
    return {"bytes": len(html.encode("utf-8", "ignore")), "text": len(t), "img": c(r"<img\b"), "img_src": c(r"<img\b[^>]*\ssrc=\"https?://"), "svg": c(r"<svg\b"),
            "style_attr": c(r"\sstyle=\""), "style_tag": c(r"<style\b"), "css_link": c(r"<link[^>]+rel=\"?stylesheet"), "script": c(r"<script\b"),
            "a": c(r"<a\b"), "button": c(r"<button\b"), "cls": c(r"\sclass=\"")}


def save(dest_dir: Path, page_id: str, html: str) -> None:
    (dest_dir / "html").mkdir(parents=True, exist_ok=True)
    (dest_dir / "html" / f"{page_id}.html.gz").write_bytes(gzip.compress(strip_for_store(html).encode("utf-8")))
    (dest_dir / "html" / f"{page_id}.meta.json").write_text(json.dumps(stats(html)), encoding="utf-8")


class _R(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.imgs = 0
        self.n = 0
        self.stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self.skip:
            if tag in SKIP and tag not in VOID:
                self.skip += 1
            return
        if tag in SKIP:
            if tag not in VOID:
                self.skip = 1
            return
        a = dict(attrs)
        if tag == "img":
            if re.search(r"\.svg(\?|$)", a.get("src") or "", re.I):   # 아이콘류는 그림 자리를 만들지 않는다
                return
            alt = re.sub(r"\s+", " ", (a.get("alt") or "")).strip()[:80]
            self.imgs += 1
            self.out.append(f'<div class="sn-img"><span>{htmllib.escape(alt) if alt else "이미지"}</span></div>')
            return
        if tag == "a":
            self.out.append("<span class=\"sn-a\">")
            self.stack.append("span")
            return
        if tag in KEEP:
            self.out.append(f"<{tag}>")
            if tag not in VOID:
                self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.skip:
            if tag in SKIP and tag not in VOID:
                self.skip -= 1
            return
        if tag == "a":
            if "span" in self.stack:
                self.stack.reverse(); self.stack.remove("span"); self.stack.reverse()
                self.out.append("</span>")
            return
        if tag in KEEP and tag not in VOID and tag in self.stack:
            while self.stack:
                t = self.stack.pop()
                self.out.append(f"</{t}>")
                if t == tag:
                    break

    def handle_data(self, data):
        if self.skip or self.n > MAX_CHARS:
            return
        t = re.sub(r"\s+", " ", data)
        if t.strip():
            self.n += len(t)
            self.out.append(htmllib.escape(t))

    def close_all(self):
        while self.stack:
            self.out.append(f"</{self.stack.pop()}>")


def render(html: str) -> dict:
    p = _R()
    p.feed(html[:3_000_000])
    p.close()
    p.close_all()
    body = "".join(p.out)
    body = re.sub(r"<(div|section|article|span|header|main|figure)>\s*</\1>", "", body)
    return {"html": body, "images": p.imgs, "chars": p.n}


def _find(page_id: str) -> Path | None:
    for d in (refs.AI_DIR, refs.USER_DIR):
        f = d / "html" / f"{page_id}.html.gz"
        if f.exists():
            return f
    return None


def view(page_id: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,60}", page_id or ""):
        return {"ok": False, "reason": "bad id"}
    f = _find(page_id)
    if not f:
        return {"ok": False, "reason": "no snapshot"}
    meta = {}
    try:
        meta = json.loads(f.with_name(f.name.replace(".html.gz", ".meta.json")).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    from . import render as _rd
    rm = _rd.load_meta(page_id)
    rendered = {k: rm[k] for k in ("captured_at", "viewport", "css_files", "css_bytes", "html_bytes", "page_h", "bands", "final_url")} if rm else None
    return {"ok": True, "capture": meta, "rendered": rendered, **render(gzip.decompress(f.read_bytes()).decode("utf-8", "replace"))}

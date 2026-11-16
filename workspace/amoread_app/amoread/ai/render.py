# -*- coding: utf-8 -*-
"""
화면 수집(렌더링 수집): 페이지를 실제 브라우저(Chrome)로 열어 그린 뒤 모양까지 저장한다. 주소로 HTML만 내려받는 intake.fetch가 못 받던 것을 받는다.

받는 것
- 그려진 HTML(자바스크립트가 만든 내용 포함, 스크립트는 뺌) + 적용된 CSS(스타일시트를 파일로 받아 <style>로 합침) → 한 파일(`capture/<id>/page.html.gz`)
- 구좌 배치: 페이지를 세로로 나눈 띠(band)마다 위치·높이·글 길이·이미지 수·칸 수·배경색 (`meta.json`의 layout) → 썸네일을 실제 비율로 그리는 데 쓴다
- 수집 환경(화면 폭 390px 모바일 고정, 수집 시각, 최종 주소, 본문 해시)
받지 않는 것: 이미지·글꼴·영상 파일 (저장하지 않는다. 이미지 주소만 남고 보여 줄 때는 막혀 있다)

안전: 브라우저가 보내는 모든 요청(페이지·스타일·스크립트·이미지)은 내부망·사설 주소를 막는다(intake와 같은 규칙). 한 번에 한 페이지, 영상은 받지 않고, 제한 시간이 있다.
필요한 것: `pip install playwright` + 이 PC의 Chrome (브라우저를 따로 내려받지 않는다). 없으면 available()이 False라 기존 방식(HTML만)으로 돌아간다.
"""
import gzip
import hashlib
import json
import re
import socket
import threading
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

from . import intake, refs

VIEW_W, VIEW_H = 390, 844   # 모바일 고정 (몰 프로모션은 모바일 기준이 대부분)
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
NAV_TIMEOUT = 30_000
MAX_HTML = 6_000_000
_lock = threading.Lock()


def available() -> bool:
    try:
        import playwright.sync_api  # noqa: F401
    except Exception:
        return False
    return True   # Chrome이 없으면 capture()가 실행할 때 "Chrome을 열 수 없어요"로 알려 준다


def capture_dir() -> Path:
    return refs.USER_DIR / "capture"


# 페이지가 그려진 뒤 띠(band)를 뽑는 스크립트: 본문을 감싼 컨테이너까지 내려가서 그 자식들을 위에서 아래로 훑는다
_LAYOUT_JS = r"""() => {
  const W = innerWidth, H = document.documentElement.scrollHeight, sy = scrollY;
  const rc = e => e.getBoundingClientRect();
  const vis = e => { const r = rc(e), cs = getComputedStyle(e); return r.height > 6 && r.width > W * .3 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position !== 'fixed'; };
  let root = document.body;
  for (let d = 0; d < 10; d++) {
    const kids = [...root.children].filter(vis);
    if (!kids.length) break;
    const tall = kids.reduce((a, b) => rc(b).height > rc(a).height ? b : a);
    if (rc(tall).height > H * .6 && (kids.length === 1 || kids.length <= 3)) { root = tall; continue; }
    break;
  }
  const bgOf = e => { for (let x = e, i = 0; x && i < 3; x = x.parentElement, i++) { const c = getComputedStyle(x).backgroundColor; if (c && !/rgba?\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return ''; };
  const bands = [...root.children].filter(vis).map(e => {
    const r = rc(e), imgs = e.querySelectorAll('img, picture, video, canvas').length;
    const tops = {};
    e.querySelectorAll('*').forEach(c => { const q = rc(c); if (q.width > 20 && q.width < W * .9 && q.height > 20) { const k = Math.round(q.top / 6); tops[k] = (tops[k] || 0) + 1; } });
    const cols = Math.max(1, ...Object.values(tops).map(n => Math.min(n, 6)));
    return { y: Math.round(r.top + sy), h: Math.round(r.height), w: Math.round(r.width), t: (e.innerText || '').replace(/\s+/g, ' ').trim().length, txt: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160), i: imgs, c: cols, bg: bgOf(e) };
  });
  return { vw: W, ph: H, bands: bands.slice(0, 80), full: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60000) };
}"""

# 저장용 HTML: 스크립트 등을 빼고, 외부 이미지는 주소를 data-src로 옮겨(요청이 안 나가게) 자리 크기를 그려진 크기로 고정한다
_CLEAN_JS = r"""(sheets) => {
  const liveS = [...document.querySelectorAll('style, link[rel=stylesheet]')];
  const d = document.documentElement.cloneNode(true);
  // 스타일: 자바스크립트가 규칙을 직접 넣는 방식(styled-components 등)은 태그 글자에 안 남으므로 실제 적용된 규칙(CSSOM)을 옮긴다. 다른 사이트 파일은 규칙을 못 읽어 받아 둔 글을 읽는다.
  // 화면 폭 조건(@media)은 수집한 모바일 폭(390px)에서 맞는 것만 남겨 펴 둔다 → 나중에 어떤 폭의 칸에 넣어도 모바일 모양 그대로 나온다
  const ser = rules => [...rules].map(r => {
    if (r.type === CSSRule.MEDIA_RULE) return matchMedia(r.conditionText || r.media.mediaText).matches ? ser(r.cssRules) : '';
    if (r.type === CSSRule.SUPPORTS_RULE) return CSS.supports(r.conditionText) ? ser(r.cssRules) : '';
    return r.cssText; }).join('\n');
  // rem·vw·vh는 나중에 칸 안에 넣을 때 기준이 달라지므로 수집 당시의 px로 바꿔 둔다
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const unitFix = css => css.replace(/(-?\d*\.?\d+)rem\b/g, (m, n) => (parseFloat(n) * rootPx).toFixed(2) + 'px').replace(/(-?\d*\.?\d+)vw\b/g, (m, n) => (parseFloat(n) * innerWidth / 100).toFixed(2) + 'px').replace(/(-?\d*\.?\d+)v(h|min)\b/g, (m, n) => (parseFloat(n) * innerHeight / 100).toFixed(2) + 'px');
  [...d.querySelectorAll('style, link[rel=stylesheet]')].forEach((el, i) => { const o = liveS[i]; let css = '';
    try { if (o && o.sheet) css = ser(o.sheet.cssRules); } catch (e) { css = ''; }
    if (!css) { const raw = el.tagName === 'LINK' ? (sheets[o ? o.href : el.href] || '') : el.textContent;
      try { const cs = new CSSStyleSheet(); cs.replaceSync(raw); css = ser(cs.cssRules); } catch (e) { css = raw; } }
    const s = document.createElement('style'); s.textContent = unitFix(css); el.replaceWith(s); });
  d.querySelectorAll('script,noscript,iframe,object,embed,template,base,meta[http-equiv],link[rel=preload],link[rel=prefetch],link[rel=modulepreload],link[rel=dns-prefetch],link[rel=icon],link[rel=manifest]').forEach(e => e.remove());
  const live = [...document.querySelectorAll('img')], mine = [...d.querySelectorAll('img')];
  mine.forEach((im, i) => { const o = live[i], r = o ? o.getBoundingClientRect() : null;
    const src = im.getAttribute('src') || o?.currentSrc || ''; if (src) im.setAttribute('data-src', src); im.removeAttribute('src'); im.removeAttribute('srcset'); im.removeAttribute('loading');
    if (r && r.width) im.setAttribute('style', (im.getAttribute('style') || '') + `;width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;background:#e6e9ea`); });
  d.querySelectorAll('[style]').forEach(e => e.setAttribute('style', unitFix(e.getAttribute('style'))));   // 태그 안 style의 vw·rem도 수집 당시 px로
  d.querySelectorAll('source').forEach(s => { s.removeAttribute('srcset'); s.removeAttribute('src'); });
  d.querySelectorAll('a[href]').forEach(a => { a.setAttribute('data-href', a.getAttribute('href')); a.removeAttribute('href'); });
  d.querySelectorAll('*').forEach(e => { for (const a of [...e.attributes]) if (/^on/i.test(a.name)) e.removeAttribute(a.name); });
  return '<!doctype html>' + d.outerHTML;
}"""


def _public(host: str, cache: dict) -> bool:
    if host in cache:
        return cache[host]
    ok = False
    try:
        intake._check_ip(intake._resolve(host, 443))
        ok = True
    except Exception:
        ok = False
    cache[host] = ok
    return ok


def _css_text(txt: str) -> str:
    txt = re.sub(r"@import[^;]+;", "", txt)
    return txt[:1_500_000]


def capture(url: str, extra=None) -> dict:
    """주소 하나를 그려서 {ok, final_url, title, html, layout, meta} 를 돌려준다. 실패하면 {ok: False, reason}.
    extra(pg): 페이지가 다 그려진 뒤 그 페이지로 더 할 일(화면 사진 찍기 등). 돌려준 값은 결과의 "extra"에 담긴다. 실패해도 수집은 그대로."""
    if not available():
        return {"ok": False, "reason": "브라우저 수집 도구(playwright·Chrome)가 없어요"}
    u = urllib.parse.urlsplit(url.strip())
    if u.scheme not in ("http", "https") or not u.hostname:
        return {"ok": False, "reason": "http(s) 주소만 받아요"}
    cache: dict = {}
    try:
        intake._check_ip(intake._resolve(u.hostname, u.port or (443 if u.scheme == "https" else 80)))
    except Exception as e:
        return {"ok": False, "reason": str(e) or "허용되지 않는 주소예요"}
    from playwright.sync_api import sync_playwright
    t0 = time.time()
    with _lock, sync_playwright() as p:   # 동시에 하나만
        try:
            # 회사에서 확장 프로그램을 관리하는 Chrome은 --disable-extensions(Playwright 기본값)를 받으면 바로 종료된다
            br = p.chromium.launch(channel="chrome", headless=True, ignore_default_args=["--disable-extensions"])
        except Exception:
            return {"ok": False, "reason": "Chrome을 열 수 없어요 (이 PC에 Chrome이 설치돼 있어야 해요)"}
        try:
            ctx = br.new_context(viewport={"width": VIEW_W, "height": VIEW_H}, device_scale_factor=1, is_mobile=True, has_touch=True, locale="ko-KR", user_agent=UA)

            def gate(route):
                req = route.request
                h = urllib.parse.urlsplit(req.url)
                if h.scheme not in ("http", "https", "data", "blob", "about") or req.resource_type in ("media", "websocket"):
                    return route.abort()
                if h.scheme in ("http", "https") and not _public(h.hostname or "", cache):
                    return route.abort()
                return route.continue_()
            ctx.route("**/*", gate)
            pg = ctx.new_page()
            resp = pg.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
            if resp is not None and resp.status >= 400:
                return {"ok": False, "reason": f"페이지가 열리지 않아요 (HTTP {resp.status})", "gone": resp.status in (404, 410)}
            try:
                pg.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            h = pg.evaluate("document.documentElement.scrollHeight")
            for y in range(0, min(h, 40000), 700):   # 늦게 불러오는 그림·구좌가 그려지도록 끝까지 한 번 내려간다
                pg.evaluate(f"window.scrollTo(0,{y})")
                pg.wait_for_timeout(90)
            pg.wait_for_timeout(400)
            pg.evaluate("window.scrollTo(0,0)")
            final = pg.url
            title = pg.title()
            hrefs = pg.evaluate("[...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href)")
            sheets = {}
            for hr in dict.fromkeys(hrefs):
                hh = urllib.parse.urlsplit(hr)
                if hh.scheme in ("http", "https") and _public(hh.hostname or "", cache):
                    try:
                        r = ctx.request.get(hr, timeout=10000)
                        if r.ok:
                            sheets[hr] = _css_text(r.text())
                    except Exception:
                        pass
            layout = pg.evaluate(_LAYOUT_JS)
            ex = None
            if extra:   # 저장용으로 문서를 손보기(_CLEAN_JS) 전에, 보이는 그대로일 때 한다
                try:
                    ex = extra(pg)
                except Exception:
                    ex = None
            html = pg.evaluate(_CLEAN_JS, sheets)
        except Exception as e:
            return {"ok": False, "reason": f"그리는 중 오류: {type(e).__name__}"}
        finally:
            br.close()
    if len(html.encode("utf-8", "ignore")) > MAX_HTML:
        return {"ok": False, "reason": "페이지가 너무 커요"}
    text = layout.get("full", "")
    return {"ok": True, "final_url": final, "title": title, "html": html, "layout": layout, "text": layout.pop("full", ""), "extra": ex,
            "meta": {"captured_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "viewport": [VIEW_W, VIEW_H], "final_url": final, "title": title, "css_files": len(sheets),
                     "css_bytes": sum(len(v) for v in sheets.values()), "html_bytes": len(html.encode("utf-8", "ignore")), "page_h": layout["ph"], "bands": len(layout["bands"]),
                     "content_hash": hashlib.sha1(text.encode("utf-8")).hexdigest()[:16], "seconds": round(time.time() - t0, 1)}}


def map_roles(bands: list[dict], rows: list[dict]) -> list[tuple]:
    """띠마다 가장 닮은 구좌(색인 행)를 찾아 (역할, 구좌 제목)을 붙인다 (글 조각 겹침). 못 찾으면 ('', '')."""
    def grams(s):
        s = re.sub(r"\s+", "", s)
        return {s[i:i + 2] for i in range(len(s) - 1)}
    secs = [(grams(r["text"][:300]), r["role"], r.get("title", "")) for r in rows]
    out = []
    for b in bands:
        g = grams(b.get("txt", ""))
        best, hit = 0.0, ("", "")
        if len(g) >= 4:
            for sg, rl, tt in secs:
                if not sg:
                    continue
                sc = len(g & sg) / max(1, min(len(g), len(sg)))
                if sc > best:
                    best, hit = sc, (rl, tt)
        out.append(hit if best >= .35 else ("", ""))
    return out


def save(page_id: str, res: dict, rows: list[dict] | None = None) -> dict:
    d = capture_dir() / page_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "page.html.gz").write_bytes(gzip.compress(res["html"].encode("utf-8"), 6))
    lay = res["layout"]
    hits = map_roles(lay["bands"], rows) if rows else [("", "")] * len(lay["bands"])
    for b, (r, t) in zip(lay["bands"], hits):
        b["role"], b["st"] = r, t
        b["txt"] = (b.get("txt") or "")[:50]
    meta = {**res["meta"], "layout": lay}
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return meta


def load_meta(page_id: str) -> dict | None:
    try:
        return json.loads((capture_dir() / page_id / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_html(page_id: str) -> str | None:
    try:
        return gzip.decompress((capture_dir() / page_id / "page.html.gz").read_bytes()).decode("utf-8", "replace")
    except OSError:
        return None


def remove(page_id: str):
    import shutil
    shutil.rmtree(capture_dir() / page_id, ignore_errors=True)

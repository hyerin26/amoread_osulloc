# -*- coding: utf-8 -*-
"""
마켓별 신규 프로모션 찾기: 마켓 버튼을 누르면 그 마켓의 기획전·이벤트 목록 화면을 브라우저로 열어 프로모션 링크를 긁고,
우리 레퍼런스에 이미 있는지 비교해 '새로 올라온 것'을 알려 준다. 추가는 기존 수집(collect.start)에 주소를 넘겨 같은 방식으로 한다.

- 마켓 목록·진입 주소·링크 모양은 MARKETS 한 곳에서 관리한다 (새 마켓은 여기에 한 항목 추가). 진입 주소는 코드에 고정된 공개 주소만 쓴다.
- 읽기만 한다: 로그인·클릭·입력 없이 목록 화면을 열고 끝까지 내려가며 링크를 읽는다. 마켓당 진입 화면 1~3개, 한 번에 하나씩.
- 결과는 planner/data/ai_collect/discover.json 에 남긴다 (마켓별 마지막 확인 시각, 링크, 처음 발견한 날). 화면은 이 파일 + 라이브러리 비교로 '신규/이미 있음'을 계산한다.
- 제목은 목록에 보이는 글자(없으면 그림 설명)라서 거칠 수 있다. 추가하면 상세 페이지를 읽어 제대로 된 이름·구좌로 바꾼다.
"""
import asyncio
import json
import re
import threading
import time
import urllib.parse
import uuid
from datetime import datetime

from . import collect, intake, refs, render

# pat: 프로모션 상세로 보이는 주소 모양(정규식, 전체 주소에 search). skip: 제외할 모양.
MARKETS = {
    "osulloc": {"label": "오설록", "pages": ["https://www.osulloc.com/kr/ko/life/event/list/ing"],
                "pat": [r"osulloc\.com/kr/ko/life/event/view/\d+"]},
    "kurly": {"label": "컬리", "strip_query": True, "pages": ["https://www.kurly.com/main"],
              "pat": [r"kurly\.com/(collections|clay)/[^?#/]+", r"event\.kurly\.com/lego/event/\S+"]},
    "29cm": {"label": "29CM", "pages": ["https://www.29cm.co.kr/", "https://www.29cm.co.kr/store/showcase"],
             "pat": [r"29cm\.co\.kr/content/(brand-news|collection|showcase|29live)/\S+"]},
    "oliveyoung": {"label": "올리브영", "strip_query": True,
                   "pages": ["https://m.oliveyoung.co.kr/m/mtn", "https://m.oliveyoung.co.kr/m/mtn?menu=event", "https://m.oliveyoung.co.kr/m/mtn/olivebetter", "https://m.oliveyoung.co.kr/m/mtn?menu=planshop"],
                   "pat": [r"oliveyoung\.co\.kr/m/mtn/planshop/detail/\w+"]},
    "zigzag": {"label": "지그재그", "pages": ["https://zigzag.kr/"],
               "pat": [r"zigzag\.kr/events/[0-9a-f-]{20,}"]},
}
MAX_PER_MARKET = 120
_lock = threading.Lock()
_jobs: dict[str, dict] = {}


def _file():
    return collect._dir() / "discover.json"


def _load() -> dict:
    try:
        return json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(d: dict):
    _file().write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


_LINKS_JS = r"""() => [...document.querySelectorAll('a[href]')].map(a => {
  const img = a.querySelector('img');
  const lines = (a.innerText || '').split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 1);
  return { u: a.href, t: lines.sort((x, y) => y.length - x.length)[0] || (img && (img.alt || img.title)) || a.getAttribute('aria-label') || a.title || '' };
})"""


_GENERIC = re.compile(r"^\d*\s*(메인\s*)?배너(\s*이미지)?$|^이미지$|^더보기$|^바로가기$|^전체\s*보기$|^자세히\s*보기$|^[\d.~\s\-/월일]+$")


def _title(s: str, url: str = "") -> str:
    t = re.sub(r"\s+", " ", s or "").strip()[:80]
    if _GENERIC.match(t):
        t = ""
    return t or urllib.parse.urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1][:60]


_FP_JS = r"""(n) => {
  const body = document.body, txt = (body ? body.innerText : '').replace(/\s+/g, ' ').trim();
  const goods = [...document.querySelectorAll('a[href]')].filter(a => /goods|product|item|catalog|prd/i.test(a.href)).length;
  let heads = 0;   // 큰 글씨(20px 이상)의 짧은 제목 글 = 구좌 제목·카피 수
  for (const e of document.querySelectorAll('h1,h2,h3,h4,strong,b,p,div,span')) {
    if (e.childElementCount > 1) continue;
    const t = (e.textContent || '').trim();
    if (t.length < 2 || t.length > 60) continue;
    if (parseFloat(getComputedStyle(e).fontSize) >= 20) { heads++; if (heads >= 60) break; }
  }
  return { t: document.title || '', b: txt.slice(0, n), len: txt.length, imgs: document.images.length, h: document.documentElement.scrollHeight, goods, heads };
}"""
FP_CHARS = 6000      # 후보 페이지에서 읽는 글자 수 (같은 프로모션인지 비교용)
FP_PARALLEL = 8      # 후보 페이지를 동시에 여는 수


async def _scan_async(m: dict) -> list[dict]:
    from playwright.async_api import async_playwright
    pats = [re.compile(p) for p in m["pat"]]
    out: dict[str, dict] = {}
    async with async_playwright() as p:
        try:
            br = await p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            raise intake.IntakeError("Chrome을 열 수 없어요 (이 PC에 Chrome이 설치돼 있어야 해요)")
        try:
            ctx = await br.new_context(viewport={"width": render.VIEW_W, "height": render.VIEW_H}, is_mobile=True, has_touch=True, locale="ko-KR", user_agent=render.UA)

            async def gate(route):   # 글만 읽으니 그림·글꼴·영상은 받지 않는다
                if route.request.resource_type in ("media", "websocket", "image", "font"):
                    await route.abort()
                else:
                    await route.continue_()
            await ctx.route("**/*", gate)
            for url in m["pages"]:   # 1) 목록 화면에서 프로모션 링크 모으기
                pg = await ctx.new_page()
                try:
                    await pg.goto(url, wait_until="domcontentloaded", timeout=render.NAV_TIMEOUT)
                    try:
                        await pg.wait_for_load_state("networkidle", timeout=8000)
                    except Exception:
                        pass
                    for _ in range(12):   # 늦게 불러오는 목록까지 내려가며 읽는다
                        await pg.mouse.wheel(0, 2200)
                        await pg.wait_for_timeout(350)
                    for x in await pg.evaluate(_LINKS_JS):
                        u = (x.get("u") or "").split("#")[0]
                        if not u.startswith("http") or not any(r.search(u) for r in pats):
                            continue
                        if m.get("strip_query"):   # 같은 기획전이 추적용 주소 꼬리만 달리 나오는 마켓
                            u = u.split("?")[0]
                        n = collect.normalize(u)
                        cur = out.get(n)
                        t = _title(x.get("t"), u)
                        if cur is None:
                            out[n] = {"url": u, "title": t}
                        elif len(t) > len(cur["title"]):
                            cur["title"] = t
                except Exception:
                    continue
                finally:
                    await pg.close()
            found = list(out.values())[:MAX_PER_MARKET]
            sem = asyncio.Semaphore(FP_PARALLEL)

            async def fp(x):   # 2) 후보마다 실제 내용 글을 읽어 둔다 (주소가 같아도 내용이 바뀔 수 있어서 주소 대신 내용으로 비교한다). 느린 페이지는 한 번 더 시도
                async with sem:
                    x["fp"] = ""
                    for attempt in range(2):
                        pg = await ctx.new_page()
                        try:
                            await pg.goto(x["url"], wait_until="domcontentloaded", timeout=15000 + 10000 * attempt)
                            try:
                                await pg.wait_for_load_state("networkidle", timeout=3000)
                            except Exception:
                                pass
                            await pg.wait_for_timeout(700)
                            r = await pg.evaluate(_FP_JS, FP_CHARS)
                            x["fp"] = r["b"]
                            x["pt"] = _title(r["t"], "")
                            x["m"] = {k: r[k] for k in ("len", "imgs", "h", "goods", "heads")}
                            if len(x["title"]) < 3 or re.fullmatch(r"[0-9a-f-]{8,}|[\w-]{1,24}", x["title"] or ""):   # 목록에서 못 읽은 제목은 페이지 제목으로
                                x["title"] = _title(r["t"], x["url"])
                            break
                        except Exception:
                            continue
                        finally:
                            await pg.close()
            await asyncio.gather(*(fp(x) for x in found))
            return found
        finally:
            await br.close()


def _scan_pages(m: dict) -> list[dict]:
    if not render.available():
        raise intake.IntakeError("브라우저 수집 도구(playwright·Chrome)가 없어요")
    with render._lock:
        return asyncio.run(_scan_async(m))


def scan_and_save(key: str) -> int:
    """마켓 하나를 확인해 결과를 discover.json에 저장하고 찾은 개수를 돌려준다 (버튼 작업과 매일 자동 실행이 함께 쓴다)."""
    found = _scan_pages(MARKETS[key])
    db = _load()
    prev = {collect.normalize(x["url"]): x for x in db.get(key, {}).get("items", [])}
    today = datetime.now().strftime("%Y-%m-%d")
    for x in found:
        old = prev.get(collect.normalize(x["url"]))
        x["first_seen"] = old["first_seen"] if old else today
    db[key] = {"at": datetime.now().strftime("%Y-%m-%d %H:%M"), "items": found}
    _save(db)
    return len(found)


def _run(job: dict, key: str):
    try:
        job["found"] = scan_and_save(key)
        job["state"] = "done"
    except intake.IntakeError as e:
        job["state"], job["error"] = "error", str(e)
    except Exception as e:
        job["state"], job["error"] = "error", f"찾는 중 오류가 났어요 ({type(e).__name__})"
    finally:
        job["ended"] = time.time()
        _lock.release()


def start(key: str) -> dict:
    if key not in MARKETS:
        raise intake.IntakeError("지원하지 않는 마켓이에요")
    if not _lock.acquire(blocking=False):
        raise intake.IntakeError("이미 다른 마켓을 확인하는 중이에요. 끝난 뒤 다시 눌러 주세요")
    for k in [k for k, v in _jobs.items() if v["state"] != "running" and time.time() - v.get("ended", 0) > 3600]:
        _jobs.pop(k, None)
    job = {"id": uuid.uuid4().hex[:12], "market": key, "state": "running"}
    _jobs[job["id"]] = job
    threading.Thread(target=_run, args=(job, key), daemon=True).start()
    return job


def status(jid: str) -> dict | None:
    return _jobs.get(jid)


SAME_URL = 0.5    # 같은 주소일 때 겹침 기준
SAME = 0.6        # 새 글이 우리 레퍼런스 글과 이만큼(작은 쪽 기준) 겹치면 같은 프로모션
MIN_GRAMS = 30    # 공통 문구를 뺀 뒤에도 이만큼은 남아야 내용 비교를 한다 (그려야 보이는 페이지 등 글이 짧으면 못 함)
COMMON = 0.2      # 마켓 안의 후보 페이지 20% 이상에 나오는 글 조각은 머리글·바닥글 같은 공통 문구로 보고 비교에서 뺀다


def _grams(t: str) -> set:
    t = re.sub(r"\s+", "", t or "")
    return {t[i:i + 2] for i in range(len(t) - 1)}


def _library() -> list[tuple]:
    """우리 레퍼런스(수집본·직접 추가)마다 (이름, 글 조각 집합, 주소)."""
    rows: dict[str, list] = {}
    try:
        for l in (refs.USER_DIR / "sections.jsonl").read_text(encoding="utf-8").splitlines():
            if l.strip():
                r = json.loads(l)
                rows.setdefault(r["page_id"], []).append(r.get("text") or "")
    except OSError:
        pass
    pages = {}
    try:
        pages = json.loads((refs.USER_DIR / "pages.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    return [(pg.get("name") or pg.get("title") or pid, _grams(" ".join(rows.get(pid, []))[:8000]), collect.normalize(pg["url"]) if pg.get("url") else "") for pid, pg in pages.items()]


def _common(items: list[dict]) -> set:
    """마켓 공통 문구(메뉴·바닥글·안내)에 해당하는 글 조각. 이것까지 비교하면 서로 다른 프로모션도 겹쳐 보인다."""
    from collections import Counter
    c, n = Counter(), 0
    for x in items:
        if x.get("fp"):
            n += 1
            c.update(_grams(x["fp"]))
    return {g for g, k in c.items() if n >= 5 and k >= max(3, COMMON * n)}


def _judge(x: dict, lib: list[tuple], urls: set, common: set = frozenset()) -> tuple[str, str]:
    """후보 하나 → (상태, 설명). 상태: have(이미 있음) / changed(같은 주소인데 내용이 달라짐) / new / ended(끝난 프로모션)."""
    from . import recapture
    text = x.get("fp") or ""
    if text and recapture.ENDED.search(text[:400]):
        return "ended", "끝났거나 없는 페이지"
    g = _grams(text) - common
    same_url = collect.normalize(x["url"]) in urls
    if len(g) >= MIN_GRAMS:
        best, name = 0.0, ""
        for n, lg, u in lib:
            lg = lg - common
            if len(lg) >= MIN_GRAMS:
                o = len(g & lg)
                if collect.normalize(x["url"]) == u:   # 같은 주소: 예전 글이 새 글에 얼마나 남아 있나 (재수집과 같은 기준)
                    sc = o / len(lg) if o / min(len(g), len(lg)) >= SAME_URL else 0.0
                    ok = sc >= SAME_URL
                else:   # 다른 주소: 양쪽이 서로 비슷해야 같은 프로모션 (같은 틀을 쓰는 다른 프로모션과 헷갈리지 않게 양쪽 기준)
                    sc = min(o / min(len(g), len(lg)), o / max(len(g), len(lg)))
                    ok = sc >= SAME
                if ok and sc > best:
                    best, name = sc, n
        if best > 0:
            return "have", name
        return ("changed", "같은 링크인데 내용이 달라졌어요") if same_url else ("new", "")
    return ("have", "같은 링크") if same_url else ("new", "")   # 글을 못 읽은 페이지는 주소로만 비교


# ---------- 참고 가치 점수: 규칙으로 계산하고 이유를 같이 보여 준다 (사람이 최종 판단). 낮은 건 목록에서 접어 두기만 하고 지우지 않는다 ----------
LOW = 45   # 이 점수 미만은 '참고 가치 낮음'으로 접는다
_PAY = re.compile(r"카드\s*(행사|혜택|할인)|즉시\s*할인|청구\s*할인|무이자|결제\s*(수단|행사)|페이\s*(결제|혜택)|쿠폰북|포인트\s*(적립|전환)")
_FIXED = re.compile(r"오마트|단독상품|베스트\s*(상품|셀러)?$|랭킹|전체\s*상품|원하는\s*날|오늘의\s*딜")
_PERIOD = re.compile(r"\d{1,2}\s*[./월]\s*\d{1,2}\s*일?\s*[\(\)가-힣]{0,3}\s*[~\-–]\s*\d{0,2}|기간\s*[:：]|~\s*\d{1,2}\s*[./월]\s*\d{1,2}")


def score(x: dict) -> tuple[int | None, list[str]]:
    """기획 참고용으로 볼 만한 정도(0~100)와 이유. 페이지 내용을 못 읽었으면 (None, [])."""
    m, text = x.get("m"), x.get("fp") or ""
    if not m:
        return None, []   # 예전 확인 결과(내용 없이 링크만 저장): 판단하지 않는다
    if not text.strip():
        return 20, ["내용 못 읽음"]   # 열었지만 글이 비어 있음(앱 이동·차단 등): 추가해도 구좌를 못 나눌 가능성이 커서 접는다
    sc, why = 50, []
    head = f"{x.get('title', '')} {x.get('pt', '')}"
    if _PAY.search(head):   # 제목에 있을 때만: 본문에는 카드 혜택을 한 구좌로 곁들이는 일반 이벤트도 많다
        sc -= 60; why.append("카드·결제 행사")
    if _FIXED.search(head):
        sc -= 30; why.append("상설 코너")
    if _PERIOD.search(text):
        sc += 15; why.append("기간 있음")
    else:
        sc -= 10; why.append("기간 표시 없음")
    if m["len"] < 800:
        sc -= 25; why.append("글이 적음")
    elif m["len"] >= 1500:
        sc += 10
    if m["imgs"] >= 12:
        sc += 10
    elif m["imgs"] < 6:
        sc -= 15; why.append("이미지 적음")
    if m["goods"] >= 60 and m["heads"] < 4:
        sc -= 15; why.append("상품 진열 위주")
    return max(0, min(100, sc)), why


def view() -> list[dict]:
    """마켓별 마지막 확인 결과를 지금 라이브러리와 내용으로 비교한 것 (신규/내용 바뀜/이미 있음/끝남)."""
    db, out = _load(), []
    lib = _library()
    urls = {u for _n, _g, u in lib if u}
    for key, m in MARKETS.items():
        d = db.get(key)
        items, have, ended = [], 0, 0
        common = _common((d or {}).get("items", []))
        for x in (d or {}).get("items", []):
            st, note = _judge(x, lib, urls, common)
            if st == "have":
                have += 1
            elif st == "ended":
                ended += 1
            else:
                sc, why = score(x)
                items.append({"url": x["url"], "title": x["title"], "first_seen": x.get("first_seen", ""), "new": True, "changed": st == "changed", "note": note,
                              "score": sc, "why": why, "low": sc is not None and sc < LOW})
        items.sort(key=lambda x: (x["low"], x["changed"], -(x["score"] if x["score"] is not None else 50), x["title"]))
        out.append({"key": key, "label": m["label"], "at": (d or {}).get("at"), "checked": d is not None, "have": have, "ended": ended,
                    "total": len(items) + have + ended, "new": len(items), "low": sum(1 for x in items if x["low"]), "items": items})
    return out

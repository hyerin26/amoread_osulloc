# -*- coding: utf-8 -*-
"""
링크 한꺼번에 수집 (임시 버튼용): 주소 목록 → 하나씩 내려받아 구좌 나누기·분류까지 자동으로 하고 라이브러리에 추가한다.
- 한 주소의 처리는 가져오기(intake)와 같다: 안전한 내려받기(내부망 차단·5MB·15초) → 구좌 나누기 → 자동 분류 → 추가. 사람이 확인하지 않으므로 라벨은 '자동'으로 표시한다.
- 이미 있는 주소(수집본·직접 추가)는 건너뛴다. 본문이 거의 비어 있는 페이지는 추가하지 않고 이유를 알려 준다.
- 오래 걸리므로 백그라운드 스레드로 돌리고 화면은 진행 상황을 주기적으로 묻는다. 동시에 하나만 돌고(노트북 부담 제한), 한 번에 최대 30개, 주소 사이 1초 쉰다.
- 주소 목록은 planner/data/ai_collect/sources.json에 저장해 다음 수집에도 쓴다. (나중에 매일 아침 자동 수집은 같은 run()을 예약 실행하면 된다)
"""
import json
import threading
import time
import urllib.parse
import uuid
from pathlib import Path

from . import intake, refs

MAX_URLS = 30
PAUSE = 1.0
_lock = threading.Lock()
_jobs: dict[str, dict] = {}


def _dir() -> Path:
    d = refs.AI_DIR.parent / "ai_collect"
    d.mkdir(parents=True, exist_ok=True)
    return d


def normalize(url: str) -> str:
    """같은 페이지인지 비교하려고 주소를 다듬는다 (조각·추적 파라미터·끝 슬래시 제거, 호스트 소문자)."""
    u = urllib.parse.urlsplit(url.strip())
    q = [(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True) if not k.lower().startswith(("utm_", "fbclid", "gclid"))]
    return urllib.parse.urlunsplit((u.scheme.lower(), u.netloc.lower().removeprefix("www."), u.path.rstrip("/"), urllib.parse.urlencode(q), ""))


def known() -> set[str]:
    out: set[str] = set()
    for d in (refs.AI_DIR, refs.USER_DIR):
        try:
            for p in json.loads((d / "pages.json").read_text(encoding="utf-8")).values():
                if p.get("url"):
                    out.add(normalize(p["url"]))
        except (OSError, ValueError):
            pass
    return out


def sources() -> list[str]:
    try:
        return [x for x in json.loads((_dir() / "sources.json").read_text(encoding="utf-8")).get("urls", []) if isinstance(x, str)]
    except (OSError, ValueError):
        return []


def save_sources(urls: list[str]):
    (_dir() / "sources.json").write_text(json.dumps({"urls": urls}, ensure_ascii=False), encoding="utf-8")


def clean_urls(raw: list[str]) -> list[str]:
    seen, out = set(), []
    for x in raw:
        x = (x or "").strip()
        if not x.startswith(("http://", "https://")) or len(x) > 500:
            continue
        n = normalize(x)
        if n not in seen:
            seen.add(n)
            out.append(x)
    return out[:MAX_URLS]


def _one(url: str, have: set[str]) -> dict:
    n = normalize(url)
    if n in have:
        return {"url": url, "status": "skip", "msg": "이미 있어요"}
    try:
        d = intake.preview_url(url)
    except intake.IntakeError as e:
        return {"url": url, "status": "fail", "msg": str(e)}
    except Exception:
        return {"url": url, "status": "fail", "msg": "읽는 중 오류가 났어요"}
    if any("본문이 거의 비어" in w for w in d.get("warnings", [])):
        return {"url": url, "status": "empty", "msg": "본문이 거의 비어 있어요 (브라우저에서 그려야 보이는 페이지). HTML 파일로 추가해 주세요", "name": d["name"]}
    try:
        out = intake.commit(d["draft_id"], {"auto": True})
    except intake.IntakeError as e:
        return {"url": url, "status": "fail", "msg": str(e)}
    have.add(n)
    have.add(normalize(d.get("link") or url))
    msg = f"구좌 {len(d['sections'])}개 · {d.get('cls') or '분류 없음'}"
    try:   # 브라우저 수집 도구가 있으면 CSS·배치까지 받아 둔다 (없거나 실패해도 추가는 그대로)
        from . import recapture, render
        if render.available():
            r = recapture.apply(out["id"], url, force_same=True)
            msg += " · 화면 수집 " + ("완료" if r["status"] == "done" else f"안 됨({r['msg']})")
    except Exception:
        pass
    return {"url": url, "status": "added", "msg": msg, "name": d["name"], "id": out.get("id")}


def _run(job: dict, urls: list[str]):
    have = known()
    try:
        for i, u in enumerate(urls):
            if i:
                time.sleep(PAUSE)
            job["items"].append(_one(u, have))
            job["done"] = i + 1
    finally:
        job["state"] = "done"
        job["ended"] = time.time()
        _lock.release()


def start(raw_urls: list[str]) -> dict:
    urls = clean_urls(raw_urls)
    if not urls:
        raise intake.IntakeError("http(s)로 시작하는 주소를 한 줄에 하나씩 적어 주세요")
    if not _lock.acquire(blocking=False):
        raise intake.IntakeError("이미 수집이 돌고 있어요. 끝난 뒤 다시 눌러 주세요")
    save_sources(urls)
    for k in [k for k, v in _jobs.items() if v["state"] == "done" and time.time() - v.get("ended", 0) > 3600]:
        _jobs.pop(k, None)
    jid = uuid.uuid4().hex[:12]
    job = {"id": jid, "state": "running", "total": len(urls), "done": 0, "items": []}
    _jobs[jid] = job
    threading.Thread(target=_run, args=(job, urls), daemon=True).start()
    return job


def status(jid: str) -> dict | None:
    return _jobs.get(jid)

# -*- coding: utf-8 -*-
"""
레퍼런스 라이브러리 저장소 (2026-11-10) — planner/data/references/

- refs.json: 직접 추가한 레퍼런스, 즐겨찾기, 구독한 핀터레스트 보드
- img/: 담당자가 올린 이미지 파일 (핀터레스트 이미지는 저장하지 않음: plans/21 §4 '이미지는 볼 때 받아 온다')
- 핀터레스트: 공개 보드의 RSS(보드주소.rss)를 읽어 핀 링크·제목·이미지 주소만 받는다. 로그인·토큰 없음 (plans/21 §7 A안).
  밖으로 보내는 것: 보드 주소 요청과 핀 이미지 요청뿐. 사내 데이터(상품·원가·매출·기획안)는 보내지 않는다.
"""
import base64
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

from planner import config

DIR = config.DATA_DIR / "references"
IMG_DIR = DIR / "img"
FILE = DIR / "refs.json"
_lock = threading.Lock()
UA = "Mozilla/5.0 (AMOREAD planner; reference board reader)"
PIN_HOST = re.compile(r"^([a-z]{2}\.|www\.)?pinterest\.(com|co\.kr|co\.uk|jp|de|fr|ca)$")
IMG_HOST = re.compile(r"^i\.pinimg\.com$")
IMG_TYPES = {b"\x89PNG": "png", b"\xff\xd8\xff": "jpg", b"RIFF": "webp", b"GIF8": "gif"}
MAX_IMG = 5 * 1024 * 1024


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _read():
    try:
        d = json.loads(FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        d = {}
    d.setdefault("items", [])
    d.setdefault("favorites", [])
    d.setdefault("boards", [])
    return d


def _write(d):
    DIR.mkdir(parents=True, exist_ok=True)
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(FILE)


def load():
    with _lock:
        return _read()


# ---------- 직접 추가한 레퍼런스 ----------
def save_item(item: dict) -> dict:
    """item: 검증된 dict (api.RefReq). id가 없으면 새로 만든다. 기존 것이면 받은 칸만 바꾼다."""
    with _lock:
        d = _read()
        rid = item.get("id") or ""
        old = next((x for x in d["items"] if x.get("id") == rid), None) if rid else None
        if old:
            old.update({k: v for k, v in item.items() if k != "id"})
            old["updated_at"] = _now()
            out = old
        else:
            out = {**item, "id": f"own{uuid.uuid4().hex[:10]}", "created_at": _now(), "updated_at": _now()}
            d["items"].insert(0, out)
        _write(d)
        return out


def delete_item(rid: str) -> bool:
    with _lock:
        d = _read()
        n = len(d["items"])
        gone = [x for x in d["items"] if x.get("id") == rid]
        d["items"] = [x for x in d["items"] if x.get("id") != rid]
        d["favorites"] = [x for x in d["favorites"] if x != rid]
        _write(d)
    for x in gone:   # 올린 이미지 파일도 지움
        name = (x.get("img_file") or "")
        if re.fullmatch(r"own[0-9a-f]{10}\.(png|jpg|webp|gif)", name):
            try:
                (IMG_DIR / name).unlink()
            except OSError:
                pass
    return len(d["items"]) < n


def set_favorite(rid: str, on: bool) -> list:
    with _lock:
        d = _read()
        fav = [x for x in d["favorites"] if x != rid]
        if on:
            fav.insert(0, rid)
        d["favorites"] = fav[:500]
        _write(d)
        return d["favorites"]


def save_image(rid: str, data_url: str) -> str:
    """data:image/...;base64,... → img/{rid}.{ext}. 파일 머리로 형식 확인, 5MB까지."""
    m = re.fullmatch(r"data:image/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]+)", data_url or "")
    if not m:
        raise ValueError("이미지 파일만 올릴 수 있어요")
    raw = base64.b64decode(m.group(1))
    if len(raw) > MAX_IMG:
        raise ValueError("5MB가 넘는 이미지는 올릴 수 없어요")
    ext = next((e for sig, e in IMG_TYPES.items() if raw.startswith(sig)), None)
    if not ext:
        raise ValueError("PNG·JPG·WEBP·GIF 이미지만 올릴 수 있어요")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{rid}.{ext}"
    (IMG_DIR / name).write_bytes(raw)
    with _lock:
        d = _read()
        for x in d["items"]:
            if x.get("id") == rid:
                x["img_file"] = name
        _write(d)
    return name


def image_path(name: str):
    if not re.fullmatch(r"own[0-9a-f]{10}\.(png|jpg|webp|gif)", name or ""):
        return None
    p = IMG_DIR / name
    return p if p.exists() else None


# ---------- 핀터레스트 공개 보드 (RSS) ----------
def board_rss(url: str):
    """보드·프로필 주소 → (정리한 보드 주소, RSS 주소). 핀터레스트 주소가 아니면 ValueError."""
    u = urllib.parse.urlsplit((url or "").strip())
    if u.scheme not in ("http", "https") or not PIN_HOST.match((u.hostname or "").lower()):
        raise ValueError("핀터레스트 보드 주소를 넣어 주세요 (예: https://www.pinterest.com/아이디/보드이름/)")
    parts = [p for p in u.path.split("/") if p]
    if parts and parts[-1].endswith(".rss"):
        parts[-1] = parts[-1][:-4]
        if parts[-1] == "feed":
            parts = parts[:-1]
    if not parts or parts[0] in ("pin", "search", "ideas", "today") or len(parts) > 2:
        raise ValueError("보드 주소를 넣어 주세요. 핀 하나(…/pin/숫자)나 검색 주소는 구독할 수 없어요")
    base = "https://www.pinterest.com/" + "/".join(urllib.parse.quote(p) for p in parts) + "/"
    rss = base[:-1] + (".rss" if len(parts) == 2 else "/feed.rss")
    return base, rss


_cache = {}   # rss → (받은 시각, 결과)


def fetch_board(url: str, fresh: bool = False):
    base, rss = board_rss(url)
    hit = _cache.get(rss)
    if hit and not fresh and time.time() - hit[0] < 3600:
        return hit[1]
    req = urllib.request.Request(rss, headers={"User-Agent": UA, "Accept": "application/rss+xml, text/xml"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            body = r.read(3_000_000)
    except urllib.error.HTTPError as e:
        raise ValueError("보드를 찾지 못했어요. 공개 보드 주소인지 확인해 주세요" if e.code == 404 else f"핀터레스트가 응답하지 않았어요 ({e.code})")
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ValueError("핀터레스트에 연결하지 못했어요. 사내망에서 막혔을 수 있어요")
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        raise ValueError("보드 내용을 읽지 못했어요 (RSS가 아님)")
    ch = root.find("channel")
    if ch is None:
        raise ValueError("보드 내용을 읽지 못했어요")
    name = (ch.findtext("title") or "").strip()[:80]
    pins = []
    for it in ch.findall("item")[:60]:
        link = (it.findtext("link") or "").strip()
        m = re.search(r"/pin/(\d{5,25})/?", link)
        if not m:
            continue
        desc = it.findtext("description") or ""
        img = re.search(r'src="(https://i\.pinimg\.com/[^"]+)"', desc)
        text = re.sub(r"<[^>]+>", " ", desc)
        text = re.sub(r"\s+", " ", text).strip()
        pins.append({"pin_id": m.group(1), "link": f"https://www.pinterest.com/pin/{m.group(1)}/",
                     "title": ((it.findtext("title") or "").strip() or text)[:120],
                     "img": img.group(1).replace("/236x/", "/474x/") if img else "",
                     "date": (it.findtext("pubDate") or "")[:16], "board": base, "board_name": name})
    out = {"board": base, "name": name, "pins": pins}
    _cache[rss] = (time.time(), out)
    return out


def add_board(url: str):
    res = fetch_board(url, fresh=True)   # 받아 보고 되면 저장
    with _lock:
        d = _read()
        d["boards"] = [b for b in d["boards"] if b.get("url") != res["board"]]
        d["boards"].insert(0, {"url": res["board"], "name": res["name"], "added_at": _now(), "last_ok": _now(), "pins": len(res["pins"]), "error": ""})
        d["boards"] = d["boards"][:30]
        _write(d)
    return res


def remove_board(url: str):
    with _lock:
        d = _read()
        d["boards"] = [b for b in d["boards"] if b.get("url") != url]
        _write(d)
        return d["boards"]


def all_pins():
    """구독한 보드의 핀 (보드마다 1시간 캐시). 실패한 보드는 error로 남기고 나머지는 보여 줌."""
    boards = load()["boards"]
    pins, state = [], []
    for b in boards:
        try:
            r = fetch_board(b["url"])
            pins.extend(r["pins"])
            state.append({**b, "error": "", "pins": len(r["pins"])})
        except ValueError as e:
            state.append({**b, "error": str(e)})
    return {"boards": state, "pins": pins}


_img_cache = {}


def pin_image(u: str):
    """핀 이미지 한 장을 받아 그대로 돌려줌 (저장하지 않음, 메모리에 잠깐 200장). i.pinimg.com만."""
    p = urllib.parse.urlsplit(u or "")
    if p.scheme != "https" or not IMG_HOST.match(p.hostname or ""):
        raise ValueError("허용되지 않은 이미지 주소예요")
    if u in _img_cache:
        return _img_cache[u]
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=12) as r:
        body = r.read(MAX_IMG + 1)
        ctype = r.headers.get("Content-Type", "image/jpeg")
    if len(body) > MAX_IMG or not ctype.startswith("image/"):
        raise ValueError("이미지를 받지 못했어요")
    if len(_img_cache) > 200:
        _img_cache.pop(next(iter(_img_cache)))
    _img_cache[u] = (body, ctype)
    return body, ctype

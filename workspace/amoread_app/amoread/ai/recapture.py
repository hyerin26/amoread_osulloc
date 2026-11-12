# -*- coding: utf-8 -*-
"""
이미 추가된 레퍼런스를 화면 수집으로 다시 받는다 (CSS·배치 포함). 링크를 따라가서 **아직 같은 프로모션이면** 모양 정보를 채우고,
바뀌었거나 사라졌으면 덮어쓰지 않고 상태만 남긴다 (예전 저장본·글·라벨은 그대로).

- 같은 프로모션인지: 예전에 저장한 글(색인)의 2글자 조각이 새 페이지 글에 얼마나 들어 있는지(포함률)로 본다. 50% 이상이면 같다.
- 결과: planner/data/ai_collect/recapture.json (레퍼런스 id → 상태·시각·사유). 상태: done(채움) / changed(내용이 바뀜) / gone(없어짐) / fail(열지 못함) / skip
- 한 번에 한 페이지, 페이지 사이 PAUSE초 쉰다. 이미 채운 것은 건너뛴다(--force로 다시).
usage: python -m amoread.ai.recapture [--limit N] [--ids own..,own..] [--pause 3] [--force]
"""
import argparse
import json
import re
import time
import urllib.parse
from datetime import datetime

from .. import references
from . import collect, render, refs

SAME = 0.5
# 프로모션이 끝났거나 사라졌을 때 사이트가 보여 주는 흔한 안내 (예전 글에 없던 것이 새로 나타나면 '없어짐'으로 본다)
ENDED = re.compile(r"이벤트\s*기간이\s*아닙|종료된\s*(이벤트|기획전|프로모션|페이지)|종료되었|마감되었|존재하지\s*않는|삭제된|찾을\s*수\s*없|페이지를\s*찾|잘못된\s*(접근|주소)|진행\s*중인\s*(이벤트|기획전)이\s*없")


def _rows(rid: str) -> list[dict]:
    f = refs.USER_DIR / "sections.jsonl"
    try:
        return [r for r in (json.loads(x) for x in f.read_text(encoding="utf-8").splitlines() if x.strip()) if r["page_id"] == rid]
    except OSError:
        return []


def _grams(s: str) -> set:
    s = re.sub(r"\s+", "", s)
    return {s[i:i + 2] for i in range(len(s) - 1)}


def same_promotion(old_text: str, new_text: str) -> float:
    a, b = _grams(old_text), _grams(new_text)
    return len(a & b) / len(a) if a else 0.0


def _report() -> dict:
    try:
        return json.loads((collect._dir() / "recapture.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write_report(d: dict):
    (collect._dir() / "recapture.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


def apply(rid: str, url: str, force_same: bool = False, changed_ok: bool = False) -> dict:
    """한 레퍼런스를 다시 받아 같은 프로모션이면 저장한다. {status, ...}"""
    rows = _rows(rid)
    res = render.capture(url)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    if not res["ok"]:
        return {"status": "gone" if res.get("gone") else "fail", "msg": res["reason"], "at": now}
    old = " ".join(r["text"] for r in rows)
    m = ENDED.search(res["text"])
    if m and not ENDED.search(old):
        return {"status": "gone", "msg": f"끝났거나 사라진 것 같아요 (페이지 안내: \"{m.group(0)}\")", "at": now}
    a, b = urllib.parse.urlsplit(url), urllib.parse.urlsplit(res["final_url"])
    if len(a.path.strip("/")) > 3 and not b.path.strip("/") and not a.query:   # 깊은 주소가 첫 화면으로 돌려보내졌다
        return {"status": "gone", "msg": "첫 화면으로 돌아갔어요 (없어진 페이지)", "at": now}
    sc = same_promotion(old, res["text"]) if old else 1.0
    if not force_same and not changed_ok and sc < SAME:
        return {"status": "changed", "msg": f"내용이 달라졌어요 (겹침 {int(sc * 100)}%)", "overlap": round(sc, 2), "at": now}
    meta = render.save(rid, res, rows)
    lay = meta["layout"]
    changed = sc < SAME and not force_same   # 같은 주소지만 내용(상품 목록 등)이 갱신된 페이지 → 화면은 새 것, 구좌 제목·글은 예전 수집분
    references.save_item({"id": rid, "layout": {"ph": lay["ph"], "vw": lay["vw"], "bands": lay["bands"]}, "captured_at": meta["captured_at"], "rendered": True, "content_changed": changed})
    return {"status": "done", "msg": f"띠 {len(lay['bands'])}개 · CSS {meta['css_files']}개 · {meta['html_bytes'] // 1024}KB" + (f" · 내용 갱신됨(겹침 {int(sc * 100)}%)" if changed else ""), "overlap": round(sc, 2), "changed": changed, "at": now}


def run(limit: int = 0, ids: list[str] | None = None, pause: float = 3.0, force: bool = False, accept_changed: bool = False):
    items = [x for x in references.load()["items"] if x.get("link") and (x.get("migrated") or x.get("from_intake") or x.get("source") == "직접 추가") and x.get("kind") == "page"]
    if ids:
        items = [x for x in items if x["id"] in ids]
    rep = _report()
    todo = [x for x in items if force or rep.get(x["id"], {}).get("status") != "done"]
    if accept_changed:   # 내용이 달라졌다고 건너뛴 것만 (사라진 것·열리지 않은 것은 제외)
        todo = [x for x in todo if rep.get(x["id"], {}).get("status") == "changed"]
    if limit:
        todo = todo[:limit]
    print(f"대상 {len(todo)}개 (전체 {len(items)}개)", flush=True)
    for i, x in enumerate(todo, 1):
        t = time.time()
        try:
            r = apply(x["id"], x["link"], changed_ok=accept_changed)
        except Exception as e:
            r = {"status": "fail", "msg": f"오류: {type(e).__name__}", "at": datetime.now().strftime("%Y-%m-%d %H:%M")}
        r["name"] = x["name"]
        rep = _report()
        rep[x["id"]] = r
        _write_report(rep)
        print(f"[{i}/{len(todo)}] {r['status']:7} {x['name'][:30]} · {r['msg']} ({time.time() - t:.0f}s)", flush=True)
        time.sleep(pause)
    rep = _report()
    from collections import Counter
    print("결과:", dict(Counter(v["status"] for v in rep.values())), flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--pause", type=float, default=3.0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--accept-changed", action="store_true", help="내용이 달라졌다고 건너뛴 것(같은 주소)도 새 화면으로 채운다 (구좌 제목·글은 예전 수집분 그대로, content_changed 표시)")
    a = ap.parse_args()
    run(a.limit, [x for x in a.ids.split(",") if x], a.pause, a.force, a.accept_changed)

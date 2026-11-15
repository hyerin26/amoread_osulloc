# -*- coding: utf-8 -*-
"""
수집본 일괄 전환: 처음에 색인으로 넣어 둔 수집본 페이지(읽기 전용)를 '직접 추가' 레퍼런스와 같은 저장 방식으로 옮긴다.
옮기고 나면 고치기·삭제·라벨 수정·수집당시 화면이 새로 추가한 레퍼런스와 똑같이 동작한다.

- 원본 색인 파일(ai_refs/*)은 건드리지 않는다. 옮긴 페이지는 삭제 목록(hidden.json)에 적어 원본 쪽을 가리고, 같은 내용을 사용자 색인(ai_refs_user)과 레퍼런스 저장소(references/refs.json)에 새로 만든다.
- 검색에 쓰이는 값(브랜드·역할·글)은 그대로라 검색 결과는 같다. 구좌 id는 `orig_id`에 원래 값을 남겨 평가 라벨과 이어진다.
- 여러 번 돌려도 안전(이미 옮긴 페이지는 건너뜀). `--undo`로 전부 되돌린다.
usage: python -m amoread.ai.migrate [--undo]
"""
import argparse
import json
import shutil
from datetime import date

from .. import references
from . import intake, refs

MAP = refs.USER_DIR / "migrated.json"   # {원래 페이지 id: 새 레퍼런스 id}


def _read_map() -> dict:
    try:
        return json.loads(MAP.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def run() -> dict:
    A = refs.AI_DIR
    pages = json.loads((A / "pages.json").read_text(encoding="utf-8"))
    labels = json.loads((A / "page_labels.json").read_text(encoding="utf-8"))
    rows = [json.loads(x) for x in (A / "sections.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    by: dict[str, list[dict]] = {}
    for r in rows:
        by.setdefault(r["page_id"], []).append(r)
    done, hid = _read_map(), refs.hidden()
    new_rows, new_pages, new_labels, n = [], {}, {}, 0
    for pid, pg in pages.items():
        lb = labels.get(pid)
        if pid in done or pid in hid or not lb:
            continue
        rs = sorted(by.get(pid, []), key=lambda r: int(r.get("order") or 0))
        if not rs:
            continue
        frm = refs.BRAND_FROM.get(pg["brand"], "외부")
        item = {"kind": "page", "kind_label": "", "name": pg["name"], "season": lb["season"], "cls": lb["cls"], "source": "수집본", "link": pg.get("url", ""),
                "pts": [], "tags": [], "memo": "", "ben": lb["ben"], "secs": pg["secs"], "shape": [r["role"] for r in rs][:40],
                "shape_x": [{"r": r["role"], "l": len(r.get("text") or ""), "i": len(r["images"]) if isinstance(r.get("images"), list) else int(r.get("images") or 0),
                             "t": (r.get("title") or "")[:20]} for r in rs][:40],
                "mode": (lb["mode"] or [""])[0] if isinstance(lb["mode"], list) else (lb["mode"] or ""),
                "ai_type": lb["type"], "migrated": True, "from_label": frm, "brand": pg["brand"], "orig_id": pid}
        rid = references.save_item(item)["id"]
        done[pid] = rid
        for r in rs:
            new_rows.append({**r, "id": f"{rid}:{r['id'].split(':', 1)[-1]}", "page_id": rid, "orig_id": r["id"]})
        new_pages[rid] = {**pg, "own": rid, "orig_id": pid, "collected_at": pg.get("collected_date") or date.today().isoformat()}
        new_labels[rid] = lb
        src = A / "html" / f"{pid}.html.gz"
        if src.exists():
            (refs.USER_DIR / "html").mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, refs.USER_DIR / "html" / f"{rid}.html.gz")
        n += 1
    if n:
        U = refs.USER_DIR
        U.mkdir(parents=True, exist_ok=True)
        secf = U / "sections.jsonl"
        keep = [json.loads(x) for x in secf.read_text(encoding="utf-8").splitlines() if x.strip()] if secf.exists() else []
        secf.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in keep + new_rows) + "\n", encoding="utf-8")
        for f, add in ((U / "pages.json", new_pages), (U / "page_labels.json", new_labels)):
            cur = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
            f.write_text(json.dumps({**cur, **add}, ensure_ascii=False), encoding="utf-8")
        refs.HIDDEN.write_text(json.dumps(sorted(hid | {p for p in done if p in pages}), ensure_ascii=False), encoding="utf-8")
        MAP.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    return {"migrated": n, "total_moved": len(done)}


def undo() -> dict:
    done = _read_map()
    for pid, rid in done.items():
        references.delete_item(rid)
        intake.remove(rid)
        refs.set_hidden(pid, False)
    try:
        MAP.unlink()
    except OSError:
        pass
    return {"restored": len(done)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--undo", action="store_true", help="전환을 되돌린다 (옮긴 항목을 지우고 원본 색인을 다시 보이게)")
    print(undo() if ap.parse_args().undo else run())

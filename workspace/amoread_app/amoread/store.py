# -*- coding: utf-8 -*-
"""
통합 기획안 저장소 — planner/data/projects/{id}.json

- 기획안 1개 = 브리프(명분·컨셉·기간…) + 할인 행(promo_rows, 기존 PLAN_ROW_FIELDS 그대로) + 페이지(섹션, 없으면 null)
- 기존 기획 도우미 기획안(planner/data/plans)은 읽기만 한다 (가져오기 = 새 통합 기획안 생성).
- 원천 파일(PROMO_WORK 등)에는 쓰지 않는다.
"""
import json
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path

from planner import config, engine

PROJECTS_DIR = config.DATA_DIR / "projects"
SCHEMA_VERSION = 1
_ID = re.compile(r"^[0-9a-f]{32}$")
STATUS_LABEL = {"planning": "기획 중", "confirmed": "확정", "reflected": "PROMO_WORK 반영됨"}


def valid_id(pid) -> bool:
    return bool(_ID.match(str(pid or "")))


def _path(pid: str) -> Path:
    if not valid_id(pid):
        raise ValueError("잘못된 기획안 ID")
    return PROJECTS_DIR / f"{pid}.json"


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _read(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def summary(d: dict) -> dict:
    b = d.get("brief") or {}
    rows = d.get("promo_rows") or []
    page = d.get("page") or None
    return {"id": d.get("id"), "title": d.get("title") or "제목 없는 기획안", "status": d.get("status") or "planning",
            "myeongbun": b.get("myeongbun") or "", "concept": b.get("concept") or "", "period": b.get("period"),
            "page_kind": b.get("page_kind") or "이벤트", "origin": (d.get("origin") or {}).get("type") or "",
            "rows": len(rows), "deal_rows": sum(1 for r in rows if r.get("type") == "하루특가"),
            "sections": len((page or {}).get("sections") or []) if page else None,
            "updated_at": d.get("updated_at"), "created_at": d.get("created_at"),
            "cls": (d.get("v2") or {}).get("cls") or "", "stage": (d.get("v2") or {}).get("stage") or ""}


def list_projects() -> list:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for p in PROJECTS_DIR.glob("*.json"):
        d = _read(p)
        if d and valid_id(d.get("id")):
            out.append(summary(d))
    return sorted(out, key=lambda x: x.get("updated_at") or "", reverse=True)


def load(pid: str) -> dict:
    d = _read(_path(pid))
    if d is None:
        raise FileNotFoundError(pid)
    return d


def _keep_section_v2(page, prev_page):
    """예전 화면은 구좌의 v2(새 버전 편집 값)를 보내지 않는다 → 같은 sectionId의 저장된 v2를 이어 붙인다."""
    if not page or not prev_page:
        return page
    old = {s.get("sectionId"): s.get("v2") for s in prev_page.get("sections") or []}
    for s in page.get("sections") or []:
        if s.get("v2") is None and old.get(s.get("sectionId")) is not None:
            s["v2"] = old[s.get("sectionId")]
    return page


class Conflict(Exception):
    """화면이 가진 updated_at(base_updated_at)이 저장된 값과 다름 = 그 사이 다른 화면이 저장함."""
    def __init__(self, updated_at):
        super().__init__(updated_at)
        self.updated_at = updated_at


_SAVE_LOCK = threading.Lock()   # 확인(prev 읽기)과 쓰기 사이에 다른 저장이 끼지 않게


def save(doc: dict) -> dict:
    """doc: 검증된 요청 dict(api.ProjectReq.model_dump()). id가 없거나 형식이 틀리면 새로 만든다.
    base_updated_at을 보냈고 저장된 기획안의 updated_at과 다르면 Conflict (저장하지 않음).
    shortcut: updated_at이 초 단위라 같은 1초 안에 두 화면이 저장하면 못 잡는다. 동시 사용자가 늘면 버전 번호로 바꾼다."""
    with _SAVE_LOCK:
        return _save(doc)


def _save(doc: dict) -> dict:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    pid = doc.get("id") if valid_id(doc.get("id")) else uuid.uuid4().hex
    prev = _read(_path(pid)) or {}
    base = doc.get("base_updated_at")
    if base and prev and prev.get("updated_at") != base:
        raise Conflict(prev.get("updated_at"))
    out = {
        "schema_version": SCHEMA_VERSION, "id": pid,
        "title": str(doc.get("title") or "").strip()[:80] or "제목 없는 기획안",
        "status": doc.get("status") if doc.get("status") in STATUS_LABEL else "planning",
        "origin": doc.get("origin") or prev.get("origin") or {"type": "brief", "ref": ""},
        "brief": doc.get("brief") or {},
        "promo_rows": [{k: r.get(k) for k in engine.PLAN_ROW_FIELDS} for r in (doc.get("promo_rows") or [])][:500],
        "deal_plan": doc.get("deal_plan"),   # 하루특가 설정 (하루 자리 수, 후보 상품). 없으면 null
        "pool": (doc.get("pool") or [])[:100],   # 후보 상품 (역할 미정)
        "page": _keep_section_v2(doc.get("page"), prev.get("page")),
        "v2": doc.get("v2") if doc.get("v2") is not None else prev.get("v2"),   # 새 버전 값: 예전 화면이 저장해도 지워지지 않게
        # 신규 구좌편집기 값: 보내지 않는 화면(예전 화면 등)이 저장해도 지워지지 않게
        "editor_next": doc.get("editor_next") if doc.get("editor_next") is not None else prev.get("editor_next"),
        "links": doc.get("links") or prev.get("links") or {"legacy_plan_id": None, "promo_work_keys": []},
        "snapshot": prev.get("snapshot"),
        "rationale": str(doc.get("rationale") or "")[:20000],
        "created_at": prev.get("created_at") or _now(), "updated_at": _now(),
    }
    tmp = _path(pid).with_suffix(".tmp")
    tmp.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_path(pid))
    return out


def write_raw(doc: dict) -> dict:
    """확정처럼 서버가 만든 값(snapshot, status)을 그대로 저장. 저장 형식은 save와 같고 updated_at만 갱신."""
    doc["updated_at"] = _now()
    tmp = _path(doc["id"]).with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_path(doc["id"]))
    return doc


def delete(pid: str) -> None:
    p = _path(pid)
    if p.exists():
        p.unlink()


def from_legacy(plan: dict) -> dict:
    """기존 기획 도우미 기획안 → 통합 기획안 초안 (저장 전 dict). 원본 기획안은 바꾸지 않는다."""
    bm = plan.get("brief_meta") or {}
    rows = plan.get("rows") or []
    dates = sorted(d for r in rows for d in (r.get("start"), r.get("end") or r.get("start")) if d)
    return {
        "title": plan.get("title") or "가져온 기획안", "status": "planning",
        "origin": {"type": "legacy", "ref": str(plan.get("id") or "")[:120]},
        "brief": {"myeongbun": bm.get("myeongbun") or "", "concept": bm.get("concept") or "",
                  "customer": bm.get("customer") or "", "target": bm.get("target") or "",
                  "purpose": "", "audience": "", "background": str(plan.get("brief") or "")[:2000], "constraints": "",
                  "benefits_note": "", "period": {"start": dates[0], "end": dates[-1]} if dates else None,
                  "page_kind": "이벤트", "season_ref": None},
        "promo_rows": rows, "page": None,
        "links": {"legacy_plan_id": plan.get("id") if valid_id(plan.get("id")) else None, "promo_work_keys": []},
        "rationale": plan.get("rationale") or "",
    }

# -*- coding: utf-8 -*-
"""기획안 저장: 동시 수정 충돌(409)과 신규 편집기 값(editor_next) 보존. 실제 planner/data/projects는 건드리지 않는다."""
import pytest

from amoread import store


@pytest.fixture(autouse=True)
def tmp_projects(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "PROJECTS_DIR", tmp_path)


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    n = iter(range(1, 60))
    monkeypatch.setattr(store, "_now", lambda: f"2026-01-01 00:00:{next(n):02d}")


def test_save_without_base_keeps_old_behaviour():
    a = store.save({"title": "a"})
    b = store.save({"id": a["id"], "title": "b"})   # 예전 클라이언트: base 없이 저장 → 그대로 덮어씀
    assert b["title"] == "b"


def test_stale_base_is_rejected_and_file_unchanged():
    a = store.save({"title": "a"})
    store.save({"id": a["id"], "title": "other tab", "base_updated_at": a["updated_at"]})
    with pytest.raises(store.Conflict) as e:
        store.save({"id": a["id"], "title": "stale tab", "base_updated_at": a["updated_at"]})
    assert e.value.updated_at == store.load(a["id"])["updated_at"] != a["updated_at"]
    assert store.load(a["id"])["title"] == "other tab"


def test_matching_base_saves():
    a = store.save({"title": "a"})
    b = store.save({"id": a["id"], "title": "b", "base_updated_at": a["updated_at"]})
    assert b["title"] == "b"


def test_editor_next_survives_saves_that_do_not_send_it():
    snap = {"schema": "amoread-editor-next", "version": 1, "snapshot": {"sections": [{"id": "s1", "layout": "hero"}]}}
    a = store.save({"title": "a", "editor_next": snap})
    store.save({"id": a["id"], "title": "legacy screen save", "page": {"sections": []}})   # 기존 편집기 저장
    d = store.load(a["id"])
    assert d["editor_next"] == snap
    assert d["page"] == {"sections": []}   # 기존 편집기 데이터는 별도로 유지


def test_api_model_limits_editor_next_size():
    from amoread.api import ProjectReq
    with pytest.raises(ValueError):
        ProjectReq(editor_next={"x": "가" * 1_600_000})
    assert ProjectReq(editor_next={"x": 1}, base_updated_at="2026-01-01 00:00:01").editor_next == {"x": 1}


# ---- 2026-11-17 리뷰에서 고친 것 ----
def test_unreadable_file_is_not_overwritten(monkeypatch):
    """파일은 있는데 못 읽으면(백신·동기화가 잡고 있음, 반쪽 파일) 새 기획안처럼 덮어쓰지 않는다 → 확정본·편집기 값이 지켜진다."""
    monkeypatch.setattr(store.time, "sleep", lambda s: None)
    a = store.save({"title": "a", "editor_next": {"snapshot": {"sections": []}}})
    store._path(a["id"]).write_text("{반쪽", encoding="utf-8")
    with pytest.raises(store.Unreadable):
        store.save({"id": a["id"], "title": "b", "base_updated_at": a["updated_at"]})
    assert store._path(a["id"]).read_text(encoding="utf-8") == "{반쪽"


def test_deleted_plan_is_not_revived_by_a_late_autosave():
    a = store.save({"title": "a"})
    store.delete(a["id"])
    with pytest.raises(store.Conflict):
        store.save({"id": a["id"], "title": "늦게 온 자동 저장", "base_updated_at": a["updated_at"]})
    assert not store._path(a["id"]).exists()


def test_update_keeps_edits_saved_meanwhile():
    """확정(update)은 지금 파일 위에 snapshot·status만 얹는다 → 확정 계산 중 다른 탭이 저장한 수정이 남는다."""
    a = store.save({"title": "a"})
    store.save({"id": a["id"], "title": "다른 탭 수정", "base_updated_at": a["updated_at"]})
    d = store.update(a["id"], {"snapshot": {"rows": []}, "status": "confirmed"})
    assert d["title"] == "다른 탭 수정" and d["status"] == "confirmed" and d["snapshot"] == {"rows": []}
    assert not list(store.PROJECTS_DIR.glob("*.tmp")), "임시 파일이 남지 않는다"

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

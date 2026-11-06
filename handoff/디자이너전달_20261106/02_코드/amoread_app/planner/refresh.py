# -*- coding: utf-8 -*-
"""
데이터 갱신(백그라운드)·새 온라인 가이드 올리기·보자기 본품 지정 저장.
"""
import csv
import io
import re
import threading
import zipfile
from datetime import datetime
from pathlib import Path

from . import build, config, sources

_state = {"running": False, "log": [], "started_at": None, "finished_at": None, "ok": None}
_lock = threading.Lock()


def status():
    with _lock:
        return dict(_state, log=list(_state["log"][-30:]))


def start_rebuild(use_cache=True):
    with _lock:
        if _state["running"]:
            return False
        _state.update(running=True, log=[], started_at=datetime.now().strftime("%H:%M:%S"), finished_at=None, ok=None)

    def log(msg):
        with _lock:
            _state["log"].append(str(msg))

    def run():
        ok = False
        try:
            build.build(use_cache=use_cache, log=log)
            ok = True
        except Exception as e:  # 화면에 원인만 짧게 보여준다 (스택트레이스 비노출)
            log(f"[오류] {type(e).__name__}: {e}")
        finally:
            with _lock:
                _state.update(running=False, ok=ok, finished_at=datetime.now().strftime("%H:%M:%S"))

    threading.Thread(target=run, daemon=True).start()
    return True


# ----------------------------------------------------------------------
# 새 온라인 가이드(상품장) 올리기 — 보안 가이드 WEB-57: 확장자 화이트리스트 + 파일 헤더 + 크기 + 경로 필터
# ----------------------------------------------------------------------
class UploadError(Exception):
    pass


def save_guide_upload(filename: str, data: bytes) -> dict:
    name = Path(str(filename or "")).name  # 경로 성분 제거 ('..', '/', '\\')
    if not name.lower().endswith(".xlsx"):
        raise UploadError("xlsx 파일만 올릴 수 있습니다.")
    if len(data) > config.GUIDE_UPLOAD_MAX_MB * 1024 * 1024:
        raise UploadError(f"파일이 너무 큽니다 (최대 {config.GUIDE_UPLOAD_MAX_MB}MB).")
    if not data.startswith(b"PK\x03\x04"):
        raise UploadError("엑셀(xlsx) 파일 형식이 아닙니다.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if "xl/workbook.xml" not in z.namelist():
                raise UploadError("엑셀(xlsx) 파일 형식이 아닙니다.")
    except zipfile.BadZipFile:
        raise UploadError("파일이 손상되었습니다.")
    safe = re.sub(r"[^0-9A-Za-z가-힣★()._\- ]+", "_", name)[:120]
    config.GUIDE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dst = config.GUIDE_UPLOAD_DIR / f"{datetime.now():%Y%m%d_%H%M%S}_{safe}"
    dst.write_bytes(data)
    try:
        df, sheet, _ = sources.load_cost_sheet(dst)
    except sources.SourceError as e:
        dst.unlink(missing_ok=True)
        raise UploadError(f"상품장 시트를 읽지 못했습니다: {e}")
    return {"file": dst.name, "sheet": sheet, "sap_count": int(df["cost"].notna().sum())}


def guide_files():
    out = []
    for i, p in enumerate(sources.guide_candidates()):
        out.append({"name": p.name, "folder": "웹 업로드" if p.parent == config.GUIDE_UPLOAD_DIR else "기본 폴더",
                    "modified": datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M"), "in_use": i == 0})
    return out


# ----------------------------------------------------------------------
# 보자기 본품 지정
# ----------------------------------------------------------------------
def read_wrap_overrides():
    path = config.WRAP_OVERRIDE_CSV
    if not path.exists():
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    return [{"wrap_seq": r[0], "base_seq": r[1], "memo": r[2] if len(r) > 2 else ""} for r in rows[1:] if len(r) >= 2]


def save_wrap_overrides(items):
    clean = []
    for it in items[:300]:
        a, b = str(it.get("wrap_seq", "")).strip(), str(it.get("base_seq", "")).strip()
        if a.isdigit() and b.isdigit():
            clean.append([a, b, str(it.get("memo") or "")[:100]])
    config.SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.WRAP_OVERRIDE_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["보자기SEQ", "본품SEQ", "메모"])
        w.writerows(clean)
    return len(clean)

# -*- coding: utf-8 -*-
"""
공유 Excel 안전 접근 유틸.

원칙
- 원본(특히 OneDrive 공유 .xlsm)은 직접 열지 않는다. 임시 폴더로 스냅샷 복사 후 그 사본만 읽는다.
  -> AMD가 Excel/웹에서 편집 중이어도 잠금 충돌이 없고, 실수로 원본을 저장할 경로 자체가 없다.
- 이 모듈에는 '원본에 쓰기' 함수가 없다. (openpyxl로 .xlsm을 저장하면 동적배열 수식(LET/FILTER),
  데이터 유효성 확장, 공동편집 시트뷰 등이 손상된다 — docs/ARCHITECTURE.md 참고)
"""
import shutil
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path


class WorkbookAccessError(Exception):
    pass


def describe_source(path: Path) -> dict:
    """스냅샷 대상 파일의 상태(수정시각, 누군가 열어둔 흔적)를 반환한다."""
    path = Path(path)
    if not path.exists():
        raise WorkbookAccessError(f"파일을 찾을 수 없습니다: {path}")
    stat = path.stat()
    lock_file = path.with_name("~$" + path.name)
    return {
        "path": str(path),
        "modified_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "size": stat.st_size,
        "opened_locally": lock_file.exists(),  # 이 PC의 Excel에서 열려있음(미저장 변경 가능)
    }


@contextmanager
def snapshot(path: Path, retries: int = 3, wait_sec: float = 2.0):
    """원본을 임시 폴더로 복사해 그 경로를 넘겨주고, 끝나면 사본을 지운다."""
    path = Path(path)
    describe_source(path)
    tmp_dir = Path(tempfile.mkdtemp(prefix="osulloc_ops_"))
    dst = tmp_dir / ("snapshot" + path.suffix)
    last_err = None
    for _ in range(retries):
        try:
            shutil.copy2(path, dst)
            break
        except (PermissionError, OSError) as e:  # OneDrive 동기화 중 일시 잠금 등
            last_err = e
            time.sleep(wait_sec)
    else:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise WorkbookAccessError(f"파일 복사 실패(동기화/잠금 중일 수 있음): {last_err}")
    try:
        yield dst
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

# -*- coding: utf-8 -*-
"""
데이터 스냅샷 내보내기·불러오기: 레퍼런스 데이터를 zip 하나로 묶어 공유 폴더(OneDrive·SharePoint 동기화 폴더 등)에 두고, 다른 PC에서 풀어 쓴다.

구조: 수집·처리(쓰기)는 한 PC(수집 담당)에서만 하고, 다른 사람은 스냅샷을 받아 읽기만 한다 (DB 없이 파일만 쓰는 환경용).
- 담기는 것: 수집 색인(ai_refs), 사용자 색인·화면 수집본(ai_refs_user), 직접 추가한 레퍼런스 목록(references/refs.json), 수집 설정·기록(ai_collect).
  이미지 파일·임시 초안(intake)·기획안(plans)·프로젝트는 담지 않는다.
- 경로: zip 안에는 data 폴더 기준 상대경로만 있다. 데이터 파일 안에는 이 PC의 절대경로가 없어서 어느 PC에 풀어도 된다.
- 안전: 공유 폴더에는 임시 이름으로 쓴 뒤 다 쓰면 이름을 바꿔 한 번에 나타나게 한다(동기화 중 반쯤 쓴 파일을 남이 받지 않도록). 불러올 때는 파일별 해시를 확인하고, 현재 데이터는 먼저 data/_backup/ 에 복사해 둔다. zip 안의 경로가 허용 목록 밖이면 거부한다.
- 설정: 공유 폴더 경로는 코드에 박지 않고 환경변수 AMOREAD_SNAPSHOT_DIR 또는 --out 으로 받는다 (사람마다 동기화 폴더 경로가 다르다).

사용
  python -m amoread.ai.snapshot_pack export [--out 폴더] [--keep 14]
  python -m amoread.ai.snapshot_pack list   [--dir 폴더]
  python -m amoread.ai.snapshot_pack import [파일.zip | 폴더(가장 최근 것)] [--yes]
"""
import argparse
import hashlib
import json
import os
import platform
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from . import collect, refs

PREFIX = "amoread_snapshot_"
VERSION = 1


def _data() -> Path:
    return refs.AI_DIR.parent   # planner/data


def _items() -> list[tuple[Path, str]]:
    """(파일 경로, zip 안 상대경로). 담을 폴더/파일을 data 기준 상대경로로 정한다."""
    d = _data()
    out = []
    roots = [refs.AI_DIR, refs.USER_DIR, collect._dir()]
    for r in roots:
        if r.is_dir():
            for f in sorted(r.rglob("*")):
                if f.is_file() and not f.name.startswith("."):
                    out.append((f, _rel(f, d)))
    from .. import references
    if references.FILE.is_file():
        out.append((references.FILE, _rel(references.FILE, d)))
    return out


def _rel(f: Path, base: Path) -> str:
    try:
        return f.resolve().relative_to(base.resolve()).as_posix()
    except ValueError:   # AMOREAD_AI_USER_DIR 등으로 data 밖에 둔 경우: 폴더 이름부터 써서 data 안으로 푼다
        r = next((x for x in (refs.AI_DIR, refs.USER_DIR, collect._dir()) if x.resolve() in f.resolve().parents), f.parent)
        return f"{r.name}/{f.resolve().relative_to(r.resolve()).as_posix()}"


def _sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def export(out: str | Path | None = None, keep: int = 14) -> Path:
    out = Path(out or os.getenv("AMOREAD_SNAPSHOT_DIR") or "")
    if not str(out):
        raise SystemExit("저장할 폴더를 --out 으로 주거나 환경변수 AMOREAD_SNAPSHOT_DIR 로 정해 주세요")
    out.mkdir(parents=True, exist_ok=True)
    name = f"{PREFIX}{datetime.now().strftime('%Y%m%d_%H%M')}.zip"
    final, tmp = out / name, out / (name + ".partial")
    files = _items()
    manifest = {"version": VERSION, "created": datetime.now().strftime("%Y-%m-%d %H:%M"), "host": platform.node(), "files": {}}
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f, rel in files:
            manifest["files"][rel] = {"sha256": _sha(f), "bytes": f.stat().st_size}
            z.write(f, rel)
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    tmp.replace(final)   # 다 쓴 뒤 이름을 바꿔 한 번에 나타나게 한다
    olds = sorted(out.glob(PREFIX + "*.zip"))
    for old in olds[:-keep] if keep > 0 else []:
        try:
            old.unlink()
        except OSError:
            pass
    return final


def auto():
    """환경변수가 설정돼 있을 때만 조용히 스냅샷을 만든다 (수집이 끝날 때 호출). 실패해도 수집 결과에는 영향 없다."""
    if not os.getenv("AMOREAD_SNAPSHOT_DIR"):
        return None
    try:
        return export()
    except (OSError, SystemExit, zipfile.BadZipFile):
        return None


def snapshots(folder: str | Path) -> list[Path]:
    return sorted(Path(folder).glob(PREFIX + "*.zip"))


def _safe(rel: str) -> bool:
    p = Path(rel)
    return not p.is_absolute() and ".." not in p.parts and p.parts and p.parts[0] in {refs.AI_DIR.name, refs.USER_DIR.name, collect._dir().name, "references"}


def import_(src: str | Path, yes: bool = False) -> Path:
    src = Path(src)
    if src.is_dir():
        zs = snapshots(src)
        if not zs:
            raise SystemExit("그 폴더에 스냅샷(zip)이 없어요")
        src = zs[-1]
    if not src.is_file():
        raise SystemExit(f"파일이 없어요: {src}")
    with zipfile.ZipFile(src) as z:
        try:
            man = json.loads(z.read("manifest.json"))
        except KeyError:
            raise SystemExit("스냅샷이 아니에요 (manifest.json 없음)")
        bad = [r for r in man["files"] if not _safe(r)]
        if bad:
            raise SystemExit(f"허용되지 않는 경로가 들어 있어요: {bad[0]}")
        stage = Path(tempfile.mkdtemp(prefix="amoread_import_"))
        try:
            for rel, info in man["files"].items():
                z.extract(rel, stage)
                if _sha(stage / rel) != info["sha256"]:
                    raise SystemExit(f"파일이 깨졌어요(해시 불일치): {rel}")
            print(f"스냅샷 {src.name} · 만든 시각 {man['created']} · 파일 {len(man['files'])}개 확인됨")
            if not yes and input("현재 데이터를 백업한 뒤 이 스냅샷으로 바꿀까요? [y/N] ").strip().lower() != "y":
                raise SystemExit("취소했어요")
            data = _data()
            bak = data / "_backup" / datetime.now().strftime("%Y%m%d_%H%M%S")
            tops = sorted({Path(r).parts[0] for r in man["files"]})
            for t in tops:
                cur = data / t
                if cur.exists():
                    bak.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(cur, bak / t)
            for t in tops:   # 폴더 단위로 바꾼다: 스냅샷에 없는 옛 파일이 남지 않게
                new, cur = stage / t, data / t
                if t == "references":   # 이미지 폴더 등 스냅샷에 없는 것은 두고 목록 파일만 바꾼다
                    cur.mkdir(parents=True, exist_ok=True)
                    for f in new.iterdir():
                        shutil.copy2(f, cur / f.name)
                else:
                    if cur.exists():
                        shutil.rmtree(cur)
                    shutil.copytree(new, cur)
            print(f"끝났어요. 이전 데이터는 {bak} 에 있어요" if bak.exists() else "끝났어요")
        finally:
            shutil.rmtree(stage, ignore_errors=True)
    return src


def main(argv=None):
    ap = argparse.ArgumentParser(description="레퍼런스 데이터 스냅샷 내보내기·불러오기")
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export"); e.add_argument("--out"); e.add_argument("--keep", type=int, default=14)
    l = sub.add_parser("list"); l.add_argument("--dir")
    i = sub.add_parser("import"); i.add_argument("src", nargs="?"); i.add_argument("--yes", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "export":
        p = export(a.out, a.keep)
        print(f"만들었어요: {p} ({p.stat().st_size / 1e6:.1f}MB)")
    elif a.cmd == "list":
        for p in snapshots(a.dir or os.getenv("AMOREAD_SNAPSHOT_DIR") or "."):
            print(p.name, f"{p.stat().st_size / 1e6:.1f}MB")
    else:
        src = a.src or os.getenv("AMOREAD_SNAPSHOT_DIR")
        if not src:
            raise SystemExit("불러올 zip 파일이나 폴더를 적어 주세요")
        import_(src, a.yes)


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""
매일 자동 확인: 마켓별 신규 프로모션 확인을 한꺼번에 돌린다 (작업 스케줄러가 부르는 명령). 레퍼런스에 추가는 하지 않는다 — 신규 목록만 갱신하고, 추가는 사람이 화면에서 고른다.

노트북이 꺼져 있거나 인터넷이 안 되는 날을 견디도록 만들었다:
- 인터넷이 안 되면 아무것도 건드리지 않고 종료코드 2로 끝난다 → 스케줄러의 '실패 시 재시도'가 나중에 다시 부른다.
- 마지막 성공 후 MIN_HOURS(20시간)가 안 지났으면 건너뛴다 → 로그인·깨어남·재시도로 여러 번 불려도 하루 한 번만 돈다. (--force 로 무시)
- 마켓 하나가 실패해도 나머지는 계속한다. 실패한 마켓은 기록에 남고 다음 실행 때 다시 한다.
- 이미 돌고 있으면(잠금 파일) 건너뛴다. 2시간 넘은 잠금은 죽은 것으로 보고 무시한다.
- 끝나면 AMOREAD_SNAPSHOT_DIR 이 있을 때만 스냅샷을 공유 폴더에 올린다.
기록은 planner/data/ai_collect/daily.json (마지막 실행·성공 시각, 마켓별 결과) — 화면의 '마지막 자동 확인'이 이걸 읽는다.

사용
  python -m amoread.ai.daily [--force] [--markets kurly,29cm] [--min-hours 20]
종료코드: 0 완료(또는 건너뜀), 2 인터넷 없음, 3 일부 마켓 실패
"""
import argparse
import json
import os
import socket
import sys
import time
from datetime import datetime

from . import collect, discover

MIN_HOURS = 20
STALE_LOCK_H = 2
PROBE = [("www.kurly.com", 443), ("www.29cm.co.kr", 443), ("www.osulloc.com", 443), ("zigzag.kr", 443)]


def _file():
    return collect._dir() / "daily.json"


def state() -> dict:
    try:
        return json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write(d: dict):
    _file().write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


def online() -> bool:
    """수집 대상 마켓 중 하나라도 접속되면 온라인으로 본다."""
    for host, port in PROBE:
        try:
            socket.create_connection((host, port), timeout=5).close()
            return True
        except OSError:
            continue
    return False


def _hours_since(ts: str | None) -> float:
    if not ts:
        return 1e9
    try:
        return (datetime.now() - datetime.strptime(ts, "%Y-%m-%d %H:%M")).total_seconds() / 3600
    except ValueError:
        return 1e9


def _lock_path():
    return collect._dir() / "daily.lock"


def _take_lock() -> bool:
    p = _lock_path()
    if p.exists() and time.time() - p.stat().st_mtime < STALE_LOCK_H * 3600:
        return False
    p.write_text(str(os.getpid()), encoding="utf-8")
    return True


def run(force: bool = False, markets: list[str] | None = None, min_hours: float = MIN_HOURS) -> int:
    st = state()
    if not force and _hours_since(st.get("last_ok")) < min_hours:
        print(f"건너뜀: 마지막 성공이 {st['last_ok']} 이라 {min_hours:.0f}시간이 안 지났어요 (--force 로 무시)")
        return 0
    if not online():
        print("인터넷에 연결되지 않아 건너뜀 (다음에 다시 시도)")
        return 2
    if not _take_lock():
        print("이미 다른 자동 확인이 돌고 있어요")
        return 0
    keys = [k for k in (markets or list(discover.MARKETS)) if k in discover.MARKETS]
    res, now = {}, lambda: datetime.now().strftime("%Y-%m-%d %H:%M")
    st["last_run"] = now()
    try:
        for k in keys:
            try:
                t = time.time()
                n = discover.scan_and_save(k)
                res[k] = {"ok": True, "found": n, "sec": round(time.time() - t), "at": now()}
            except Exception as e:   # 한 마켓이 실패해도 나머지는 계속
                res[k] = {"ok": False, "error": f"{type(e).__name__}: {e}"[:200], "at": now()}
            print(k, res[k])
        for v in discover.view():
            if v["key"] in res and res[v["key"]]["ok"]:
                res[v["key"]]["new"] = v["new"]
        st["results"] = {**st.get("results", {}), **res}
        failed = [k for k, r in res.items() if not r["ok"]]
        if not failed and not markets:   # 일부 마켓만 돌린 시험 실행은 '오늘 다 했음'으로 치지 않는다
            st["last_ok"] = now()
        _write(st)
        try:   # 오늘의 영감: 아침에 볼 카드의 실제 화면을 미리 받아 둔다 (실패해도 신규 확인 결과에는 영향 없음)
            from . import inspire
            st["inspire"] = {"at": now(), "msg": inspire.prefetch(20).get("msg", "")}   # 확인에서 떨어지는 후보가 있어 12장보다 넉넉히 본다
            _write(st)
        except Exception:
            pass
        try:   # 트렌드 키워드 '지금 뜨는 것': 일주일에 한 번만 (몇 분 걸리고, 유튜브 할당량이 하루 1회분이라). 실패해도 신규 확인 결과에는 영향 없음
            if _hours_since((st.get("trend") or {}).get("at")) >= 24 * 6.5:
                from ..trend import weekly
                st["trend"] = weekly.run()
                _write(st)
        except Exception:
            pass
        try:
            from . import snapshot_pack
            snapshot_pack.auto()
        except Exception:
            pass
        return 3 if failed else 0
    finally:
        _write(st)
        try:
            _lock_path().unlink()
        except OSError:
            pass


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="마켓별 신규 프로모션 매일 자동 확인")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--markets")
    ap.add_argument("--min-hours", type=float, default=MIN_HOURS)
    a = ap.parse_args(argv)
    return run(a.force, a.markets.split(",") if a.markets else None, a.min_hours)


if __name__ == "__main__":
    sys.exit(main())

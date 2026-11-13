# -*- coding: utf-8 -*-
"""
담당자의 선택 기록 (planner/data/ai_log/events.jsonl, 한 줄에 사건 하나, 덧붙이기만 한다).

- 무엇을 기록하나: 추천안을 만들었을 때(compose: 어떤 유형·후보·레퍼런스를 보여 줬나), 담당자가 후보를 골랐을 때(pick_cand),
  레퍼런스를 골랐거나(pick_ref) 버렸을 때(drop_ref). 글 내용이 아니라 ID만 남긴다 (기획안·원천 파일에는 쓰지 않는다).
- 어디에 쓰나: (1) 후보 선택 비율·레퍼런스 선택/버림 횟수 요약(summary) → 사람이 라벨을 달지 않아도 되는 검증 자료,
  (2) 많이 고른 레퍼런스는 조금 앞세우고 많이 버린 것은 뒤로 미룬다(adjust). 기록이 없으면 아무 일도 하지 않는다.
- 파일이 5MB를 넘으면 더 쓰지 않는다 (로컬 디스크를 채우지 않게).
"""
import json
import os
import time
from collections import Counter
from pathlib import Path

LOG_DIR = Path(os.getenv("AMOREAD_AI_LOG_DIR") or (Path(__file__).resolve().parents[2] / "planner" / "data" / "ai_log"))
LOG = LOG_DIR / "events.jsonl"
MAX_BYTES = 5_000_000
EVENTS = {"compose", "pick_cand", "pick_ref", "drop_ref"}
PICK_W, DROP_W, CAP = 0.25, 0.5, 1.0   # 한 번 고르면 +0.25, 한 번 버리면 -0.5 (점수는 표준편차 단위). 합은 ±1을 넘지 않는다
GLOBAL_W = 0.25   # 구좌 종류를 알 때, 다른 구좌에서 고른/버린 기록은 이 비율만 반영 (한 구좌에서 많이 고른 사례가 모든 구좌에서 앞서지 않게)
_cache = {"mt": None, "n": Counter(), "p": Counter(), "d": Counter(), "ps": Counter(), "ds": Counter()}


def record(event: str, **fields) -> bool:
    """사건 한 줄 덧붙이기. 실패해도 서비스에는 영향 없다."""
    if event not in EVENTS:
        return False
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        if LOG.exists() and LOG.stat().st_size > MAX_BYTES:
            return False
        row = {"t": int(time.time()), "event": event, **{k: v for k, v in fields.items() if v not in (None, "", [])}}
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        return True
    except OSError:
        return False


def _rows() -> list[dict]:
    try:
        return [json.loads(x) for x in LOG.read_text(encoding="utf-8").splitlines() if x.strip()]
    except (OSError, ValueError):
        return []


def _load():
    try:
        mt = LOG.stat().st_mtime
    except OSError:
        _cache.update(mt=None, p=Counter(), d=Counter(), ps=Counter(), ds=Counter())
        return
    if _cache["mt"] == mt:
        return
    p, d, ps, ds = Counter(), Counter(), Counter(), Counter()
    for r in _rows():
        if r.get("event") == "pick_ref" and r.get("ref_id"):
            p[r["ref_id"]] += 1
            ps[(r["ref_id"], r.get("section", ""))] += 1
        elif r.get("event") == "drop_ref" and r.get("ref_id"):
            d[r["ref_id"]] += 1
            ds[(r["ref_id"], r.get("section", ""))] += 1
    _cache.update(mt=mt, p=p, d=d, ps=ps, ds=ds)


def adjust(ref_id: str, section: str = "") -> float:
    """레퍼런스(섹션 ID)에 더할 점수. 기록이 없으면 0. section(구좌 종류)을 주면 그 구좌에서 고른/버린 기록은 전부, 다른 구좌의 기록은 GLOBAL_W만 반영한다."""
    _load()
    if section:
        own = PICK_W * _cache["ps"][(ref_id, section)] - DROP_W * _cache["ds"][(ref_id, section)]
        other = PICK_W * (_cache["p"][ref_id] - _cache["ps"][(ref_id, section)]) - DROP_W * (_cache["d"][ref_id] - _cache["ds"][(ref_id, section)])
        return max(-CAP, min(CAP, own + GLOBAL_W * other))
    return max(-CAP, min(CAP, PICK_W * _cache["p"][ref_id] - DROP_W * _cache["d"][ref_id]))


def summary() -> dict:
    rows = _rows()
    ev = Counter(r.get("event") for r in rows)
    shown, picked = Counter(), Counter()
    for r in rows:
        if r.get("event") == "compose":
            shown.update(r.get("cands") or [])
        elif r.get("event") == "pick_cand" and r.get("cand_id"):
            picked[r["cand_id"]] += 1
    return {"events": dict(ev), "candidates": {c: {"shown": shown[c], "picked": picked[c], "pick_rate": round(picked[c] / shown[c], 2) if shown[c] else None} for c in sorted(set(shown) | set(picked))},
            "refs_picked": dict(Counter(r["ref_id"] for r in rows if r.get("event") == "pick_ref" and r.get("ref_id")).most_common(10)),
            "refs_dropped": dict(Counter(r["ref_id"] for r in rows if r.get("event") == "drop_ref" and r.get("ref_id")).most_common(10))}

# -*- coding: utf-8 -*-
"""
외부 API 자체 한도: 콘솔 한도에 닿기 전에 이 PC에서 먼저 멈춘다 (차단·과금 방지).

- 세는 단위 = 실제로 보낸 요청 1건. 실패한 요청도 센다 (콘솔도 요청 기준으로 셈).
- 하루·한 달은 한국 시간 기준. 한도는 config.API_LIMITS.
- 기록 파일(data/api_usage.json)을 읽지 못하면 0부터 세지 않고 멈춘다 (모르는 채로 더 부르지 않음).
- shortcut: 이 PC에서 보낸 것만 센다. 같은 키를 다른 PC·서버에서도 쓰면 콘솔의 '한도 및 알림'이 마지막 방어선.
"""
import json
import threading
from datetime import datetime, timedelta, timezone

from . import config

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()


class LimitReached(Exception):
    pass


def _load():
    path = config.USAGE_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def take(bucket, err=LimitReached, now=None):
    """요청 1건을 쓰기 전에 부른다. 한도 안이면 1을 더하고, 넘으면 err를 낸다."""
    name, day_cap, month_cap = config.API_LIMITS[bucket]
    now = now or datetime.now(KST)
    day, month = now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")
    with _lock:
        u = _load()
        if u is None:
            raise err(f"{name}: 사용량 기록을 읽지 못해 멈췄어요 (data/api_usage.json 확인).")
        b = u.get(bucket) or {}
        if b.get("day") != day:
            b["day"], b["day_n"] = day, 0
        if b.get("month") != month:
            b["month"], b["month_n"] = month, 0
        if b["day_n"] >= day_cap:
            raise err(f"{name}: 오늘 자체 한도 {day_cap:,}회를 다 써서 멈췄어요. 내일 0시(한국 시간)에 다시 돼요.")
        if b["month_n"] >= month_cap:
            raise err(f"{name}: 이번 달 자체 한도 {month_cap:,}회를 다 써서 멈췄어요. 다음 달 1일에 다시 돼요.")
        b["day_n"] += 1
        b["month_n"] += 1
        u[bucket] = b
        config.USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = config.USAGE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(u, ensure_ascii=False), encoding="utf-8")
        tmp.replace(config.USAGE_FILE)

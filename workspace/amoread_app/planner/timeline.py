# -*- coding: utf-8 -*-
"""
기획 D-day: PROMO_WORK 상시 할인의 시작일 = 오픈일(종료일 = 행사 끝)로 보고,
오늘부터 오픈까지 남은 업무일(주말·공휴일 제외)과 단계별 목표일을 거꾸로 계산한다.

규칙 (사용자 확정 v2, 오픈 당일 제외 · D-n = 오픈 전 n번째 업무일)
            이벤트(일반)        GNB
총 리드타임  11WD               12WD          = 틀 기획 3 + 디자인 4 + 퍼블&개발 4|5
기획 착수    D-11               D-12
틀 기획 완료 D-9 (착수 후 3WD)  D-10
디자인 착수  틀 기획 다음 WD     (최종 기획은 디자인과 병행, 같은 날 마감)
디자인 완료  D-5                D-6
퍼블&개발    D-4~D-1            D-5~D-1 (5WD 버퍼)
QA           D-1                D-1

모드: 표준(남은 WD ≥ 리드타임) / 압축(틀 기획을 줄이면 됨) / 위험(디자인까지 줄여야 함) / 매우위험(퍼블 기간도 안 남음)
남은 WD = 오늘(업무일이면 포함) ~ 오픈 전날 업무일 수.

공휴일: 한국_공휴일DB xlsx(읽기만) → data/holidays.csv 로 캐시(OneDrive가 안 붙어도 동작).
임시공휴일·회사 휴무는 settings/휴무일_추가.csv 에 사람이 적는다.
구분(이벤트/GNB): settings/기획일정_구분.csv (프로모션명 포함어 → 구분). 화면에서 바꾸면 행사명 그대로 저장.
"""
import csv
import logging
import re
from datetime import date, datetime, timedelta

from . import config, engine

log = logging.getLogger("planner")

KINDS = ("이벤트", "GNB")
# 단계 길이(WD). 리드타임 = plan + design + dev
DURATIONS = {"이벤트": {"plan": 3, "design": 4, "dev": 4}, "GNB": {"plan": 3, "design": 4, "dev": 5}}
STEPS = [("kickoff", "기획 착수"), ("draft", "틀 기획 완료"), ("design_start", "디자인 착수"), ("final", "최종 기획 완료"),
         ("design_due", "디자인 완료"), ("dev_start", "퍼블 시작"), ("qa", "퍼블·QA 완료")]
HORIZON_DAYS = 180
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_cache = {"src_mtime": None, "days": None, "from": ""}


# ----------------------------------------------------------------------
# 공휴일
# ----------------------------------------------------------------------
def _read_csv(path):
    for enc in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    return []


def _load_xlsx(path):
    """공휴일DB 시트: 날짜·공휴일명·업무일제외 열. 업무일제외가 Y인 행만."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb["공휴일DB"] if "공휴일DB" in wb.sheetnames else wb.worksheets[0]
        rows = ws.iter_rows(values_only=True)
        head = [str(h or "").strip() for h in next(rows)]
        i_d, i_n = head.index("날짜"), head.index("공휴일명")
        i_x = head.index("업무일제외") if "업무일제외" in head else None
        out = {}
        for r in rows:
            v = r[i_d] if len(r) > i_d else None
            if isinstance(v, datetime):
                v = v.date()
            elif isinstance(v, str) and _DATE.match(v.strip()[:10]):
                v = date.fromisoformat(v.strip()[:10])
            if not isinstance(v, date):
                continue
            if i_x is not None and str(r[i_x] or "Y").strip().upper() != "Y":
                continue
            out[v.isoformat()] = str(r[i_n] or "공휴일").strip()[:30]
        return out
    finally:
        wb.close()


def holidays() -> dict:
    """{'YYYY-MM-DD': 이름}. xlsx가 바뀌었으면 다시 읽어 캐시, 못 읽으면 캐시 CSV."""
    src = config.HOLIDAY_XLSX
    mtime = src.stat().st_mtime if src.exists() else None
    if _cache["days"] is None or mtime != _cache["src_mtime"]:
        days, frm = {}, src.name
        if mtime is not None:
            try:
                days = _load_xlsx(src)
                config.DATA_DIR.mkdir(parents=True, exist_ok=True)
                with open(config.HOLIDAY_CACHE, "w", encoding="utf-8-sig", newline="") as f:
                    w = csv.writer(f)
                    w.writerow(["날짜", "이름"])
                    w.writerows(sorted(days.items()))
            except Exception:   # 파일 잠김·구조 변경 → 캐시로
                log.exception("공휴일 DB를 읽지 못해 캐시를 씁니다: %s", src.name)
                days = {}
        if not days and config.HOLIDAY_CACHE.exists():
            days = {r[0]: r[1] for r in _read_csv(config.HOLIDAY_CACHE)[1:] if len(r) >= 2 and _DATE.match(r[0])}
            frm = "캐시(data/holidays.csv)"
        _cache.update(src_mtime=mtime, days=days, **{"from": frm if days else "없음"})
    out = dict(_cache["days"])
    if config.HOLIDAY_EXTRA_CSV.exists():
        for r in _read_csv(config.HOLIDAY_EXTRA_CSV)[1:]:
            if r and _DATE.match(r[0].strip()):
                out[r[0].strip()] = (r[1].strip() if len(r) > 1 and r[1].strip() else "휴무")[:30]
    return out


def is_workday(d: date, hol: dict) -> bool:
    return d.weekday() < 5 and d.isoformat() not in hol


def wd_before(open_d: date, n: int, hol: dict) -> date:
    """오픈일 전 n번째 업무일 (n=1 → 오픈 전날 업무일)."""
    d, k = open_d, 0
    while k < n:
        d -= timedelta(days=1)
        if is_workday(d, hol):
            k += 1
    return d


def wd_between(a: date, b: date, hol: dict) -> int:
    """a(포함) ~ b(제외) 업무일 수. a ≥ b면 0."""
    n, d = 0, a
    while d < b:
        if is_workday(d, hol):
            n += 1
        d += timedelta(days=1)
    return n


# ----------------------------------------------------------------------
# 구분(이벤트/GNB)
# ----------------------------------------------------------------------
def read_kinds() -> list:
    """[(포함어, 구분)]: 긴 포함어가 먼저 맞도록 정렬."""
    path = config.TIMELINE_KIND_CSV
    if not path.exists():
        return []
    out = [(r[0].strip()[:40], r[1].strip()) for r in _read_csv(path)[1:]
           if len(r) >= 2 and r[0].strip() and r[1].strip() in KINDS]
    return sorted(out, key=lambda x: -len(x[0]))


def kind_of(name: str, rules: list) -> tuple:
    """(구분, 근거 포함어). 지정이 없으면 이벤트."""
    for key, kind in rules:
        if key in name:
            return kind, key
    return "이벤트", ""


def set_kind(name: str, kind: str) -> None:
    """화면에서 바꾼 구분을 행사명 그대로 저장(같은 이름 행은 덮어씀)."""
    name = name.strip()[:40]
    if not name or kind not in KINDS:
        raise ValueError("행사명 또는 구분이 올바르지 않습니다")
    rows = [r for r in read_kinds() if r[0] != name] + [(name, kind)]
    config.SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.TIMELINE_KIND_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["프로모션명(포함어)", "구분(이벤트/GNB)"])
        w.writerows(sorted(rows))


# ----------------------------------------------------------------------
# 일정 계산
# ----------------------------------------------------------------------
def _milestones(open_d: date, plan: int, design: int, dev: int, hol: dict) -> dict:
    """단계 길이로 목표일을 오픈일에서 거꾸로 계산. plan=0이면 틀 기획은 디자인 착수와 같은 날."""
    lead = plan + design + dev
    ds = wd_before(open_d, design + dev, hol)
    return {"kickoff": wd_before(open_d, lead, hol),
            "draft": wd_before(open_d, design + dev + 1, hol) if plan else ds,
            "design_start": ds, "final": ds,
            "design_due": wd_before(open_d, dev + 1, hol),
            "dev_start": wd_before(open_d, dev, hol),
            "qa": wd_before(open_d, 1, hol)}


def _mode(rem: int, du: dict) -> str:
    if rem >= du["plan"] + du["design"] + du["dev"]:
        return "표준"
    if rem >= du["design"] + du["dev"]:
        return "압축"
    if rem > du["dev"]:
        return "위험"
    return "매우위험"


def _step_view(ms: dict, today: date, hol: dict) -> list:
    out = []
    for key, label in STEPS:
        d = ms[key]
        state = "past" if d < today else ("today" if d == today else "")
        out.append({"key": key, "label": label, "date": d.isoformat(), "dow": "월화수목금토일"[d.weekday()],
                    "state": state, "wd_left": wd_between(today, d, hol) if d > today else 0})
    return out


def _promo_waves(today: date) -> list:
    """상시 행을 (행사명, 시작일)로 묶어 오픈 예정만. 시작 = 오픈, 끝 = 같은 묶음의 가장 늦은 종료일."""
    waves = {}
    for p in engine.DATA.ensure().promos:
        if p.get("type") != "상시" or not p.get("start"):
            continue
        s = date.fromisoformat(str(p["start"])[:10])
        if s <= today or (s - today).days > HORIZON_DAYS:
            continue
        name = str(p.get("promo") or "").strip() or "(이름 없음)"
        e = date.fromisoformat(str(p.get("end") or p["start"])[:10])
        w = waves.setdefault((name, s), {"promo": name, "open": s, "end": e, "items": 0})
        w["end"] = max(w["end"], e)
        w["items"] += 1
    return sorted(waves.values(), key=lambda w: (w["open"], w["promo"]))


def dday(today: date = None) -> dict:
    today = today or date.today()
    hol = holidays()
    rules = read_kinds()
    last_hol = max(hol) if hol else None
    rows = []
    for w in _promo_waves(today):
        kind, by = kind_of(w["promo"], rules)
        du = DURATIONS[kind]
        lead = du["plan"] + du["design"] + du["dev"]
        rem = wd_between(today, w["open"], hol)
        mode = _mode(rem, du)
        steps = _step_view(_milestones(w["open"], du["plan"], du["design"], du["dev"], hol), today, hol)
        nxt = next((s for s in steps if s["state"] != "past"), None)
        overdue = [s["label"] for s in steps if s["state"] == "past"]
        # 압축안: 퍼블은 줄이지 않고 디자인 → 틀 기획 순으로 줄여 오늘 착수
        squeeze = None
        if mode in ("압축", "위험"):
            design = min(du["design"], rem - du["dev"])
            plan = rem - du["dev"] - design
            squeeze = {"plan": plan, "design": design, "dev": du["dev"],
                       "steps": _step_view(_milestones(w["open"], plan, design, du["dev"], hol), today, hol)}
        rows.append({"promo": w["promo"], "kind": kind, "kind_by": by, "open": w["open"].isoformat(),
                     "open_dow": "월화수목금토일"[w["open"].weekday()], "end": w["end"].isoformat(),
                     "items": w["items"], "days_left": (w["open"] - today).days, "wd_left": rem, "lead": lead,
                     "slack": rem - lead, "mode": mode, "steps": steps, "next": nxt, "overdue": overdue,
                     "squeeze": squeeze,
                     "no_holiday_data": bool(last_hol and w["open"].isoformat() > last_hol)})
    return {"today": today.isoformat(), "today_workday": is_workday(today, hol), "rows": rows,
            "rules": {k: {**v, "lead": sum(v.values())} for k, v in DURATIONS.items()},
            "holiday_source": _cache["from"],
            "holiday_count": len(hol), "holiday_last": last_hol,
            "upcoming_holidays": [{"date": d, "name": n} for d, n in sorted(hol.items())
                                  if today.isoformat() <= d <= (today + timedelta(days=60)).isoformat()]}

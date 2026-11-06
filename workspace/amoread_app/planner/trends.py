# -*- coding: utf-8 -*-
"""
외부 신호 ① 검색 수요. 네이버 데이터랩 검색어 트렌드 × 오설록 실적.

- 키워드 그룹(settings/트렌드키워드.csv)마다 주별 검색 지수(0~100, 요청 안에서 상대값)를 받아 data/trends.json에 캐시한다.
- 보내는 것: 검색어·기간뿐 (실적·원가·고객 정보는 절대 보내지 않음). 키는 .env에만 두고 화면·로그에 쓰지 않는다.
- 숫자 해석은 '같은 그룹 안의 시간 변화'만 쓴다 (그룹끼리 지수 크기 비교는 하지 않음, 데이터랩 지수는 상대값).

신호 규칙 (모두 규칙 계산, AI 아님)
- 검색 4주 변화 = 최근 4주 평균 ÷ 그 전 4주 평균 − 1
- 작년 대비 = 최근 4주 ÷ 52주 전 같은 4주 − 1
- 작년 다음 4주 = 52주 전 '다음 4주' ÷ 52주 전 같은 4주 − 1  (작년 이 시기 이후 검색이 어떻게 움직였나 → 앞으로의 계절 흐름 참고)
- 우리 매출 4주 변화 = 연결 상품 최근 28일 ÷ 직전 28일 − 1  (명절이 끼면 크게 흔들려 신호에는 쓰지 않음)
- 우리 작년 대비 = 연결 상품 최근 28일 ÷ 작년 같은 28일(364일 전) − 1  ← '기회' 신호는 양쪽 모두 작년 대비로 비교(계절 효과 상쇄)
"""
import csv
import json
import math
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

from . import config, engine
from .engine import DATA, _f

API_URL = config.NAVER_API_BASE + "/search-trend/v1/search"   # NAVER API HUB 검색어 트렌드 (요청·응답 모양은 예전 데이터랩과 같음)
HEAD = ["그룹", "검색어(;로 구분)", "상품명 포함어(;로 구분)", "카테고리", "메모"]
_last_fetch = {"t": 0.0}


class TrendError(Exception):
    pass


def has_keys():
    return bool(config.NAVER_CLIENT_ID and config.NAVER_CLIENT_SECRET)


# ----------------------------------------------------------------------
# 키워드 그룹 설정
# ----------------------------------------------------------------------
def _split(v):
    return [x.strip() for x in str(v or "").split(";") if x.strip()]


def read_groups():
    path = config.TREND_CSV
    if not path.exists():
        return []
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
    except UnicodeDecodeError:
        with open(path, encoding="cp949", newline="") as f:
            rows = list(csv.reader(f))
    out = []
    for r in rows[1:]:
        r = (r + [""] * 5)[:5]
        name = r[0].strip()[:20]
        kws = _split(r[1])[:20]
        if not name or not kws:
            continue
        out.append({"name": name, "keywords": kws, "match": _split(r[2])[:20], "category": r[3].strip()[:20],
                    "memo": r[4].strip()[:100]})
    return out


def save_groups(items):
    clean = []
    for it in items[:30]:
        name = str(it.get("name") or "").strip()[:20]
        as_list = lambda v: _split(";".join(v) if isinstance(v, list) else v)
        kws = [k[:30] for k in as_list(it.get("keywords"))][:20]
        if not name or not kws:
            continue
        match = [m[:20] for m in as_list(it.get("match"))][:20]
        clean.append([name, ";".join(kws), ";".join(match), str(it.get("category") or "").strip()[:20],
                      str(it.get("memo") or "").strip()[:100]])
    config.SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.TREND_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEAD)
        w.writerows(clean)
    return len(clean)


# ----------------------------------------------------------------------
# 데이터랩 받기
# ----------------------------------------------------------------------
def _last_sunday(today=None):
    today = today or date.today()
    return today - timedelta(days=(today.weekday() + 1) % 7 or 7)


def _post(body):
    req = urllib.request.Request(API_URL, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        **config.naver_headers(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        msg = {401: "네이버 API 키가 올바르지 않습니다 (.env의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 NAVER API HUB에서 받은 키인지 확인).",
               403: "이 Application에 '검색어 트렌드' API가 없습니다. 네이버 클라우드 콘솔 › NAVER API HUB › Application에서 추가하세요.",
               429: "네이버 데이터랩 하루 호출 한도를 넘었습니다. 내일 다시 시도하세요."}.get(e.code, f"네이버 데이터랩 오류 (HTTP {e.code})")
        raise TrendError(msg)
    except (urllib.error.URLError, TimeoutError):
        raise TrendError("네이버 데이터랩에 연결하지 못했습니다 (네트워크·방화벽 확인).")


def _log(rec):
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.DATA_DIR / "external_log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"), **rec}, ensure_ascii=False) + "\n")


def refresh():
    """키워드 그룹 전체의 최근 2년+ 주별 검색 지수를 받아 캐시. 그룹 5개씩 나눠 요청한다."""
    if not has_keys():
        raise TrendError("네이버 API 키가 없습니다. 설정 방법을 화면 안내대로 진행하세요.")
    gap = time.time() - _last_fetch["t"]
    if gap < config.TREND_REFRESH_MIN_GAP_MIN * 60:
        raise TrendError(f"방금 받았습니다. {config.TREND_REFRESH_MIN_GAP_MIN - int(gap // 60)}분 뒤 다시 시도하세요.")
    groups = read_groups()
    if not groups:
        raise TrendError("키워드 그룹이 없습니다.")
    end = _last_sunday()
    start = end - timedelta(days=7 * 112)        # 112주 ≈ 2년 + 여유 (작년 다음 4주 계산용)
    out = []
    _last_fetch["t"] = time.time()
    try:
        for i in range(0, len(groups), 5):
            chunk = groups[i:i + 5]
            res = _post({"startDate": start.isoformat(), "endDate": end.isoformat(), "timeUnit": "week",
                         "keywordGroups": [{"groupName": g["name"], "keywords": g["keywords"]} for g in chunk]})
            for g, r in zip(chunk, res.get("results") or []):
                pts = [(d["period"], float(d["ratio"])) for d in r.get("data") or []
                       if d.get("period") and str(d["period"]) <= (end - timedelta(days=6)).isoformat()]   # 덜 끝난 주 제외
                out.append({"name": g["name"], "keywords": g["keywords"], "data": pts})
    except TrendError as e:
        _log({"service": "naver_datalab", "groups": len(groups), "success": False, "error": str(e)})
        raise
    doc = {"fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "start": start.isoformat(), "end": end.isoformat(),
           "groups": out}
    tmp = config.TREND_CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    tmp.replace(config.TREND_CACHE)
    _log({"service": "naver_datalab", "groups": len(groups), "success": True})
    return doc


def _cache():
    if not config.TREND_CACHE.exists():
        return None
    try:
        return json.loads(config.TREND_CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


# ----------------------------------------------------------------------
# 계산
# ----------------------------------------------------------------------
def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def _chg(a, b):
    return a / b - 1 if a is not None and b and b > 0 else None


def series_metrics(vals):
    """주별 지수 리스트(오래된 → 최근) → 4주 변화·작년 대비·작년 다음 4주."""
    n = len(vals)
    if n < 8:
        return {}
    r4 = _mean(vals[-4:])
    m = {"recent4": r4, "momentum": _chg(r4, _mean(vals[-8:-4]))}
    if n >= 56:
        ly4 = _mean(vals[-56:-52])
        m["yoy"] = _chg(r4, ly4)
        m["ly_ahead"] = _chg(_mean(vals[-52:-48]), ly4)
    return m


def match_products(g):
    words = [w.replace(" ", "") for w in g.get("match") or []]
    cat = g.get("category")
    out = []
    for p in DATA.products.values():
        if not p.get("active"):
            continue
        name = str(p.get("name", "")).replace(" ", "")
        if words and not any(w in name for w in words):
            continue
        if cat and p.get("category") != cat:
            continue
        if not words and not cat:
            continue
        out.append(p)
    out.sort(key=lambda p: -(_f(p.get("sales_28")) or 0))
    return out


def _signals(m, ours):
    out = []
    mom, yoy, ahead, oy = m.get("momentum"), m.get("yoy"), m.get("ly_ahead"), ours.get("yoy")
    if yoy is not None and yoy >= 0.15 and oy is not None and oy < yoy - 0.10:
        out.append({"k": "gap", "level": "important", "text": f"작년보다 검색 {yoy:+.0%}인데 우리 매출은 작년 대비 {oy:+.0%} → 노출·할인 기회"})
    elif mom is not None and mom >= 0.20:
        out.append({"k": "rise", "level": "info", "text": f"최근 4주 검색 {mom:+.0%} 상승 중"})
    if ahead is not None and ahead >= 0.15:
        out.append({"k": "ahead", "level": "important", "text": f"작년엔 이 다음 4주 검색 {ahead:+.0%} → 미리 준비"})
    if yoy is not None and yoy >= 0.30 and not any(s["k"] == "gap" for s in out):
        out.append({"k": "yoy", "level": "info", "text": f"작년 이맘때보다 검색 {yoy:+.0%}"})
    if mom is not None and mom <= -0.15:
        out.append({"k": "cool", "level": "info", "text": f"검색 4주 {mom:+.0%}: 관심 식는 중, 깊은 할인보다 묶음·정리"})
    return out


def overview():
    DATA.ensure()
    groups = read_groups()
    cache = _cache()
    by_name = {g["name"]: g for g in (cache or {}).get("groups", [])}
    rows = []
    for g in groups:
        c = by_name.get(g["name"])
        stale_kw = bool(c) and c.get("keywords") != g["keywords"]
        vals = [v for _, v in (c or {}).get("data", [])] if c and not stale_kw else []
        m = series_metrics(vals)
        prods = match_products(g)
        s28 = sum(_f(p.get("sales_28")) or 0 for p in prods)
        p28 = sum(_f(p.get("sales_prev28")) or 0 for p in prods)
        lyp = sum(_f(p.get("ly_prev28")) or 0 for p in prods)
        lyn = sum(_f(p.get("ly_next28")) or 0 for p in prods)
        ours = {"products": len(prods), "sales_28": s28, "growth": _chg(s28, p28), "yoy": _chg(s28, lyp), "ly_ahead": _chg(lyn, lyp),
                "top": [{k: p.get(k) for k in ("seq", "name", "sales_28", "growth_28", "max_discount", "price")} |
                        {"scheduled": bool(p.get("upcoming") or p.get("running"))} for p in prods[:6]]}
        peak = max(vals) if vals else None
        rows.append({**g, "metrics": m, "ours": ours, "signals": _signals(m, ours) if vals else [],
                     "series": [round(v / peak * 100, 1) for v in vals[-104:]] if peak else [],
                     "periods": [p for p, _ in (c or {}).get("data", [])][-104:] if vals else [],
                     "status": "ok" if vals else ("keywords_changed" if stale_kw else "no_data")})
    score = lambda r: sum(2 if s["level"] == "important" else 1 for s in r["signals"])
    rows.sort(key=lambda r: (-score(r), -(r["metrics"].get("momentum") or -9)))
    return {"has_keys": has_keys(), "fetched_at": (cache or {}).get("fetched_at"), "end": (cache or {}).get("end"),
            "groups": rows,
            "note": "검색 지수는 네이버 데이터랩 상대값(그룹 안에서 최고 주 = 100). 그룹끼리 크기 비교는 하지 않고 시간 변화만 봅니다. "
                    "우리 매출 = 상품명 포함어·카테고리로 연결한 판매 중 상품의 합"}


def plan_rows(group_name, start=None, limit=8):
    """키워드 그룹 연결 상품으로 1주 상시 기획 행 (예정 행사 없는 상품, 평소 할인율·원가율 기준)."""
    from .ideas import _pick_rate, _pool, next_monday
    DATA.ensure()
    g = next((x for x in read_groups() if x["name"] == group_name), None)
    if not g:
        return None
    d0 = engine._d(start) if start else next_monday()
    d1 = d0 + timedelta(days=6)
    free = {str(p["seq"]) for p in _pool(d0, d1)}
    ov = next((r for r in overview()["groups"] if r["name"] == group_name), {})
    mom = (ov.get("metrics") or {}).get("momentum")
    rows = []
    for p in match_products(g):
        if str(p["seq"]) not in free or str(p.get("name", "")).startswith("["):
            continue
        rate = _pick_rate(p, "상시")
        if not rate:
            continue
        rows.append({"promo": f"{g['name']} 기획전", "type": "상시", "start": d0.isoformat(), "end": d1.isoformat(),
                     "seq": str(p["seq"]), "items": None, "rate": rate, "appeal": "", "clearance": False,
                     "memo": f"검색 '{g['name']}' 4주 {('%+.0f%%' % (mom * 100)) if mom is not None else '-'} · 28일 매출 {(_f(p.get('sales_28')) or 0) / 10000:,.0f}만원"})
        if len(rows) >= limit:
            break
    return {"group": g["name"], "start": d0.isoformat(), "end": d1.isoformat(), "rows": rows,
            "rationale": f"네이버 검색 '{', '.join(g['keywords'][:4])}' 흐름에 맞춘 {g['name']} 기획전 초안입니다. "
                         f"연결 상품 중 이 주에 잡힌 행사가 없는 상품을 28일 매출순으로 골랐고, 할인율은 가격대별 평소 상시 할인율(원가율 45% 이내)입니다."}

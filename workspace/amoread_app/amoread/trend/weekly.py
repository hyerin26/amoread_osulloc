# -*- coding: utf-8 -*-
"""
지금 뜨는 것 (급상승 아이템) 주간 실행. osulloc-concept-explorer tools/rising_list.py 의 판정 흐름을 그대로 옮겼다 (문서 쓰기만 뺌).

  python -m amoread.trend.weekly            기본 + 차 인접 분야 둘 다 (한쪽이 실패해도 다른 쪽은 함)
  python -m amoread.trend.weekly --general  기본만     --category  분야만

1) 최근 14일 뉴스 헤드라인·MZ 뉴스레터·유튜브 채널·검색 급상승(+쇼츠, YOUTUBE_API_KEY 있을 때)에서 구체적인 이름 후보를 뽑는다 (rising.py, 코드)
2) AI(rising_filter)가 소비자가 먹고·사고·가고·따라 할 수 있는 것만 남긴다. 후보에 없는 이름은 서버가 지운다 (ai.py)
3) 이름별로 최근 14일 / 15~45일 전 / 46~365일 전 기사 수를 재서 고정 규칙으로 단계를 정한다 (초기 급상승·확산 중·이미 대중화·꺾이는 중…)
4) 지금 뜨는 것마다 AI(rising_moves)가 오설록 아이디어 1개. 상품명은 확인된 목록(data/product_facts.txt)만
5) 지난 실행과 비교해 신규·유지·단계 변화를 붙인다

결과: planner/data/trend/rising/<날짜>.json, <날짜>_category.json — 브리프 키워드 화면이 가장 최근 것을 읽는다 (service.latest)
매일 아침 자동 확인(amoread.ai.daily)이 7일에 한 번 이걸 부른다.
"""
import argparse
import asyncio
import json
import re
import sys
import traceback
from datetime import date, datetime
from pathlib import Path

from . import ai, rising

DIR = Path(__file__).resolve().parents[2] / "planner" / "data" / "trend" / "rising"
ORDER = {"뉴스 전 선행 포착": -1, "쇼츠에서 급상승": -1, "쇼츠에서 유지": 1, "측정 대기": 3, "정점 지남": 3, "오래된 유행": 4, "초기 급상승": 0, "반응 포착": 0,
         "출시 단계": 2, "확산 중": 1, "이미 대중화": 2, "꺾이는 중": 3, "근거 부족": 4, "측정 실패": 5}
LIVE = ("뉴스 전 선행 포착", "쇼츠에서 급상승", "초기 급상승", "확산 중", "쇼츠에서 유지", "반응 포착")
CATEGORY_FOCUS = (
    "These candidates come from searches in fields next to a tea brand (tea, tea food and dessert, cafe and home cafe, gifts, healthy routine, Jeju). "
    "Besides named products, ALSO keep menu types, ingredient or flavour combinations, formats and habits that a tea brand could learn from "
    "(예: 호지차 초콜릿, 논알콜 하이볼, 야외 다도, 쫀득 모찌 밀크티). "
    "Keep only things a person drinks, eats with tea, gives as a gift, or does as a tea-time, home-cafe or wellness habit. "
    "Drop company or brand names as such, clothing, sauces and meals, alcohol brands, characters, local-government events, people, industry or export news, "
    "broad category words (예: 양갱, 선물세트) and broken phrases that do not read as the name of a thing or a habit (예: '젤라또 따뜻'). "
    "Drop anything made or sold by OSULLOC or Amorepacific itself: we are looking for outside signals. "
    "If two candidates are the same thing keep the one that reads as a natural name. age_group: who would mostly buy or do it, 전 연령 if unclear.")
OLDER_FOCUS = ("These candidates come from searches about people in their 30s, 40s and 50s or older. Keep up to 10 per age group. "
               "For these ages also keep named health foods, hobby goods, festivals or fairs, TV-shopping hits and gift items. "
               "Never answer 10·20대 here unless the headlines clearly say so.")


def flat(term):
    return term.replace(" ", "")


def _save(out, suffix=""):
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / f"{out['date']}{suffix}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


def previous_run(day, suffix=""):
    """같은 종류의 이전 날짜 실행 결과 (가장 최근 것)."""
    best = None
    for path in DIR.glob(f"*{suffix}.json"):
        m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})" + re.escape(suffix), path.stem)
        if m and m.group(1) < day.isoformat() and (best is None or m.group(1) > best[0]):
            best = (m.group(1), path)
    return json.loads(best[1].read_text(encoding="utf-8")) if best else None


def carry_rows(prev, rows, today, limit=15):
    """지난번에 뜨는 중이던 것이 이번 수집에 안 잡혔으면 기사 수만 다시 세어 계속 추적한다."""
    if not prev:
        return []
    have = {flat(r["term"]) for r in rows}
    old = [p for p in prev["items"] if p.get("stage") in LIVE and flat(p["term"]) not in have][:limit]
    if not old:
        return []
    early = {p["term"] for p in old if any(x != "news" for x in p.get("sources", []))}
    measured = {m["term"]: m for m in asyncio.run(rising.measure([p["term"] for p in old], today, early))}
    keep = ("term", "category", "age_group", "what", "field", "keyword", "sources", "seed_headlines")
    return [dict({k: p[k] for k in keep if k in p}, shorts=None, seed_top_views=p.get("seed_top_views", 0), carried=True, **measured.get(p["term"], {})) for p in old]


def compare(out, prev):
    out["previous"] = prev["date"] if prev else None
    if not prev:
        return out
    before = {flat(p["term"]): p for p in prev["items"]}
    for r in out["items"]:
        p = before.get(flat(r["term"]))
        r["change"] = "신규" if not p else f"유지({r.get('stage')})" if p.get("stage") == r.get("stage") else f"{p.get('stage')} → {r.get('stage')}"
        if p:
            r["previous_stage"] = p.get("stage")
    return out


def restage(rows):
    """뉴스 단계 + 쇼츠 기간 비교에 고정 규칙을 적용한다 (네트워크 없음)."""
    for r in rows:
        if r.get("news_stage"):
            r["stage"], r["reason"] = rising.combine_stage(r["news_stage"], r.get("news_reason", r.get("reason", "")), r.get("shorts"),
                                                           r.get("seed_top_views", 0), r["sources"] == ["shorts"])
    rows.sort(key=lambda r: (ORDER.get(r.get("stage"), 9), -(r.get("stories") or {}).get("last_14d", 0)))


def make_moves(groups, out, context_of):
    """그룹마다 AI 한 번. 실패해도 측정 결과는 저장한다 (실패한 단계는 errors에 남김)."""
    moves = {}
    for label, live in groups:
        if not live:
            continue
        try:
            result, _ = ai.generate("rising_moves", {"themes": [context_of(r) for r in live]})
            moves.update({m["theme_label"]: m for m in result["moves"]})
        except ai.AIError as e:
            out.setdefault("errors", []).append(f"아이디어 생성({label}): {e}")
    return moves


def general(today=None):
    today = today or date.today()
    headlines, seed = asyncio.run(rising.seed_headlines(today))
    extra, seed["extra"] = asyncio.run(rising.extra_sources(today))
    shorts, seed["shorts"] = asyncio.run(rising.shorts_seed(today))
    candidates = rising.extract_candidates(headlines + extra + shorts, limit=170)
    print("후보", len(candidates), flush=True)

    def payload(group):
        return [{"term": c["term"], "headlines": c["headlines"][:3], "sources": c["sources"], "age_hints": c["age_hints"]} for c in group]
    older = [c for c in candidates if set(c["age_hints"]) & {"30대", "40대", "50대 이상"} and c["sources"] == ["news"]]
    rest = sorted([c for c in candidates if c not in older], key=lambda c: 0 if "newsletter" in c["sources"] else 1 if "youtube" in c["sources"] else 2)
    kept, model = ai.generate("rising_filter", {"candidates": payload(rest[:110])})
    if older:   # 윗세대 후보가 젊은 층 후보에 밀리지 않게 따로 고른다
        more, _ = ai.generate("rising_filter", {"candidates": payload(older[:110]), "focus": OLDER_FOCUS})
        seen = {i["term"] for i in kept["items"]}
        kept["items"] += [i for i in more["items"] if i["term"] not in seen]
    items = kept["items"]
    src = {c["term"]: c for c in candidates}
    early = {t for t, c in src.items() if any(x != "news" for x in c["sources"])}
    measured = {m["term"]: m for m in asyncio.run(rising.measure([i["term"] for i in items], today, early))}
    order = sorted((i["term"] for i in items), key=lambda t: "shorts" not in src[t]["sources"])
    yt = asyncio.run(rising.shorts_check(order, today))
    rows = [dict(i, shorts=yt.get(i["term"]), sources=src[i["term"]]["sources"], seed_headlines=src[i["term"]]["headlines"], **measured.get(i["term"], {})) for i in items]
    prev = previous_run(today)
    rows += carry_rows(prev, rows, today)
    for r in rows:
        r["seed_top_views"] = src.get(r["term"], r).get("seed_top_views", 0)
        if r.get("stage") and r["stage"] != "측정 실패":
            r["news_stage"], r["news_reason"] = r["stage"], r.get("reason", "")
    restage(rows)
    out = {"date": today.isoformat(), "kind": "general", "seed": seed, "model": model, "candidates": len(candidates), "items": rows, "moves": {}}
    compare(out, prev)
    groups = []
    for ages in (("10·20대", "전 연령"), ("30대", "40대", "50대 이상")):
        live = []
        for age in ages:
            live += [r for r in rows if r["age_group"] == age and r.get("stage") in LIVE][:6]
        groups.append(("·".join(ages), live))
    out["moves"] = make_moves(groups, out, lambda r: {
        "label": r["term"], "age_group": r["age_group"], "category": r["category"], "what": r["what"], "stage": r["stage"],
        "counts": r["stories"], "first_seen": r.get("first_seen"), "seen_in": r["sources"],
        "shorts_titles": [t["title"] for t in (r.get("shorts") or {}).get("top", [])],
        "headlines": [e["title"] for e in r.get("evidence", [])[:4]] or r["seed_headlines"]})
    _save(out)
    return out


def category(today=None):
    """차 인접 분야(data/category_keywords.txt)에서 새로 뜨는 메뉴·조합·형식."""
    today = today or date.today()
    headlines, seed = asyncio.run(rising.category_headlines(today))
    phrases = rising.category_candidates(headlines, limit=90)
    taken = {flat(c["term"]) for c in phrases}
    named = []
    for c in rising.extract_candidates(headlines, limit=60):   # 같은 헤드라인의 따옴표 속 상품·메뉴 이름
        if flat(c["term"]) in taken:
            continue
        row = next((h for h in headlines if c["term"] in h["title"]), None)
        named.append(dict(c, field=row["field"] if row else "기타", keyword=row["keyword"] if row else ""))
    candidates = phrases + named[:40]
    print("후보", len(candidates), flush=True)
    kept, model = ai.generate("rising_filter", {"candidates": [{"term": c["term"], "headlines": c["headlines"][:3], "field": c["field"]} for c in candidates], "focus": CATEGORY_FOCUS})
    items = kept["items"]
    measured = {m["term"]: m for m in asyncio.run(rising.measure([i["term"] for i in items], today))}
    src = {c["term"]: c for c in candidates}
    order = sorted((i["term"] for i in items), key=lambda t: (src[t]["field"] not in ("차", "카페·홈카페"), ORDER.get(measured.get(t, {}).get("stage"), 9)))
    yt = asyncio.run(rising.shorts_check(order, today, rising.CATEGORY_YT_CHECKS))
    rows = [dict(i, field=src[i["term"]]["field"], keyword=src[i["term"]]["keyword"], shorts=yt.get(i["term"]), sources=["news"],
                 seed_headlines=src[i["term"]]["headlines"], seed_top_views=0, **measured.get(i["term"], {})) for i in items]
    prev = previous_run(today, "_category")
    rows += carry_rows(prev, rows, today)
    for r in rows:
        if r.get("stage") and r["stage"] != "측정 실패":
            r["demand"] = rising.demand_cues([e["title"] for e in r.get("evidence", [])] + r["seed_headlines"])
            r["news_stage"], r["news_reason"] = rising.category_stage(r["stage"], r.get("reason", ""), r["demand"])
    restage(rows)
    out = {"date": today.isoformat(), "kind": "category", "seed": seed, "model": model, "candidates": len(candidates), "items": rows, "moves": {}}
    compare(out, prev)
    out["moves"] = make_moves([("분야", [r for r in rows if r.get("stage") in LIVE][:14])], out, lambda r: {
        "label": r["term"], "field": r["field"], "age_group": r["age_group"], "category": r["category"], "what": r["what"],
        "stage": r["stage"], "counts": r["stories"], "first_seen": r.get("first_seen"),
        "headlines": [e["title"] for e in r.get("evidence", [])[:4]] or r["seed_headlines"]})
    _save(out, "_category")
    return out


def run(which=("general", "category")) -> dict:
    """둘 다 (한쪽이 실패해도 다른 쪽은 함). {종류: 'ok' | 오류 글}."""
    res = {}
    for name in which:
        try:
            out = (general if name == "general" else category)()
            res[name] = "ok" + (f" (일부 실패: {'; '.join(out['errors'])})" if out.get("errors") else "")
        except Exception as e:   # noqa: BLE001 - 다른 쪽은 계속
            traceback.print_exc()
            res[name] = f"{type(e).__name__}: {e}"[:200]
        print(name, res[name], flush=True)
    return {"at": datetime.now().strftime("%Y-%m-%d %H:%M"), "results": res}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="지금 뜨는 것(급상승 아이템) 주간 실행")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--general", action="store_true")
    g.add_argument("--category", action="store_true")
    a = ap.parse_args(argv)
    r = run(("general",) if a.general else ("category",) if a.category else ("general", "category"))
    return 0 if all(v.startswith("ok") for v in r["results"].values()) else 1


if __name__ == "__main__":
    sys.exit(main())

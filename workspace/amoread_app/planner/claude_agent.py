# -*- coding: utf-8 -*-
"""
Claude 기획 담당: 설치된 Claude Code 로그인으로 실행 (API 키 불필요, claude-agent-sdk).

- Claude가 쓸 수 있는 건 아래 '기획 도구'뿐이다 (파일 읽기/쓰기·명령 실행 등 기본 도구는 모두 끔).
- 숫자는 전부 engine 함수가 계산한다. Claude는 도구 결과로 조합·할인율·일정을 짜고 이유를 쓴다.
- 최종 답은 JSON 스키마로 받고, 서버가 check_plan으로 한 번 더 검증한다.
- 보안 가이드 AI-09/AI-12: 요청·결과를 chat_log.jsonl에 남기고, 분당 호출 수를 제한한다.
"""
import asyncio
import getpass
import json
import time
import uuid
from collections import deque
from datetime import date, datetime

from . import config, engine, review, reviews, schedule, trends

try:
    from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ResultMessage, ToolUseBlock,
                                  create_sdk_mcp_server, query, tool)
    SDK_OK = True
except ImportError:  # 패키지가 없으면 화면에서 안내만 한다
    SDK_OK = False


def _txt(obj):
    return {"content": [{"type": "text", "text": json.dumps(obj, ensure_ascii=False, default=str)[:60000]}]}


def _opt(schema_props, required=()):
    return {"type": "object", "properties": schema_props, "required": list(required), "additionalProperties": False}


NUM = {"type": "number"}
STR = {"type": "string"}
ITEMS = {"type": "array", "items": _opt({"seq": STR, "qty": {"type": "integer"}}, ["seq"])}

TOOL_LABELS = {
    "search_products": "상품 찾는 중", "get_product": "상품 상세 확인", "simulate_mix": "조합 원가 계산",
    "suggest_partners": "같이 묶을 상품 찾는 중", "existing_promos": "이미 잡힌 행사 확인",
    "discount_patterns": "평소 할인 패턴 확인", "check_plan": "기획안 검증",
    "past_promos": "지난 행사 성과 확인", "last_year_sales": "작년 같은 기간 실적 확인",
    "season_events": "시즌 일정 확인", "deal_candidates": "하루특가 후보 찾는 중",
    "search_trends": "검색 트렌드 확인", "review_signals": "고객 리뷰 반응 확인",
}


def build_tools():
    @tool("search_products",
          "조건으로 판매 중 상품(SEQ)을 찾는다. 결과에 정가·원가율·max_discount(할인 후 원가율 45%를 지키는 최대 할인율)·"
          "최근 28일 매출/수량·성장률(growth_28)·days_since_promo(PROMO_WORK 행사가 끝난 뒤 지난 일수, null=2025-09 이후 행사 없음)·"
          "최근 행사·예정 행사가 있다. category: 티 세트|티 제품|티푸드|라이프 스타일. "
          "sort: sales_28|growth_28|max_discount|cost_ratio|days_since_promo|price. "
          "exclude_scheduled_from/to(YYYY-MM-DD)를 주면 그 기간에 이미 행사가 잡힌 상품은 뺀다. min_days_since_promo: 행사가 이 일수 이상 없었던 상품만.",
          _opt({"query": STR, "category": STR, "product_type": STR, "price_min": NUM, "price_max": NUM,
                "max_cost_ratio": NUM, "min_max_discount": NUM, "min_days_since_promo": NUM,
                "exclude_scheduled_from": STR, "exclude_scheduled_to": STR, "sort": STR, "limit": {"type": "integer"}}))
    async def t_search(args):
        return _txt(engine.search_products(**args))

    @tool("get_product", "SEQ 하나의 상세: 구성품 원가, 최근 90일 일별 수량, 과거 행사 이력(할인율·행사 수량·반응도·할인후 원가율).",
          _opt({"seq": STR}, ["seq"]))
    async def t_get(args):
        p = engine.get_product(args["seq"])
        if p:
            q = p.pop("daily_qty", [])
            p["daily_qty_last14"] = q[-14:]
        return _txt(p or {"error": "SEQ 없음"})

    @tool("simulate_mix",
          "여러 상품을 묶은 조합(새 조합상품 아이디어)의 정가합·원가합·원가율·max_discount를 계산. rate(0~1)를 주면 할인 후 원가율과 통과 여부.",
          _opt({"items": ITEMS, "rate": NUM}, ["items"]))
    async def t_mix(args):
        return _txt(engine.simulate_mix(args["items"], args.get("rate")))

    @tool("suggest_partners",
          "기준 상품과 묶었을 때 min_rate 이상 할인해도 할인 후 원가율 45% 이하가 되는 짝 상품 목록(최근 매출순). "
          "원가가 높은 상품을 원가 낮은 상품과 섞어 할인 여력을 만들 때 쓴다.",
          _opt({"seq": STR, "min_rate": NUM, "category": STR, "limit": {"type": "integer"}}, ["seq"]))
    async def t_partner(args):
        return _txt(engine.suggest_partners(args["seq"], args.get("min_rate", 0.30), args.get("limit", 12),
                                            args.get("category")))

    @tool("existing_promos", "기간(YYYY-MM-DD)에 PROMO_WORK에 이미 잡혀 있는 행사 목록.",
          _opt({"date_from": STR, "date_to": STR}, ["date_from", "date_to"]))
    async def t_exist(args):
        rows = engine.existing_promos(args["date_from"], args["date_to"])
        return _txt({"count": len(rows), "rows": rows[:300]})

    @tool("discount_patterns", "과거 행사 기준 유형×가격대별 평소 할인율(하위25/중앙/상위25/최대)·반응도, 하루특가 할인율 구간별 반응도.",
          _opt({}))
    async def t_pat(args):
        return _txt(engine.patterns())

    @tool("check_plan",
          "기획안 행들을 검증한다. 행: {promo, type(상시|하루특가), start, end, seq(기존 상품) 또는 items(신규 조합), rate(0~1), "
          "clearance(재고 털이면 true)}. 할인가·할인후 원가율·예상 수량/매출·오류/경고를 돌려준다. 최종 답 전에 반드시 호출.",
          _opt({"rows": {"type": "array", "items": _opt({
              "promo": STR, "type": STR, "start": STR, "end": STR, "seq": {"type": ["string", "null"]},
              "items": {"type": ["array", "null"], "items": _opt({"seq": STR, "qty": {"type": "integer"}}, ["seq"])},
              "rate": NUM, "clearance": {"type": "boolean"}}, ["promo", "type", "start", "end", "rate"])}}, ["rows"]))
    async def t_check(args):
        res = engine.check_plan(args["rows"])
        slim = [{k: r.get(k) for k in ("idx", "name", "price", "rate", "sale_price", "cost_ratio_after", "max_discount",
                                        "expected_sales", "level", "errors", "warnings")} for r in res["rows"]]
        return _txt({"rows": slim, "summary": res["summary"]})

    @tool("past_promos",
          "이름에 keyword가 들어간 지난 행사 회차(PROMO_WORK, 2025-09 이후)의 성과: 기간·품목 수·행사 매출·평균 할인·"
          "반응도 중앙·할인후 원가율 중앙 + 매출 상위 품목(지금 판매 중인지, 지금 원가로 다시 계산한 원가율). "
          "예: '블프', '설', '홀리데이'. 작년 같은 행사를 참고해 올해 기획할 때 쓴다.",
          _opt({"keyword": STR, "limit": {"type": "integer"}}, ["keyword"]))
    async def t_past(args):
        return _txt(review.find_waves(args["keyword"], min(int(args.get("limit") or 6), 10)))

    @tool("last_year_sales",
          "올해 기간(YYYY-MM-DD)에 해당하는 작년 같은 기간(364일 전 같은 요일)의 상품별 매출 상위. "
          "올해도 판매 중인 상품만, 작년 그 기간에 들어간 행사 이름 포함. 시즌 수요가 반복되는 상품을 찾을 때 쓴다.",
          _opt({"date_from": STR, "date_to": STR, "category": STR, "limit": {"type": "integer"}}, ["date_from", "date_to"]))
    async def t_ly(args):
        r = engine.last_year_top(args["date_from"], args["date_to"], args.get("limit", 30), args.get("category"))
        r["rows"] = [{k: x.get(k) for k in ("seq", "name", "category", "price", "max_discount", "sales_28", "ly_sales",
                                             "ly_qty", "ly_promos", "upcoming")} for x in r["rows"]]
        return _txt(r)

    @tool("season_events", "시즌 일정(빼빼로데이·수능·블프·홀리데이·설 등): 날짜, 준비 시작일, 이미 잡힌 관련 행사, 작년 비슷한 행사 회차.",
          _opt({}))
    async def t_season(args):
        return _txt(schedule.seasons_view())

    @tool("deal_candidates",
          "특정 날짜(YYYY-MM-DD)의 하루특가 후보: 원가율 기준 최대 할인 30% 이상, 앞뒤 14일 하루특가 없음, 28일 매출순, 제안 할인율 포함.",
          _opt({"date": STR, "limit": {"type": "integer"}}, ["date"]))
    async def t_deal(args):
        rows = schedule.deal_candidates(args["date"], min(int(args.get("limit") or 10), 20))
        return _txt([{k: x.get(k) for k in ("seq", "name", "category", "price", "max_discount", "suggest_rate", "sales_28",
                                            "last_deal", "exp_sales")} for x in rows])

    @tool("search_trends",
          "네이버 검색 트렌드(데이터랩, 캐시) 키워드 그룹별: 검색 4주 변화(momentum)·작년 대비(yoy)·작년 이 다음 4주 변화(ly_ahead), "
          "연결된 오설록 상품의 28일 매출과 변화, 규칙 신호. 검색 지수는 그룹 안 상대값이라 그룹끼리 크기 비교는 하지 않는다.",
          _opt({}))
    async def t_trend(args):
        o = trends.overview()
        return _txt({"fetched_at": o["fetched_at"], "has_data": any(g["status"] == "ok" for g in o["groups"]),
                     "groups": [{k: g[k] for k in ("name", "keywords", "metrics", "signals", "status")} |
                                {"ours": {k: g["ours"][k] for k in ("products", "sales_28", "growth", "yoy", "ly_ahead", "top")}}
                                for g in o["groups"]]})

    @tool("review_signals",
          "최근 8주 오설록몰 고객 리뷰 요약: 반응 좋은 상품(리뷰 수·평점), 선물 언급 많은 상품, 아쉬운 리뷰가 있는 상품, 근거 후기 일부. "
          "소구문구·상품 선정 근거로 쓴다(후기를 그대로 광고 문구로 쓰지 말고 요약해서 쓴다).",
          _opt({}))
    async def t_review(args):
        o = reviews.overview()
        slim = lambda rs: [{k: r.get(k) for k in ("seq", "name", "n", "avg", "gift", "repeat", "discount", "low", "quotes", "max_discount", "scheduled")} for r in rs]
        return _txt({"weeks": o["weeks"], "reviews": o["reviews"], "good": slim(o["good"][:20]), "gift": slim(o["gift"][:10]),
                     "low": slim(o["low"][:8])})

    return [t_search, t_get, t_mix, t_partner, t_exist, t_pat, t_check, t_past, t_ly, t_season, t_deal, t_trend, t_review]


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "기획안 제목"},
        "rationale": {"type": "string", "description": "기획 의도·상품 선정 이유·할인율 근거·확인 필요사항 (한국어, 줄바꿈 가능)"},
        "rows": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "promo": {"type": "string"}, "type": {"type": "string", "enum": ["상시", "하루특가"]},
                "start": {"type": "string"}, "end": {"type": "string"},
                "seq": {"type": ["string", "null"]},
                "items": {"type": ["array", "null"], "items": {
                    "type": "object", "properties": {"seq": {"type": "string"}, "qty": {"type": "integer"}},
                    "required": ["seq", "qty"], "additionalProperties": False}},
                "rate": {"type": "number"}, "appeal": {"type": "string"}, "clearance": {"type": "boolean"},
                "memo": {"type": "string", "description": "이 행을 넣은 이유 한 줄"},
            },
            "required": ["promo", "type", "start", "end", "seq", "items", "rate", "appeal", "clearance", "memo"],
            "additionalProperties": False}},
        "questions": {"type": "array", "items": {"type": "string"}, "description": "기획자에게 확인할 것(없으면 빈 배열)"},
    },
    "required": ["title", "rationale", "rows", "questions"],
    "additionalProperties": False,
}


def system_prompt():
    meta = engine.DATA.ensure().meta
    return f"""너는 오설록 직영몰(오설록닷컴) 프로모션 기획 담당이다. 기획자의 요청을 받아 실제로 세팅할 수 있는 할인 기획안을 짠다.

오늘: {date.today():%Y-%m-%d} / 판매실적 마지막 날: {meta.get('sales_last_day')} (출고일 기준 실적)

반드시 지킬 것
- 숫자(정가·원가·원가율·매출·할인 여력)는 기획 도구로만 얻는다. 기억이나 추측으로 숫자나 SEQ를 만들지 않는다.
- 할인 후 원가율 = 원가 / (할인가 / 1.1). 45%는 참고선이지 고정 기준이 아니다. 시즌 행사의 평소 할인율(특히 하루특가 35~45%)을 원가율 때문에 낮추지 말고, 넘는 행은 rationale에 원가율을 적어 둔다.
- 평소 할인 수준은 discount_patterns로 확인해 맞춘다 (대략 상시 15~25%, 하루특가 30~40%, 2만원대 하루특가는 40%도 흔함).
- 하루특가는 하루짜리(start=end). 같은 상품 하루특가를 14일 안에 반복하지 않는다. 하루에 하루특가는 4~6개 정도.
- 상시 할인 위에 하루특가를 얹는 건 정상 운영이다(어드민이 기간을 나눔). 같은 유형끼리 기간이 겹치면 안 된다.
- 요청 기간에 existing_promos로 이미 잡힌 행사를 확인하고, 중복을 피하거나 의도적으로 보완한다.
- 원가가 높아 단독 할인 여력이 없는 상품은 suggest_partners/simulate_mix로 원가 낮은 상품과 묶는 '신규 조합'을 검토할 수 있다.
  신규 조합 행은 seq=null, items=[{{seq, qty}}]로 쓴다 (SEQ 등록이 필요하다고 memo에 적는다). 기존 상품 행은 items=null.
- 판매가 꾸준한 상품, 최근 성장 상품(growth_28), 오래 행사가 없던 상품(days_since_promo)을 고르게 본다. 최근 90일 판매 없는 상품은 넣지 않는다.
- 시즌 행사(블프·설·홀리데이 등)는 past_promos로 작년 같은 행사의 구성·할인율·성과를 먼저 보고, last_year_sales로
  작년 같은 기간 잘 팔린 상품을 확인한다. '작년이랑 비슷하게'는 작년 품목과 할인율을 최대한 그대로 쓰라는 뜻이다(안 팔리게 된 상품만 비슷한 상품으로 바꾼다). 지금 원가율(now_cost_ratio_after)은 참고로 적는다.
- 큰 틀에서 기획할 때는 외부 신호도 본다: search_trends(네이버 검색 수요 흐름)와 review_signals(고객 반응).
  '검색은 오르는데 우리 매출은 덜 오른' 그룹, 작년 이 시기 다음 4주에 검색이 오른 그룹은 우선 검토한다. 리뷰 반응 좋은 상품은 신규 유입용,
  선물 언급 많은 상품은 선물 기획에 맞다. 외부 신호를 근거로 쓸 때는 rationale에 어떤 신호인지 숫자로 적는다.
- 하루특가 날짜를 채울 때는 deal_candidates로 그 날 후보를 받아 쓴다. season_events로 다가오는 시즌을 확인할 수 있다.
- 재고 데이터는 없다. 재고를 근거로 쓰지 않는다 (재고 털이 여부는 기획자가 알려줄 때만 clearance=true).
- 최종 답을 내기 전에 check_plan으로 전체 행을 검증하고, 오류(errors)가 남지 않게 고친다(원가율 초과는 경고일 뿐 할인율을 낮출 이유가 아니다). 경고는 rationale에 설명한다.
- 기간을 안 주면 가장 그럴듯한 기간을 정하고 rationale에 '가정'이라고 적는다. 정보가 꼭 필요하면 questions에 남긴다.
- promo(프로모션명)는 짧은 행사 이름(예: '가을 감사제'). appeal(소구문구)은 화면용 짧은 문구, 없으면 빈 문자열.
- rationale은 한국어로, 기획 의도 → 상품 선정 이유 → 할인율 근거 → 주의할 점 순서로 간결하게 쓴다. 단정 대신 근거 숫자를 쓴다.
"""


class _RateLimiter:
    def __init__(self, per_min):
        self.per_min, self.calls = per_min, deque()

    def allow(self):
        now = time.time()
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        if len(self.calls) >= self.per_min:
            return False
        self.calls.append(now)
        return True


LIMITER = _RateLimiter(config.CLAUDE_RATE_PER_MIN)
JOBS = {}


def _log_chat(rec):
    config.CHAT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(config.CHAT_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def start_job(brief: str, current_rows=None, client_ip="127.0.0.1"):
    if not SDK_OK:
        raise RuntimeError("claude-agent-sdk가 설치되어 있지 않습니다 (pip install claude-agent-sdk).")
    if not LIMITER.allow():
        raise RuntimeError("요청이 너무 잦습니다. 1분 뒤 다시 시도하세요.")
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"id": job_id, "status": "running", "events": [], "result": None, "error": None,
                    "started": time.time(), "brief": brief}
    # 작업 참조를 들고 있어야 중간에 가비지 수집되지 않는다
    JOBS[job_id]["task"] = asyncio.get_running_loop().create_task(_run(job_id, brief, current_rows or [], client_ip))
    for old in [k for k, v in JOBS.items() if time.time() - v["started"] > 6 * 3600]:
        JOBS.pop(old, None)
    return job_id


def job_status(job_id):
    j = JOBS.get(job_id)
    if not j:
        return None
    return {k: j[k] for k in ("id", "status", "events", "result", "error")} | {"elapsed": round(time.time() - j["started"])}


async def _run(job_id, brief, current_rows, client_ip):
    job = JOBS[job_id]
    prompt = brief.strip()
    if current_rows:
        prompt += ("\n\n[현재 기획안: 이걸 바탕으로 수정해줘]\n" +
                   json.dumps([{k: r.get(k) for k in engine.PLAN_ROW_FIELDS} for r in current_rows][:200],
                              ensure_ascii=False))
    server = create_sdk_mcp_server("planner", tools=build_tools())
    names = [f"mcp__planner__{n}" for n in TOOL_LABELS]
    opts = ClaudeAgentOptions(
        tools=[], mcp_servers={"planner": server}, allowed_tools=names,
        system_prompt=system_prompt(), setting_sources=[], max_turns=config.CLAUDE_MAX_TURNS,
        model=config.CLAUDE_MODEL, cwd=str(config.DATA_DIR), output_format={"type": "json_schema", "schema": OUTPUT_SCHEMA},
    )
    rec = {"ts": datetime.now().isoformat(timespec="seconds"), "user": getpass.getuser(), "ip": client_ip,
           "prompt": prompt[:8000], "success": False}
    try:
        async for m in query(prompt=prompt, options=opts):
            if isinstance(m, AssistantMessage):
                for b in m.content:
                    if isinstance(b, ToolUseBlock):
                        short = b.name.replace("mcp__planner__", "")
                        if short in TOOL_LABELS:
                            job["events"].append({"t": round(time.time() - job["started"]), "label": TOOL_LABELS[short],
                                                  "detail": _brief_args(short, b.input)})
            elif isinstance(m, ResultMessage):
                rec["cost_usd"] = m.total_cost_usd
                rec["turns"] = m.num_turns
                if m.is_error or not m.structured_output:
                    raise RuntimeError(f"Claude 응답 오류 ({m.subtype})")
                out = m.structured_output
                checked = engine.check_plan(out.get("rows") or [])
                job["result"] = {**out, "check": checked, "cost_usd": m.total_cost_usd, "turns": m.num_turns}
        if job["result"] is None:
            raise RuntimeError("Claude가 결과를 돌려주지 않았습니다.")
        job["status"] = "done"
        rec.update(success=True, title=job["result"].get("title"), rows=len(job["result"].get("rows") or []))
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)[:300]
        rec["error"] = job["error"]
    finally:
        _log_chat(rec)


def _brief_args(name, a):
    if name == "search_products":
        parts = [a.get("query"), a.get("category"),
                 f"{int(a['price_min']):,}원~" if a.get("price_min") else None,
                 f"~{int(a['price_max']):,}원" if a.get("price_max") else None,
                 f"정렬 {a['sort']}" if a.get("sort") else None]
        return " · ".join(p for p in parts if p)
    if name in ("get_product", "suggest_partners"):
        p = engine.DATA.products.get(str(a.get("seq")))
        return p.get("name") if p else str(a.get("seq"))
    if name == "simulate_mix":
        return " + ".join((engine.DATA.products.get(str(i.get("seq"))) or {}).get("name", str(i.get("seq")))
                          for i in a.get("items", []))
    if name == "existing_promos":
        return f"{a.get('date_from')} ~ {a.get('date_to')}"
    if name == "check_plan":
        return f"{len(a.get('rows', []))}행"
    return ""

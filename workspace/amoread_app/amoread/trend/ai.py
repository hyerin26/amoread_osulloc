# -*- coding: utf-8 -*-
"""
트렌드 키워드의 AI 단계 (osulloc-concept-explorer의 /api/generate 중 급상승 아이템에 쓰는 두 작업만 옮김).

AI는 '유행을 아는' 도구로 쓰지 않는다. 수집·기사 수·단계 판정은 코드(rising.py)가 하고, AI는 두 가지만 한다.
- rising_filter: 헤드라인에서 뽑은 후보 이름 중 소비자가 먹고·사고·가고·따라 할 수 있는 구체적인 것만 남김 (후보 목록에 없는 이름은 서버가 지움)
- rising_moves : 지금 뜨는 아이템마다 오설록 공식몰 프로모션 아이디어 1개 (상품명은 확인된 목록 data/product_facts.txt 안에서만, 목록 밖 이름은 서버가 지움)

제공자 (환경변수 AMOREAD_TREND_AI)
- claude_code (기본): 이 PC에 설치·로그인된 Claude Code CLI(구독 로그인, API 키 불필요). 공개 헤드라인과 상품 목록만 보낸다
- mock: 키 없이 흐름만 확인 (테스트용, 결과는 [가상 예시])
"""
import json
import os
import re
from pathlib import Path

from . import claude_code

DATA = Path(__file__).resolve().parent / "data"

MALL_FORMATS = ["기획전 랜딩 페이지", "메인 배너·히어로", "큐레이션 섹션(테마별 상품 묶음)", "선물 가이드(받는 사람·상황별)",
                "기프트 포장·메시지 카드 옵션 안내", "기간 한정 세트 구성 검토(상품팀 확인 필요)", "콘텐츠 매거진·레시피",
                "리뷰·참여 이벤트", "오프라인 티하우스 연계 안내"]
PRODUCT_CLAIMS = re.compile(r"키트|세트|샘플러|패키지|증정|사은품|할인|가격대|예상 가격|최저가|특가|\d+ ?%|무료|1\+1|한정 수량|효능|효과|건강|면역|다이어트")
AGES = ("10·20대", "30대", "40대", "50대 이상", "전 연령")

TASKS = {
    "rising_filter": (
        "Return {items:[{term:string, category:string, age_group:string, what:string}]}. "
        "Input candidates are names pulled from recent Korean headlines, each with sample headlines. "
        "Keep only SPECIFIC named things a consumer can eat, buy, visit, collect or imitate and that are being talked about as newly popular: "
        "a product or menu name, a dessert or snack, a shop, a character, a meme, a challenge, a buzzword (예: 떡픈런, 왁뿌). "
        "Drop people (celebrities, politicians, athletes), companies and big chains as such, countries, cities, generic words, finance, real estate, tech parts, "
        "and anything whose headlines are not about consumer taste. "
        "term must be copied exactly from the candidate list. If two candidates are the same thing keep the more specific one. "
        "category: one of 음식·디저트, 음료, 캐릭터·굿즈, 밈·챌린지, 공간·가게, 패션·뷰티, 문화·취미, 신조어. "
        "what: one Korean sentence saying what it is, using only what the headlines say; if unclear write '헤드라인만으로는 불명확'. "
        "age_group: exactly one of 10·20대, 30대, 40대, 50대 이상, 전 연령: who the headlines say is into it "
        "(age_hints shows which life-context search found it: 30대 = work, commute, parenting of young kids, newlywed; 40대 = school-age parents, health management, golf; "
        "50대 이상 = hobbies of older adults, health, gifts for parents. Use the hint unless the headlines contradict it; 전 연령 only when truly unclear). "
        "If the input has a 'focus' note, follow it. Return at most 40 items and make sure every age group that has a fitting candidate is represented, most concrete first. All values in Korean."),
    "rising_moves": (
        "Return {moves:[{theme_label:string, link:string, move_title:string, what_to_do:string, products:[string], placement:string, "
        "example_phrase:string, fit_for_audience:string, needs_check:string}]}. "
        "link: ONE short Korean sentence (max 60 chars) naming the bridge between the item and OSULLOC tea or tea food "
        "(같은 재료·식감, 같은 행동, 같은 순간, 같은 말맛 중 무엇으로 이어지는지); write '연결 약함' if there is no honest bridge. "
        "Speak to the item's age_group: the idea, tone and placement should suit that age (예: 50대 이상은 부모님 선물·건강한 일상, 30대는 직장·육아 일상). "
        "If the item's meaning is marked 불명확, do not guess: set link to '뜻 확인 후 판단' and keep the idea minimal. "
        "Each supplied theme is ONE specific item that is taking off right now (label = its name, with stage, counts and headlines). "
        "For each, give ONE promotion idea for the OSULLOC official mall that a marketer could brief this week: it must use the item's own hook "
        "(its format, ritual, wordplay, look or the behaviour around it) and translate it to tea or tea food, not just mention a general mood. "
        "what_to_do: 2 to 3 Korean sentences: the concrete device (예: 이름 패러디, 같은 형식의 페어링, 줄서기·인증 행동의 온라인 버전), what the visitor sees first and does. "
        "products: only exact names copied from brief.product; empty list if none fit. Never invent products, bundles, prices, discounts, gifts or limited editions. "
        "placement: exactly one of mall_formats. example_phrase: Korean headline of at most 22 characters; wordplay on the item is welcome. "
        "fit_for_audience: one tentative sentence on why this could land now. "
        "needs_check: rights and risk first: if the item is another company's brand, shop, character or a person, say '상표·IP 권리 확인 필요' and propose using the format, not the name; "
        "also note if the item barely fits a tea brand. theme_label must equal the supplied label. All values in Korean."),
}
PREFIX = ("당신은 프로모션 콘셉트 탐색 보조자입니다. 상품이 미정이면 특정 상품명·제품 구성·키트·할인·사은품·효능을 지어내지 마세요. "
          "실시간 트렌드도 근거 없이 주장하지 마세요. 한국어로만 작성하고 JSON 객체만 반환하세요. ")


class AIError(Exception):
    pass


def provider() -> str:
    return os.getenv("AMOREAD_TREND_AI", "claude_code").lower()


def product_facts() -> str:
    try:
        return (DATA / "product_facts.txt").read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def confirmed_names(product_text: str) -> list[str]:
    parts = re.split(r"[,\n·•]|\(.*?\)|:|：", str(product_text or ""))
    names = {p.strip(" +[]") for p in parts if len(p.strip(" +[]")) >= 3}
    return sorted(names, key=len, reverse=True)


def _claims(text: str, names: list[str]) -> list[str]:
    for n in names:
        text = text.replace(n, " ")
    return sorted(set(PRODUCT_CLAIMS.findall(text)))


def extract_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
    try:
        result = json.loads(raw)
    except ValueError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise
        result = json.loads(raw[start:end + 1])
    if not isinstance(result, dict):
        raise ValueError("JSON 객체가 아님")
    return result


def validate(task: str, result: dict, context: dict) -> dict:
    if task == "rising_filter":
        if not isinstance(result.get("items"), list):
            raise ValueError("items 없음")
        allowed = {str(c.get("term")) for c in context.get("candidates", []) if isinstance(c, dict)}
        seen, out = set(), []
        for i in result["items"]:
            if isinstance(i, dict) and str(i.get("term")) in allowed and i["term"] not in seen:   # 후보에 없는 이름(지어낸 것)은 버린다
                seen.add(i["term"])
                out.append(i)
        for i in out:
            if i.get("age_group") not in AGES:
                i["age_group"] = "전 연령"
            i.setdefault("category", "미분류")
            i.setdefault("what", "")
        return {"items": out[:40]}
    moves = result.get("moves")
    if not isinstance(moves, list) or not moves:
        raise ValueError("moves 없음")
    for m in moves:
        if not isinstance(m, dict) or not all(isinstance(m.get(k), str) and m.get(k).strip() for k in ("theme_label", "move_title", "what_to_do", "placement", "example_phrase")):
            raise ValueError("아이디어 형식이 틀림")
    return postprocess_moves(result, context)


def postprocess_moves(result: dict, context: dict) -> dict:
    """확인된 상품 이름만 남기고, 목록 밖 구좌·혜택 표현·22자 초과를 '점검'으로 표시한다 (문구를 몰래 고치지 않음)."""
    facts = str((context.get("brief") or {}).get("product", ""))
    names = confirmed_names(facts)
    known = [n for n in names if len(n) >= 4]
    for m in result["moves"]:
        listed = m.get("products") if isinstance(m.get("products"), list) else []
        m["products"] = [p for p in dict.fromkeys(str(x).strip() for x in listed) if any(p == n or p in n or n in p for n in known)]
        checks = []
        for field in ("what_to_do", "example_phrase"):
            found = _claims(str(m.get(field, "")), names)
            if found:
                checks.append(f"상품 구성·혜택·효능 표현({', '.join(found)}) · 상품팀 확인 필요")
        if m.get("placement") not in MALL_FORMATS:
            checks.append("구좌가 공식몰 구좌 목록에 없음 · 담당자가 구좌 확인")
        if len(str(m.get("example_phrase", ""))) > 22:
            checks.append("문구 22자 초과")
        m["checks"] = list(dict.fromkeys(checks))
    return result


def _mock(task: str, context: dict) -> dict:
    if task == "rising_filter":
        return {"items": [{"term": c.get("term"), "category": "미분류", "age_group": "전 연령", "what": "[가상 예시] 규칙으로 뽑은 후보(선별 없음)"}
                          for c in context.get("candidates", [])[:12] if isinstance(c, dict)]}
    return {"moves": [{"theme_label": str(t.get("label", "")), "link": "[가상 예시]", "move_title": "[가상 예시] " + str(t.get("label", "")),
                       "what_to_do": "가상 예시예요. 실제 아이디어는 Claude Code를 연결하면 만들어져요.", "products": [],
                       "placement": MALL_FORMATS[2], "example_phrase": str(t.get("label", ""))[:22],
                       "fit_for_audience": "담당자 확인 필요", "needs_check": "가상 예시"} for t in context.get("themes", [])[:8] if isinstance(t, dict)]}


def generate(task: str, context: dict) -> tuple[dict, str]:
    """(결과, 모델 이름). 실패하면 AIError."""
    if task not in TASKS:
        raise AIError("지원하지 않는 작업이에요")
    context = dict(context)
    if task == "rising_moves":
        context["mall_formats"] = MALL_FORMATS
        context["brief"] = {"product": product_facts()}
    if provider() == "mock":
        res = _mock(task, context)
        return (validate(task, res, context) if res.get("items") or res.get("moves") else res), "mock"
    prompt = PREFIX + TASKS[task] + "\n입력: " + json.dumps(context, ensure_ascii=False)
    timeout = float(os.getenv("AMOREAD_TREND_AI_TIMEOUT", "480"))
    try:
        raw, meta = claude_code._run(prompt, os.getenv("CLAUDE_CODE_MODEL", "haiku"), timeout)
        return validate(task, extract_json(raw), context), meta["model"]
    except claude_code.ClaudeCodeError as e:
        raise AIError(str(e)) from e
    except (ValueError, KeyError, IndexError) as e:
        raise AIError(f"AI 응답을 처리하지 못했어요 ({type(e).__name__})") from e

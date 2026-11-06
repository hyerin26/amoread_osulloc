# -*- coding: utf-8 -*-
"""
할인 없음(PROMO_WORK 유형 '큐레이션') 행을 다루는 검증·내보내기 감싸기 (plans/05 R18).

기존 engine.check_plan, plans.export_plan은 고치지 않는다.
- 검증: 큐레이션이 아닌 행은 engine.check_plan 그대로, 큐레이션 행은 할인 검증 없이 판매 여부·기간·겹침만 본다. 행 번호(idx)는 원래 순서로 되돌린다.
- 내보내기: plans.export_plan이 만든 새 엑셀 파일(output/)을 열어 큐레이션 행의 할인구분·할인율을 비우고, 검증 시트의 '할인율 없음' 오류를 지운다.
  원천 파일(공유 xlsm 등)에는 쓰지 않는다.
"""
from datetime import datetime

import openpyxl
from openpyxl.styles import PatternFill

from planner import engine, plans

CURATION = "큐레이션"


def _d(s):
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _curation_row(i, r, rows):
    errs, warns = [], []
    res = {k: r.get(k) for k in engine.PLAN_ROW_FIELDS}
    res.update(idx=i, hints=[], sale_price=None, cost_ratio_after=None, max_discount=None, expected_sales=None)
    s, e = _d(r.get("start")), _d(r.get("end") or r.get("start"))
    if not s or not e:
        errs.append("시작일/종료일 형식 오류(YYYY-MM-DD)")
    elif e < s:
        errs.append("종료일이 시작일보다 빠름")
    if r.get("items"):
        names = [(engine.DATA.products.get(str(it.get("seq"))) or {}).get("name") or str(it.get("seq")) for it in r["items"]]
        res.update(kind="신규조합", name=" + ".join(names), price=None, cost=None)
    else:
        p = engine.DATA.products.get(str(r.get("seq")))
        if not p:
            errs.append(f"SEQ {r.get('seq')} 없음")
            res.update(kind="기존", name=None, price=None, cost=None)
        else:
            res.update(kind="기존", name=p.get("name"), category=p.get("category"), price=p.get("price"), cost=None, sale_price=p.get("price"))
            if not p.get("active"):
                warns.append("최근 90일 판매 없음(판매 중지 여부 확인)")
            if s and e:
                for h in engine.DATA.promos_of(p["seq"]):
                    hs, he = _d(h.get("start")), _d(h.get("end"))
                    if hs and he and h.get("type") == CURATION and hs <= e and he >= s:
                        warns.append(f"기존 큐레이션과 기간 겹침: {h.get('promo')} {hs:%m/%d}~{he:%m/%d}")
    rate = r.get("rate")
    if rate:
        warns.append("할인 없음인데 할인율이 있어요 (PROMO_WORK에는 할인율 없이 큐레이션으로 나가요)")
    if s and e:
        for j, o in enumerate(rows):
            if j < i and o.get("type") == CURATION and str(o.get("seq") or "") == str(r.get("seq") or "") and r.get("seq"):
                os_, oe = _d(o.get("start")), _d(o.get("end") or o.get("start"))
                if os_ and oe and os_ <= e and oe >= s:
                    warns.append(f"이 기획안 {j + 1}행과 같은 상품·할인 없음 기간 겹침")
    fl = engine.efficacy_flags(r.get("appeal"))
    if fl:
        warns.append(f"소구문구에 효능으로 읽힐 수 있는 표현: {', '.join(fl)} (식품 표시광고: RA 확인)")
    res["errors"], res["warnings"] = errs, warns
    res["level"] = "error" if errs else ("warn" if warns else "ok")
    return res


def check(rows: list) -> dict:
    engine.DATA.ensure()
    keep = [i for i, r in enumerate(rows) if r.get("type") != CURATION]
    base = engine.check_plan([rows[i] for i in keep])
    out = []
    for r in base["rows"]:
        r["idx"] = keep[r["idx"]]
        out.append(r)
    cur = [_curation_row(i, r, rows) for i, r in enumerate(rows) if r.get("type") == CURATION]
    out += cur
    out.sort(key=lambda x: x["idx"])
    s = dict(base["summary"])
    s["rows"] = len(rows)
    s["errors"] = s.get("errors", 0) + sum(1 for r in cur if r["errors"])
    s["warnings"] = s.get("warnings", 0) + sum(1 for r in cur if r["warnings"] and not r["errors"])
    s["curation"] = len(cur)
    if cur:
        s["note"] = (s.get("note") or "") + f" 할인 없음(큐레이션) {len(cur)}행은 할인·예상 매출 계산에서 뺐어요."
    return {"rows": out, "summary": s}


def export(plan: dict):
    """plans.export_plan 결과 파일에서 큐레이션 행을 바로잡는다. 반환: 파일 경로."""
    path = plans.export_plan(plan)
    if not any(r.get("type") == CURATION for r in (plan.get("rows") or [])):
        return path
    wb = openpyxl.load_workbook(path)
    try:
        ws = wb["PROMO_WORK 붙여넣기"]
        for row in ws.iter_rows(min_row=2):
            if len(row) >= 12 and row[4].value == CURATION:
                row[9].value = None    # J 할인구분
                row[11].value = None   # L 할인율
        v = wb["검증"]
        clear = PatternFill(fill_type=None)
        for row in v.iter_rows(min_row=2):
            if len(row) >= 21 and row[3].value == CURATION:
                errs = [x for x in str(row[19].value or "").split(" / ") if x and "할인율 없음" not in x]
                row[19].value = " / ".join(errs) or None
                row[18].value = "할인 없음" if not errs else row[18].value
                if not errs:
                    for c in row:
                        c.fill = clear
        n = sum(1 for r in plan["rows"] if r.get("type") == CURATION)
        v.append([])
        v.append(["", "참고", f"할인 없음(큐레이션) {n}행은 할인율 없이 내보냈어요. 위 요약의 오류 수에는 이 행들의 '할인율 없음'이 들어 있을 수 있어요."])
        wb.save(path)
    finally:
        wb.close()
    return path

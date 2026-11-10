# -*- coding: utf-8 -*-
"""
기획안 저장/불러오기(JSON)와 엑셀 내보내기.

내보내기 엑셀은 '새 파일'이다 (공유 xlsm에는 절대 쓰지 않는다).
- 'PROMO_WORK 붙여넣기' 시트: PROMO_WORK와 같은 열 순서(A~M). 자동 수식 열(요일·상품명·정가·할인가·어드민링크)은
  비워 둔다 → 엑셀에서 [선택하여 붙여넣기 → 값 + '내용 있는 셀만 붙여넣기']로 붙이면 원본 수식이 보존된다.
- '검증' 시트: 원가율·경고·예상 매출 (참고용, 붙여넣지 않음)
- '신규조합 제안' 시트: SEQ가 아직 없는 조합 (SEQ 등록 후 PROMO_WORK에 추가)
"""
import json
import re
import uuid
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from . import config, engine

_ID = re.compile(r"^[0-9a-f]{32}$")


def _plan_path(plan_id: str) -> Path:
    if not _ID.match(plan_id or ""):
        raise ValueError("잘못된 기획안 ID")
    return config.PLANS_DIR / f"{plan_id}.json"


def list_plans():
    config.PLANS_DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for p in config.PLANS_DIR.glob("*.json"):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        out.append({"id": d.get("id"), "title": d.get("title"), "updated_at": d.get("updated_at"),
                    "rows": len(d.get("rows") or []), "source": d.get("source", ""),
                    "confirmed_at": (d.get("snapshot") or {}).get("confirmed_at")})
    return sorted(out, key=lambda x: x.get("updated_at") or "", reverse=True)


def load_plan(plan_id: str):
    return json.loads(_plan_path(plan_id).read_text(encoding="utf-8"))


def save_plan(plan: dict):
    config.PLANS_DIR.mkdir(parents=True, exist_ok=True)
    plan_id = plan.get("id") if _ID.match(str(plan.get("id") or "")) else uuid.uuid4().hex
    rows = [{k: r.get(k) for k in engine.PLAN_ROW_FIELDS} for r in (plan.get("rows") or [])][:500]
    prev = {}
    if _plan_path(plan_id).exists():
        try:
            prev = json.loads(_plan_path(plan_id).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            prev = {}
    doc = {"id": plan_id, "title": str(plan.get("title") or "제목 없는 기획안")[:80], "rows": rows,
           "brief_meta": {k: str((plan.get("brief_meta") or {}).get(k) or "")[:300] for k in ("myeongbun", "concept", "target", "customer")},
           "snapshot": prev.get("snapshot"),
           "brief": str(plan.get("brief") or "")[:4000], "rationale": plan.get("rationale") or "",
           "source": str(plan.get("source") or "")[:40], "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    tmp = _plan_path(plan_id).with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_plan_path(plan_id))
    return doc


def delete_plan(plan_id: str):
    p = _plan_path(plan_id)
    if p.exists():
        p.unlink()


PROMO_WORK_HEADERS = ["요일\n(자동)", "시작일", "종료일", "프로모션명", "유형\n(하루특가/상시/큐레이션)", "SEQ코드",
                      "상품명\n(자동)", "카테고리명", "소구문구", "할인구분", "정가\n(자동,원)", "할인율", "할인가\n(자동,원)"]
AUTO_COLS = {1, 7, 11, 13}  # 1-based: 요일, 상품명, 정가, 할인가: 비워 둠


def export_plan(plan: dict) -> Path:
    checked = engine.check_plan(plan.get("rows") or [])
    rows = checked["rows"]
    config.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r'[\\/:*?"<>|\s]+', "_", str(plan.get("title") or "기획안"))[:40]
    path = config.REPORT_DIR / f"기획안_{safe}_{datetime.now():%Y%m%d_%H%M%S}.xlsx"

    wb = Workbook()
    ws = wb.active
    ws.title = "PROMO_WORK 붙여넣기"
    head_fill = PatternFill("solid", fgColor="E8F0E6")
    auto_fill = PatternFill("solid", fgColor="F2F2F2")
    ws.append(PROMO_WORK_HEADERS)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = auto_fill if c.column in AUTO_COLS else head_fill
        c.alignment = Alignment(wrap_text=True, vertical="center")
    n = 0
    for r in rows:
        if r.get("kind") != "기존" or r.get("errors") and any("SEQ" in e and "없음" in e for e in r["errors"]):
            continue
        s, e = engine._d(r.get("start")), engine._d(r.get("end") or r.get("start"))
        ws.append([None, s, e, r.get("promo"), r.get("type"), int(r["seq"]) if str(r.get("seq")).isdigit() else r.get("seq"),
                   None, r.get("category_tag") or None, r.get("appeal") or None, "정율", None, r.get("rate"), None])
        n += 1
        ws.cell(ws.max_row, 2).number_format = ws.cell(ws.max_row, 3).number_format = "yyyy-mm-dd"
        ws.cell(ws.max_row, 12).number_format = "0%"
    for col, w in zip("ABCDEFGHIJKLM", (7, 12, 12, 16, 10, 9, 10, 14, 14, 9, 9, 8, 10)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    note_row = ws.max_row + 2
    ws.cell(note_row, 2, "붙여넣는 법: B2부터 아래 행까지 복사 → PROMO_WORK 빈 행의 B열에서 "
                         "[선택하여 붙여넣기 → 값 + '내용 있는 셀만 붙여넣기'] (회색 자동 열의 수식이 지워지지 않음)").font = Font(color="666666")

    v = wb.create_sheet("검증")
    v.append(["행", "구분", "프로모션명", "유형", "시작일", "종료일", "SEQ", "상품명", "정가", "할인율", "할인가",
              "원가", "할인후 원가율", "원가율45% 최대할인", "예상 수량", "예상 매출", "예상 매출총이익", "클리어런스", "판정", "오류", "경고", "메모"])
    for c in v[1]:
        c.font = Font(bold=True)
        c.fill = head_fill
    fills = {"error": PatternFill("solid", fgColor="FBE3E1"), "warn": PatternFill("solid", fgColor="FFF4D6")}
    for r in rows:
        v.append([r["idx"] + 1, r.get("kind"), r.get("promo"), r.get("type"), r.get("start"), r.get("end"),
                  r.get("seq") or "", r.get("name"), r.get("price"), r.get("rate"), r.get("sale_price"), r.get("cost"),
                  r.get("cost_ratio_after"), r.get("max_discount"), r.get("expected_qty"), r.get("expected_sales"),
                  r.get("expected_profit"), "예" if r.get("clearance") else "", {"error": "오류", "warn": "주의", "ok": "통과"}[r["level"]],
                  " / ".join(r["errors"]), " / ".join(r["warnings"]), r.get("memo") or r.get("hint") or ""])
        if r["level"] in fills:
            for c in v[v.max_row]:
                c.fill = fills[r["level"]]
    for row in v.iter_rows(min_row=2):
        for c, fmt in ((row[9], "0%"), (row[12], "0%"), (row[13], "0%"), (row[8], "#,##0"), (row[10], "#,##0"),
                       (row[11], "#,##0"), (row[14], "#,##0"), (row[15], "#,##0"), (row[16], "#,##0")):
            c.number_format = fmt
    for col, w in zip("ABCDEFGHIJKLMNOPQRSTUV", (5, 8, 14, 8, 11, 11, 8, 30, 9, 7, 9, 8, 9, 9, 8, 12, 12, 7, 6, 30, 50, 30)):
        v.column_dimensions[col].width = w
    s = checked["summary"]
    v.append([])
    v.append(["", "요약", f"행 {s['rows']} · 오류 {s['errors']} · 주의 {s['warnings']} · 예상 매출 {s['expected_sales']:,}원 · "
                         f"예상 매출총이익 {s.get('expected_profit', 0):,}원 (참고치) · 원가율 기준 {s['target']:.0%}"])

    combos = [r for r in rows if r.get("kind") == "신규조합"]
    if combos:
        c = wb.create_sheet("신규조합 제안")
        c.append(["행", "프로모션명", "유형", "시작일", "종료일", "구성", "정가 합", "원가 합", "할인율", "할인가",
                  "할인후 원가율", "최대할인(원가율45%)", "메모"])
        for cell in c[1]:
            cell.font = Font(bold=True)
        for r in combos:
            c.append([r["idx"] + 1, r.get("promo"), r.get("type"), r.get("start"), r.get("end"), r.get("name"),
                      r.get("price"), r.get("cost"), r.get("rate"), r.get("sale_price"), r.get("cost_ratio_after"),
                      r.get("max_discount"), r.get("memo") or ""])
        c.column_dimensions["F"].width = 50
    if plan.get("rationale") or plan.get("brief"):
        b = wb.create_sheet("기획 메모")
        b.column_dimensions["A"].width = 120
        for line in (f"요청: {plan.get('brief') or ''}\n\n{plan.get('rationale') or ''}").splitlines():
            b.append([line])
    wb.save(path)
    return path


def confirm_plan(plan_id: str):
    """확정: 지금 예측(행별 예상 수량·매출·반응도·가정)을 고정 저장. 이후 수정해도 회고는 이 값과 비교한다."""
    doc = load_plan(plan_id)
    chk = engine.check_plan(doc.get("rows") or [])
    doc["snapshot"] = {"confirmed_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "data_built_at": engine.DATA.meta.get("built_at"),
                       "summary": {k: chk["summary"].get(k) for k in ("expected_sales", "expected_range", "rows")},
                       "rows": [{k: r.get(k) for k in ("seq", "type", "start", "end", "rate", "name", "expected_qty",
                                                       "expected_sales", "expected_range", "lift", "lift_band", "base_qty")}
                                for r in chk["rows"] if r.get("kind") == "기존"]}
    tmp = _plan_path(plan_id).with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_plan_path(plan_id))
    return doc


def plan_actual(plan_id: str):
    """확정 스냅샷 vs 실적: PROMO_WORK에 들어간 같은 SEQ·유형·시작일 행의 행사 실적(데이터 갱신 후)."""
    doc = load_plan(plan_id)
    snap = doc.get("snapshot")
    if not snap:
        return {"plan": doc.get("title"), "snapshot": None, "rows": []}
    engine.DATA.ensure()
    rows, tot_p, tot_a = [], 0, 0
    for r in snap["rows"]:
        m = next((h for h in engine.DATA.promos_of(r["seq"]) if h.get("type") == r["type"] and h.get("start") == r["start"]), None)
        actual = (m or {}).get("promo_sales")
        st = (m or {}).get("status") or ("PROMO_WORK에 없음" if not m else "")
        rows.append({**r, "actual_sales": actual, "actual_qty": (m or {}).get("promo_qty"), "actual_lift": (m or {}).get("lift"),
                     "status": st, "ratio": actual / r["expected_sales"] if actual is not None and r.get("expected_sales") else None})
        if actual is not None and r.get("expected_sales"):
            tot_p += r["expected_sales"]
            tot_a += actual
    return {"plan": doc.get("title"), "snapshot": {k: snap[k] for k in ("confirmed_at", "summary")}, "rows": rows,
            "matched": sum(1 for x in rows if x["actual_sales"] is not None), "expected_sum": tot_p, "actual_sum": tot_a,
            "ratio": tot_a / tot_p if tot_p else None,
            "note": "실적은 PROMO_WORK에 같은 SEQ·유형·시작일로 들어가고 데이터를 갱신한 뒤에 맞춰집니다. 실적 = 세팅 할인율 ±2%p 판매."}

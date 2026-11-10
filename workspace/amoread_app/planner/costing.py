# -*- coding: utf-8 -*-
"""
SEQ 원가 계산.

규칙 (사용자 확정 2026-10-16)
- 원가 = 상품장 이동평균가 (SAP 기준)
- 단일상품: SEQ_MASTER의 SAP 중 가장 큰 숫자 코드(최신 리뉴얼) 1개. 그 코드가 상품장에 없으면 상품장에 있는 다음 최신 코드.
- 조합상품: 구성 SAP 원가 합 (같은 SAP가 여러 줄이면 그만큼 수량)
- 930… 포장재 = 0원
- 보자기 완제품(S… / 960… 코드)은 상품장에 없다 → 본품(이름에서 [보자기] 태그를 뗀 SEQ) 원가 + 보자기 원가
  (일반 4,000원 / 한정 9,000원)
- 정가: 단일 = SEQ_MASTER 정가 최댓값, 조합 = 구성 정가 합 (엑셀 'SEQ정가합계(자동)'과 같은 규칙)
"""
import difflib
import re

import pandas as pd

from . import config
from .sources import _sap_key

WRAP_TAG = re.compile(r"^\s*\[[^\]]*보자기[^\]]*\]\s*")


def _is_wrap_code(sap) -> bool:
    return isinstance(sap, str) or (isinstance(sap, int) and str(sap).startswith("960"))


def _is_packaging(sap) -> bool:
    return isinstance(sap, int) and str(sap).startswith("930")


def _norm_name(s) -> str:
    return re.sub(r"\s+", "", str(s or ""))


def _num(v):
    n = pd.to_numeric(v, errors="coerce")
    return None if pd.isna(n) else float(n)


def build_seq_table(master_rows, cost_df: pd.DataFrame, wrap_overrides: dict = None) -> pd.DataFrame:
    """master_rows: ops.core.promo_workbook.MasterRow 목록. 반환: SEQ별 원가표.
    wrap_overrides: {보자기SEQ: 본품SEQ}: 이름으로 본품을 못 찾는 보자기 상품용 (settings/보자기_본품지정.csv)"""
    wrap_overrides = wrap_overrides or {}
    cost = {r.sap: r for r in cost_df.itertuples(index=False)}
    by_seq = {}
    for m in master_rows:
        sap = _sap_key(m.sap)
        if not m.seq or sap is None:
            continue
        by_seq.setdefault(m.seq, []).append({"sap": sap, "sap_name": m.sap_name, "name": m.name,
                                             "category": m.category, "type": str(m.product_type or "").strip(),
                                             "price": _num(m.price)})

    def stock_of(sap):
        r = cost.get(sap)
        if r is None:
            return None
        vals = [v for v in (r.logistics_stock, r.sales_stock) if v == v and v is not None]
        return sum(vals) if vals else None

    # 1차: 보자기 아닌 SEQ 원가
    rows = {}
    wrap_seqs = []
    for seq, items in by_seq.items():
        first = items[0]
        ptype = first["type"]
        prices = [i["price"] for i in items if i["price"] is not None]
        price = (max(prices) if ptype == "단일상품" else sum(prices)) if prices else None
        base = {"seq": seq, "name": str(first["name"] or "").strip(), "category": first["category"],
                "product_type": ptype, "price": price}
        if ptype == "단일상품":
            nums = sorted({i["sap"] for i in items if isinstance(i["sap"], int) and not _is_wrap_code(i["sap"])},
                          reverse=True)
            if not nums:
                wrap_seqs.append((seq, base, items))
                continue
            in_sheet = [s for s in nums if s in cost and cost[s].cost == cost[s].cost]
            if in_sheet:
                sap = in_sheet[0]
                note = "" if sap == nums[0] else f"최신 SAP {nums[0]} 상품장에 없음 → {sap} 원가 사용"
                rows[seq] = {**base, "cost": float(cost[sap].cost), "status": "정상" if not note else "구SAP 원가",
                             "note": note, "components": [{"sap": sap, "name": cost[sap].sap_name,
                                                           "cost": float(cost[sap].cost)}],
                             "stock": stock_of(sap)}
            else:
                rows[seq] = {**base, "cost": None, "status": "원가 누락", "note": f"SAP {nums[0]} 상품장에 없음",
                             "components": [{"sap": nums[0], "name": items[0]["sap_name"], "cost": None}],
                             "stock": None}
        else:
            comps, missing, deferred = [], [], False
            for i in items:
                sap = i["sap"]
                if _is_packaging(sap):
                    comps.append({"sap": sap, "name": i["sap_name"], "cost": 0.0})
                elif _is_wrap_code(sap):
                    comps.append({"sap": sap, "name": i["sap_name"], "cost": None, "wrap": True})
                    deferred = True
                elif sap in cost and cost[sap].cost == cost[sap].cost:
                    comps.append({"sap": sap, "name": cost[sap].sap_name, "cost": float(cost[sap].cost)})
                else:
                    comps.append({"sap": sap, "name": i["sap_name"], "cost": None})
                    missing.append(str(sap))
            if deferred:
                wrap_seqs.append((seq, base, items))
                continue
            stocks = {}
            for c in comps:
                if not _is_packaging(c["sap"]):
                    stocks.setdefault(c["sap"], [stock_of(c["sap"]), 0])
                    stocks[c["sap"]][1] += 1
            st = [s // n for s, n in stocks.values() if s is not None]
            rows[seq] = {**base, "cost": None if missing else sum(c["cost"] for c in comps),
                         "status": "원가 누락" if missing else "정상",
                         "note": f"SAP {', '.join(missing)} 상품장에 없음" if missing else "",
                         "components": comps, "stock": min(st) if st and len(st) == len(stocks) else None}

    # 2차: 보자기 완제품 → 본품 원가 + 보자기
    plain = {_norm_name(r["name"]): s for s, r in rows.items() if r["cost"] is not None}
    plain_names = list(plain)
    wrap_cost_by_sap = {}

    def wrap_base(names):
        """보자기 SEQ의 이름들(SEQ_MASTER에 여러 표기가 있을 수 있음)로 본품 SEQ를 찾는다.
        1) 태그 뗀 이름 완전일치 → 2) 본품 이름이 그 이름으로 시작(유일할 때) → 3) 아주 비슷한 이름(0.9 이상)"""
        keys = [_norm_name(WRAP_TAG.sub("", n)) for n in names if n]
        for key in keys:
            if key in plain:
                return plain[key], ""
        for key in keys:
            starts = [n for n in plain_names if n.startswith(key)]
            if len(starts) == 1:
                return plain[starts[0]], f"'{rows[plain[starts[0]]]['name']}' 원가 사용"
        for key in keys:
            near = difflib.get_close_matches(key, plain_names, n=1, cutoff=0.9)
            if near:
                return plain[near[0]], f"유사 이름 '{rows[plain[near[0]]]['name']}' 원가 사용"
        return None, ""

    for seq, base, items in [w for w in wrap_seqs if w[1]["product_type"] == "단일상품"]:
        limited = "한정" in base["name"]
        wrap = config.WRAP_COST_LIMITED if limited else config.WRAP_COST
        names = [base["name"]] + [str(i["name"] or "") for i in items if str(i["name"] or "") != base["name"]]
        ov = wrap_overrides.get(seq)
        if ov and ov in rows and rows[ov]["cost"] is not None:
            bseq, near_note = ov, "본품 지정(설정 파일)"
        else:
            bseq, near_note = wrap_base(names)
        label = f"보자기({'한정 ' if limited else ''}{wrap:,}원 가산)"
        if bseq is None:
            rows[seq] = {**base, "cost": None, "status": "원가 누락", "note": "보자기 본품을 이름으로 찾지 못함",
                         "components": [], "stock": None}
            continue
        c = rows[bseq]["cost"] + wrap
        rows[seq] = {**base, "cost": c, "status": label, "note": f"본품 SEQ {bseq} 원가 + 보자기. {near_note}".strip(),
                     "components": [{"sap": f"SEQ{bseq}", "name": rows[bseq]["name"], "cost": rows[bseq]["cost"]},
                                    {"sap": "보자기", "name": "한정 보자기" if limited else "보자기", "cost": float(wrap)}],
                     "stock": rows[bseq]["stock"]}
        for i in items:
            if _is_wrap_code(i["sap"]):
                wrap_cost_by_sap[i["sap"]] = c

    for seq, base, items in [w for w in wrap_seqs if w[1]["product_type"] != "단일상품"]:
        comps, missing = [], []
        for i in items:
            sap = i["sap"]
            if _is_packaging(sap):
                comps.append({"sap": sap, "name": i["sap_name"], "cost": 0.0})
            elif _is_wrap_code(sap):
                v = wrap_cost_by_sap.get(sap)
                comps.append({"sap": sap, "name": i["sap_name"], "cost": v})
                if v is None:
                    missing.append(str(sap))
            elif sap in cost and cost[sap].cost == cost[sap].cost:
                comps.append({"sap": sap, "name": cost[sap].sap_name, "cost": float(cost[sap].cost)})
            else:
                comps.append({"sap": sap, "name": i["sap_name"], "cost": None})
                missing.append(str(sap))
        rows[seq] = {**base, "cost": None if missing else sum(c["cost"] for c in comps),
                     "status": "원가 누락" if missing else "보자기 포함 조합",
                     "note": f"SAP {', '.join(missing)} 원가 없음" if missing else "", "components": comps,
                     "stock": None}

    # 예전 기준 원가(손익예측 시트)로 채운 구성품이 있으면 표시 — 화면에서 '구 원가'로 구분
    old_saps = set(cost_df.loc[cost_df["cost_source"].astype(str).str.startswith("구"), "sap"]) \
        if "cost_source" in cost_df else set()

    def uses_old(r, depth=0):
        for c in r.get("components") or []:
            s = c.get("sap")
            if s in old_saps:
                return True
            if isinstance(s, str) and s.startswith("SEQ") and depth == 0 and s[3:] in rows:
                if uses_old(rows[s[3:]], 1):
                    return True
        return False

    for r in rows.values():
        r["old_cost"] = bool(r["cost"] is not None and uses_old(r))
        if r["old_cost"]:
            r["note"] = (r["note"] + " · " if r["note"] else "") + "구 상품정보 원가 포함(예전 기준)"

    df = pd.DataFrame(rows.values())
    df["cost_ratio"] = df["cost"] / (df["price"] / config.VAT)
    df["max_discount"] = 1 - df["cost"] * config.VAT / config.TARGET_COST_RATIO / df["price"]
    df["price_band"] = df["price"].map(config.price_band)
    return df.sort_values("seq", key=lambda s: s.astype(int)).reset_index(drop=True)


def max_discount_for(price: float, cost: float, target: float = None) -> float:
    """정가·원가가 주어졌을 때 '할인 후 원가율 ≤ target'을 지키는 최대 할인율."""
    target = target or config.TARGET_COST_RATIO
    return 1 - cost * config.VAT / target / price


def cost_ratio_after(price: float, cost: float, rate: float) -> float:
    """할인율 rate 적용 후 원가율."""
    return cost / (price * (1 - rate) / config.VAT)

# -*- coding: utf-8 -*-
"""
외부 신호 ② 고객 반응: 리뷰 주간 수집기(review_weekly_collector) 결과 CSV × 오설록 실적.

- 최근 REVIEW_WEEKS개 주차 파일(리뷰_YYYYMMDD_YYYYMMDD.csv)을 읽기만 한다.
- 개인정보 보호: 작성자 열은 아예 읽지 않는다(usecols). 화면에는 후기 일부(60자)만 근거로 보여준다.
- 언급 집계는 단순 단어 포함 규칙(AI 아님): 선물 / 재구매 / 할인 / 아쉬움(평점 3 이하).
"""
import re
from pathlib import Path

import pandas as pd

from . import config
from .engine import DATA, _f

COLS = ["리뷰ID", "SEQ", "상품명", "평점", "등록일", "구매후기", "나만의TIP", "베스트여부"]
MENTIONS = {
    "gift": re.compile(r"선물|선물용|드렸|드리|부모님|어머니|아버지|지인|친구에게|감사 ?인사"),
    "repeat": re.compile(r"재구매|또 ?구매|또 ?샀|또 ?주문|다시 ?구매|n번째|몇 ?번째|계속 ?구매|항상 ?구매"),
    "discount": re.compile(r"할인|세일|쿠폰|특가|저렴|가성비"),
}
_cache = {"key": None, "data": None}


def _files():
    d = Path(config.REVIEW_DIR)
    if not d.exists():
        return []
    return sorted(d.glob("리뷰_*.csv"))[-config.REVIEW_WEEKS:]


def _load():
    files = _files()
    key = tuple((f.name, int(f.stat().st_mtime)) for f in files)
    if _cache["key"] == key:
        return _cache["data"]
    frames = []
    for f in files:
        for enc in ("utf-8-sig", "cp949"):
            try:
                frames.append(pd.read_csv(f, encoding=enc, usecols=lambda c: c in COLS, dtype=str))
                break
            except UnicodeDecodeError:
                continue
            except ValueError:
                break
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=COLS)
    if not df.empty:
        df = df.drop_duplicates("리뷰ID") if "리뷰ID" in df else df
        df["SEQ"] = df["SEQ"].fillna("").str.replace(r"\.0$", "", regex=True).str.strip()
        df["평점"] = pd.to_numeric(df["평점"], errors="coerce")
        df["text"] = (df.get("구매후기", "").fillna("") + " " + df.get("나만의TIP", "").fillna("")).str.strip()
    data = {"df": df, "files": [f.name for f in files]}
    _cache.update(key=key, data=data)
    return data


def _quote(t, n=60):
    t = re.sub(r"\s+", " ", str(t or "")).strip()
    return t if len(t) <= n else t[:n] + "…"


_seq_cache = {"key": None, "data": None}


def by_seq():
    """SEQ → 리뷰 요약 (수·평점·언급 수·근거 후기 2개).
    2026-11-10: 리뷰 파일이 그대로면 요약을 다시 계산하지 않는다 (상품 상세를 부를 때마다 전체 리뷰를 다시 묶느라 요청 하나에 1초 넘게 걸리던 것)."""
    d = _load()
    if _seq_cache["key"] is not None and _seq_cache["key"] == _cache["key"]:
        return _seq_cache["data"]
    res = _by_seq(d)
    _seq_cache.update(key=_cache["key"], data=res)
    return res


def _by_seq(d):
    df = d["df"]
    out = {}
    if df.empty:
        return out, d["files"]
    for seq, g in df.groupby("SEQ"):
        if not seq:
            continue
        txt = g["text"]
        rec = {"seq": seq, "n": int(len(g)), "avg": float(g["평점"].mean()) if g["평점"].notna().any() else None,
               "low": int((g["평점"] <= 3).sum())}
        for k, rx in MENTIONS.items():
            rec[k] = int(txt.str.contains(rx).sum())
        best = g.sort_values(["베스트여부", "평점"], ascending=[False, False]) if "베스트여부" in g else g
        gift = g[txt.str.contains(MENTIONS["gift"])]
        picks = list(gift["text"][:1]) + [t for t in best["text"] if t not in list(gift["text"][:1])][:2]
        rec["quotes"] = [_quote(t) for t in picks[:2] if t]
        lows = g[g["평점"] <= 3]["text"]
        rec["low_quotes"] = [_quote(t) for t in lows[:2] if t]
        out[seq] = rec
    return out, d["files"]


def overview(min_reviews=3):
    DATA.ensure()
    stats, files = by_seq()
    rows = []
    for seq, r in stats.items():
        p = DATA.products.get(seq)
        if not p:
            continue
        rows.append({**r, "name": p.get("name"), "category": p.get("category"), "price": _f(p.get("price")),
                     "max_discount": _f(p.get("max_discount")), "sales_28": _f(p.get("sales_28")),
                     "growth_28": _f(p.get("growth_28")), "days_since_promo": p.get("days_since_promo"),
                     "scheduled": bool(p.get("upcoming") or p.get("running")), "active": bool(p.get("active"))})
    good = sorted((r for r in rows if r["n"] >= min_reviews and (r["avg"] or 0) >= 4.7 and r["active"]),
                  key=lambda r: (-(r["n"]), -(r["avg"] or 0)))
    gift = sorted((r for r in rows if r["gift"] >= 2 and r["active"]), key=lambda r: -r["gift"])
    low = sorted((r for r in rows if r["low"] >= 1), key=lambda r: (-r["low"], r["avg"] or 5))
    total = sum(r["n"] for r in rows)
    return {"available": bool(files), "files": files, "weeks": len(files), "reviews": total, "products": len(rows),
            "good": good[:30], "gift": gift[:15], "low": low[:10],
            "source_dir_hint": "review_weekly_collector\\output", "min_reviews": min_reviews,
            "note": f"최근 {len(files)}주 리뷰 {total:,}건 (오설록몰). 반응 좋음 = 리뷰 {min_reviews}건 이상·평점 4.7 이상. "
                    "언급 수는 단어 포함 규칙(선물·재구매·할인)으로 센 값이라 문맥은 근거 후기로 확인하세요. 작성자 정보는 읽지 않습니다."}


def for_product(seq):
    stats, _ = by_seq()
    return stats.get(str(seq))

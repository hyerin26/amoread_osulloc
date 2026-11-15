# -*- coding: utf-8 -*-
"""
레퍼런스 색인 만들기: 수집·분석해 둔 섹션 파일 → planner/data/ai_refs/ (git에 올리지 않는 폴더).

  python -m amoread.ai.build_index --src <unified 폴더>           # 키워드 검색용 (표준)
  python -m amoread.ai.build_index --export-labels labels.csv       # 분류 라벨을 검수용 CSV로 (엑셀로 고친 뒤)
  python -m amoread.ai.build_index --import-labels labels.csv       # 고친 칸만 저장 → 다음 색인부터 유지
  python -m amoread.ai.build_index --src <unified 폴더> --vectors  # 의미 벡터도 계산 (sentence-transformers 필요, 모델 처음 한 번 내려받음)

--src 폴더에 필요한 파일: sections_unified.jsonl, pages_meta.jsonl (reference_ai/build_unified.py가 수집 데이터에서 만든다. role이 하나로 합쳐져 있다)
출력: sections.jsonl (섹션 한 줄 = 한 구좌), pages.json (페이지별 이름·출처·구좌 이름 목록), vectors.npy (선택)
외부 사이트에서 모은 자료라 저장소에 올리지 않는다 (planner/data/는 .gitignore).
"""
import argparse
import json
import re
from pathlib import Path

from . import labeling, refs, rules


def clean(t: str) -> str:
    t = re.sub(r"(마켓 뷰티\s*)+", " ", t or "")           # 컬리 화면의 내비게이션 문구가 글에 섞여 있음
    t = re.sub(r"\b(\w+)( \1\b)+", r"\1", t)               # 'BENEFIT BENEFIT' 같은 반복
    return re.sub(r"\s+", " ", t).strip()


def campaign_name(meta: dict) -> str:
    t = (meta.get("title") or "").split("\n")[0].strip()
    if t.upper() == "SHOWCASE" or len(t) < 6:             # 29cm 목록 문구는 모두 'SHOWCASE'라 페이지 제목에서 사이트 이름을 뺀다
        t = re.sub(r"\s*-\s*모든 취향 곁에, 29CM$", "", meta.get("page_title") or meta.get("page_id") or "")
    return t[:70]


def section_title(row: dict, heads: list[str]) -> str:
    h = next((x for x in heads if x and len(x) >= 3), "")
    return (h or re.split(r"[.|/]| {2,}", row["text"])[0] or row["text"])[:30].strip()


SKIP_ROLES = {"ui_noise", "empty"}   # 검색할 글이 없는 구좌 (글이 없어도 이미지 설명(alt)이 있으면 그 설명으로 찾는다)


def passage(s: dict) -> str:
    t = (s.get("text") or "")
    t = (s.get("alt") or "") if t in ("", "None") else t[:600]
    h = " / ".join((s.get("headings") or [])[:2])
    return f"{h}. {t}".strip(". ").strip()


NOT_ROLES = {"ui_noise", "empty", "image_block", "content", "visual_gallery"}   # 구좌 구성 통계에서 뺄 값 (이미지뿐이거나 정해지지 않은 것)


def type_stats(full: list[dict], metas: dict) -> dict:
    """수집한 페이지마다 같은 규칙(rules.decide)으로 유형을 붙이고, 유형별로 '그 역할을 가진 페이지 수'를 센다.
    규칙이 낸 구성이 실제 사례와 얼마나 맞는지 점검하고, 새 데이터가 들어오면 숫자가 저절로 바뀌게 하려는 것."""
    by_page: dict[str, list[dict]] = {}
    for s in full:
        by_page.setdefault(s["page_id"], []).append(s)
    stats: dict[str, dict] = {}
    for pid, secs in by_page.items():
        meta = metas.get(pid) or {}
        if meta.get("status") not in (None, "captured") or len(secs) < 2:   # 본문을 못 얻은 페이지는 뺀다
            continue
        hero = next((s["text"] for s in sorted(secs, key=lambda x: int(x["order"])) if s["role"] == "hero" and s.get("text") not in ("", "None")), "")
        doc = {"title": campaign_name(meta), "brief": {"myeongbun": campaign_name(meta), "concept": hero[:300]}, "v2": {}}
        _, main, undecided = rules.decide(doc)
        t = "generic" if undecided else main["type"]
        e = stats.setdefault(t, {"pages": 0, "roles": {}, "brands": {}, "role_brands": {}})
        e["pages"] += 1
        e["brands"][meta.get("brand") or secs[0]["brand"]] = e["brands"].get(meta.get("brand") or secs[0]["brand"], 0) + 1
        for r in {s["role"] for s in secs} - NOT_ROLES:
            e["roles"][r] = e["roles"].get(r, 0) + 1
            b = meta.get("brand") or secs[0]["brand"]
            if b not in e["role_brands"].setdefault(r, []):
                e["role_brands"][r].append(b)
    return stats


def label_pages(full: list[dict], metas: dict, out: Path) -> dict:
    """페이지마다 분류 라벨을 붙여 page_labels.json에 저장 (원본은 건드리지 않음). 사람이 고친 값(label_overrides.json)은 그대로 덮어 쓴다."""
    by: dict[str, list[dict]] = {}
    for s in full:
        by.setdefault(s["page_id"], []).append(s)
    labels = {}
    for pid, secs in by.items():
        meta = metas.get(pid) or {}
        if meta.get("status") not in (None, "captured", "app_handoff"):
            continue
        page = {"listing_label": meta.get("title"), "page_title": meta.get("page_title"), "collected_date": meta.get("collected_date"), "sections": secs}
        labels[pid] = labeling.classify_page(page)
    try:
        over = json.loads((out / "label_overrides.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        over = {}
    labels = labeling.apply_overrides(labels, over)
    (out / "page_labels.json").write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    return labels


def build(src: Path, out: Path, vectors: bool = False, html_dir: Path | None = None) -> dict:
    """src 폴더의 sections_unified.jsonl(role 하나로 합친 섹션)·pages_meta.jsonl → out. 벡터는 같은 행 순서로 직접 계산한다."""
    full = [json.loads(x) for x in (src / "sections_unified.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    metas = {p["page_id"]: p for p in map(json.loads, (src / "pages_meta.jsonl").read_text(encoding="utf-8").splitlines())}
    out.mkdir(parents=True, exist_ok=True)
    lines, pages = [], {}
    for s in full:
        text = clean(passage(s))
        if s["role"] in SKIP_ROLES or not text:
            continue
        meta = metas[s["page_id"]]
        title = section_title({"text": text}, s.get("headings") or [])
        lines.append({"id": f"{s['page_id']}:{s['sec_id']}", "page_id": s["page_id"], "brand": s["brand"], "role": s["role"], "title": title,
                      "campaign": f"{s['brand']} · {campaign_name(meta)}", "url": meta["url"], "order": int(s["order"]), "text": text[:600], "images": s.get("images") or [], **labeling.classify_section(s)})
        pg = pages.setdefault(s["page_id"], {"name": campaign_name(meta), "brand": s["brand"], "url": meta["url"], "secs": []})
        pg["secs"].append(title)
    (out / "sections.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in lines) + "\n", encoding="utf-8")
    (out / "pages.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    labels = label_pages(full, metas, out)
    stats = type_stats(full, metas)
    (out / "type_stats.json").write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")
    if vectors:
        import numpy as np
        from sentence_transformers import SentenceTransformer
        m = SentenceTransformer(refs.DENSE_MODEL)
        x = m.encode(["passage: " + r["text"] for r in lines], batch_size=32, normalize_embeddings=True, show_progress_bar=False)
        np.save(out / "vectors.npy", x)   # 행 순서가 sections.jsonl과 같다
    snaps = 0
    if html_dir and html_dir.is_dir():   # 수집본 화면용 저장본 (외부 링크가 만료돼도 볼 수 있게)
        from . import snapshot
        for pid in pages:
            f = html_dir / f"{pid}.html"
            if f.exists():
                snapshot.save(out, pid, f.read_text(encoding="utf-8", errors="ignore"))
                snaps += 1
    return {"sections": len(lines), "pages": len(pages), "vectors": vectors, "snapshots": snaps}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, help="sections_unified.jsonl 등이 있는 폴더")
    ap.add_argument("--out", type=Path, default=refs.AI_DIR, help="출력 폴더 (기본: planner/data/ai_refs)")
    ap.add_argument("--html-dir", type=Path, help="수집한 페이지 HTML 폴더(<페이지 id>.html). 있으면 수집본 화면용으로 가볍게 줄여 색인 폴더/html에 저장")
    ap.add_argument("--vectors", action="store_true", help="의미 벡터도 계산")
    ap.add_argument("--export-labels", type=Path, help="분류 라벨을 검수용 CSV로 내보내기 (색인을 만든 뒤)")
    ap.add_argument("--import-labels", type=Path, help="검수한 CSV에서 고친 칸을 label_overrides.json에 저장 (다음 색인부터 유지)")
    a = ap.parse_args()
    if a.export_labels or a.import_labels:
        labels = json.loads((a.out / "page_labels.json").read_text(encoding="utf-8"))
        if a.export_labels:
            pages = json.loads((a.out / "pages.json").read_text(encoding="utf-8"))
            print("내보냄:", labeling.export_csv(labels, pages, a.export_labels), "페이지 →", a.export_labels)
        else:
            print("고친 페이지:", labeling.import_overrides(a.import_labels, a.out / "page_labels.json", a.out / "label_overrides.json"))
    elif a.src:
        print(build(a.src, a.out, a.vectors, a.html_dir))
    else:
        ap.error("--src 또는 --export-labels / --import-labels 가 필요해요")

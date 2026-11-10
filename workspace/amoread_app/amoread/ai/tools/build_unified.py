"""수집 데이터(reference/data) → 역할이 하나로 합쳐진 섹션 파일.

예전에는 role(수집 원본, 'content'가 228개로 뭉쳐 있음)과 role_v2(우리가 세분화)를 따로 뒀다.
여기서 하나로 합친다: role = 세분화한 값 (원본이 'content'일 때만 규칙으로 세분화, 나머지는 원본 그대로).
  - role_v1 = 수집 원본 값 (되짚어 볼 때만), role_source = 'kept' | 'rule:…' | 'unresolved'
  - 같은 뜻의 다른 이름은 한 이름으로 ('terms' → 'terms_notice')
원본 JSON은 건드리지 않는다 (읽기만). 사용: python build_unified.py <reference/data 폴더> [출력 폴더]
출력: sections_unified.jsonl, pages_meta.jsonl
"""
import glob, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from reclassify_roles import v2

ALIAS = {"terms": "terms_notice"}

def main(src, out):
    secs, pages = [], []
    for f in sorted(glob.glob(str(pathlib.Path(src) / "pages/*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        ss = d.get("sections") or []
        rows = []
        assets = {a["id"]: a for a in d.get("image_assets") or []}
        for s in ss:
            ims = [assets[i] for i in s.get("image_ids") or [] if i in assets]
            alt = " ".join(dict.fromkeys(a["alt"].strip() for a in ims if (a.get("alt") or "").strip()))[:300]   # 글이 없는 구좌의 단서 (이미지 설명)
            urls = [a["url"] for a in ims if a.get("url")][:3]
            row = {"page_id": d["id"], "brand": d["brand"], "sec_id": s["id"], "order": s["order"], "n_total": len(ss), "role": s["role"],
                   "role_evidence": s.get("role_evidence"), "headings": s.get("headings") or [], "text": (s.get("text") or "").strip(),
                   "n_images": len(s.get("image_ids") or []), "n_links": len(s.get("relationship_indexes") or [])}
            probe = dict(row, text=row["text"] if row["text"] not in ("", "None") else (alt if len(alt) >= 14 else ""))   # 글이 없으면 이미지 설명(14자 이상일 때만)으로 역할을 짚는다
            role, ev = v2(probe)                     # 'content'만 세분화, 나머지는 그대로 ('kept')
            row["alt"], row["images"] = alt, urls
            role_v1 = row.pop("role")
            row["role"] = ALIAS.get(role, role)
            row["role_v1"] = role_v1
            row["role_source"] = "unresolved" if ev == "unresolved" else ev
            rows.append(row)
        secs += rows
        pages.append({"page_id": d["id"], "brand": d["brand"], "url": d["url"], "status": d.get("status"), "title": d.get("listing_label"),
                      "page_title": d.get("title"), "n_sections": len(ss), "roles": [r["role"] for r in rows]})
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    for name, rows in (("sections_unified.jsonl", secs), ("pages_meta.jsonl", pages)):
        with open(out / name, "w", encoding="utf-8") as fh:
            for r in rows: fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    import collections
    print(len(pages), "pages", len(secs), "sections")
    print(collections.Counter(s["role"] for s in secs).most_common())
    print("unresolved:", sum(s["role_source"] == "unresolved" for s in secs))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent / "unified")

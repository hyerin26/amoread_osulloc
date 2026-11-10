"""제품이 쓰는 검색(amoread.ai.refs)을 그대로 평가. 라벨은 '페이지:섹션' ID로 키를 바꿔 쓴다 (옛 라벨은 옛 행 번호 기준이라 변환).
usage: AMOREAD_AI_DENSE=0|1 python eval_product.py [--unlabeled]  (PYTHONPATH=<osulloc>/workspace/amoread_app)"""
import json, os, sys, pathlib, collections, numpy as np
d = pathlib.Path(__file__).resolve().parent
from amoread.ai import refs
Q = json.load(open(d/"queries.json", encoding="utf-8"))
OLD_BRANDS = {"29cm", "kurly", "osulloc"}
def labels():
    return json.load(open(d/"labels_by_id.json", encoding="utf-8"))   # {질의: {"페이지:섹션": 0|1|2}} — AI가 붙인 라벨(사람 검수 전)
L = labels()
FOOD_BRANDS = {"osulloc", "kurly", "kakao_gift", "dongwonmall", "hankkitongsal", "cjthemarket"}   # 식품·선물 몰 (우리와 같은 영역)
FOOD = []
def run(only_old=False, show_unlabeled=False):
    FOOD.clear()
    nd, p5, hit, un, rows = [], [], [], 0, []
    for q in Q:
        top = refs.search(q["text"], [q["role"]], k=40 if only_old else 5)   # 제품은 구좌마다 3~5개만 받는다
        if only_old: top = [r for r in top if r["brand"] in OLD_BRANDS]
        top = top[:5]; lab = L.get(q["qid"], {})
        g = [lab.get(r["id"]) for r in top]; un += sum(x is None for x in g); g0 = [x or 0 for x in g]
        best = sorted(lab.values(), reverse=True)[:5]; idcg = sum((2**x-1)/np.log2(i+2) for i, x in enumerate(best))
        nd.append(sum((2**x-1)/np.log2(i+2) for i, x in enumerate(g0))/idcg if idcg else 0)
        p5.append(np.mean([x == 2 for x in g0])); hit.append(float(any(x == 2 for x in g0))); FOOD.append(np.mean([r["brand"] in FOOD_BRANDS for r in top]))
        if show_unlabeled:
            for r, x in zip(top, g):
                if x is None: rows.append((q["qid"], q["text"], r["id"], r["brand"], r["role"], r["text"][:110]))
    return np.mean(nd), np.mean(p5), np.mean(hit), un, rows
if __name__ == "__main__":
    mode = refs.status()["mode"]; U = []
    for name, kw in (("all malls", dict()),) if "--all-only" in sys.argv else (("old malls only", dict(only_old=True)), ("all malls", dict())):
        a = run(**kw, show_unlabeled="--unlabeled" in sys.argv); U.extend(a[4])
        print(f"[{mode}] {name:15s} nDCG@5 {a[0]:.3f}  P@5 {a[1]:.3f}  Hit@5 {a[2]:.3f}  식품몰비율@5 {np.mean(FOOD):.2f}  unlabeled {a[3]}")
    if "--unlabeled" in sys.argv:
        p = d/"unlabeled_new.json"; old = json.load(open(p, encoding="utf-8")) if p.exists() else []
        seen = {(x[0], x[2]) for x in old}; old += [list(x) for x in U if (x[0], x[2]) not in seen and not seen.add((x[0], x[2]))]
        json.dump(old, open(p, "w", encoding="utf-8"), ensure_ascii=False); print(len(old), "unlabeled saved")

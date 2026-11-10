"""새 수집 데이터가 오면 한 번에: 합치기 → 색인(벡터 포함) → 평가 → 지난번과 비교.
usage: python amoread/ai/tools/refresh.py <reference/data 폴더> [--app <osulloc>/workspace/amoread_app] [--no-vectors]
- 결과 점수는 eval_history.jsonl에 쌓고, 지난번보다 nDCG가 0.03 넘게 떨어지면 경고한다.
- 분류 라벨(명분·분류·혜택 방식)은 자동으로 붙고 label_review.csv로 내보낸다. 엑셀에서 고친 뒤 `python -m amoread.ai.build_index --import-labels label_review.csv`로 저장하면 다음 갱신부터 그대로 유지된다.
- 새 데이터로 들어온 섹션 중 라벨이 없는 것이 top5에 나오면 개수를 알려 준다(라벨을 더 붙여야 평가가 믿을 만하다)."""
import json, os, subprocess, sys, time, pathlib, argparse
d = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser(); ap.add_argument("data"); ap.add_argument("--app", default=str(d.parents[2])); ap.add_argument("--no-vectors", action="store_true")
a = ap.parse_args(); py = sys.executable
env = dict(os.environ, PYTHONUTF8="1", PYTHONPATH=a.app)
def run(*cmd, **kw): return subprocess.run(cmd, env=dict(env, **kw.get("env", {})), cwd=kw.get("cwd"), capture_output=True, text=True)
print("1) 역할 합치기"); r = run(py, str(d / "build_unified.py"), a.data); print("   ", r.stdout.strip().splitlines()[0], "|", r.stdout.strip().splitlines()[-1]); r.returncode and sys.exit(r.stderr)
print("2) 색인 만들기"); r = run(py, "-m", "amoread.ai.build_index", "--src", str(d / "unified"), *([] if a.no_vectors else ["--vectors"]), cwd=a.app); print("   ", r.stdout.strip().splitlines()[-1]); r.returncode and sys.exit(r.stderr)
r = run(py, "-m", "amoread.ai.build_index", "--export-labels", str(d / "label_review.csv"), cwd=a.app); print("   분류 라벨 검수표:", r.stdout.strip().split("→")[-1].strip() or r.stderr[-200:])
import collections
lb = json.load(open(pathlib.Path(a.app) / "planner/data/ai_refs/page_labels.json", encoding="utf-8"))
print("   자동 분류 현황: 분류", dict(collections.Counter(v["cls"] or "미정" for v in lb.values())), "| 사람이 고친 것", sum(v["labeled_by"] == "human" for v in lb.values()), "개")
print("3) 평가"); res = {}
for mode in (["0"] if a.no_vectors else ["0", "1"]):
    r = run(py, str(d / "eval_product.py"), "--all-only", env={"AMOREAD_AI_DENSE": mode}, cwd=str(d))
    line = next(l for l in r.stdout.splitlines() if l.startswith("["))
    nd = float(line.split("nDCG@5")[1].split()[0]); hit = float(line.split("Hit@5")[1].split()[0]); un = int(line.split("unlabeled")[1])
    res["vector" if mode == "1" else "keyword"] = {"nDCG": nd, "Hit": hit, "unlabeled": un}; print("   ", line)
hist = d / "eval_history.jsonl"; prev = [json.loads(x) for x in hist.read_text().splitlines()] if hist.exists() else []
rec = {"t": time.strftime("%Y-%m-%d %H:%M"), "data": str(a.data), **res}
with open(hist, "a", encoding="utf-8") as f: f.write(json.dumps(rec, ensure_ascii=False) + "\n")
if prev:
    for k, v in res.items():
        if k in prev[-1] and v["nDCG"] < prev[-1][k]["nDCG"] - 0.03: print(f"   ⚠ {k} nDCG가 지난번 {prev[-1][k]['nDCG']:.3f}보다 {prev[-1][k]['nDCG'] - v['nDCG']:.3f} 떨어졌어요")
        elif k in prev[-1]: print(f"   {k} nDCG 지난번 {prev[-1][k]['nDCG']:.3f} → {v['nDCG']:.3f}")
if any(v["unlabeled"] for v in res.values()): print("   ※ 라벨 없는 결과가 있어요:", {k: v["unlabeled"] for k, v in res.items()}, "→ `eval_product.py --unlabeled`로 뽑아 라벨을 붙이세요")
print("완료. 서버는 색인이 바뀐 것을 알아서 다시 읽습니다.")

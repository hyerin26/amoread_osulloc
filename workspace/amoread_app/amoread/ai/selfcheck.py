# -*- coding: utf-8 -*-
"""
AI 데이터 자체 점검: 코딩을 모르는 담당자도 '지금 레퍼런스 추천이 믿을 만한 상태인지' 알 수 있게, 파일이 서로 맞는지 스스로 확인한다.

- 읽기만 한다 (아무것도 고치거나 지우지 않는다). 결과는 [{level, title, detail, fix}] — level: ok / warn / error. fix는 사람이 할 일 한 줄.
- 쓰는 곳: 서버가 켜질 때 한 줄 요약 출력, 화면·API(/api/am/ai/health), 테스트(tests/test_selfcheck.py), 명령(python -m amoread.ai.selfcheck).
- 새 문제를 알게 되면 여기에 점검을 하나 더하면 된다: 같은 문제가 조용히 반복되지 않게.
"""
import gzip
import json
import sys

from . import feedback, refs, render, rules


GENERIC_ROLES = {"content", "image_block"}   # 역할을 못 정한 일반 구좌: 이름이 없어도 추천에서 쓰지 않으므로 문제 아님


def _row(level, title, detail="", fix=""):
    return {"level": level, "title": title, "detail": detail, "fix": fix}


def run() -> list[dict]:
    out = []
    if not refs._load():
        return [_row("error", "레퍼런스 색인이 없어요", "planner/data/ai_refs 가 비어 있어요. 추천은 규칙 틀만 나오고 사례는 붙지 않아요.", "수집 담당에게 스냅샷을 받아 `python setup_env.py --snapshot <zip>` 을 실행하세요")]
    rows, pages = refs._state["rows"], refs._state["pages"]
    out.append(_row("ok", f"색인 정상: 구좌 {len(rows)}개 · 페이지 {len(pages)}개"))

    own = sum(1 for p in pages.values() if p.get("brand") in refs.PREFER_BRANDS)
    if own < 10:
        out.append(_row("warn", f"자사몰 사례가 {own}개뿐이에요", "추천이 외부(패션·화장품) 사례로 치우칠 수 있어요.", "라이브러리 [신규 프로모션 찾기]에서 오설록 기획전·이벤트를 더 모으세요"))

    orphan = sorted({r["page_id"] for r in rows if r["page_id"] not in pages})
    if orphan:
        out.append(_row("error", f"페이지 정보가 없는 구좌가 있어요 ({len(orphan)}개 페이지)", ", ".join(orphan[:5]), "색인을 다시 만들거나 스냅샷을 다시 받으세요"))

    unknown = sorted({r["role"] for r in rows} - set(rules.ROLE_NAME) - GENERIC_ROLES)
    if unknown:
        out.append(_row("warn", "이름이 정해지지 않은 구좌 역할이 있어요", ", ".join(unknown), "amoread/ai/rules.py ROLE_NAME에 이름을 더하세요 (개발자)"))

    refs.page_season("")   # 라벨 파일을 읽어 두기
    labels = refs._pl["d"]
    missing = [pid for pid in pages if pid not in labels]
    if missing:
        out.append(_row("warn", f"분류 라벨이 없는 페이지 {len(missing)}개", "라이브러리에 안 보이고 계절 보정도 못 받아요.", "`python -m amoread.ai.migrate` 또는 색인을 다시 만드세요"))

    mine = refs._own_items()
    no_cap, no_band, changed = [], [], 0
    for pid, p in mine.items():
        if p.get("content_changed"):
            changed += 1
        if p.get("rendered"):
            if not (render.capture_dir() / pid / "page.html.gz").exists():
                no_cap.append(pid)
            elif not (p.get("layout") or {}).get("bands"):
                no_band.append(pid)
    if no_cap:
        out.append(_row("error", f"수집 화면 파일이 없는 페이지 {len(no_cap)}개", ", ".join(no_cap[:5]), "스냅샷을 다시 받거나 해당 레퍼런스를 지우고 다시 수집하세요 (원본 구좌 이미지가 안 나와요)"))
    if no_band:
        out.append(_row("warn", f"구좌 위치 정보가 없는 페이지 {len(no_band)}개", ", ".join(no_band[:5]), "`python -m amoread.ai.recapture` 로 다시 그려 두세요"))
    if changed:
        out.append(_row("warn" if changed > 0.5 * max(1, len(mine)) else "ok", f"수집 뒤 내용이 바뀐 페이지 {changed}개 (원본 구좌를 못 잘라 글로만 보여요)",
                        "정상 동작이에요. 많을수록 비교가 글 중심이 돼요.", "급하지 않아요. 새 화면으로 다시 수집하면 좋아져요"))

    bad_html = 0
    for pid in list(mine)[:400]:
        f = render.capture_dir() / pid / "page.html.gz"
        if f.exists():
            try:
                with gzip.open(f, "rb") as g:
                    g.read(64)
            except (OSError, EOFError):
                bad_html += 1
    if bad_html:
        out.append(_row("error", f"깨진 수집 화면 파일 {bad_html}개", "", "스냅샷을 다시 받으세요"))

    if not rules.type_stats():
        out.append(_row("warn", "유형별 통계가 없어요", "필수·선택 구좌 보정과 '같은 유형 사례 N개 중 M개' 근거가 빠져요.", "`python -m amoread.ai.build_index` 로 다시 만드세요"))

    try:
        sz = feedback.LOG.stat().st_size
        if sz > 0.8 * feedback.MAX_BYTES:
            out.append(_row("warn", "선택 기록 파일이 거의 찼어요", f"{sz // 1000}KB / {feedback.MAX_BYTES // 1000}KB — 다 차면 더 쓰지 않아요.", "ai_log/events.jsonl 을 보관용으로 옮기고 새로 시작하세요 (개발자)"))
    except OSError:
        pass
    return out


def summary(items: list[dict] | None = None) -> dict:
    items = items if items is not None else run()
    n = {k: sum(1 for x in items if x["level"] == k) for k in ("error", "warn", "ok")}
    return {"status": "error" if n["error"] else "warn" if n["warn"] else "ok", "counts": n, "items": items}


def main() -> int:
    s = summary()
    mark = {"ok": "✔", "warn": "!", "error": "✖"}
    for x in s["items"]:
        print(f"{mark[x['level']]} {x['title']}" + (f"\n    {x['detail']}" if x["detail"] else "") + (f"\n    → {x['fix']}" if x["fix"] and x["level"] != "ok" else ""))
    print(f"\n결과: {'문제 없음' if s['status'] == 'ok' else '확인할 것이 있어요' if s['status'] == 'warn' else '고쳐야 할 문제가 있어요'}")
    return 1 if s["status"] == "error" else 0


if __name__ == "__main__":
    sys.exit(main())

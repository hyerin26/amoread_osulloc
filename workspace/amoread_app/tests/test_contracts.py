# -*- coding: utf-8 -*-
"""화면(JS)과 서버(파이썬) 사이의 약속 점검. 한쪽만 고쳐서 생기던 문제(구좌 종류가 늘었는데 레퍼런스 연결이 안 됨, 화면이 없는 API를 부름 등)를
코딩을 모르는 사람이 찾아내지 않아도, 테스트가 먼저 알려 준다. 새 구좌 종류·API·이벤트를 더하면 여기서 바로 빨갛게 뜬다."""
import re
import unittest
from pathlib import Path

from amoread.ai import api, refs, rules

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "planner" / "static"
V2 = STATIC / "v2"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


class ScreenServerContracts(unittest.TestCase):
    def test_every_editor_layout_has_a_reference_role(self):
        """구좌 편집 화면의 구좌 종류(LAYOUTS)마다 레퍼런스 역할이 따로 정해져 있어야 한다 (정해지지 않으면 전부 '스토리' 사례로 몰렸던 문제)."""
        src = read(V2 / "editor.js")
        block = src[src.index("const LAYOUTS = ["):src.index("const LNAME")]
        ids = re.findall(r"\['([a-z][a-z0-9-]*)', '", block)
        self.assertGreaterEqual(len(ids), 15, "구좌 종류를 읽지 못했어요 (editor.js의 LAYOUTS 모양이 바뀌었나요?)")
        default = refs.roles_for("__unknown__", "")
        for lay in ids:
            roles = refs.roles_for(lay, "x")
            self.assertTrue(roles and all(r in rules.ROLE_NAME for r in roles), lay)
            # 'text-cta'(글 구좌)와 'review'(후기: 맞는 역할이 따로 없음)만 기본값을 써도 된다
            if lay not in ("text-cta", "review", "split", "benefit", "grid2", "grid3", "hero", "deal-banner"):
                self.assertNotEqual(roles, default, f"'{lay}' 구좌 종류에 맞는 레퍼런스 역할이 없어요 — amoread/ai/refs.py roles_for에 추가하세요")

    def test_layouts_in_rules_are_known_to_editor(self):
        editor_ids = set(re.findall(r"\['([a-z][a-z0-9-]*)', '", read(V2 / "editor.js")))
        for t in list(rules.TYPES.values()) + [rules.GENERIC]:
            for s in t["sections"]:
                self.assertIn(rules.layout_for(s["role"]), editor_ids, s["role"])

    def test_ai_urls_used_by_the_screens_exist_on_the_server(self):
        routes = {r.path for r in api.router.routes}   # '/ai/…'
        used = set()
        for f in V2.glob("*.js"):
            used |= {m for m in re.findall(r"/api/am(/ai/[a-z/]+)", read(f))}
        self.assertTrue(used, "화면이 부르는 AI 주소를 못 찾았어요")
        for u in used:
            self.assertIn(u.rstrip("/"), routes, f"화면이 부르는 {u} 가 서버에 없어요")

    def test_feedback_events_sent_by_screens_are_accepted(self):
        accepted = set(api.FeedbackReq.model_fields["event"].annotation.__args__)
        sent = set()
        for f in V2.glob("*.js"):
            for line in read(f).splitlines():
                if "ai/feedback" in line:   # 그 줄의 event: … 값들 (삼항식이면 둘 다)
                    seg = line[line.index("event:"):line.index("doc_id")] if "event:" in line and "doc_id" in line else ""
                    sent |= set(re.findall(r"'([a-z]+_[a-z]+)'", seg))
        self.assertTrue(sent)
        self.assertLessEqual(sent, accepted, sent - accepted)

    def test_pages_only_load_files_that_exist(self):
        for html in V2.glob("*.html"):
            for ref in re.findall(r'(?:src|href)="(/static/[^"?#]+)', read(html)):
                self.assertTrue((STATIC.parent / ref.lstrip("/")).exists(), f"{html.name}이 없는 파일을 불러와요: {ref}")

    def test_python_models_match_screen_limits(self):
        """화면이 서버 한도보다 길게 보내면 422가 되어 추천이 조용히 '예시'로 돌아간다 — 화면의 slice 길이가 서버 한도 이하인지 본다."""
        src = read(V2 / "editor.js")
        for field, model_field in (("name", "name"), ("purpose", "purpose")):
            m = re.search(rf"{field}: \(s\.\w+ \|\| ''\)\.slice\(0, (\d+)\)", src)
            self.assertTrue(m, f"editor.js에서 {field} 자르는 코드를 못 찾았어요")
            limit = api.SectionIn.model_fields[model_field].metadata[0].max_length
            self.assertLessEqual(int(m.group(1)), limit)


class JsSyntax(unittest.TestCase):
    def test_every_v2_script_parses(self):
        """고치다 괄호 하나만 빠져도 그 화면 전체가 멈춘다 — node가 있는 PC(개발자)에서는 저장 전에 잡는다."""
        import shutil
        import subprocess
        node = shutil.which("node")
        if not node:
            self.skipTest("node 없음")
        for f in sorted(V2.glob("*.js")):
            r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{f.name}: {r.stderr[:300]}")


if __name__ == "__main__":
    unittest.main()


class LibraryLookups(unittest.TestCase):
    def test_library_finds_items_by_id_in_both_lists(self):
        """레퍼런스 화면은 직접 추가한 것(OWN)과 수집본(R) 두 목록을 함께 쓴다. id로 찾을 때 R만 보면 직접 추가한 페이지에서 오류로 멈춘다
        ('이 페이지의 구좌 N개' 버튼이 안 눌리던 문제, 2026-11-14) → byId()/all()로만 찾아야 한다."""
        src = read(V2 / "library.js")
        bad = [ln for ln in src.splitlines() if re.search(r"\bR\.(find|findIndex|some)\(", ln)]
        self.assertEqual(bad, [], "library.js에서 R.find 대신 byId(id)나 all()을 쓰세요")

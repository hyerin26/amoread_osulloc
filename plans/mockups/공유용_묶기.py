# 목업을 한 파일로 묶기: tokens.css와 Pretendard 글꼴을 HTML 안에 넣어, 파일 하나만 받아도 같은 모양으로 열리게 한다
import base64, pathlib, re, shutil, sys
root = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
static = root / 'workspace/amoread_app/planner/static'
font = base64.b64encode((static / 'fonts/PretendardVariable.woff2').read_bytes()).decode()
tokens = (static / 'tokens.css').read_text(encoding='utf-8')
assert tokens.count("url('/static/fonts/PretendardVariable.woff2')") == 1
tokens = tokens.replace("url('/static/fonts/PretendardVariable.woff2')", f"url(data:font/woff2;base64,{font})")
LINK = '<link rel="stylesheet" href="../../workspace/amoread_app/planner/static/tokens.css">'
OVERRIDE = re.compile(r"(/\* tokens\.css의 글꼴 주소[^\n]*\*/\n)?@font-face \{ font-family: 'Pretendard Variable';[^}]*\}\n")
for f in sorted((root / 'plans/mockups').glob('2[0-9]_*.html')):
    s = f.read_text(encoding='utf-8')
    assert s.count(LINK) == 1, f.name
    s, n = OVERRIDE.subn('', s, count=1); assert n == 1, f.name
    s = s.replace(LINK, '<style>\n/* AMOREAD Green UI v2.5.1 tokens.css (앱과 같은 값) + Pretendard 글꼴을 파일 안에 넣었어요 (SIL OFL 1.1, 같이 보낸 LICENSE.txt) */\n' + tokens + '\n</style>')
    assert '../../' not in s, f.name
    (out / f.name).write_text(s, encoding='utf-8')
    print(f.name, round((out / f.name).stat().st_size / 1e6, 2), 'MB')
shutil.copy(static / 'fonts/LICENSE.txt', out / 'Pretendard_LICENSE.txt')
(out / '읽어주세요.txt').write_text(
"AMOREAD 재설계 목업 (2026-11-06)\n\n"
"- 파일마다 디자인 토큰과 글꼴이 들어 있어서, 하나만 열어도 같은 모양이에요. 크롬이나 엣지로 열어 주세요.\n"
"- 화면 위쪽 경로(홈 › 브리프 › 구좌 구성 › 구좌 편집 › 미리보기·내보내기)를 누르면 다른 목업으로 이동해요. 상품·할인(25)은 기획안 어느 단계에서나 여는 공간이에요. 여섯 파일을 같은 폴더에 두면 돼요.\n"
"- 모든 데이터는 가상의 예시예요. 실제 매출·원가·고객 정보는 없어요.\n"
"- 프로모션 분류 5색(시즌·브랜드기획전·런칭·콜라보·클리어런스)은 v2.5.1에 없는 색이라 제안 값이에요. 의견 부탁드려요.\n\n"
"20_홈_일정표 / 21_브리프_키워드확장 / 22_구좌구성_추천 / 23_구좌편집 / 24_미리보기_내보내기 / 25_상품할인 / 28_레퍼런스_라이브러리 (윗줄 메뉴 '레퍼런스') / 29_설정_데이터 (⚙)\n"
"참고: 26_앱틀_비교 (메뉴·기획안 목록 위치 비교, 결정은 C) / 27_컴포넌트_검색창 (검색창 상태·크기·값)\n", encoding='utf-8')

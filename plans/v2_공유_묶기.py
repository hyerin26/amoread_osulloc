# 새 버전(v2) 화면 공유 묶음: 디자이너·개발자가 서버 없이 브라우저로 열어 볼 수 있는 사본 + 안내 + 문서 + CSS 현황 → zip
# 쓰는 법 (저장소 루트에서): python -I plans/v2_공유_묶기.py . AMOREAD_v2_프로토타입_20261107
# - 앱 파일 배치(static/tokens.css, static/v2/*)를 그대로 두고, 서버 주소(/static/…, /v2/…)만 상대 경로로 바꾼다
# - 글꼴은 tokens.css 안에 넣는다 (파일로 열면 브라우저가 글꼴 파일을 막는 경우가 있어서)
# - static/_share/ = 공유본에만 있는 파일 (서버 부르기 막기, 안내 화면 CSS)
import base64, collections, html, pathlib, re, shutil, sys, zipfile

root = pathlib.Path(sys.argv[1]).resolve(); name = sys.argv[2]
static = root / 'workspace/amoread_app/planner/static'; v2 = static / 'v2'
base = root / 'handoff' / name
if base.exists() or base.with_suffix('.zip').exists():
    sys.exit(f'이미 있어요: {base} — 다른 이름으로 만들어 주세요 (덮어쓰지 않음)')
out = base / 'static'; (out / 'v2').mkdir(parents=True); (out / 'fonts').mkdir(); (out / '_share').mkdir(); (base / '문서').mkdir()
rd = lambda p: p.read_text(encoding='utf-8')
wr = lambda p, s: p.write_text(s, encoding='utf-8', newline='')

PAGES = {   # 파일: (화면 이름, 흐름 순서 표시, 한 줄 설명)
    'home': ('홈', '시작', '일정표(몰 행사·명분·기획안), 실적 한 줄, 기획안 목록, 새 기획안 만들기'),
    'brief': ('브리프', '01', '키워드 마인드맵과 근거 → 컨셉·누구에게·메인 카피·느낌 레퍼런스 정리'),
    'compose': ('구좌 구성', '02', '구좌 구성 추천안 2~3개(A 규칙 / B 지난 행사 / C 레퍼런스) 비교하고 고르기'),
    'editor': ('구좌 편집', '03', '구좌 목록 · 전체 와이어프레임 · 편집 패널(문구·카드 모양·상품·레퍼런스·디자인 요청). 와이어프레임의 카드를 누르면 카드 문구'),
    'preview': ('미리보기·내보내기', '04', '확인할 것, 디자이너 기획안·카드 문구표, 엑셀·ZIP 내보내기'),
    'deals': ('상품·할인', '공간', '기획안 어느 단계에서나 여는 공간: 상품, 할인 행, 하루특가 편성, 추가 혜택'),
    'library': ('레퍼런스', '메뉴', '레퍼런스 라이브러리 (저장소가 아직 없어 앱에서도 전부 예시)'),
    'settings': ('설정·데이터', '⚙', '데이터 상태, 원가 파일, 외부 연결, 명분 사전·목록, 기획 기준'),
}
found = sorted(p.stem for p in v2.glob('*.html'))
assert found == sorted(PAGES), f'화면 목록이 바뀌었어요: {found}'

# 1) 디자인 토큰 + 글꼴
FONT_URL = "url('/static/fonts/PretendardVariable.woff2')"
tokens = rd(static / 'tokens.css'); assert tokens.count(FONT_URL) == 1
font64 = base64.b64encode((static / 'fonts/PretendardVariable.woff2').read_bytes()).decode()
wr(out / 'tokens.css', '/* 공유본: 아래 @font-face의 글꼴 주소만 파일 안(data:)으로 바꿨어요. 앱 원본은 /static/fonts/PretendardVariable.woff2 */\n'
   + tokens.replace(FONT_URL, f'url(data:font/woff2;base64,{font64})'))
for f in ('PretendardVariable.woff2', 'LICENSE.txt'): shutil.copy(static / 'fonts' / f, out / 'fonts' / f)

# 2) 화면 CSS는 그대로, JS는 화면 이동 주소 3곳만 ('/v2/settings#conn' → 'settings.html#conn'. ?id=가 붙는 이동은 기획안이 있을 때만이라 그대로)
for p in v2.glob('*.css'): shutil.copy(p, out / 'v2' / p.name)
JS_NAV = re.compile(r"""(['"])/v2/([a-z]+)(#[\w-]*)?\1"""); n_js = 0
for p in v2.glob('*.js'):
    s, n = JS_NAV.subn(lambda m: f"{m[1]}{m[2]}.html{m[3] or ''}{m[1]}", rd(p)); n_js += n
    wr(out / 'v2' / p.name, s)
assert n_js == 3, f'JS 화면 이동 주소 수가 바뀌었어요: {n_js}'

# 3) 화면 HTML: 서버 주소 → 상대 경로, 공유본 파일 넣기
for page in PAGES:
    s = rd(v2 / f'{page}.html')
    s = s.replace('href="/static/tokens.css"', 'href="../tokens.css"')
    s = re.sub(r'(href|src)="/static/v2/', r'\1="', s)
    s = re.sub(r'href="/v2/([a-z]+)(#[^"]*)?"', lambda m: f'href="{m[1]}.html{m[2] or ""}"', s)
    old = '<a class="v2old" href="/">예전 화면</a>'; assert s.count(old) == 1, page
    s = s.replace(old, '<a class="v2old" href="../../처음_열어보기.html">공유 안내</a>')
    tag = f'<script src="{page}.js"></script>'; assert s.count(tag) == 1, page
    s = s.replace(tag, f'<script src="../_share/offline.js"></script>\n{tag}')
    left = re.findall(r'(?:href|src)="/[^"]*"', s); assert not left, (page, left)
    wr(out / 'v2' / f'{page}.html', s)

wr(out / '_share' / 'offline.js', """// 공유본에만 있는 파일 (앱에는 없어요). 서버 없이 파일로 열었을 때 서버 부르기를 바로 '연결 안 함'으로 끝내요.
// 화면마다 서버 응답이 없으면 예시 데이터를 그대로 보여 주는 길로 가요. 저장·실제 데이터·키워드 검색·내보내기는 이 사본에서 안 돼요.
const SHARE_OFFLINE = '공유용 사본이라 서버에 연결하지 않아요';
if (typeof v2api === 'function') v2api = () => Promise.reject(new Error(SHARE_OFFLINE));   // eslint-disable-line no-global-assign
const shareFetch = window.fetch.bind(window);
window.fetch = (u, o) => (String(u).startsWith('/api') ? Promise.reject(new Error(SHARE_OFFLINE)) : shareFetch(u, o));
""")

# 4) 서버 주소: 화면 JS에서 직접 뽑음 (공통 = api.js·plan.js·products.js)
apis = {}
for p in sorted(v2.glob('*.js')):
    got = sorted(set(re.findall(r'/api/[a-z0-9/_-]*[a-z0-9_-]', rd(p))))
    if got: apis[p.stem] = got

# 5) CSS 현황: 화면 CSS마다 따로 적은 같은 선택자 (디자인 시스템으로 묶을 후보)
rules = collections.defaultdict(dict)   # 선택자 → {파일: 값}
hexes = {}
for p in sorted(v2.glob('*.css')):
    s = re.sub(r'/\*.*?\*/', '', rd(p), flags=re.S)
    hexes[p.name] = len(re.findall(r'#[0-9a-fA-F]{3,8}\b', s))
    for sel, body in re.findall(r'([^{}@]+)\{([^{}]*)\}', s):
        norm = ';'.join(sorted(x.strip() for x in body.split(';') if x.strip()))
        for one in sel.split(','):
            one = ' '.join(one.split())
            if one: rules[one][p.stem] = norm
code = ' '.join(rd(p) for p in v2.glob('*.html')) + ' '.join(rd(p) for p in v2.glob('*.js'))
def used(sel):
    cls = re.findall(r'\.([a-zA-Z][\w-]*)', sel)
    return not cls or all(re.search(rf'(?<![\w-]){re.escape(c)}(?![\w-])', code) for c in cls)
multi = [(k, v) for k, v in rules.items() if len(v) >= 2]
multi.sort(key=lambda kv: (len(set(kv[1].values())) == 1, -len(kv[1]), kv[0]))
n_diff = sum(len(set(v.values())) > 1 for _, v in multi)
e = html.escape
rows = ''.join(f'<tr><td><code>{e(k)}</code></td><td class="n">{len(v)}</td><td>{"<b>값이 달라요</b>" if len(set(v.values())) > 1 else "같아요"}</td>'
               f'<td>{e(", ".join(sorted(v)))}</td><td>{"" if used(k) else "화면에서 안 쓰는 것 같아요"}</td></tr>' for k, v in multi)
HEAD = lambda title, css: (f'<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
                           f'<title>{title}</title>\n<link rel="stylesheet" href="{css}tokens.css">\n<link rel="stylesheet" href="{css}_share/안내.css">\n</head>\n<body>\n<main class="doc">\n')
wr(base / '문서' / 'CSS_공통요소_현황.html', HEAD('CSS 공통 요소 현황', '../static/') + f"""<p><a href="../처음_열어보기.html">← 공유 안내</a></p>
<h1>CSS 공통 요소 현황</h1>
<p>화면 CSS(static/v2/*.css) 여러 곳에 따로 적힌 같은 선택자예요. 목업에서 화면마다 복사해 온 것이라, 디자인 시스템 컴포넌트로 묶을 후보예요.
같은 선택자 {len(multi)}개 중 <b>값이 다른 곳 {n_diff}개</b>를 위에 모았어요. '화면에서 안 쓰는 것 같아요'는 그 class 이름이 HTML·JS 어디에도 없다는 뜻이에요 (자동 검사라 확인 필요).</p>
<h2>화면 CSS 안의 색 값(hex) 수</h2>
<p>규칙: 화면 CSS는 tokens.css의 의미 변수만 써요. 0이 아니면 정리할 곳이에요.</p>
<table><thead><tr><th>파일</th><th class="n">hex</th></tr></thead><tbody>{''.join(f'<tr><td>{e(k)}</td><td class="n">{n}</td></tr>' for k, n in hexes.items())}</tbody></table>
<h2>여러 화면에 있는 선택자</h2>
<table><thead><tr><th>선택자</th><th class="n">파일 수</th><th>값</th><th>파일</th><th>쓰임</th></tr></thead><tbody>{rows}</tbody></table>
</main>
</body>
</html>
""")

# 6) 문서
DOCS = {'20_사용자플로우_재설계.md': '결정 기록: 화면마다 왜 이렇게 정했는지, 디자이너·운영께 여쭤볼 것(§5)',
        '23_새버전_v2_앱에_붙이기.md': '앱에 붙인 방식, 화면별 실제 데이터 / 아직 예시 표(§2), 기획안 저장 모양(§2-1)'}
for f in DOCS: shutil.copy(root / 'plans' / f, base / '문서' / f)

wr(out / '_share' / '안내.css', """/* 공유본 안내 화면용 (앱에는 없어요). 값은 tokens.css 변수만 */
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); background: var(--bg); }
.doc { max-width: 980px; margin: 0 auto; padding: var(--s6, 32px) var(--s5, 24px) 64px; }
h1 { font-size: var(--fs-h1); margin: 0 0 8px; } h2 { font-size: var(--fs-h2, 18px); margin: 32px 0 8px; } h3 { margin: 20px 0 6px; font-size: var(--fs-body); }
p, li { color: var(--ink2); } a { color: var(--accent); }
code { font-size: var(--fs-sm); background: var(--sunken); padding: 1px 4px; border-radius: 4px; }
.cap { font-size: var(--fs-cap); color: var(--mute); }
.screens { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.screens a { display: block; height: 100%; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--r3, 12px); background: var(--surface); color: var(--ink); text-decoration: none; }
.screens a:hover { border-color: var(--accent); }
.screens b { display: block; margin-bottom: 4px; } .screens .st { color: var(--accent); font-size: var(--fs-cap); font-weight: var(--fw-strong); margin-right: 6px; }
.screens span.d { font-size: var(--fs-sm); color: var(--ink2); }
.box { padding: 14px 16px; border-radius: var(--r2); background: var(--warn-soft); margin: 16px 0; }
table { width: 100%; border-collapse: collapse; background: var(--surface); font-size: var(--fs-sm); }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line-sub); vertical-align: top; }
th { color: var(--mute); font-weight: var(--fw-medium); } td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
pre { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 12px; overflow: auto; font-size: var(--fs-sm); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
""")

# 7) 처음 열어보기
li = ''.join(f'<li><a href="static/v2/{k}.html"><b><span class="st">{e(st)}</span>{e(nm)}</b><span class="d">{e(d)}</span></a></li>' for k, (nm, st, d) in PAGES.items())
api_rows = ''.join(f'<tr><td><code>{k}.js</code></td><td>{"<br>".join(f"<code>{e(a)}</code>" for a in v)}</td></tr>' for k, v in apis.items())
tree = """처음_열어보기.html        이 안내
static/
  tokens.css               디자인 토큰 (AMOREAD Green UI v2.5.1) + Pretendard 글꼴
  fonts/                   PretendardVariable.woff2, LICENSE.txt (SIL OFL 1.1)
  v2/
    shell.css, shell.js    공통 틀 (윗줄 메뉴 + 기획안 막대)
    api.js                 서버 부르기 v2api() (토큰 헤더)
    plan.js                PLAN: ?id= 기획안 읽기·저장 (0.7초 모아서)
    products.js            상품 목록·상세, 추가 혜택 가격 계산
    {화면}.html/.css/.js   화면마다 한 벌 (8개)
  _share/                  공유본에만 있는 파일 (앱에는 없음)
    offline.js             서버 부르기를 바로 '연결 안 함'으로
    안내.css               이 안내·문서 화면 모양
문서/
  20_사용자플로우_재설계.md, 23_새버전_v2_앱에_붙이기.md, CSS_공통요소_현황.html"""
wr(base / '처음_열어보기.html', HEAD('AMOREAD v2 공유 안내', 'static/') + f"""<h1>AMOREAD 새 버전(v2) 프로토타입</h1>
<p class="cap">{e(name)} · 디자이너·개발자 공유용 · 크롬이나 엣지로 열어 주세요</p>

<div class="box"><b>이 사본은 서버 없이 열려요.</b> 그래서 화면은 모두 <b>예시 데이터</b>로 보여요(가상의 상품·가격·원가·후기). 저장, 실제 데이터, 키워드 검색, 엑셀·ZIP 내보내기, 파일 올리기는 동작하지 않아요.
'공유용 사본이라 서버에 연결하지 않아요' 알림이 뜨는 건 정상이에요. 앱에서는 기획안을 열면(?id=) 같은 화면이 실제 데이터로 바뀌어요.</div>

<h2>화면</h2>
<p>흐름: 홈 → 01 브리프 → 02 구좌 구성 → 03 구좌 편집 → 04 미리보기·내보내기. 상품·할인은 어느 단계에서나 여는 공간이에요. 화면 위 메뉴와 단계 막대로 서로 오갈 수 있어요.</p>
<ul class="screens">{li}</ul>

<h2>디자이너께</h2>
<ul>
<li>디자인 기준은 <code>static/tokens.css</code> (AMOREAD Green UI v2.5.1 값, 글꼴 Pretendard)예요. 화면 CSS는 이 변수만 쓰는 게 규칙이에요.</li>
<li>화면 CSS는 목업에서 화면마다 복사해 와서, 버튼·태그·칩·탭(seg)·입력칸·토스트 같은 같은 요소가 파일마다 따로 있어요. 어디가 같고 다른지는 <a href="문서/CSS_공통요소_현황.html">CSS 공통 요소 현황</a>에 모아 두었어요. 디자인 시스템으로 묶을 후보예요.</li>
<li>화면 위 회색 안내 줄과 '예시' 태그는 아직 실제 데이터가 아닌 곳 표시예요. 구좌 편집의 점선 칸은 '켜 뒀는데 글이 비어 있는 자리'예요.</li>
<li>왜 이렇게 정했는지는 <code>문서/20_사용자플로우_재설계.md</code>, 여쭤볼 것은 그 문서 §5에 있어요.</li>
</ul>

<h2>개발자께</h2>
<h3>원본과 이 사본</h3>
<ul>
<li>원본: 로컬 git 저장소의 <code>redesign</code> 브랜치, <code>workspace/amoread_app/planner/static/v2</code> (+ <code>static/tokens.css</code>, <code>static/fonts</code>). 서버는 FastAPI이고 <code>/v2/{{화면}}</code> 주소로 <code>static/v2/{{화면}}.html</code>을 내보내요.</li>
<li>이 사본에서 바꾼 것 (나머지는 원본 그대로):
  <ul>
  <li>HTML: <code>/static/…</code>, <code>/v2/…</code> 주소를 상대 경로로, '예전 화면' 링크를 이 안내로, 화면 JS 앞에 <code>_share/offline.js</code> 한 줄</li>
  <li>JS: 화면 이동 주소 3곳 (<code>'/v2/settings#conn'</code> → <code>'settings.html#conn'</code> 등). <code>?id=</code>가 붙는 이동은 기획안이 있을 때만이라 그대로 두었어요</li>
  <li>tokens.css: 글꼴 주소를 파일 안(data:)으로. 파일로 열면 브라우저가 글꼴 파일을 막는 경우가 있어서예요</li>
  </ul></li>
</ul>
<h3>구조</h3>
<pre>{e(tree)}</pre>
<ul>
<li>화면마다 예시 데이터를 갖고 있고, 주소에 <code>?id=</code>(기획안)가 있으면 서버에서 읽어 실제 데이터로 바꿔요. 저장은 <code>PLAN.save(바꾸기)</code> → 0.7초 모아 <code>POST /api/am/projects</code>.</li>
<li>기획안은 JSON 하나예요: <code>brief</code>, <code>promo_rows</code>(할인 행 = PROMO_WORK), <code>page.sections[]</code>(구좌·카드 칸), <code>v2</code>(새 버전만 쓰는 값). 구좌 편집의 카드 모양·카드 글은 <code>section.v2.card</code> {{order, on, def}}와 <code>section.v2.cards</code> {{카드 id: 라벨·태그·알약·버튼·끈 요소}}에 있어요. 자세한 표는 <code>문서/23</code> §2-1이에요.</li>
<li>지켜야 할 규칙: 페이지 안 <code>&lt;script&gt;</code>·<code>&lt;style&gt;</code>·<code>style=""</code> 속성 금지(서버 CSP, 모양은 CSS 파일이나 CSSOM으로) · 모든 서버 호출에 <code>x-planner-token</code> 헤더(페이지 meta에서) · 외부 키는 서버 <code>.env</code>에만, 화면에는 있음/없음만 · 외부 서비스에는 키워드만 보내고 원가·고객 정보는 보내지 않아요 · 서버는 이 PC(127.0.0.1)에서만 열려요.</li>
</ul>
<h3>화면이 부르는 서버 주소 (코드에서 뽑음)</h3>
<table><thead><tr><th>파일</th><th>주소</th></tr></thead><tbody>{api_rows}</tbody></table>
</main>
</body>
</html>
""")

# 8) zip (폴더째)
z = base.with_suffix('.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(base.rglob('*')):
        if p.is_file(): zf.write(p, p.relative_to(base.parent).as_posix())
print(z, round(z.stat().st_size / 1e6, 2), 'MB,', sum(1 for p in base.rglob('*') if p.is_file()), '파일 · CSS 같은 선택자', len(multi), '· 값 다름', n_diff)

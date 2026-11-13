# AMOREAD — 오설록몰 프로모션 페이지 기획 도구 (`design` 브랜치)

프로모션 기획안 하나를 **홈(일정·명분) → 브리프 → 구좌 구성 추천 → 구좌 편집 → 미리보기·내보내기** 순서로 만드는 로컬 웹앱입니다.
새로 설계한 화면은 `/v2/`, 예전 화면은 `/`에 있습니다.

기획자 프로토타입(`sub`)을 바탕으로 브리프의 레퍼런스 상세 패널, 구좌 편집과 미리보기의 좁은 화면 배치, 디자이너 전달 ZIP의 파일 선택 항목을 다듬었습니다. 변경 이력은 [README_UXUI_변경사항.md](README_UXUI_변경사항.md)에서 확인할 수 있습니다.

> 이 문서는 각자 PC에서 처음 받아 실행하는 방법입니다. 서버는 **자기 PC(127.0.0.1)에서만** 열리므로, 다른 사람 PC의 화면에는 접속할 수 없습니다. 각자 실행하세요.

---

## 1. 준비물

| 항목 | 내용 |
|---|---|
| OS | Windows 10/11 또는 macOS |
| Git | `git --version`으로 확인 |
| Python | **3.11 이상** (`python --version`). 담당자 PC는 3.15.2에서 동작 확인 |
| GitLab 권한 | 이 저장소는 비공개입니다. 접근 권한이 없으면 담당자에게 요청 |

---

## 2. 받기

```powershell
git clone -b design https://gitlab.com/amoread2/osulloc.git
cd osulloc\workspace\amoread_app
```

이미 저장소를 받았다면 `osulloc` 폴더에서 `git fetch origin`으로 최신 브랜치를 확인한 뒤 `git switch design`으로 이동합니다. 이후 앱 실행 명령은 `workspace/amoread_app` 폴더에서 실행합니다.

---

## 3. Python 환경 만들기 (Windows, 처음 한 번)

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install pip-system-certs
.venv\Scripts\python.exe -m pip install -r planner\requirements.txt
```

- `pip-system-certs`를 먼저 설치하는 이유: 사내망에서 pip가 인증서 오류(`SSL: CERTIFICATE_VERIFY_FAILED`)로 멈추는 것을 막습니다.
- `.venv` 폴더는 git에 올라가지 않습니다 (각자 PC에서 만듦).
- 설치는 몇 분 걸립니다. 끝에 나오는 `A new release of pip is available` 안내는 무시해도 됩니다.

---

## 4. Windows에서 실행

```powershell
$env:PYTHONUTF8 = "1"
$env:PLANNER_PORT = "9751"
.venv\Scripts\python.exe -m planner.server
```

- 1~2초 뒤 브라우저가 자동으로 열립니다 (`--no-browser`를 붙이면 안 열림).
- **새 화면: http://127.0.0.1:9751/v2/**  ·  예전 화면: http://127.0.0.1:9751/
- 끄려면 PowerShell 창에서 `Ctrl + C` 또는 창 닫기.
- `PLANNER_PORT`를 안 정하면 9731번을 씁니다. 이미 쓰는 번호라 실패하면 다른 번호(예: 9761)로 바꾸세요.
- 두 번째부터는 **4번만** 하면 됩니다.

### macOS에서 실행

`osulloc` 폴더에서 다음 명령을 실행합니다.

```sh
cd workspace/amoread_app
python3 -m venv .venv
.venv/bin/python -m pip install -r planner/requirements.txt
PYTHONUTF8=1 PLANNER_PORT=9751 .venv/bin/python -m planner.server --no-browser
```

브라우저에서 [v2 화면](http://127.0.0.1:9751/v2/)을 엽니다. 가상 환경과 패키지 설치는 처음 한 번만 하면 됩니다.

### 실행 파일(.bat)에 대해

| 파일 | 다른 PC에서 | 설명 |
|---|---|---|
| `run_redesign.bat` | ❌ 안 됨 | 담당자 PC의 Python 경로(Downloads 폴더 안)를 직접 가리킵니다. 실행하면 `Python venv not found`로 끝납니다. |
| `run_planner.bat` | ⭕ 됨 | `.venv`가 없으면 3번을 자동으로 하고 **9731번**으로 엽니다. 새 화면은 http://127.0.0.1:9731/v2/ . 데이터가 없으면 시작할 때 원천 파일 오류가 한 번 나오지만 서버는 그대로 뜹니다. |
| `build_data.bat` | ⭕ 됨 | 5번의 데이터 만들기를 실행합니다. |

---

## 5. 데이터 (선택 — 없어도 화면은 열림)

판매실적·원가·리뷰 등 **데이터 파일은 git에 올리지 않습니다** (`.gitignore`로 제외).

**데이터 없이 실행하면**
- `/v2/` 화면은 모두 열리고, 기획안을 열지 않은 상태에서는 **예시(가짜) 내용**으로 보입니다. 화면 구조·디자인 확인은 이걸로 충분합니다.
- 실제 숫자가 필요한 부분(상품·할인 계산, 지난 행사, 실적 등)은 "기획용 데이터가 없습니다" 같은 안내가 나옵니다.

**데이터가 필요하면**
1. 담당자에게 데이터 묶음을 **사내 채널로** 따로 받습니다 (git·외부 메신저로 주고받지 않기).
2. 아래 위치에 넣습니다.

   | 위치 | 내용 |
   |---|---|
   | `data\report_service\CustomTemplate 고객판매실적_seq YYYY.csv` | SEQ × 일자 판매실적 |
   | `data\report_service\일자별트렌드_전체 데이터_YYYY.csv` | 몰 전체 KPI |
   | `data\sample\★오설록 온라인 가이드….xlsx` | 상품장 (이동평균가 = 원가) |
   | `data\sample\BY26 프로모션별 할인정보….xlsx` | 행사 이력(PROMO_WORK) + 상품 구성 |
   | `data\sample\reviews\` | 고객 리뷰 |

3. 데이터를 만듭니다 (원천 파일을 바꿀 때마다 다시).

   ```powershell
   $env:PYTHONUTF8 = "1"
   .venv\Scripts\python.exe -W ignore -m planner.build
   ```

   결과는 `planner\data\planner_data.json`에 생기고, 서버를 켠 채로 만들어도 자동으로 다시 읽습니다.
   파일이 없으면 `[오류] 온라인 가이드 파일이 없습니다: …`처럼 어떤 파일이 빠졌는지 알려 줍니다.

---

## 6. 외부 연결·AI (선택)

- **네이버 검색·트렌드·연관 키워드**: `.env.example`을 복사해 `.env`로 이름을 바꾸고 키를 넣습니다. 키 받는 법은 `.env.example` 안 설명과 `plans/22_키워드소재_창구_조사와_API키.md` §3 참고.
  - **키는 `.env`에만** 둡니다. 코드·문서·커밋·채팅에 쓰지 마세요. `.env`는 git에 올라가지 않습니다.
  - 키가 없으면 해당 기능만 비어 있고 나머지는 동작합니다.
- **AI 기능**(기획안 만들기·수정 대화): 그 PC에 Claude Code가 설치·로그인돼 있어야 동작합니다. 없으면 AI 기능만 꺼집니다.

---

## 7. 어디부터 보면 되나

| 보고 싶은 것 | 위치 |
|---|---|
| 화면별 결정 기록 (왜 이렇게 만들었나, 열린 질문) | `plans/20_사용자플로우_재설계.md` (먼저 읽기) — §5가 멘토님·디자이너·운영에게 묻는 질문 |
| 화면별 실제 데이터 / 예시 구분표 | `plans/23_새버전_v2_앱에_붙이기.md` §2 |
| 새 화면 코드 (HTML·CSS·JS) | `workspace/amoread_app/planner/static/v2/` |
| 디자인 토큰 (색·글꼴·간격) | `workspace/amoread_app/planner/static/tokens.css` |
| 서버·API | `workspace/amoread_app/planner/server.py` |
| 화면 목업 (가짜 데이터) | `plans/mockups/` |

화면 코드 규칙: 보안 정책(CSP) 때문에 HTML의 `style="…"` 속성과 `<style>`·인라인 `<script>`는 동작하지 않습니다. CSS 클래스와 별도 `.js` 파일로 작성하세요.

---

## 8. 같이 작업할 때

- 화면 UX/UI 작업은 `design`을 기준으로 브랜치를 만들고, `design`을 대상으로 Merge Request를 엽니다.
  ```powershell
  git switch -c 이름/작업내용
  ```
- **올리면 안 되는 것**: `data\`, `planner\data\`, `.env`, `.venv\` (모두 `.gitignore`에 있음). `git status`에 이런 파일이 보이면 커밋하지 마세요.
- `design`과 `main`은 커밋 이력이 별개입니다. `main` 반영 방식은 팀과 협의합니다.

---

## 9. 신규 구좌편집기 확인하기 (시험 중, `design_eun` 브랜치)

`design_eun` 브랜치에는 **신규 구좌편집기(v1.12)**가 기존 앱 안에 붙어 있습니다. 기존 구좌 편집기는 그대로 두고, 버튼으로 오가며 비교할 수 있습니다.

### 9-1. 브랜치 받기

이미 저장소가 있으면 `osulloc` 폴더에서:

```powershell
git fetch origin
git switch design_eun
```

처음 받는다면:

```powershell
git clone -b design_eun https://gitlab.com/amoread2/osulloc.git
cd osulloc\workspace\amoread_app
```

Python 환경 만들기와 실행은 위 **3·4번과 같습니다**. 서버를 켜면 `http://127.0.0.1:9751/v2/`(또는 정한 포트)로 들어갑니다.
다른 브랜치에서 서버를 켜 둔 상태라면 **끄고 `design_eun`에서 다시 켜야** 신규 편집기가 보입니다.

### 9-2. 빠르게 보기 (예시 화면, 1분)

1. `http://127.0.0.1:9751/v2/editor` 를 엽니다 (기존 구좌 편집, 예시 기획안).
2. 제목 오른쪽 도구 줄의 **[신규 편집기로 열기 (시험)]** 를 누릅니다.
3. 신규 편집기가 열립니다. 상단 오른쪽 **[← 기존 구좌 편집기로]** 로 돌아갈 수 있습니다.

예시 화면은 편집기에 들어 있는 **가상 상품·후기**로 보이고 **저장되지 않습니다**. 화면 구조와 조작감을 보기에는 충분합니다.

### 9-3. 내 기획안으로 보기 (저장까지)

1. 홈(`/v2/home`)에서 **＋ 새 기획안** → **시작하기 →**
2. 브리프에서 **다음: 구좌 구성** → 구좌 구성에서 추천안을 고르고 **다음: 구좌 편집**
3. 구좌 편집 화면에서 **[신규 편집기로 열기 (시험)]**
4. 처음 열면 기존 편집기의 구좌를 그대로 가져옵니다. 고치면 상단에 `저장 중… → 저장했어요 HH:MM`이 표시됩니다.

- 상품·가격은 이 기획안의 **상품·할인** 단계에 넣은 상품과 할인율로 보입니다. 상품이 없으면 상품 카드가 빈 상태로 나옵니다.
- 데이터 파일(5번)이 없으면 신규 편집기 위쪽에 "상품·후기를 불러오지 못했어요"가 뜨지만, 구좌 편집과 저장은 됩니다.
- 신규 편집기에서 고친 내용은 **신규 편집기 저장본에만** 저장됩니다. 기존 구좌 편집기와 **04 미리보기·내보내기에는 반영되지 않습니다** (시험 단계라 일부러 분리).

### 9-4. 이것들을 봐 주세요

| 확인할 것 | 해 보는 방법 |
|---|---|
| 기존 ↔ 신규 오가기 | [신규 편집기로 열기] → [기존 구좌 편집기로]. 같은 기획안으로 돌아오는지 |
| 디자인이 기존 화면과 어울리는지 | 버튼·입력창·탭·카드·글자 크기를 기존 구좌 편집과 번갈아 보기 |
| 가운데 → 오른쪽 연결 | 가운데 와이어프레임에서 상품명·혜택 문구를 누르면 오른쪽에서 그 설정으로 이동·강조되는지 |
| 구좌 순서 바꾸기 | 왼쪽 구성 목록의 ↑↓, `Ctrl+Z`(실행 취소)·`Ctrl+Y`(다시 실행) |
| 상품 카드 16개 요소 | 상품 카드를 누르고 오른쪽 목록에서 요소 켜기 → **편집**을 눌러야 설정이 열리는지(기본은 접힘), ⠿ 끌기·↑↓로 순서 바꾸기 |
| 설정이 미리보기에 반영되는지 | 배치·표시 탭에서 열 수, 가운데 정렬, 이미지 비율, 아코디언 이미지 위치를 바꿔 보기 |
| 저장 | 고친 뒤 새로고침해도 남아 있는지 |
| 읽기 불편한 곳·헷갈리는 문구 | 자유롭게 |

### 9-5. 디자인 비교 결과 보기 (서버 없이)

`amoread_editor\integration\green-ui-compare\report.html` 을 브라우저로 엽니다.
기존 편집기와 신규 편집기의 버튼·입력창·탭·카드 등을 두 열로 놓고 **일치 / 충돌 발견 / 비교 불가**로 표시합니다 (값은 실제 화면에서 잰 것).

### 9-6. 알아 둘 점

- **시험 기능**입니다. 화면·저장 형식이 바뀔 수 있으니 실제 업무 기획안은 기존 편집기로 작업하세요.
- 상품 이미지는 앱 데이터에 없어 "이미지 자리"로만 나옵니다. 운영 상품·가격 API는 아직 연결 전입니다.
- 의견은 화면 이름(예: 신규 편집기 · 오른쪽 상품 카드 목록)과 무엇을 했을 때 어땠는지를 함께 적어 주세요. 스크린샷이 있으면 좋습니다.

### 9-7. 개발자용

- **끄기**: `$env:AMOREAD_EDITOR_NEXT = "0"`으로 서버를 띄우면 화면(`/v2/editor-next`)과 진입 버튼이 사라집니다. 편집기 파일은 `amoread_editor/editor/v1.12`, 앱 연결부는 `planner/static/v2/editor-next.*`.
- **저장**: 같은 기획안의 `editor_next`에 따로 저장합니다. 다른 화면이 먼저 저장했으면 덮어쓰지 않고 "저장 못 했어요"로 알립니다(모든 화면 공통).
- **테스트**:
  ```powershell
  .venv\Scripts\python.exe -m pip install -r requirements-dev.txt
  .venv\Scripts\python.exe -m playwright install chromium
  .venv\Scripts\python.exe -m pytest tests -q            # 앱 저장 단위 + 브라우저 통합 테스트 (서버를 스스로 띄움)
  ```
  편집기 자체 회귀: `amoread_editor\editor\v1.12`에서 `..\..\..\workspace\amoread_app\.venv\Scripts\python.exe run_regression_v112.py`
- **디자인 비교**: 서버를 띄운 뒤 `amoread_editor\integration\green_ui_compare.py --label before`, `--label after` → `green-ui-compare\report.html`

---

## 문제가 생기면

| 증상 | 해결 |
|---|---|
| `python`을 찾을 수 없음 | Python 설치 시 "Add to PATH" 체크, 또는 `py -3 -m venv .venv` |
| pip 설치 중 SSL/인증서 오류 | 3번의 `pip-system-certs`를 먼저 설치했는지 확인 |
| `Python venv not found` | `run_redesign.bat` 대신 4번 명령 또는 `run_planner.bat` 사용 |
| 포트 사용 중 오류 | `$env:PLANNER_PORT`를 다른 번호로 |
| 화면은 뜨는데 "인증 토큰이 없습니다" | 페이지 새로고침 (서버를 다시 켜면 토큰이 바뀜) |
| 숫자 화면이 비어 있음 | 5번 데이터를 넣고 `planner.build` 실행 |
| 한글이 깨짐 | 실행 전에 `$env:PYTHONUTF8 = "1"` |

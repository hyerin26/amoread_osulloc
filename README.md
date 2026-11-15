# AMOREAD — 담당자님용 Windows 실행 안내

이 문서는 **`ai/amoread-ai-module` 브랜치**를 담당자님 PC에서 실행하는 방법입니다. `ai/amoread-ai-module`은 폴더명이 아니라 Git 브랜치 이름입니다.

프로모션 기획안을 **홈 → 브리프 → 구좌 구성 → 구좌 편집 → 미리보기·내보내기** 순서로 만드는 로컬 웹앱입니다. 사용할 화면은 `/v2/`입니다.

> 처음에는 **코드 받기 → 기존 원천 데이터 넣기 → Python 환경 설치 → 데이터 변환 → 앱 실행** 순서로 진행해 주세요. 실제 데이터로 사용하려면 데이터 배치·변환이 필요합니다. 원천 데이터는 담당자님께서 기존에 저희에게 전달해 주셨던 파일입니다. 새로 준비하거나 다시 전달하실 필요 없이, 보관 중인 해당 파일을 사용해 주세요.

## 1. 준비 사항

- Windows 10/11
- Python **3.11 이상** (설치 시 `Add Python to PATH` 선택)
- Git
- Google Chrome (레퍼런스 화면 수집·신규 프로모션 찾기에 사용)
- 이 비공개 GitLab 저장소에 접근할 수 있는 계정

시작 메뉴에서 **PowerShell**을 열고 아래 명령어로 확인합니다. 이 문서의 명령어는 PowerShell 기준이며, 파일·폴더 경로는 Windows 표기(`\`)를 사용합니다. URL과 Git 브랜치 이름에는 `/`를 그대로 사용합니다.

```powershell
python --version
git --version
```

`python`을 찾을 수 없으면 `py -3 --version`도 확인해 주세요. `py`만 동작하는 PC에서는 아래의 `python setup_env.py`를 `py -3 setup_env.py`로 바꿔 실행하면 됩니다.

## 2. AI 통합 버전 받기

기존 작업 폴더와 섞이지 않도록 **새 폴더 `osulloc-ai`**에 받습니다. 파일 탐색기에서 저장할 위치를 연 뒤 주소창에 `powershell`을 입력하고 Enter를 누르세요. 아래 명령어를 한 줄씩 실행합니다.

```powershell
git clone -b ai/amoread-ai-module --single-branch https://gitlab.com/amoread2/osulloc.git osulloc-ai
cd osulloc-ai
git branch --show-current
cd workspace\amoread_app
```

브랜치 확인 결과가 `ai/amoread-ai-module`이면 맞습니다. 이미 `osulloc-ai` 폴더가 있다면 새로 복제하지 말고 그 폴더가 올바른 브랜치인지 먼저 확인해 주세요. 기존 폴더를 삭제하거나 덮어쓰지 마세요.

**이후 설치·데이터 변환·실행 명령은 모두 `osulloc-ai\workspace\amoread_app` 폴더에서 실행합니다.** 저장소 전체가 필요하므로 `amoread_app` 폴더만 따로 옮기지 마세요.

## 3. 기존에 전달해 주셨던 원천 데이터 넣기 (필수)

담당자님께서 기존에 저희에게 보내주셨던 **판매실적·상품장·프로모션 정보·리뷰 파일**을 넣어 주세요. 위치는 저장소 최상위가 아니라 **`workspace\amoread_app\data`**입니다.

이미 아래 구조의 `data` 폴더를 보관 중이시면 `amoread_app` 안으로 폴더째 복사해 주세요. 파일 이름과 연도는 원본 그대로 유지합니다.

```text
osulloc-ai
└─ workspace
   └─ amoread_app
      ├─ setup_env.py
      ├─ planner
      └─ data
         ├─ report_service
         │  ├─ CustomTemplate 고객판매실적_seq YYYY.csv
         │  └─ 일자별트렌드_전체 데이터_YYYY.csv
         └─ sample
            ├─ ★오설록 온라인 가이드….xlsx
            ├─ BY26 프로모션별 할인정보….xlsx
            └─ reviews
               └─ 고객 리뷰 파일들
```

| 위치 (`amoread_app` 기준) | 넣을 원천 자료 |
|---|---|
| `data\report_service\` | SEQ × 일자 고객판매실적 CSV, 몰 전체 일자별 트렌드 CSV |
| `data\sample\` | 오설록 온라인 가이드 상품장 Excel, BY26 프로모션별 할인정보 Excel |
| `data\sample\reviews\` | 고객 리뷰 파일 |

`YYYY`와 `…`는 파일명 예시의 생략 표시입니다. 이 글자대로 파일명을 바꾸지 마세요. 여러 연도의 파일을 전달하셨다면 해당 파일들을 함께 넣어 주세요.

**원천 데이터와 레퍼런스 데이터는 서로 다릅니다.** 이 브랜치에는 초기 레퍼런스 색인·수집본이 포함되어 있지만, 판매실적·원가 등 위 원천 자료는 별도로 넣어야 합니다. 원천 자료를 `planner\data` 안에 넣지 마세요. `planner\data`는 앱이 사용할 변환 결과와 레퍼런스 데이터가 있는 위치입니다.

원천 자료는 Git에 올리지 않습니다. 데이터 파일을 공유할 때는 사내 승인 채널을 이용해 주세요.

## 4. Python 환경 만들기 (처음 한 번)

3번의 파일을 넣은 뒤, `amoread_app` 폴더의 PowerShell에서 실행합니다.

```powershell
python setup_env.py
```

설치 도구가 다음 작업을 자동으로 수행합니다.

1. Python 버전 확인 및 `.venv` 가상환경 생성
2. 사내망 인증서 연동용 `pip-system-certs`와 앱 필수 패키지 설치
3. 화면 수집 도구 Playwright 설치 (이 PC의 Chrome 사용)
4. 레퍼런스 데이터 확인 및 기본 데이터 생성 시도
5. 앱 로딩과 데이터 상태 점검

**별도로 `python -m venv .venv`를 실행하지 않아도 되는 이유는 이 도구가 가상환경 생성과 패키지 설치를 대신하기 때문입니다.** 가상환경 활성화 명령도 필요하지 않습니다. 이후 명령에서는 `.venv` 안의 Python을 직접 사용합니다.

설치에는 몇 분 걸릴 수 있습니다. PowerShell 창을 닫지 말고 완료 또는 오류 메시지를 확인해 주세요. Playwright 설치에 실패하면 화면 수집·신규 찾기는 제한되지만 나머지 기능은 사용할 수 있습니다.

설치 도구 대신 직접 설치해야 하는 경우에만 아래 명령어를 사용합니다. 두 방식을 모두 진행할 필요는 없습니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install pip-system-certs
.\.venv\Scripts\python.exe -m pip install -r planner\requirements.txt
.\.venv\Scripts\python.exe -m pip install -r planner\requirements-capture.txt
```

## 5. 실제 데이터 변환 (필수)

설치가 끝나면 아래 명령어를 실행해 **3번의 원천 파일을 앱에서 사용할 데이터로 변환**합니다. 설치 도구도 생성 작업을 시도하지만 기존 결과가 있으면 건너뛰므로, 이번에 넣은 파일이 반영되도록 이 단계를 진행해 주세요.

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -W ignore -m planner.build
```

- 결과 파일: `workspace\amoread_app\planner\data\planner_data.json`
- `[오류] 온라인 가이드 파일이 없습니다: …` 등 오류가 나오면 안내된 원천 파일의 위치와 이름을 확인한 뒤 다시 실행해 주세요. 오류가 남아 있으면 실제 데이터 준비가 끝난 상태가 아닙니다.
- 이후 **판매실적·상품장·프로모션 정보 등 원천 파일을 바꿀 때마다 이 변환 명령어를 다시 실행**합니다. 서버가 켜져 있어도 변환 결과를 다시 읽습니다.

## 6. 앱 실행 및 종료

같은 `amoread_app` 폴더에서 실행합니다.

```powershell
$env:PYTHONUTF8 = "1"
$env:PLANNER_PORT = "9751"
.\.venv\Scripts\python.exe -m planner.server
```

크롬에서 **[http://127.0.0.1:9751/v2/](http://127.0.0.1:9751/v2/)** 를 열어 주세요. 브라우저가 자동으로 열려도 주소 끝이 `/v2/`인지 확인합니다.

- **사용 중에는 PowerShell 창을 열어두세요.** 창을 닫으면 서버도 종료됩니다.
- 종료: PowerShell 창에서 **Ctrl + C**
- 각자 PC에서 실행하는 앱이므로 이 주소를 다른 사람에게 보내도 담당자님 PC에 접속되지는 않습니다.
- `PLANNER_PORT`를 지정하지 않으면 기본 포트는 9731입니다. 이 문서는 9751로 통일합니다.

### 다음부터 실행할 때

파일 탐색기에서 `osulloc-ai\workspace\amoread_app` 폴더를 열고 주소창에 `powershell`을 입력합니다. **6번의 세 줄만 다시 실행**하면 됩니다. 설치는 매번 하지 않아도 됩니다. 원천 데이터가 바뀐 경우에는 5번을 먼저 진행하세요.

### 실행 후 확인

1. `/v2/` 화면이 열리는지 확인합니다.
2. 실제 상품·실적 등이 필요한 화면에서 데이터 없음 안내가 나오면 3번과 5번을 확인합니다. 기획안을 열지 않은 화면에는 예시가 보일 수 있으므로 화면이 열렸다는 것만으로 실제 데이터 반영을 판단하지 마세요.
3. 레퍼런스 라이브러리에 초기 레퍼런스가 표시되는지 확인합니다. 서버 창에 AI 데이터 점검 경고가 있으면 내용을 확인합니다.
4. 기획안을 저장한 뒤 구좌 구성·레퍼런스 추천을 확인합니다.

## 7. AI 기능별 추가 설정

| 기능 | 필요한 설정 |
|---|---|
| 구좌 구성·레퍼런스 추천 | 기본 설치와 포함된 레퍼런스 데이터로 사용. 이 추천 자체에는 Claude 인증이 필요하지 않음 |
| AI 카피 추천·설명 다듬기 | 조직에서 승인한 Claude Agent SDK 인증과 모델 접근 설정 필요 |
| 기존 기획안 생성·수정 대화 | 담당자 PC의 Claude Code 설치·로그인 필요 |
| 신규 프로모션 찾기·화면 수집 | Playwright 설치 및 담당자 PC의 Chrome 필요 |
| 네이버 검색·트렌드·연관 키워드 | `.env.example`의 안내에 따라 `.env`에 API 설정 필요 |

**Python 패키지 설치만으로 Claude 인증까지 완료되지는 않습니다.** AI 카피 추천은 실제 인증과 모델 권한이 있어야 성공합니다. 브라우저에 API 키를 입력하지 마세요. 관련 기능 설정이 없는 경우에도 나머지 기능은 확인할 수 있습니다.

- AI 카피 추천: 저장된 기획안에서 **구좌 편집 → 문구 → AI 카피 추천**
- 설명 다듬기: 구좌 편집의 설명란 아래 **AI로 문구 다듬기**
- 브리프 메인 카피: 브리프의 **AI 제안**

세부 안내: [AI 추천 모듈](https://gitlab.com/amoread2/osulloc/-/blob/ai/amoread-ai-module/workspace/amoread_app/amoread/ai/README.md), [멘트 추천 기능](https://gitlab.com/amoread2/osulloc/-/blob/ai/amoread-ai-module/멘트추천기능/README.md).

## 8. 문제가 생기면

| 증상 | 확인할 내용 |
|---|---|
| `python`을 찾을 수 없음 | Python 설치와 PATH 확인. 설치 명령은 `py -3 setup_env.py`로 시도 |
| `setup_env.py` 또는 모듈을 찾을 수 없음 | 현재 위치가 `osulloc-ai\workspace\amoread_app`인지 확인 |
| 패키지 설치 중 SSL·인증서 오류 | `pip-system-certs` 설치 단계 확인. 계속 실패하면 오류 메시지를 전달하고 사내 인증서·네트워크 설정 확인 |
| 원천 파일이 없다는 오류 | 3번의 위치·원본 파일명 확인 후 5번 재실행 |
| 상품·실적 화면에 데이터 없음 | 5번 변환이 오류 없이 완료되어 `planner\data\planner_data.json`이 생성되었는지 확인 |
| 포트가 이미 사용 중 | `$env:PLANNER_PORT = "9761"`로 바꿔 실행하고 접속 주소도 `http://127.0.0.1:9761/v2/`로 변경 |
| 인증 토큰이 없다는 안내 | 서버 재실행 후 페이지 새로고침 |
| 한글이 깨짐 | 실행·변환 전에 `$env:PYTHONUTF8 = "1"` 설정 |
| AI 카피 추천 실패 | Claude 인증·모델 권한 확인. 패키지가 설치되어 있다는 상태만으로 인증 성공을 보장하지 않음 |
| 레퍼런스가 비거나 점검 경고가 나옴 | 아래 점검 명령 실행 후 안내 확인 |

레퍼런스 데이터 점검은 앱을 종료한 뒤 같은 폴더에서 실행할 수 있습니다.

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -m amoread.ai.selfcheck
```

레퍼런스 데이터가 누락된 경우 수집 담당이 내보낸 스냅샷 ZIP을 사내 채널로 받아 다음과 같이 지정할 수 있습니다. 판매실적·상품장 원천 파일을 대신하는 ZIP은 아닙니다.

```powershell
python setup_env.py --snapshot "C:\실제경로\amoread_snapshot_날짜_시각.zip"
```

경로는 실제 받은 파일 위치로 바꿔 주세요. 설치 도구는 기존 기본 색인이 있으면 데이터 가져오기를 건너뜁니다. 최신 스냅샷으로 교체가 필요한 경우에는 [AI 모듈 문서의 스냅샷 공유 안내](https://gitlab.com/amoread2/osulloc/-/blob/ai/amoread-ai-module/workspace/amoread_app/amoread/ai/README.md)를 확인해 주세요.

문제가 해결되지 않으면 **실행한 단계와 PowerShell 오류 메시지**를 전달해 주세요. API 키·비밀번호·원천 데이터 내용은 포함하지 마세요.

> `run_redesign.bat`는 특정 PC의 Python 경로를 사용하므로 이 안내의 실행 명령을 사용해 주세요.

---

## 9. 03 구좌 편집 = 신규 구좌편집기

신규 구좌편집기(v1.12)가 **03 구좌 편집의 유일한 편집기**입니다. 예전 구좌 편집기 주소(`/v2/editor`)로 들어와도 신규 편집기로 넘어갑니다.

### 9-1. 보기

1. 홈(`/v2/home`)에서 기획안을 열고 단계 막대의 **03 구좌 편집**
2. 예시 화면만 보려면 `http://127.0.0.1:9751/v2/editor` (가상 상품·후기, 저장 안 됨)

### 9-2. 화면 구성 (자세히: `plans/27`)

| 칸 | 하는 일 |

|---|---|
| 왼쪽 | 페이지 구좌 목록 (순서·복제·삭제는 줄에 마우스를 올리면), **＋ 구좌**(유형 선택 창), **＋ 요소**(요소 넣기 패널) |
| 가운데 | 모바일 미리보기 + 페이지 전체 도구(실행 취소·검수·내보내기) |
| 오른쪽 | 고른 구좌 편집: 내용(문구·상품) · 배치·표시 · 참고·인계 · 검수, **AI 카피 추천**(문구 탭), **자료 연결** |

### 9-3. 저장과 연결

- 고친 내용은 기획안의 `editor_next`(편집기 값 전체)와 표준 형식 `page.sections`에 **함께** 저장됩니다 → 04 미리보기·내보내기·AI 카피 추천이 같은 내용을 봅니다.
- 02 구좌 구성에서 구좌를 다시 고르면, 03을 열 때 바뀐 구좌에 맞춰 다시 가져옵니다 (같은 구좌 id는 편집기 세부값 유지).
- 다른 화면이 먼저 저장했으면 덮어쓰지 않고 "저장 못 했어요"로 알리고, 작성 내용은 이 브라우저에 임시 보관합니다.
- 상품·가격은 이 기획안의 **상품·할인** 단계 값입니다. 상품 이미지는 앱 데이터에 없어 자리만 나옵니다.

### 9-4. 레퍼런스 추천

- 오른쪽 **참고·인계 › 레퍼런스**. 수집해 둔 자사몰·외부 페이지에서 이 구좌와 비슷한 구좌 3개(+ 더 보기)와, 오늘의 영감 보관함에 저장한 구좌가 나옵니다.
- **참고로 붙이기** → 메모(참고할 것)를 남길 수 있고, 붙인 것은 04 미리보기·내보내기의 '참고 (원본 구좌)'에 함께 나갑니다. 예전 편집기에서 붙인 것도 그대로 보입니다.
- **라이브러리에서 보기**는 레퍼런스 화면에서 그 구좌를 바로 엽니다. 붙이고 뺀 기록은 다음 추천 순서에 반영됩니다.

### 9-5. AI 카피 추천

- 오른쪽 **내용 › 문구**의 설명 입력칸 아래. 제목·설명 함께 / 제목만 / 설명만 / 지금 설명 다듬기, 말투 3가지 → 후보 3개 → 고른 것만 입력칸에 들어갑니다 (실행 취소 가능).
- 서버 모듈은 저장소 루트 `멘트추천기능/` (`ai/amoread-ai-module` 브랜치에서 모듈만 가져옴). 서버가 Claude Agent SDK로 호출하며, 그 PC에 Claude Code가 로그인돼 있어야 실제 추천이 됩니다. 원가·매출·후기는 보내지 않습니다.

### 9-6. 개발자용

- **끄기**: `$env:AMOREAD_EDITOR_NEXT = "0"`이면 신규 편집기가 꺼지고 `/v2/editor`가 예전 편집기를 엽니다. 편집기 파일은 `amoread_editor/editor/v1.12`, 앱 연결부는 `planner/static/v2/editor-next*` (배치 `editor-next-ux.css`, 저장 연결 `editor-next-host.js`, AI `editor-next-ai.js`).
- **테스트**:
  ```powershell
  .venv\Scripts\python.exe -m pip install -r requirements-dev.txt
  .venv\Scripts\python.exe -m playwright install chromium
  .venv\Scripts\python.exe -m pytest tests -q            # 저장 단위 + 브라우저 통합 테스트 (서버를 스스로 띄움)
  cd ..\..; workspace\amoread_app\.venv\Scripts\python.exe -m pytest 멘트추천기능/tests -q   # AI 카피 추천 모듈 (저장소 루트에서)
  ```
  사내망에서 `playwright install`이 막히면 `$env:E2E_BROWSER_CHANNEL = "msedge"` (이 PC의 Edge 사용, 정책에 따라 안 될 수 있음).
- **디자인 비교**(원본 대비): `amoread_editor\integration\green-ui-compare\report.html`


### 01 브리프 · 근거 기반 키워드 탐색

- 브리프 안에서 **명분 · 중심 키워드**를 고친 뒤 **이 명분으로 키워드 찾기**를 누르면 명분과 출발점을 함께 저장하고 새 검색 결과로 지도를 만듭니다. 같은 명분을 다시 검색해도 서버의 6시간 캐시를 갱신합니다. 담아 둔 키워드·작성한 콘셉트·카피는 유지합니다.
- 중심 단어에서 실제 연관 키워드가 바로 뻗습니다. 첫 가지에 기획 관점 분류를 넣지 않으며, 출처 필터와 배지로 검색 연관어·콘텐츠 추출어·웹 근거 기반 AI 추천·AI 아이디어를 구분합니다. 키워드를 직접 추가하거나 숨기고, 선택한 말에서 다음 가지를 탐색할 수 있습니다. 상품 연결은 실제 상품 이름이 명분·후보 키워드와 일치할 때 표시합니다.
- 검색 상승은 최근 4주와 이전 4주의 비교가 가능한 경우에만 표시합니다. 검색 연관어·콘텐츠 추출어는 유행을 증명하지 않으며, 근거가 없으면 **검색 추이 미확인**으로 표시합니다. 뉴스·블로그는 최신순으로 조회합니다.
- **브리프에 담기**는 키워드와 출처·조회일·관련 글을 함께 저장합니다. **키워드로 콘셉트 조합**은 문장 틀이며, **AI 활용 방향 보기 / AI 콘셉트 제안**은 버튼을 누를 때 Claude를 호출합니다. AI 제안은 입력한 명분·타깃·기간·선택 키워드와 공개 콘텐츠 제목만 전달하며, 상품 원가·매출은 전달하지 않습니다. Claude SDK 인증과 모델 권한이 필요합니다.
- **AI로 키워드 확장**은 Claude Agent SDK의 WebSearch/WebFetch로 현재 중심 단어의 자료를 조사해 최대 8개의 연관 키워드를 추가합니다. 실제 도구 결과에서 확인한 링크만 웹 근거로 인정하고, 근거를 확보하지 못한 제안은 **AI 아이디어**로 표시합니다. 링크·자료 게시일·추천 이유·조회일을 저장하고, 새로고침 때 저장된 가지를 복원합니다. AI 확장은 최근 10회까지 보관하며, 담은 키워드의 근거는 별도로 유지합니다. 명분을 바꾸면 이전 명분의 지도를 새로 만들고 이미 담은 키워드는 유지합니다. Claude 인증·모델 접근뿐 아니라 해당 환경에서 WebSearch/WebFetch 사용이 가능해야 합니다.
- 검증: 앱 폴더에서 `python -m pytest tests/test_keyword_agent.py tests/test_brief_keywords.py tests/test_project_save.py tests/test_save_safety.py -q`, Node가 있으면 `node --test tests/brief-keywords.test.cjs`. 외부 API·AI 응답은 테스트용 대체 응답으로 검증합니다.

# AMOREAD — 오설록몰 프로모션 페이지 기획 도구 (`sub` 브랜치)

프로모션 기획안 하나를 **홈(일정·명분) → 브리프 → 구좌 구성 추천 → 구좌 편집 → 미리보기·내보내기** 순서로 만드는 로컬 웹앱입니다.
새로 설계한 화면은 `/v2/`, 예전 화면은 `/`에 있습니다.

> **`design` 브랜치:** 기획자 프로토타입(`sub`)에서 화면 UX/UI가 바뀐 내용과 변경 이력은 [README_UXUI_변경사항.md](README_UXUI_변경사항.md)에 있습니다.

> 이 문서는 각자 PC에서 처음 받아 실행하는 방법입니다. 서버는 **자기 PC(127.0.0.1)에서만** 열리므로, 다른 사람 PC의 화면에는 접속할 수 없습니다. 각자 실행하세요.

---

## 1. 준비물

| 항목 | 내용 |
|---|---|
| OS | Windows 10/11 (아래 명령은 PowerShell 기준) |
| Git | `git --version`으로 확인 |
| Python | **3.11 이상** (`python --version`). 담당자 PC는 3.15.2에서 동작 확인 |
| GitLab 권한 | 이 저장소는 비공개입니다. 접근 권한이 없으면 담당자에게 요청 |

---

## 2. 받기

```powershell
git clone -b sub https://gitlab.com/amoread2/osulloc.git
cd osulloc\workspace\amoread_app
```

이후 명령은 모두 **`workspace\amoread_app` 폴더 안에서** 실행합니다.

---

## 3. Python 환경 만들기 (처음 한 번)

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install pip-system-certs
.venv\Scripts\python.exe -m pip install -r planner\requirements.txt
```

- `pip-system-certs`를 먼저 설치하는 이유: 사내망에서 pip가 인증서 오류(`SSL: CERTIFICATE_VERIFY_FAILED`)로 멈추는 것을 막습니다.
- `.venv` 폴더는 git에 올라가지 않습니다 (각자 PC에서 만듦).
- 설치는 몇 분 걸립니다. 끝에 나오는 `A new release of pip is available` 안내는 무시해도 됩니다.

---

## 4. 실행

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

- `sub`에서 각자 브랜치를 만들어 작업하고, Merge Request로 `sub`에 합칩니다.
  ```powershell
  git switch -c 이름/작업내용
  ```
- **올리면 안 되는 것**: `data\`, `planner\data\`, `.env`, `.venv\` (모두 `.gitignore`에 있음). `git status`에 이런 파일이 보이면 커밋하지 마세요.
- 참고: `sub`는 원격 `main`과 이력이 이어져 있지 않습니다. `main`에 합치는 방법은 따로 정합니다.

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

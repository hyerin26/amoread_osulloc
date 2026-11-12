# AI 추천 모듈 (구좌 구성 · 레퍼런스)

화면(`planner/static`)은 **바꾸지 않고** 서버(`/api/am/ai/*`)로만 붙는 모듈입니다.
`planner.server`의 Guard(토큰·Host 검사, 보안 헤더)가 그대로 적용되고, 기획안·원천 파일에는 **쓰지 않으며** 외부 호출도 없습니다.

| 단계 | 하는 일 | 방식 |
|---|---|---|
| 1. 구좌 구성 | 브리프(제목·명분·콘셉트·목적·분류·키워드…) → 프로모션 유형 9개 중 판단 → 구좌 목록(이름·레이아웃·구좌 목표·필수/선택·이유) | **명분 사전**(`/api/seasons`, 담당자가 관리)의 종류 → 키워드 규칙 → 목적·분류 순. 단서가 없으면 유형을 찍지 않고 '유형 미정' 범용 구성. 모델·외부 호출 없음 (`rules.py`) |
| 2. 레퍼런스 | 구좌 하나 → 같은 역할의 수집 사례 n개 + 추천 이유 | 역할 필터 → BM25 → (선택) 의미 벡터 → 중복 묶기 → 우리 브랜드 먼저 (`refs.py`) |

## API

모두 `POST`(상태만 `GET`), 헤더 `x-planner-token` 필요 (화면이 이미 쓰는 것). 입력은 `amoread.api`의 Brief와 같은 필드명이며 **모두 선택**입니다.

| 주소 | 입력 | 결과 |
|---|---|---|
| `GET /api/am/ai/status` | – | `{ready, sections, pages, brands, mode: "keyword"\|"keyword+vector"}` |
| `POST /api/am/ai/outline` | `{title, brief{myeongbun,concept,purpose,audience,…}, v2{cls,keywords}}` | `{mode, basis, type, items:[{name, layoutId, purpose, optional, why, role}]}` — `sources/outline.js purposeOutline`과 같은 모양 |
| `POST /api/am/ai/references` | `{section{layoutId,name,purpose}, doc, n}` | `{mode, basis, items:[{id,title,campaign,cat,applicable,layout,reason,summary,why,from,url,…}]}` — `sources/recommend.js recommendRefs`와 같은 모양 |
| `POST /api/am/ai/compose` | `{doc, per_section}` | `{mode, basis, type, candidates:[A,C], pages, refs}` — `v2/compose.js`의 CANDS(A 규칙형·C 레퍼런스 조합)와 같은 모양, `pages`는 PAGES(페이지키 → 이름·출처·구좌 목록) |

| `POST /api/am/ai/feedback` | `{event: pick_cand\|pick_ref\|drop_ref, doc_id, cand_id, ref_id, section}` | `{ok}` — 담당자의 선택을 `planner/data/ai_log/events.jsonl`에 ID만 덧붙임 |
| `GET /api/am/ai/feedback/summary` | – | 후보별 노출·선택 비율, 많이 고른·버린 레퍼런스 |

- 레이아웃 ID는 화면 값(`hero · grid2 · grid3 · split · benefit · deal-banner · text-cta`), 구좌 목표는 `브랜딩 · 전환 · 객단가 · 혜택 안내 · 정보 안내 · 유입`을 씁니다.
- `mode`: 색인이 있으면 `ai`, 없으면 `demo`(규칙만, 레퍼런스 비어 있음). 화면이 '(예시)'를 표시하는 기준으로 쓸 수 있습니다.
- `optional: true`는 필수가 아닌 구좌(유형 규칙의 선택 구좌)입니다.

## 화면에 붙이려면 (화면 담당)

이 모듈은 화면 코드를 건드리지 않습니다. 화면의 출처 파일(`planner/static/js/am/sources/*.js`, `v2/compose.js`의 `buildLive`)에서
`/api/am/ai/*`를 불러 같은 모양의 결과로 바꿔 끼우면 됩니다 (`mode: 'ai'`일 때만). 서버가 꺼져 있거나 `mode: 'demo'`면 지금 화면의 예시 로직을 그대로 쓰면 됩니다.

## 레퍼런스 색인 만들기 (처음 한 번, 데이터를 바꿀 때)

색인은 `planner/data/ai_refs/`(git에 올라가지 않음)에 둡니다. 외부 사이트에서 수집한 자료라 **저장소에 올리지 않습니다.**

```powershell
$env:PYTHONUTF8 = "1"
.venv\Scripts\python.exe -m amoread.ai.build_index --src <수집·분석 결과 폴더>            # 키워드 검색용
.venv\Scripts\python.exe -m amoread.ai.build_index --src <수집·분석 결과 폴더> --vectors  # 의미 벡터도
```

`--src` 폴더에는 `sections_unified.jsonl`, `pages_meta.jsonl`이 있어야 합니다. 수집 데이터(`reference/data`)에서 `reference_ai/build_unified.py <reference/data>`로 만듭니다. 구좌 역할은 `role` 하나로 합쳐져 있습니다(수집 원본의 `content`만 규칙으로 세분화, `terms`→`terms_notice`로 이름 통일. 원본 값은 `role_v1`). `--vectors`는 벡터를 이 폴더에서 직접 계산합니다. 색인 파일이 바뀌면 서버를 끄지 않아도 다시 읽습니다.

### 의미 벡터(선택)
키워드(BM25)만으로도 동작합니다. 의미 벡터를 섞으려면 `sentence-transformers`를 설치하고 환경변수 `AMOREAD_AI_DENSE=1`을 켭니다
(모델 `intfloat/multilingual-e5-base`를 처음 한 번 내려받아야 해서 사내망에서는 막힐 수 있습니다. 못 받으면 자동으로 키워드만 씁니다).
`AMOREAD_AI_DENSE_MODEL`로 모델을, `AMOREAD_AI_PREFER_BRANDS`(기본 `osulloc`)로 먼저 보여 줄 브랜드를 바꿀 수 있습니다.
`AMOREAD_AI_BRAND_MARGIN`(기본 3.0)은 우리 브랜드를 앞세우는 한도입니다 — 1등 사례와 점수 차가 이보다 크면 우리 브랜드라도 앞세우지 않습니다 (엉뚱한 자사 글이 맨 앞에 오는 것을 막음).
`AMOREAD_AI_AFFINITY`(기본 0=끔)는 우리 브랜드 글과 말투·소재가 가까운 사례를 앞세웁니다. 측정에서 식품몰 비율은 오르지만(0.45→0.57) 라벨 점수가 내려가(0.69→0.65) 켜지 않았습니다.
사례가 모자란 역할(카드 제휴·룩북·앱 안내)은 가까운 역할에서 보충해 찾습니다 (`refs.ROLE_FALLBACK`). 응답의 `images`는 원본 이미지 주소입니다(화면은 아직 쓰지 않음).

## 새 레퍼런스 가져오기 (링크·HTML 파일·이미지)

레퍼런스 화면의 [＋ 레퍼런스 추가]에서 방법을 고른다. **링크·HTML은 먼저 읽고 채운 뒤, 담당자가 확인·수정하고 [추가]를 눌러야 저장된다.**

1. **불러오기** `POST /api/am/ai/intake/preview` — `{method: "url", url}`(서버가 내려받음) 또는 `{method: "html", html, filename}`(브라우저가 읽어 보냄).
   HTML을 읽어 구좌로 나누고(section·header·footer·h1/h2 기준), 구좌 역할과 분류 라벨(명분·분류·혜택·유형)을 자동으로 붙여 초안과 근거·경고를 돌려준다. 아직 저장하지 않는다(초안은 24시간 보관).
2. **확인·수정** — 화면의 이름·종류·명분·분류·혜택 방식·태그를 고친다. 나눈 구좌 목록도 미리 볼 수 있다.
3. **추가** `POST /api/am/ai/intake/commit` — 고친 값으로 라이브러리(`planner/data/references`)에 저장하고, 구좌를 사용자 색인(`planner/data/ai_refs_user/`)에 넣어 추천 검색에도 쓴다. 지우면 색인에서도 빠진다. 수집 색인을 다시 만들어도 사용자 색인은 남는다.
- **이미지**는 내용을 읽지 않는다(OCR 보류). 파일 이름으로 이름만 채우고 나머지는 직접 고른다.
- **링크 내려받기는 안전하게**: http/https·80/443 포트만, 내부·사설 주소 차단(DNS로 풀린 IP를 검사해 그 IP로 접속, 리다이렉트도 매번 검사), 5MB·15초, HTML 형식만. 저장하는 HTML은 스크립트·이벤트 속성을 뺀 뒤 gzip이고 화면에 원본 그대로 내보내지 않는다.
- **한계**: 서버는 브라우저가 아니라 내려받기만 하므로, 브라우저에서 그려야 보이는 페이지는 본문이 비어 경고가 뜬다 → 브라우저에서 'HTML로 저장'한 파일을 올린다. 구좌 나누기는 일반 규칙이라 몰별로 맞춘 팀원 수집본(`section_inference.py`)과 개수·역할이 다를 수 있어 미리보기로 확인하게 했다.

## 분류 라벨 (레퍼런스 화면의 필터)

- 수집한 페이지마다 `labeling.py`가 **명분·시즌, 분류(시즌/브랜드기획전/런칭/콜라보/클리어런스), 프로모션 유형, 혜택 방식, 참여 방식**을 규칙으로 붙이고 근거(`evidence`)와 신뢰도를 남긴다. 구좌에는 구좌 종류(`stype`)·참여 방식을 붙인다. 원본 JSON은 고치지 않고 `planner/data/ai_refs/page_labels.json`에 따로 저장한다.
- **자동 수집과 연결:** 새 페이지가 들어오면 같은 `labeling.classify_page(page)`를 부르면 된다. `refresh.py`가 합치기→색인→분류→평가를 한 번에 돌린다.
- **사람이 고치는 법:** `python -m amoread.ai.build_index --export-labels 라벨.csv` → 엑셀에서 고침 → `--import-labels 라벨.csv`. 자동 값과 달라진 칸만 `label_overrides.json`에 저장되고, 이후 색인을 다시 만들어도 그대로 유지된다(`labeled_by = human`).
- 값은 검수 전 자동 라벨이다. 분류는 제목만 보며(본문 메뉴 글에 속지 않으려고) 단서가 없으면 비워 둔다(현재 66/183). 명분·시즌은 명분 사전(오설록 달력) 또는 제목의 계절 말에서만 정하고 없으면 비운다 — 수집한 달로 정하면 전부 같은 값이 돼서 쓰지 않는다.
- `GET /api/am/ai/library`가 이 라벨을 화면(레퍼런스 라이브러리) 모양으로 돌려주고, `library.js`가 불러와 하드코딩된 예시 대신 보여 준다(서버가 꺼져 있으면 예시 그대로).

## 유지보수를 줄이는 구조

- **규칙을 수집 사례가 받쳐 준다 (`type_stats.json`).** 색인을 만들 때 수집한 페이지마다 같은 규칙으로 유형을 붙이고 "이 유형 사례 N개 중 M개가 이 구좌를 가짐"을 센다. 구좌 이유에 이 숫자가 붙고(응답 `support`), 사례가 5개 미만인 유형은 신뢰도를 낮추며, 6개 이상인 유형에서 사례의 20% 미만만 가진 필수 구좌는 선택으로 낮추고, 두 몰 이상 사례의 60% 이상이 가진 구좌는 선택 구좌로 제안한다. 새 데이터가 들어오면 숫자가 저절로 바뀐다.
- **C안은 페이지 단위로 먼저 고른다.** 브리프에 가까운 레퍼런스 페이지를 먼저 찾고(페이지 검색 점수 + 구성안 역할을 얼마나 가졌는지 + 우리 브랜드), 그 페이지 안에서 구좌를 가져오고 없는 구좌만 다른 사례로 보충한다. 10개 브리프에서 C안이 쓴 서로 다른 페이지 수가 평균 3.4개 → 2.8개로 줄었다.
- **선택을 기록한다 (`feedback.py`).** 후보를 골랐을 때만 화면(`compose.js`)이 `/feedback`을 부른다(화면은 그대로). 레퍼런스를 골랐다·버렸다는 기록(pick_ref·drop_ref)은 API가 준비돼 있으나 구좌 편집·미리보기 화면이 아직 부르지 않는다. 기록이 쌓이면 많이 고른 사례는 조금 앞서고(+0.25) 많이 버린 사례는 뒤로(-0.5) 간다. 기록이 없으면 아무 일도 없다.
- **갱신은 한 번에:** `reference_ai/refresh.py <reference/data>` — 합치기 → 색인 → 평가 → 지난번 점수와 비교(`eval_history.jsonl`).

- 새 명분(빼빼로데이 같은 기념일)은 **명분 사전에만 등록**하면 된다. 사전의 '종류'(명절·대목/기념일/쇼핑/…)가 유형 가중치로 바뀌므로 코드를 고칠 필요가 없다 (`rules.SEASON_KIND_PRIOR`, 종류가 9개로 고정).
- 사전에도 키워드에도 없는 새 말은 **틀린 유형을 확신 있게 내지 않고** '유형 미정 (범용 기본 구성)'을 낸다.
- 담당자가 **확정**한 기획안은 다음 비슷한 기획에서 후보 D '지난 우리 기획안처럼'으로 나온다 (`cases.py`, 읽기만). 쓸수록 늘고 따로 관리할 목록이 없다.
- 의미 벡터로 명분을 고르는 방식은 측정해 보고 넣지 않았다 (e5-base로 명분 사전 43개와 비교: 철자 변형·동의어는 맞혔지만 새 말은 오답 점수가 0.78~0.83으로 정답과 구분이 안 됨).

## 과제로 남겨 둔 것

- **데이터가 적고 한쪽으로 치우쳤다.** 오설록 페이지 4개, 29cm 패션이 대부분이다(유형 통계도 29cm '브랜드 쇼케이스' 70개가 대부분). 끝난 행사는 사이트에서 사라지므로 새로 모아야 한다. 코드로는 풀리지 않는다.
- **글만 읽는다.** 이미지뿐인 구좌(약 33개)는 설명(alt)이 없으면 못 찾는다. OCR·이미지 임베딩은 이미지를 내려받아야 하고 팀 공유 자료 안전 문제가 있어 보류했다.
- 유형 규칙·라벨은 사람 검수 전이다. 선택 기록이 쌓이면 이것으로 검증한다.

## 한계 (사용 전에 알아 둘 것)

- **유형 규칙은 기획자 검토 전 초안**입니다. 유형 9개의 표준 구성은 수집한 사례(컬리 8, 오설록 3, 29cm 76)에서 관찰한 것에 기획 상식을 더한 것이고,
  선물 큐레이션·신제품 론칭·셰프 협업은 근거 사례가 1~3개뿐이라 신뢰도 `low`로 표시됩니다. 판단 키워드·근거 사례는 응답의 `basis`·`type`에 들어 있습니다.
- 레퍼런스는 **29cm 패션 사례가 대부분**이라, 오설록 사례가 없는 구좌(예: 신제품 메인 비주얼)에는 패션 사례가 나옵니다 (출처는 `from`·`campaign`에 표시).
  원본 이미지·캡처는 연결돼 있지 않습니다.
- 레이아웃이 7종뿐이라 유의사항·공유·앱 안내 같은 구좌는 모두 `text-cta`로 모입니다.
- 검색 품질은 쿼리 30개·AI가 붙인 라벨 625건으로 가늠한 값이며 사람 검수 전입니다. 현재 값(구좌당 상위 5개, 라벨 기준): 키워드 nDCG 0.69·Hit 0.90, 키워드+벡터 nDCG 0.72·Hit 0.97. 평가: `reference_ai/eval_product.py`.
- 글 없이 이미지뿐인 구좌(약 33개)는 이미지 설명(alt)이 없으면 찾지 못합니다. 이미지를 읽는 OCR·이미지 임베딩은 이미지를 내려받아야 하고 팀 공유 자료 안전 문제로 보류했습니다.

## 파일

| 파일 | 역할 |
|---|---|
| `rules.py` | 유형 판단·구좌 구성 규칙, 역할→화면 레이아웃·구좌 목표 매핑 |
| `refs.py` | 색인 읽기, 역할 필터·BM25·(선택)벡터 검색, 화면 레퍼런스 모양으로 바꾸기 |
| `compose.py` | A·C 후보와 pages 조립 |
| `api.py` | 라우터 `/api/am/ai/*` (`amoread/api.py` 맨 아래에서 포함) |
| `build_index.py` | 색인·유형 통계·분류 라벨 만들기 |
| `labeling.py` · `library.py` · `cases.py` · `feedback.py` | 분류 라벨 · 레퍼런스 화면용 목록 · 저장한 기획안 사례 · 선택 기록 |
| `tools/` | 새 데이터 갱신·평가 스크립트 (`tools/README.md`) |

## 썸네일(윤곽) 규격
레퍼런스 카드 썸네일은 이미지 없이 구좌 구성에서 자동으로 그려진다 (`library.js` `shapeThumb`).
- 입력: 페이지별 `shape_x` = `[{r: 역할, l: 글 길이, i: 이미지 수, t: 제목}]` (없으면 `shape` 역할 목록만으로도 그려짐)
- 색: 역할 계열(비주얼·상품·혜택·스토리·참여·안내)별, `FAM` 표 한 곳에서 관리
- 새 레퍼런스: 색인(`build_index`·크롤링 갱신)·가져오기(`intake` commit) 모두 같은 필드를 채우므로 추가 즉시 썸네일이 생긴다
- 새 역할이 생기면 `FAM`, `SH`, `shapeBlock0`에 한 줄씩 추가 (없으면 기본 줄무늬로 표시)

## 수집 버튼 (임시, `collect.py`)
레퍼런스 라이브러리 화면의 [수집] 버튼 → 주소 목록을 한꺼번에 내려받아 구좌 나누기·자동 분류 후 추가한다 (`/api/am/ai/collect/*`).
- 한 주소의 처리는 가져오기(intake)와 같은 안전 내려받기·분류. 라벨은 `labeled_by: auto`로 남고 이미 있는 주소는 건너뛴다.
- 백그라운드 1개만 동시 실행, 한 번에 30개, 주소 사이 1초. 주소 목록은 `planner/data/ai_collect/sources.json`에 저장.
- 매일 아침 자동 수집은 같은 `collect.start(urls)`를 예약 실행하면 된다 (노트북이 꺼져 있으면 못 돈다는 점은 그대로).
- 프론트는 임시 버튼 하나(`#collectBtn`)와 대화상자뿐이다. 디자인 파트가 모양을 바꿔도 API는 그대로 쓸 수 있다.

## 수집본 일괄 전환·삭제 (`migrate.py`, `/api/am/ai/hide`)
- `python -m amoread.ai.migrate` — 처음에 색인으로 넣은 수집본 184건을 '직접 추가' 레퍼런스와 같은 저장 방식(레퍼런스 저장소 + 사용자 색인)으로 옮긴다. 원본 색인은 그대로 두고 삭제 목록(`ai_refs_user/hidden.json`)에 적어 가린다. 여러 번 돌려도 안전, `--undo`로 되돌림.
- 옮긴 뒤: 고치기·삭제·라벨 수정·수집 당시 화면이 새로 추가한 것과 똑같고, 검색 점수는 그대로다(평가 nDCG 0.690 → 0.690). 구좌 id는 `orig_id`에 원래 값을 남겨 평가 라벨과 이어진다.
- 삭제 버튼: 옮기지 않은 수집본 페이지는 `POST /api/am/ai/hide {id, on}`으로 숨긴다(삭제 목록에 적을 뿐이라 색인을 다시 만들어도 다시 나오지 않고 `on:false`로 되돌릴 수 있다).

## 화면 수집 (CSS·배치까지, `render.py` · `recapture.py`)
주소로 HTML만 내려받던 방식(`intake.fetch`)은 CSS·실제 배치를 못 받는다. 화면 수집은 실제 브라우저(Chrome)로 페이지를 그린 뒤 모양까지 저장한다.
- **저장**(`planner/data/ai_refs_user/capture/<id>/`): `page.html.gz`(그려진 HTML + 적용된 CSS를 한 파일로, 스크립트 없음) · `meta.json`(수집 시각·최종 주소·본문 해시·CSS 크기·구좌 띠 배치). 이미지·글꼴·영상 파일은 저장하지 않는다(이미지 주소만).
- **배치**: 페이지를 세로 띠(band)로 나눠 띠마다 위치·높이·글 길이·이미지 수·칸 수·배경색을 남기고, 가장 닮은 구좌의 역할을 붙인다. 레퍼런스 썸네일이 이 값으로 실제 배치 윤곽을 그린다.
- **고정 조건**: 모바일 폭 390px, 한 번에 한 페이지, 영상 차단, 제한 시간. 브라우저가 보내는 모든 요청은 내부망·사설 주소 차단(intake와 같은 규칙).
- **보기**: 수집 당시 화면 → 그려서 저장한 모습을 칸(iframe, sandbox·스크립트 없음, 전용 CSP)에 보여 준다 (`/ai-snap/<id>`). 저장본이 없으면 글·구조 읽기용 화면.
- **필요한 것**: `pip install playwright` + 이 PC의 Chrome (브라우저를 따로 내려받지 않음, `channel="chrome"`). 없으면 `render.available()`가 False라 기존 방식(HTML만)으로 동작한다.
- **재수집** `python -m amoread.ai.recapture [--limit N] [--ids ..] [--force]`: 이미 추가한 레퍼런스의 링크를 따라가 **같은 프로모션이면**(예전 글 2글자 조각이 새 페이지에 50% 이상 포함) 채운다. 끝났거나 사라졌으면(종료 안내·첫 화면으로 이동·404) `gone`, 내용이 달라졌으면 `changed`로 표시만 하고 덮어쓰지 않는다. 결과는 `planner/data/ai_collect/recapture.json`.
- **수집 버튼**으로 새로 추가할 때도 브라우저 수집 도구가 있으면 자동으로 화면 수집까지 한다.
- 알려진 한계: 이미지 파일이 없어 사진 자리는 회색 칸. 팝업·쿠키 배너가 뜬 상태로 저장될 수 있음. 로그인·앱 전용·봇 차단 페이지는 못 받음.

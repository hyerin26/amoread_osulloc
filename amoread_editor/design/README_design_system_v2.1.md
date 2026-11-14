# AMOREAD · Tea Green UI v2.1

적용일 2026-11-05 / D-046 / CR-20261105-001 / main 883db0e 기반 yunxeo 브랜치.

## 실제 앱에서 확인하기

저장소 루트 `index.html`을 브라우저로 열거나 `python3 -m http.server 8000`으로 실행한다. [라이브 UI 키트](visual-guide_v2.1.html)는 참고용 오프라인 가이드이며 상단 ‘프로토타입 적용본’ 링크가 실제 루트 앱으로 연결된다.

## 단일 HTML 빌드

`python3 scripts/build.py`는 아래 순서로 CSS를 합친 뒤 `src/template.html`과 `src/app.js`에 연결한다.

1. `design/tokens_v2.1.css`: primitive → semantic → component 토큰.
2. `src/styles.css`: 기존 페이지/와이어프레임 구조, 캠페인 목업, 인쇄 기준.
3. `src/theme.css`: Tea Green 앱 UI 컴포넌트, 반응형 보정, 인쇄 호환.

생성된 `index.html`은 외부 파일·패키지 없이 열린다. 기존 HTML 내보내기도 합성 CSS를 그대로 포함한다. `index.html`을 직접 편집하지 않는다. 제출 전 `python3 scripts/build.py --check`, `node --check src/app.js`를 실행한다.

## 적용 값

- 주 행동: Tea Green `#397D49`, hover `#2D663B`.
- 선택 배경 `#F2F7EE`, 브랜드 텍스트 `#2D663B`.
- 화면은 화이트/쿨 뉴트럴. 캠페인 미리보기의 브랜드 그래픽은 별도로 유지한다.
- 편집 본문 14px, 레이블 13px, 페이지 제목 28/36px, 패널 제목 15/24px, 섹션 제목 18/26px.
- 일반 버튼 40px, compact 버튼 36px, 입력 44px; 터치 환경의 행동 타깃은 44px 이상.
- 버튼/입력 반경 9~11px, 카드 16px, 확인창 20px. 상태와 목적별 크기는 `src/theme.css`에 매핑한다.
- 포커스: 연한 Leaf 300 ring, 입력 focus에 브랜드 테두리+연한 배경 ring.
- 선택: 연한 그린 + 텍스트/테두리. 미적용 후보: amber 점선+임시 미리보기 문구. 성공: 체크/완료 문구와 positive 상태색.
- 8개 주요 텍스트 색 조합은 4.5:1 이상(주요 버튼 흰 글자 5.00:1). 전체 접근성 인증은 아니다.

`tokens_v2.1.json`은 CSS와 같은 값을 담은 프로젝트 전용 JSON이다. 특정 Figma 플러그인 자동 가져오기 형식은 아니다. 폰트는 설치된 Pretendard 또는 시스템 한글 서체로 대체하고 외부 폰트를 로드하지 않는다.

## 공통 컴포넌트

`.btn` / `.field` / `input,textarea,select` / `.tag` / `.tabs,.inspector-tabs` / `.outline-item` / `.layout-card,.ref-card,.catalog-item` / `.price-preview` / `.notice,.helper-banner` / `.modal,.toast`를 기존 DOM에 매핑했다. `components_v2.1.css`는 가이드의 독립 UI 예시용이며 앱에 중복 로드하지 않는다.

## 화면 크기

| 화면 | 구좌 목록 | 캔버스 | 속성/탐색 |
|---|---|---|---|
| 1221px 이상 | 220px | 유동, 최소 420px | 360px / 480px |
| 981~1220px | 190px | 유동, 최소 330px | 320px / 430px |
| 701~980px | 180px | 남은 폭 | 접기 가능한 오버레이 |
| 700px 이하 | 버튼으로 열기 | 단일 열 | 전체 폭 오버레이 |

작은 화면에서는 작업 단계 내비게이션을 독립된 두 번째 행에 놓는다. 편집 영역 높이는 상단 바 높이를 제외해 하단이 뷰포트를 넘지 않게 한다. reduced-motion이면 전환을 제거한다.

## 유지하는 업무 계약

기획 내용·상품 연결·가격 적용·Undo/Redo·브라우저 저장 키는 그대로다. 탐색/패널 접기는 적용 또는 취소가 아니다. JS 변경은 레이아웃 ‘교체’ 후보에도 기존 신규 후보와 같은 임시 미리보기 표시를 주는 `isStagedPreview` 표현 조건에 한정한다. 확정 구좌 데이터는 수정하지 않는다. 기존 저장된 기획안도 같은 키로 읽는다.

S07은 전체 와이어프레임과 같은 구좌의 요청사항을 같은 행에 배치하고, 기본 출력의 내부 원가 비노출·A4 가로형 인쇄 기준을 유지한다. 실제 PDF 저장/페이지 분할은 이번 QA에서 실행하지 않았다.

## 참고와 버전

사용자가 제공한 SEED 자료의 역할 토큰·버튼 위계·상태 분리 원칙을 참고했다. 당근의 오렌지·로고·코드에 의존하지 않고 AMOREAD 전용으로 작성했다. [참고 기록](SEED_reference_v2.1.md). 공식 오설록 브랜드 승인이나 실제 사내 연동을 의미하지 않는다.

기존 `tokens_v0.2.css`, `visual-guide_v0.2.html`은 이전 제안으로 보존한다. UI 키트 HTML은 v2.1 참고 스냅샷이며 앱 수정 시 별도 검토한다. 토큰을 수정할 때 CSS와 JSON 양쪽을 동기화하고 가이드 표시값도 확인한다.

## 검증

결과와 화면 증거는 [QA 기록](../docs/qa/CR-20261105-001.md) 참조. main 병합·외부 사이트 배포는 이 브랜치 작업에 포함하지 않는다.

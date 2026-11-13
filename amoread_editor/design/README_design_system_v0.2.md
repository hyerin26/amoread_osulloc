> 현재 브랜치의 실제 적용 기준은 [Tea Green v2.1](README_design_system_v2.1.md)입니다. 아래 v0.2는 과거 제안으로 보존합니다.

# AMOREAD Design System · v0.2

> **상태:** 내부 SaaS 화면 설계를 위한 팀 협업용 제안서, 확정된 사내 디자인 가이드 아님  
> **적용 범위:** 사전 목업·기능정의서·화면설계서·React 프로토타입. 기존 오설록 사내 툴의 디자인·데이터 연동은 회사 노트북에서 추후 확인  
> **기준:** 데스크톱 우선 / 레퍼런스·AI 기획·와이어프레임 편집 / SEED(토큰·컴포넌트 사고) + Shopify Polaris(관리형 워크플로) + Fluent 2(밀도·상태·접근성)

## 0. 요약 의사결정

1. **기술 라이브러리를 세 개 섞지 않는다.** SEED/Polaris/Fluent의 패턴을 참고하되 `AMOREAD` 전용 디자인 토큰과 UI 래퍼 컴포넌트를 정의한다. SEED React 패키지의 실제 채택은 프론트엔드 팀이 설치·호환성을 검토한 뒤 결정한다.
2. **디자인 토큰을 2층으로 분리한다.** `primitive`(hex, px) → `semantic`(예: `color.text.primary`) → `component`(버튼/칩). 사용자 화면에는 primitive 직접 사용을 지양한다.
3. **전문가용 작업 화면은 `comfortable`를 기본으로, 데이터 테이블만 `compact` 모드를 허용한다.** 앱 전체 폰트를 일괄 축소하지 않는다.
4. **AI 추천은 '한 번에 다 보여주기'가 아니라 한 개 초안·부분 수정·이유·출처를 한 화면에서 확인**하게 한다.
5. **자동 이미지→와이어프레임 변환은 실험 기능으로 격리.** 추천 사례 선택→기존 수동 구조화 모듈 적용→구좌 이동·문구 편집은 PoC 없이도 시연 가능한 P0.
6. 기존 사내 툴의 가격·원가·리뷰·상품 목록은 **UI 어댑터**로 연결한다. 민감한 운영값과 계산 로직은 프론트엔드에 하드코딩하지 않는다.

## 1. 3개 디자인 시스템의 역할

| 참고 | 채택할 원칙 | 그대로 베끼지 않을 것 | 적용 화면 |
|---|---|---|---|
| 당근 SEED | Foundations → Components → Patterns, 의미별 스타일/스케일 구분, Figma-코드 언어 통일 | 소비자 앱의 대형 터치 타깃/카드 비중, 브랜드 오렌지 | 전체 공통 |
| Shopify Polaris | 데이터·상품/리소스 목록, 검색·필터·정렬·테이블, Page 액션/상세 패널 | Shopify 전용 상단 셸, 의존성, 상거래 플랫폼 용어 | S01, S03, S05 |
| Microsoft Fluent 2 | Neutral 중심 색 위계, 상태/키보드 포커스, 글로벌·의미별 토큰, 컴팩트 데이터 조작 | Windows/Teams 브랜딩, 앱 고유 구성요소 전부 | S04, S06 |

**공식 출처**
- SEED: https://seed-design.io/get-started ; https://seed-design.io/updates/how-seed-evolved
- Polaris: https://shopify.dev/docs/api/app-home/latest ; https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table
- Fluent 2: https://fluent2.microsoft.design/design-tokens ; https://fluent2.microsoft.design/typography ; https://fluent2.microsoft.design/color

## 2. Foundations

### 2.1 Color : 의미가 우선

| Semantic token | 제안 값 | 사용처 |
|---|---|---|
| `--color-canvas` | `#F6F8F7` | 전체 작업 배경 |
| `--color-surface` | `#FFFFFF` | 카드/패널/입력 |
| `--color-surface-subtle` | `#F1F5F2` | 섹션 구분 및 비강조 영역 |
| `--color-text-primary` | `#192720` | 본문/제목 |
| `--color-text-secondary` | `#52675D` | 보조 설명/메타 |
| `--color-text-tertiary` | `#63776D` | 날짜/부가정보(중요 본문 사용 지양) |
| `--color-border-default` | `#DCE4DF` | 카드/패널/입력 경계 |
| `--color-brand-default` | `#266953` | 주요 CTA, 활성 상태, 명시적 선택 |
| `--color-brand-hover` | `#1F5947` | hover/pressed |
| `--color-brand-soft` | `#EDF5F0` | 활성 네비/선택 칩 배경 |
| `--color-info` | `#165B91` | 사실/데이터 연계 상태 |
| `--color-success` | `#266B4C` | 저장 성공/검증 완료 |
| `--color-warning` | `#9A591B` | 검토 필요/주의 |
| `--color-danger` | `#A43D45` | 삭제/연동 오류 |

- 흰 배경 기준 `#266953` 텍스트 명암비는 약 **6.51:1**, `#52675D`는 **6.07:1**. 일반 텍스트에 필요한 4.5:1을 만족하는 제안 색상이다.
- 브랜드 색을 상태색의 대용으로 사용하지 않는다. `AI 추론`, `원본 확인`, `연동 실패`는 **문구+아이콘+색상**으로 구분한다.
- 고유 브랜드 로고/오설록 퍼블릭 브랜드 컬러의 정확한 사용 정책은 사내 가이드 확인 전까지 미확정.

### 2.2 Typography : 6개 역할만 먼저 고정

| 역할 | 크기/행간/굵기 | 사용 | 예시 |
|---|---|---|---|
| Display/Page | 26 / 34 / 700 | 화면 제목 1개 | `새 프로모션 기획` |
| Section | 18 / 26 / 700 | 작업 구획 제목 | `기획 방향` |
| Subsection | 16 / 24 / 600 | 카드 내부 제목 | `가격대별 선물 추천` |
| Body | 14 / 22 / 400 | 기본 정보/폼/표 | `주요 목적을 선택하세요` |
| Body strong | 14 / 22 / 600 | 항목 이름/선택값 | `원본 확인` |
| Caption | 12 / 18 / 400~600 | 타임스탬프·근거 메타 | `마지막 수정 10:32` |

- `11px 이하`를 본문/중요 액션에 쓰지 않는다. 숫자표는 **tabular numerals** 및 오른쪽 정렬.
- `Pretendard` (사용 가능 여부 확인) → `Apple SD Gothic Neo` → `Malgun Gothic` → system-ui. 글꼴 파일 배포·내장은 별도 라이선스 확인.
- 이름·기간·목표 등 **중요한 필드 레이블은 본문보다 작아도 대비와 굵기 유지**.
- 제목의 굵기가 늘어날 때 색상도 과하게 늘리지 않는다. 폰트의 크기·굵기·여백으로 위계 형성.

### 2.3 Sizing / spacing / elevation

| 이름 | 토큰 | 값/규칙 |
|---|---|---|
| 간격 기본 | `space-*` | `4, 8, 12, 16, 20, 24, 32, 40` px |
| 버튼/입력 기본 | `control-md` | 높이 `36px`; 중요 폼 CTA `40px` |
| 버튼/입력 compact | `control-sm` | 높이 `30px`; 표 툴바/드로어만 사용 |
| 카드 안쪽 | `card-padding` | 기본 `20px`, 정보가 밀집한 카드 `16px` |
| 카드 사이 | `card-gap` | `16px` |
| 그룹 사이 | `section-gap` | `24~32px` |
| 필드 사이 | `field-gap` | `16px` |
| 라운드 | `radius-*` | 버튼 8 / 카드 12 / 드로어 0~12 px |
| 경계 | `border-default` | 1px 중립색; 과도한 그림자 금지 |
| Focus ring | `focus-ring` | 2px 강조색 외곽선 + 2px offset |

### 2.4 Desktop layout

- 넓은 화면 `1440px`: 좌측 앱 내비 `220px`, 작업 헤더 `56px`, 본문 최대 `1440px`, 우측 컨텍스트 패널 `320px`.
- 기본 리스트형 페이지: 본문 폭 `980~1200px`, 카드 2~3열; 이미지 중심 라이브러리는 3열에서 2열로 자연스럽게 변경.
- S06 편집기: **좌측 구좌 목록 208px / 중앙 유동 폭(최소 420px) / 우측 속성·근거 320px**. 미리보기는 별도의 모바일 캔버스 최대 520px를 중앙에 배치 가능.
- `1280px` 아래: 우측 패널을 오버레이/토글로, `1024px` 아래: 좌측 내비를 아이콘 레일 또는 숨김으로. PC 분할화면 우선; 서비스 자체 모바일 지원은 범위 밖.
- 본문이 좁아질 때 폰트 크기를 줄여 해결하지 말고, 보조 패널을 접는다.

## 3. Components · 첫 구현 라이브러리

컴포넌트 접두사는 `Am`을 제안(`AmButton`, `AmReferenceCard`). **기본 시각 컴포넌트와 비즈니스 복합 컴포넌트를 분리**한다.

### 3.1 Primitive/Control 컴포넌트

| 이름 | 필수 속성/variant | 상태 | P0 화면 |
|---|---|---|---|
| `AmButton` | primary, secondary, tertiary, danger, icon / sm, md | hover, focus, disabled, loading | 전체 |
| `AmTextField`/`AmTextarea` | label, hint, required, error | focus, error, disabled | S03/S04 |
| `AmCheckbox`/`AmRadio`/`AmSelect` | option, selection | selected, disabled | S01/S03 |
| `AmTabs`/`AmSegmented` | tabs, active | default, active | S01/S06 |
| `AmChip`/`AmFilterChip` | selected, remove | active, hover | S01/S03 |
| `AmBadge` | neutral, info, success, warning, danger | label text mandatory | 전체 |
| `AmCard`/`AmPanel` | padding, title, actions | normal, selected | 전체 |
| `AmDrawer`/`AmModal` | title, close, footer | open, closed, confirm | S02/S06 |
| `AmTable` | header, sort, compact | loading, empty, row-selected | S05 |
| `AmToast`/`AmInlineNotice` | status, message | save, warning, error | 전체 |
| `AmSkeleton`/`AmEmptyState` | context, retry | loading/empty | S00/S01 |

### 3.2 업무 특화 복합 컴포넌트

| 컴포넌트 | 구성/의미 | P0 여부 |
|---|---|---|
| `OpportunityCard` | 추천 명분 + 시기 + 데이터 신호 + CTA. **트렌드와 과거 사례 출처 분리** | P1 |
| `ReferenceCard` | 원본 이미지 + 내/외부 + 명분/소구 + `상세 보기`/`저장`/`적용` | P0 |
| `ReferenceDetailDrawer` | 원본/구좌/AI 추론/출처/적용 동작; 이미지 확대 | P0 |
| `EvidenceRow` | 근거 내용 + 출처 + 확인 시점 + `원본 확인`/`AI 해석` 상태 | P0 |
| `BriefSection` | 목적 복수 선택, 확정 조건과 미정 항목, 도움말 | P0 |
| `ConceptDraftCard` | 기본안 **1개**, 근거, 카피 인라인 수정/해당 부분만 재추천 | P0 |
| `ProductMetricTable` | SKU, 정가/할인가, 원가율, 최근 특가, 리뷰/평점 등; **기존 로직은 그대로 연결** | P1 |
| `SectionOutlineItem` | 구좌 번호, 제목, 구좌별 목적, 선택/순서 이동/삭제 | P0 |
| `WireframeSection` | 레이아웃 구조, 가상 이미지 영역, 텍스트 편집, 원본 연결 | P0 |
| `ProvenanceBadge` | `원본 확인`/`AI 해석`/`미확인` (성능 우수 의미로 오인 방지) | P0 |
| `SaveStatus` | 저장 중/저장됨/실패; 실패 시 재시도 | P0 |

### 3.3 AI에 대한 별도 인터랙션 규칙

1. 자동 생성 카피 옆 `이 문구만 다시 추천` 제공, 생성 결과를 사용자가 편집하면 `사용자 수정` 상태 저장.
2. 기획 컨셉을 바꿀 때 기존에 확정한 상품/구좌는 **임의 삭제 금지**. 충돌이 있다면 비파괴적 안내와 선택지 제공.
3. AI 근거는 사람이 검증한 사실·소스 원문·AI 해석을 구분. 레퍼런스 사용 빈도와 판매 성과 추론 금지.
4. 빈/오류 상태에서도 사용자가 수동 입력과 구조 선택으로 진행 가능.
5. `추천 생성`/`다시 추천`/`페이지 적용` 등 비용 큰 동작은 명시적인 버튼으로 수행; 초안 내용의 자동 덮어쓰기 금지.

## 4. Patterns · 화면별 규칙

| ID | 화면 | 레이아웃 패턴 | 가장 중요한 주 행동 |
|---|---|---|---|
| S00 | 기회 탐색/캘린더 | 좌측 전체 내비+캘린더+기회 카드/근거 드로어 | `이 아이디어로 시작` |
| S01 | 레퍼런스 라이브러리 | 상단 통합 검색+캠페인/구좌 세그먼트+필터+이미지 그리드 | `상세 보기` |
| S02 | 레퍼런스 상세 | 우측 360px 드로어(이미지/기획적 역할/출처) | `현재 기획에 적용` |
| S03 | 브리프 | 2컬럼 폼(필드 그룹) + 우측 입력 내용 요약 | `기획 초안 생성` |
| S04 | 기획 컨셉·카피 | 가운데 편집 패널 + 우측 근거/레퍼런스 320px | `선택 부분 수정` |
| S05 | 상품·혜택 | 테이블/필터/상태/우측 상세 | `상품 선택` (연동 미완 시 시연용) |
| S06 | 구좌 와이어프레임 | 3분할: 구좌 목록/미리보기/속성·레퍼런스 | `구좌 추가`, `순서 변경`, `문구 편집` |
| S07 | 최종 기획안 | 읽기 전용 문서 미리보기 + 내보내기 | `내보내기` |

## 5. 개발 팀 인터페이스 설계: 기존 툴에 붙이기 쉽게

- UI는 `view model`만 받도록 설계한다. 실제 내부 응답 DTO/필드명은 나중에 매핑한다.
- `CampaignBrief {id, title, period, goals[], constraints[], ...}`
- `Reference {id, sourceType, thumbnail, campaignContext, sectionRole, provenance, ...}`
- `Proposal {id, briefId, concept, copies[], sections[], ...}`
- `ProductMetrics {sku, listPrice, salePrice, costRatio, estimatedRevenue, reviewSummary, ...}`
- `WireframeSection {id, type, layoutTree, editableText[], sourceReferenceId, goalTags[], ...}`
- `SaveStatus {state: idle|saving|saved|error, timestamp}`
- **테이블에 보이는 가격/원가율은 프론트에서 새로 계산한 값이라고 주장하지 말 것.** 기존 데이터의 계산·갱신 기준을 유지한다.
- **사내 데이터를 외부 LLM, 외부 Figma, 공개 호스팅으로 보내지 말 것**: 회사 정책과 허용된 실행환경 확인 전엔 샘플 데이터로만 시연한다.

## 6. Figma 팀원에게 넘기는 최소 자산 구성

**파일/페이지 구조 제안:** `00_Cover / 01_Foundations / 02_Components / 03_Patterns / 04_Screens / 05_Flows / 99_Archive`

- Foundations: `Color/semantic`, `Type/role`, `Space`, `Radius`, `Elevation` variables/styles
- Components: `Button`, `Input`, `Select`, `Chip`, `Badge`, `Card`, `Tabs`, `Table`, `Drawer`, `Toast`, `Panel`
- Business: `ReferenceCard`, `EvidenceRow`, `ConceptDraft`, `SectionOutline`, `WireframeSection`
- Component variants: `size`, `type`, `state`; 텍스트와 아이콘 위치는 properties로 편집.
- 페이지별 프레임: `Desktop/1440`, `Split/1100` 2종부터 제작.

## 7. 빠르게 결정할 것 vs 보류할 것

**오늘~화면 작업 전 고정 가능**
- 타입/컬러/간격 스케일, 글로벌 내비·헤더, 패널 폭, 버튼/입력/칩/배지 규칙
- ReferenceCard/EvidenceRow/ConceptDraft/WireframeSection의 구조와 데이터 표시 원칙
- S04/S06의 작업 흐름 및 P0 인터랙션

**회사 노트북에서 확인 후 조정**
- 기존 도구 화면·권한·API 연결 범위, 정확한 SKU/마진 정보 컬럼, 회사 브랜드 규칙
- 실제 LLM 및 레퍼런스 HTML/이미지 처리 방법, 정보보안 허용 범위
- 대행사 최종 전달 문서의 정확한 필드·포맷

**기술 실험**
- 외부 URL 자동 수집, 이미지→동적 와이어프레임 생성, Figma 파일 자동 내보내기.

## 8. 수용 조건(디자인/개발 공통)

- 타입/색/간격은 token을 통해 사용하고, 화면별 임의 hex를 만들지 않는다.
- 일반 본문·중요 버튼의 텍스트 대비 ≥ 4.5:1. 색상만으로 저장/오류/추천의 사실성을 구분하지 않는다.
- 1440px 및 1100px 분할 환경에서 핵심 CTA·본문·현재 편집 위치가 겹치지 않는다.
- 레퍼런스 카드의 `저장`과 `기획에 적용` 액션은 별도.
- AI 결과의 일부만 수정해도 다른 확정된 내용이 유지된다.
- 구좌 편집에는 실제 요소 위치가 보이는 와이어프레임, 원본 링크, 구좌 순서·문구 변경이 있다.
- 모든 중요 버튼은 로딩/오류/비활성 상태가 정의되어 있다.

---

**버전 변경:** v0.1의 `#266953`, 14px 본문, 220~224px 내비, 320px 근거 패널 가안을 유지하되, semantic 토큰·컴포넌트 명세·표준 패턴·업무 모델 연결 지침을 추가한 v0.2. **공식 SEED/Polaris/Fluent 토큰을 복사한 자료가 아니라 AMOREAD 제안값**이다.
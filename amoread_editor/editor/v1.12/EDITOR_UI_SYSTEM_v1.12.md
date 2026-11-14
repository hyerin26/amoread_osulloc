# AMOREAD 편집기 UI 컴포넌트 시스템 v1.12

**정의 범위:** 좌측 구성/추가/자료, 중앙 기획안, 우측 Inspector, 구좌 선택기/검수 모달의 **편집기 UI**. 고객 화면의 상품/CTA 와이어프레임은 별도 스타일 층으로 둔다.
**중요:** Green UI v2.5.1 기존 색상/타이포/반경/spacing 토큰은 **수정하지 않는다**. 이 Lab의 `tokens.demo.css`는 사내 토큰의 대체품이 아니다. `editor-ui-kit.css`에서 컴포넌트 시맨틱 별칭만 만든다.

## 1. 핵심 UX 원칙

1. **좌측 탐색은 어디/무엇?** 구좌·요소 계층을 선택하고 추가한다. **우측 속성은 어떤 값/표시?** 현재 선택 대상 한 개의 값과 동작만 변경한다.
2. **구조 > 배치 > 콘텐츠 > 데이터**: 상품 리스트에서는 열 선택을 숨기고, 메이슨리에서는 공통 비율 대신 상품별 비율을 사용한다. 숨겨도 설정값은 삭제하지 않는다.
3. **상위 탭 ≠ 하위 탭:** 상위는 밑줄형, 하위 복수는 낮은 대비의 보조 탐색, 하나뿐이면 제목으로만 표현한다.
4. **상태 구분:** 선택(aria-selected/pressed)은 hover와 달라야 하며, keyboard focus는 색 변화뿐 아니라 2px 링으로 표현한다.
5. **스위치 ≠ 체크박스:** 적용 즉시 토글은 switch, 상품·후기 선택이나 일괄 제출 전에 결정하는 값은 checkbox.
6. **접기 ≠ On/Off:** 트리·아코디언은 chevron+aria-expanded, 값 자체 활성화는 switch.
7. **컨텍스트 우선:** 편집기 버튼은 Green UI, 중앙 와이어프레임의 CTA는 오설록 페이지 UI; 서로 스타일을 공유하지 않는다.
8. **방해 최소화:** 스켈레톤은 실제 네트워크/계산 대기 중에만. 미구현 상태에는 ‘미연동’ 명시. Toast는 즉시 피드백, 입력 오류는 필드 아래.

## 2. 간격과 마진 규정

| 관계 | 기준 | 예외/이유 |
|---|---:|---|
| 아이콘 ↔ 텍스트 | 8px | 15px 아이콘과 작은 라벨에서는 6px 허용 |
| 라벨 ↔ 입력창 | 4px | 오류/도움말은 입력 하단 4px |
| 독립 필드 ↔ 필드 | 12px | 동일 행의 짧은 컨트롤은 8px |
| 하나의 반복 항목 내부 padding | 12px | 좁은 320px 인스펙터에서 8px까지 허용 |
| 반복 항목 ↔ 다음 반복 항목 | 8px | 동일 그룹으로 인식 |
| 설정 그룹 제목 ↔ 설명 | 8px | 설명 ↔ 첫 필드 16px |
| 별개 설정 그룹 ↔ 그룹 | 24px | divider는 보조 수단, 여백이 우선 |
| 패널 가장자리 ↔ 콘텐츠 | 20px | 좁은 뷰에서는 12~16px |
| 버튼 ↔ 인접 버튼 | 8px | 아이콘 버튼 묶음 6px |
| 요소 라이브러리 카드 ↔ 카드 | 12px | 2열 모바일에서는 8px |
| 모달 헤더/본문/푸터 | 16~24px | footer와 스크롤 영역 구분, 썸네일 잘림 금지 |
| 상품 카드 내부(이미지 ↔ 이름 ↔ 가격) | 역할별 4/8/12px | 미리보기용 별도 데이터 컴포넌트, 4열에서는 밀도 조절 |

### 실제 코드 토큰 매핑

`--ed-space-1=var(--s1)` 4px · `--ed-space-2=var(--s2)` 8px · `--ed-space-3=var(--s3)` 12px · `--ed-space-4=var(--s4)` 16px · `--ed-space-5=var(--s5)` 24px · `--ed-space-6=var(--s6)` 32px. 값을 중복 하드코딩하지 말고 에디터 컴포넌트 클래스에만 적용한다. 기존 CSS의 px 값은 점진적으로 이 토큰으로 대체한다.

## 3. 상태 표준

| 공통 상태 | 색/표시 | 인터랙션·접근성 |
|---|---|---|
| Rest | 기본 표면·텍스트 | 기본 |
| Hover | hover surface/보더 | 포인터만; hover 없을 때 사용 가능해야 함 |
| Pressed | 미세한 피드백 | 포커스와 별개, 애니메이션 120ms 이하 |
| Selected | 선택색 + 바/테두리/체크 | aria-selected/pressed/current |
| Focus-visible | 2px focus outline, offset 2px | 키보드 Tab, 스크린리더 명칭 |
| Disabled | 명도 감소, cursor 금지 | 실제 `disabled` 속성; 설명은 읽을 수 있도록 |
| Readonly | 배경 구분, 텍스트 복사 가능 | disabled로 대체하지 말 것 |
| Invalid | 오류 border + helper | aria-invalid, 메시지 연결 |
| Loading | spinner/skeleton, aria-busy | 실제 비동기 작업에서만 |
| Dragover | 점선 슬롯 + 강조 링 | 키보드 대체 `위/아래` 버튼 유지 |
| Expanded | chevron 회전 + body 노출 | aria-expanded, Esc는 dialog에 적용 |

## 4. 요소별 Component Registry

| 영역 | 이름 | 현재 편집기 클래스/셀렉터 | 주요 상태 |
|---|---|---|---|
| navigation | WorkRail | `.cb-rail [data-cb-rail]` | rest,hover,selected,focus,disabled |
| navigation | SectionTree | `.ia-tree-section,.ia-tree-node` | rest,hover,selected,focus,disabled,expanded,drag |
| navigation | PrimaryTabs | `.ia-groups.am-kit-primary-nav` | rest,hover,selected,focus,disabled |
| navigation | SecondaryTabs | `.ia-subtabs.am-kit-subnav` | rest,hover,selected,focus,disabled |
| navigation | Breadcrumb | `.ia-breadcrumb` | rest,hover,focus |
| action | Button | `.am-ed-button` | rest,hover,pressed,focus,disabled,loading |
| action | IconButton | `.am-ed-icon-btn,.outline-entry-actions button` | rest,hover,pressed,focus,disabled |
| action | DragHandle | `[draggable],.am-custom-resize-handle` | rest,hover,dragging,focus,disabled |
| input | TextField | `.am-ed-field .am-ed-input` | rest,hover,focus,disabled,readonly,invalid |
| input | TextArea | `.am-ed-textarea` | rest,hover,focus,disabled,readonly,invalid |
| input | Select | `.am-ed-select,select.am-ed-input` | rest,hover,focus,disabled,invalid |
| input | SearchField | `#pickerSearch,.ia-data-results` | rest,focus,loading,empty,results |
| input | Checkbox | `.am-ed-element-row input[type=checkbox],.am-ed-product-row input[type=checkbox]` | checked,unchecked,focus,disabled,indeterminate |
| input | Switch | `.am-ed-toggle input[role=switch]` | on,off,focus,disabled |
| input | ChoiceGroup | `.am-ed-choice,.am-ed-column-picker` | rest,hover,selected,focus,disabled |
| input | FilterChip | `.am-ed-picker-cats button,.ia-library-choose button` | rest,hover,selected,focus,disabled |
| input | FileInput | `input[type=file]` | rest,focus,disabled,invalid,uploaded |
| surface | InspectorGroup | `.am-ed-group` | rest |
| surface | RepeatItem | `.am-ed-repeat` | rest,hover,focus |
| surface | ProductDataRow | `.am-ed-product-row` | rest,hover,selected,disabled |
| surface | ReferenceCard | `.am-ed-ref` | rest,hover,focus |
| surface | SelectionCard | `.am-ed-picker-card` | rest,hover,selected,focus,disabled |
| surface | Accordion | `.ia-advanced,details.am-ed-accordion` | collapsed,expanded,hover,focus,disabled |
| surface | Dialog | `#typeDialog,#fullPreviewDialog,#ia-qa-dialog` | closed,open,focus,loading |
| feedback | InlineValidation | `[aria-invalid],.am-ed-note--warning` | default,warning,error,success |
| feedback | Toast | `#toast` | hidden,visible,actionable |
| feedback | ValidationHub | `#ia-qa-items,.ia-qa-item` | idle,issues,empty,focus |
| feedback | Skeleton | `.am-kit-skeleton` | loading,reduced-motion |
| feedback | EmptyState | `.am-kit-empty,.ia-tree-empty` | empty,actionable |
| canvas | DropZone | `.cb-dropzone` | idle,hover,dragover,invalid |
| canvas | ResizeHandle | `.am-custom-resize-handle` | rest,hover,dragging,focus,disabled |
| canvas | PreviewSelection | `#page [data-page],#page [data-cb-node]` | rest,selected,hover,focus,scroll-target |
| data | ProductCard | `.mock-product,.cb-product-card` | default,focused,compact,grid,masonry |
| data | CTA | `.mock-cta,.cb-action` | filled,outline,text,wide,disabled |

이 표의 상태는 **규정해야 할 전체 상태 계약**이며, 일부는 샘플·새 클래스에만 구현되어 있다. 기존 API와 연결되기 전의 loading/invalid/readonly를 완료 기능으로 간주하지 않는다. JSON 레지스트리에는 용도·간격·사용 제한이 포함된다.

## 5. 아이콘 시스템

- 소스: `editor-ui-kit.js`에서 inline SVG sprite registry만 사용. 외부 CDN/폰트 사용 금지, CSP 및 회사 환경 고려.
- 기본 사이즈 **20px**, 트리·반복 항목 **16px**, 보조 15px. 선 두께는 1.8px, 선 모서리는 round.
- 아이콘 이름을 의미 기반으로 고정: `chevron-right`, `copy`, `trash`, `package`, `calendar`, `blocks`, `database`, `list-tree` 등.
- decorative SVG에는 aria-hidden=true. **아이콘만 있는 버튼에는 aria-label을 반드시 부여**하고, 선택과 장애 여부를 색상만으로 표시하지 않는다.
- chevron-right는 접힘/펼침에서만 회전. 위/아래 화살표는 순서 변경에만 사용. 토글 상태를 표현할 때 chevron 대신 switch 사용 금지.

## 6. 그룹별 사용/금지 예시

- `내용 → 문구`처럼 하위가 하나면 상위 탭 하나와 본문 섹션 제목으로 표현한다. 같은 위계 버튼을 두 번 보여주지 않는다.
- `메이슨리`에서 구좌 공통 이미지 비율 선택을 보여주지 않는다. 개별 카드마다 비율 선택.
- 단순 펼침은 `details/summary` 또는 chevron 버튼. 불필요하게 switch로 표현하지 않는다.
- 카드 선택은 `aria-pressed` 또는 `aria-selected`, 실행 버튼은 동작 의미를 가진 action button.
- 상품 카드의 모서리 라벨은 고객 이미지 위에 겹치는 **상품 데이터 컴포넌트**이며 에디터의 Tag·Chip 컴포넌트와 섞지 않는다.

## 7. 실제 도입 범위와 남은 작업

**이번 v1.12 적용:** 좌측 트리 아이콘·chevron, 상/하위 탭 분리, 입력/선택/버튼/그룹 간격 규칙, focus/hover/disabled, 스위치, 아코디언, 카드/모달 기본 상태, 미리보기 자동 이동, 번호 붙이기 UI 제거(기존 데이터 보존). 실제 UI에서 사용하는 선택자에만 CSS 별칭 적용.

**후속 사내 개발:** 현재 통일되지 않은 개별 이벤트 입력과 AI 검수 로그를 동일 컴포넌트로 이관, 정식 ErrorField, Tooltips/Popover의 일괄 키보드/포커스 처리, 네트워크 Skeleton/Loading 연결, 실제 Green UI 토큰 매핑·CSP 확인, 플로우 별 디자인 리뷰.

## 8. 공식 참고 자료

- Fluent 2 Layout: https://fluent2.microsoft.design/layout
- Fluent 2 Field: https://fluent2.microsoft.design/components/web/react/core/field/usage/
- Fluent 2 Button: https://fluent2.microsoft.design/components/web/react/core/button/usage/
- Fluent 2 Accordion: https://fluent2.microsoft.design/components/web/react/core/accordion/usage
- Shopify Polaris Spacing: https://github.com/Shopify/polaris-react-archive/blob/main/polaris.shopify.com/content/design/layout/layout-tokens.mdx
- SEED Switch: https://seed-design.io/components/switch
- SEED Primitives: https://v2.seed-design.io/primitive/
- Material interaction states: https://m3.material.io/foundations/interaction/states/overview

## 9. 사내 GitLab 이식 주의

- 저장 데이터 구조를 변경하지 않는다. `num` 등 레거시 필드가 있더라도 새 기본 화면에는 표시하지 않는 방식으로 호환한다.
- `tokens.demo.css`는 **사내 반입 시 제거**하고 기존 Green UI 정식 CSS를 바라보도록 경로를 조정한다.
- 인라인 SVG sprite는 외부 네트워크에 의존하지 않지만 사내 CSP에서 `use href="#..."` 사용 가능 여부를 검증한다.
- UI/브라우저 회귀는 `test_editor_ui_kit_v112.py`와 이전 버전 테스트를 병행한다.

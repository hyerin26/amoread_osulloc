# 신규 구좌편집기 연결 · Green UI 우선 적용 가이드

> **실제 적용(2026-11-14, design_eun):** 아래의 iframe 브리지(launcher.js) 방식은 쓰지 않았습니다. 앱 서버가
> `X-Frame-Options: DENY`와 CSP(`script-src 'self'; style-src 'self'`)를 보내 iframe·인라인 스타일이 막히기 때문입니다.
> 대신 앱 라우트 `/v2/editor-next`(workspace/amoread_app/planner/static/v2/editor-next.*)가 이 폴더의 v1.12 파일을 직접 읽고,
> 기획안·상품·후기는 앱 API(`/api/am/projects`, `/api/products`, `/api/product/{seq}`)로 연결합니다. 저장은 기획안의 `editor_next`.
> 실행·끄기·테스트는 저장소 루트 README §9. 아래 내용은 업로드 당시의 설계 기록으로 남겨 둡니다.

대상 브랜치: **osulloc / design_eun**  
기존 편집기 삭제 여부: **삭제하지 않음**  
신규 코드 위치: \`amoread-editor/editor/v1.12/\`  
진입 브리지: \`amoread-editor/integration/launcher.js\`

## 연결 방식 (기존 편집기 보존)

현재 운영 앱의 구좌편집기 화면(기존 화면)의 HTML/레이아웃 컴포넌트에 **아래 스크립트만 추가**합니다. 앱이 React/Vue/Next.js라면 스크립트를 화면이 마운트된 뒤 한 번 로드하는 방식으로 넣을 수 있습니다. 기존 버튼·라우트·기획안 렌더링은 교체하지 않습니다.

\`\`\`html
<!-- 예시입니다. 실제 루트 URL은 앱의 public/static 경로에 맞춰 변경하세요. -->
<script>
  window.AMOREAD_INTEGRATION = {
    mountSelector: ".existing-editor-toolbar", // 실제 앱에서 확인 후 지정. 없으면 우하단 고정 버튼
    buttonLabel: "구좌편집기 · 신규",
    greenUI: {
      // 실제 앱의 Green UI CSS 변수를 먼저 확인하여 매핑합니다.
      tokenMap: {
        // "--accent": "--YOUR_REAL_GREEN_UI_PRIMARY"
      },
      selectors: {
        primaryButton: ".YOUR_EXISTING_PRIMARY_BUTTON",
        secondaryButton: ".YOUR_EXISTING_SECONDARY_BUTTON",
        input: ".YOUR_EXISTING_INPUT",
        heading: ".YOUR_EXISTING_HEADING"
      }
    },
    hostAdapter: window.AMOREAD_OSULLOC_API || null
  };
</script>
<script defer src="/amoread-editor/integration/launcher.js"></script>
\`\`\`

**주의:** 위 선택자 이름(\`YOUR_EXISTING_...\`)은 예시이며 실제 앱의 클래스가 아닙니다. 확인 없이 복사하면 충돌 비교에서 일부 항목이 \`비교 불가\`로 나옵니다. 서버나 브라우저 라우터가 정적 폴더를 제공하도록 구성해야 브리지가 작동합니다.

버튼 클릭 시 신규 편집기를 **동일 출처의 iframe 레이어**에서 실행하고, 상단 **‘← 기존 구좌편집기로 돌아가기’**로 닫습니다. 이 방식은 기존 편집기 컴포넌트를 제거하지 않아 되돌리기가 안전합니다. 신형 편집기의 \`?amoread_embed=1\` 모드에서는 독립 데모 로컬스토리지 대신 **외부 저장**이 사용됩니다.

## Green UI 우선 원칙

새 편집기가 사용하는 데모 토큰 \`tokens.demo.css\`는 기본값입니다. 구좌편집기 브리지는 진입 페이지의 계산 CSS 변수를 읽어 새 iframe 문서에 **인라인 CSS 속성**으로 적용합니다. Green UI 변수명이 현재 편집기 의미 토큰과 다르면 \`greenUI.tokenMap\`으로 연결합니다.

예:

\`\`\`js
greenUI: {
  tokenMap: {
    '--accent': '--CURRENT_GREEN_PRIMARY_TOKEN',
    '--accent-soft': '--CURRENT_GREEN_SUBTLE_TOKEN',
    '--ink': '--CURRENT_TEXT_PRIMARY_TOKEN',
    '--r2': '--CURRENT_CONTROL_RADIUS_TOKEN'
  },
  selectors: {
    primaryButton: '#your-current-app .primary-button',
    secondaryButton: '#your-current-app .secondary-button',
    input: '#your-current-app input',
    heading: '#your-current-app h2'
  }
}
\`\`\`

\`greenUI.tokens\`로 실제 값(예: \`{'--accent':'#006842'}\`)을 직접 넘길 수도 있지만 정식 토큰 이름으로 연결하는 편을 권장합니다. **구체적인 색상·토큰 이름은 GitLab 프로젝트를 읽기 전에는 결정하지 않습니다.**

### 충돌을 화면으로 보는 방법

1. 기존 편집기에서 **‘구좌편집기 · 신규’**를 클릭합니다.
2. 상단 **‘Green UI 충돌 비교’**를 클릭합니다.
3. 현재 앱과 새 편집기의 계산 CSS 값을 **2열 비교 카드와 색상 스와치**로 확인할 수 있습니다.
4. \`일치 / 충돌 / 비교 불가\` 상태가 항목마다 표시됩니다.

비교 항목은 브랜드 메인 색상, 패널 배경, 본문 색상, 주요·보조 버튼 배경/글자, 입력창 테두리·반경, 제목·본문 글꼴/크기, 기본 간격입니다. 값이 없는 경우 충돌이 없다는 결론을 내리지 않고 **‘비교 불가’**로 표시합니다.

**중요한 한계:** 아직 실제 \`osulloc\` 앱의 Green UI 컴포넌트 소스를 읽지 못했으므로, 현재 어떤 버튼에 색상 충돌이 있는지는 확인되지 않았습니다. 라이브 비교 패널에서 실제 선택자를 연결해 확인해야 합니다. iframe 스타일 분리를 유지해 기존 Green UI CSS를 수정하거나 삭제하지 않습니다.

## 상품·후기·기획안 저장 연동

브리지는 실제 저장 API가 존재한다고 가정하지 않습니다. 기존 앱에서 인증/권한 확인 후 다음 함수를 제공할 때만 연결됩니다.

\`\`\`js
window.AMOREAD_OSULLOC_API = {
  async listProducts() {
    // 실제 상품 API를 호출하고 다음 필드로 정규화합니다.
    return [{id:'SEQ123',name:'상품명',listPrice:28000,
      rate:0.2,extraRate:0,rating:4.8,reviews:12,
      quote:'후기 요약',appeal:'상품 소구문구'}];
  },
  async listReviews() {
    return [{id:'R1',productId:'SEQ123',title:'제목',
      text:'후기',rating:5,source:'your-backend'}];
  },
  async getDraft() {
    // API에서 { sections, current, tab } 형식의 저장 기획안을 반환
    return null; 
  },
  async saveDraft(snapshot) {
    // 권한 검사·버전 충돌 검증 후 실제 서버에 저장
  }
};
\`\`\`

정규화 주의: \`listPrice\`는 **원**, \`rate\`와 \`extraRate\`는 0~1 비율, \`rating\`은 0~5 점수입니다. **실판매가·실할인은 서버의 정식 가격 정책이 우선**이며, 데모의 프런트 계산을 정산/주문에 사용하면 안 됩니다.

현재 \`AMOREAD_EDITOR_API\`는 \`setCatalog\`, \`importSnapshot\`, \`exportSnapshot\`, \`subscribe\`를 제공하고, 브리지는 입력 변경 후 약 700ms에 한 번 \`saveDraft\`를 호출합니다. 저장 실패는 상단에 경고로 표시되며, 원본 편집기에는 영향을 주지 않습니다.

**의도적으로 연동하지 않은 기능:** 사내 로그인/권한, 실상품 SEQ API, 쿠폰 발급·추첨·스탬프 운영, 이미지 업로드, 실제 공개 페이지 배포. 대상 앱 소스와 백엔드 정책 확인 없이는 안전하게 구현할 수 없습니다.

## 적용 순서와 안전성

1. \`design_eun\`에서 정적 파일들이 서비스에서 실제로 제공되는지 먼저 확인
2. 기존 편집기 진입 페이지에 스크립트 한 개 연결 (기존 파일 삭제 금지)
3. 버튼 클릭, 새 화면 열림/닫힘 및 Green UI 차이 시각 확인
4. API 어댑터 연결 전까지 **미연결 데모** 상태 유지
5. 실데이터 정규화 함수·쓰기 권한·저장 충돌 처리와 회귀 테스트 추가
6. 통합하기 전 기존 편집기로 돌아가는 경로 및 복구 확인

### 개발 완료 여부

**완료(패키지 코드):** 신규 진입 버튼, 기존 편집기 유지, 같은 출처 iframe, Green UI 토큰 우선 적용, 시각적 충돌 비교, 상품·후기·기획안 어댑터 연결점, 저장 상태 표시.

**미완료(실제 GitLab 앱):** 기존 앱의 실제 진입 컴포넌트/라우트 수정, 현재 최신 Green UI와의 충돌 실측, 운영 API 연결·검증. GitLab 저장소에 직접 접근하지 못했기 때문에 앱별 변경을 수행했다고 주장하지 않습니다.

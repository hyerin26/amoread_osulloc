# AMOREAD → 오설록 GitLab \`design_eun\` 이관 및 연동 안내

대상: \`https://gitlab.com/amoread2/osulloc.git\`의 **\`design_eun\` 브랜치**. 원본: \`EunseongOH/tea_ad\`의 \`feat/composable-block-editor\`. 본 문서는 **준비된 포팅 계약**이며, 대상 저장소를 실제로 열거나 권한을 검증했다는 주장이 아니다.

## 1. 저장소에 들어가는 코드

마이그레이션 스크립트는 **브랜치 \`design_eun\`**을 만들거나 이미 존재하면 이어받는다. 대상 앱 코드를 무단 변경하지 않도록 모두 버전된 독립 경로에 둔다.

\`\`\`text
amoread-editor/
  editor/v1.12/      # 구좌편집기 전체: JS / CSS / HTML / 브라우저 테스트 / 기획 문서
  design/            # Green UI 디자인 시스템 전체: v2.5.1 포함 이력/토큰/가이드
  integration/
    INTEGRATION_GUIDE.md
    example-host-adapter.js
  IMPORT_MANIFEST.json
\`\`\`

v1.12의 22개 구좌 유형, 9개 추가 블록, 전체 CSS 계층, UI 구성 요소 레지스트리, 검증 파일을 포함한다. 운영용 루트 CSS/라우팅/배포 설정은 자동으로 덮어쓰지 않는다.

## 2. 디자인 시스템

- 최종 기준: \`design/tokens_v2.5.1.css\`, \`tokens_v2.5.1.json\`, \`README_design_system_v2.5.1.md\`, \`visual-guide_v2.5.1.html\`.
- 상세 편집기 규칙: \`editor/v1.12/EDITOR_UI_SYSTEM_v1.12.md\`, \`EDITOR_COMPONENT_REGISTRY_v1.12.json\`.
- 화면 레이어: \`tokens.demo.css\`(독립 Lab의 데모 토큰) → \`styles.css\` → \`composable.css\` → \`editor-spacing.css\` → \`layout-integrity.css\` → \`custom-section.css\` → \`image-layout-v110.css\` → \`ia-v111.css\` → \`editor-ui-kit.css\` → \`block-quality.css\` → \`canvas-selection.css\`.
- 운영 앱에서는 Green UI의 **정식 토큰 소스가 권위**를 가진다. \`tokens.demo.css\`를 기존 앱의 전역 \`tokens.css\` 위에 복사하거나 전역 CSS 이름을 덮어쓰지 않는다. 가능하면 **별도 경로/iframe**에 편집기를 탑재하여 스타일 충돌을 차단한다.

## 3. 실제 상품·후기·기획안 연결 계약

v1.12 \`app.js\`는 **선택적 호스트 API** \`window.AMOREAD_EDITOR_API\`를 제공한다.

\`\`\`js
const editor = window.AMOREAD_EDITOR_API;
editor.version; // "1.12"
editor.setCatalog({
  products: [{ id:"SEQ123", name:"상품", listPrice:30000,
    rate:0.10, extraRate:0, rating:4.8, reviews:51,
    quote:"후기 한 줄", appeal:"상품별 소구문구" }],
  reviews: [{ id:"REVIEW1", productId:"SEQ123", title:"구매 후기",
    text:"후기 내용", rating:5, source:"internal" }]
});
editor.importSnapshot({
  sections: [/* 기존 구좌 스키마와 일치하는 레코드 */],
  current: "...",
  tab: "copy"
});
const initial = editor.exportSnapshot();
const unsubscribe = editor.subscribe(snapshot => {
  // 이 메서드는 매 입력에도 호출된다. 호스트가 debounce 후 저장해야 한다.
});
\`\`\`

정책: \`window.AMOREAD_EDITOR_OPTIONS = { persistence: "external" }\`을 **app.js 로딩 전에** 설정하면 데모 로컬스토리지 \`amoread-lab-v09\`를 읽거나 쓰지 않는다. 운영 모드에서 저장은 반드시 호스트가 인증된 API를 통해 수행한다.

**중요:** 상품·후기 데이터 필드는 위 표시 스키마로 정규화해야 한다. 사용자 앱의 SEQ, 상품 가격표, 프로모션 할인 테이블, 후기 데이터베이스의 실제 필드명/단위/반올림 정책은 대상 GitLab 소스가 확인되기 전까지 **미확정**이다. API 호출 주소, 세션 쿠키, 권한, 이미지 URL, 에셋 업로드, 가격 유효기간을 여기서 만들어 넣지 않는다.

### 필수 연동 체크

1. 인증된 서비스에서 상품·후기(SEQ 포함) 조회 및 에러/빈 상태 처리
2. 정가/할인율·추가할인율과 프로모션 가격 정책 검증(프런트에서 실제 판매가를 결정하지 않기)
3. 기획안 \`sections/current/tab\` 저장과 서버 버전(수정 충돌) 관리
4. 저장 중 상태 표시, 네트워크 실패 시 복구/재시도 정책
5. 이미지 업로드 및 접근 제어(현재는 **이미지 자리 시안**)
6. 운영 쿠폰/추첨/출석/퀴즈 API는 별도 이벤트·권한·배포 체크리스트가 승인되기 전 **연동되지 않음**
7. 실제 페이지 반영 전 디자인 시스템 및 접근성 QA, 개인정보·로그·XSS/CSP 확인

\`example-host-adapter.js\`는 호스트의 \`window.AMOREAD_OSULLOC_API\` 객체를 받아 호출하는 **연동 예시**다. 대상 앱 API 경로를 추측하지 않으며, 호스트가 구현하지 않으면 동작하지 않는다.

## 4. 실제 앱에 탑재하는 순서

1. 대상 GitLab 저장소에 접근 가능한 계정으로 기존 브랜치와 프로젝트 구조를 확인한다.
2. \`design_eun\`에 이관 완료 후, **기존 라우트와 충돌하지 않는 편집기 전용 경로**를 선택한다.
3. 정적 호스팅을 사용하는 앱이라면 편집기 파일들을 \`public\` 이하 별도 디렉터리로 **별도 검토 후** 옮긴다. React/Vite/Next/Spring 등의 실제 플랫폼 확인 없이는 빌드 구성 자동 수정을 금지한다.
4. 운영용 호스트 어댑터(상품/후기/기획안/권한)를 구현하고 \`window.AMOREAD_EDITOR_OPTIONS\`를 먼저 주입한다.
5. 데모 데이터가 아닌 실제 조회값으로 카드 미리보기, 가격·혜택 조건, 저장·복원, 권한 분리 테스트를 시행한다.
6. \`python editor/v1.12/run_regression_v112.py\` 및 앱 테스트를 실행하고 리뷰 후 통합한다.

## 5. 이관 실행

원본 GitHub 저장소에서:

\`\`\`bash
python gitlab-migration/migrate_to_design_eun.py --push
\`\`\`

GitLab에 쓰기 가능한 **기존 Git 자격 증명**이 필요하다. 자격 증명/토큰을 이 채팅에 붙여넣거나 스크립트 인자로 전달하지 않는다. 기본값은 안전한 분리 폴더에 파일을 복제하며, 기존 GitLab 앱의 루트와 API는 변경하지 않는다. 실행기는 원본 GitHub 저장소 또는 \`--source\`로 지정한 체크아웃을 사용한다.

**확인해야 할 것:** 타깃 GitLab 저장소에 대해 접근하지 못한 환경에서 만든 계획이므로 위 포팅은 *실제 통합 완료*가 아니라 *통합 준비 단계*다.

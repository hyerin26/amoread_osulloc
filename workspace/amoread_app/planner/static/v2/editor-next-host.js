// 신규 구좌편집기(v1.12)를 앱 안에서 여는 연결부. v1.12 스크립트보다 먼저 읽힌다 (editor-next.html 순서).
// 외부 저장 모드: v1.12가 브라우저 저장소(localStorage) 대신 이 화면이 주는 기획안 값을 쓰게 한다.
// (CSP style-src 'self' 대응은 v1.12 쪽 data-am-style 처리 — editor-ui-kit.js 끝)
window.AMOREAD_EDITOR_OPTIONS = { persistence: 'external' };

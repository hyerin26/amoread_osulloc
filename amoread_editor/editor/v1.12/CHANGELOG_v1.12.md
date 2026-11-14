# v1.12 진행 재개 및 완료 기록 — 2026-11-14

- 기존 v1.11 코드 기반 `editor-ui-kit.js` / `editor-ui-kit.css`와 공통 UI 계약 34종을 검토하고 컴포넌트 갤러리(`editor-components.html`) 확인.
- 좌측 구좌/요소 자동 이동과 우측 상·하위 탐색 차이를 실제 브라우저에서 확인.
- UI의 번호 붙이기 조작은 제거하지만 기존 저장 필드 삭제는 하지 않는 호환 규칙 유지.
- 추가 신규 테스트 `test_v112_integration.py`: 고정 사이드바, 독립 스크롤, 구좌 이미지 비율, 상품 카드 삽입, 가상 상품 값 저장/복원, 우측 편집 계층을 확인.
- GitHub CI에서 오래된 프레임 테스트의 탭 탐색 경로가 실패해, 새 UI에 맞는 `test_v112_resize.py`를 추가하고 높이 입력·드래그·Undo/Redo를 재검증.
- 기존 회귀 테스트 실행 목록을 하나로 묶는 `run_regression_v112.py` 추가. 구식 DOM 경로 테스트 3개는 새 기능 검증으로 대체.
- 원본 Green UI 토큰과 기존 v1.11 소스를 직접 수정/덮어쓰지 않고 `integrated/v1.12/`에 새 버전을 추가.

### 구현되지 않은 것
- 사내 실데이터 API/가격 정책/후기 데이터/정식 PDF·HTML 인계와 GitLab 통합
- 일부 갤러리 예시의 실서비스 Loading/Tooltip/Validation 통합
- Green UI v2.5.1의 최종 사내 CSS와 CSP에 대한 실제 회사 환경 검증
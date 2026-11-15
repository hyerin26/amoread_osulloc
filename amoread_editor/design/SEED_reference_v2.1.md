# SEED 참고 기록

사용자가 제공한 seed-design-dev.zip을 읽기 전용으로 확인했다. 저장소 코드나 설치 스크립트는 실행하지 않았다.

## 참고한 구조

- Foreground / Background / Stroke × Role × Variant × State 색상 구조.
- 크기·줄높이·굵기 토큰과 목적별 텍스트 스타일 분리.
- Action Button의 Anatomy, Variant, Size, State 및 액션 위계.
- 행동 버튼과 조건 선택 Chip의 구분.
- Enabled / Pressed / Selected / Disabled를 분리하는 상태 모델.
- 눌림 피드백을 레이아웃 변화 없이 표현하는 원칙.

## AMOREAD에서 새로 정한 것

티그린 브랜드 팔레트, 쿨 뉴트럴, 기획 도구에 맞춘 14/15px 본문과 40/44/52px 컨트롤, 레퍼런스 카드·탐색 패널·AI 근거·가격 검토 패턴, UI 키트 전체 레이아웃과 구현. SEED의 브랜드색·문구·로고·이미지·소스 코드를 재배포하거나 SEED 패키지와의 호환을 주장하지 않는다. 2px 눌림 수식을 복제하지 않고, 이 데스크톱 도구에는 표면색 변경과 1px 이동을 적용했다.

## 확인한 경로

- `docs/content/foundations/color/color-role.mdx`
- `docs/content/foundations/typography.mdx`
- `docs/content/components/action-button.mdx`
- `docs/content/components/chip.mdx`
- `docs/content/foundations/state.mdx`
- `docs/content/foundations/feedback/scale.mdx`
- `packages/rootage/components/action-button.yaml`
- `docs/content/components/field.mdx`
- `docs/content/components/text-input.mdx`
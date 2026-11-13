# GitLab `design_eun` 업로드 안내

이 압축파일은 AMOREAD 구좌편집기 v1.12와 Green UI 디자인 시스템을 한 번에 옮기기 위한 **업로드 전용 패키지**입니다. 프로젝트의 기존 파일을 변경하지 않고 새 `amoread-editor/` 폴더만 추가합니다.

## 가장 쉬운 방법: GitLab 웹에서 업로드

1. GitLab [amoread2/osulloc](https://gitlab.com/amoread2/osulloc)에서 `design_eun` 브랜치를 만듭니다. 작업 브랜치를 반드시 `design_eun`으로 선택합니다.
2. [GitHub 업로드 패키지 ZIP](https://github.com/EunseongOH/tea_ad/archive/refs/heads/handoff/design-eun-upload.zip)을 다운로드해 압축을 풉니다. 다운로드에 GitHub 저장소 열람 권한이 필요할 수 있습니다.
3. 압축을 풀면 `amoread-editor/` 폴더가 있습니다. ZIP 파일 **자체를 GitLab에 업로드하지 마세요.** GitLab이 자동으로 압축을 풀어주지 않습니다.
4. GitLab의 **Code → Open in Web IDE**를 엽니다. 왼쪽 **Explorer**에서 `amoread-editor` 폴더와 하위 `editor/v1.12`, `design`, `integration` 폴더를 생성합니다.
5. 각 폴더를 우클릭하고 **Upload**를 눌러, 압축 해제한 동일 폴더에 있는 파일들을 **여러 개 선택**해 올립니다. `editor/v1.12` 폴더의 모든 코드·스타일·JSON·테스트 파일을 함께 올려야 합니다.
6. 왼쪽 **Source Control**에서 변경 파일을 확인한 뒤 커밋 메시지 `Add AMOREAD editor v1.12 and Green UI design system`으로 **Commit & Push**를 실행합니다.
7. 브랜치 `design_eun`에서 `amoread-editor/editor/v1.12/index.html`과 `amoread-editor/design/tokens_v2.5.1.css`이 모두 올라갔는지 확인합니다.

> 파일이 많으므로 GitLab Web IDE에서 여러 파일을 선택해 업로드할 수 있습니다. 단, **원래의 디렉터리 구조는 직접 만들어야 합니다.** 공식 도움말: https://docs.gitlab.com/user/project/web_ide/

## 더 간단한 일괄 업로드: Git을 사용할 수 있다면

압축 해제한 폴더(이 `UPLOAD_TO_GITLAB.sh` 파일이 있는 곳)에서 GitLab 저장소를 다운로드하거나 기존 로컬 저장소를 사용합니다.

```bash
git clone https://gitlab.com/amoread2/osulloc.git
cd osulloc
git switch design_eun
cd ..
bash UPLOAD_TO_GITLAB.sh ./osulloc
```

스크립트는 대상 브랜치, 미커밋 변경사항, 기존 `amoread-editor` 폴더를 확인합니다. 검사 후 사용자에게 물어보고 **`design_eun`에만 커밋·푸시**합니다. GitLab 인증은 사용자가 자신의 Git 설정으로 처리해야 하며 토큰을 이 대화에 입력하지 마세요.

## 파일 구조

```text
amoread-editor/
  editor/v1.12/          구좌편집기 전체(22구좌·구성블록·CSS·JS·HTML·테스트)
  design/                Green UI 전체 토큰, 설명서, 시각 가이드
  integration/
    INTEGRATION_GUIDE.md  실제 연결 설계·데이터 명세
    example-host-adapter.js  호스트 연동 예시(사내 API 엔드포인트 없음)
  IMPORT_MANIFEST.json   가져온 원본 파일 목록·개수
```

### 무엇이 동작하나요?

- `editor/v1.12/index.html`: 정적 구좌편집기 **데모** 실행 가능. `python -m http.server 8000`으로 정적 서버를 띄워 브라우저에서 열 수 있습니다.
- 구좌 배치, 구성블록 선택·삭제·드래그, 중앙/우측 패널 연결, 상품 카드의 16개 표시 속성, Green UI 스타일 등 편집기 자체 동작.
- `window.AMOREAD_EDITOR_API`: 실제 운영 앱에서 상품·후기 목록을 주입하고 기획안을 불러오고 변경을 구독할 수 있는 연결 지점 제공.

### 파일 업로드만으로 연결되지 않는 것

현재 패키지는 **원본 사내 GitLab 코드를 읽지 못한 상태에서 만든 독립 편집기**입니다. GitLab에 파일을 올려도 기존 앱의 메뉴·라우팅·로그인·상품 SEQ·가격 정책·저장 DB·쿠폰 API에 **자동으로 연결되지 않습니다.** 사내 앱 코드를 확인하고 `integration/INTEGRATION_GUIDE.md` 기준으로 연결 작업이 별도 필요합니다. 업로드 직후 기존 앱의 메인화면을 바꾸거나 빌드 설정을 덮어쓰지 않는 이유도 여기에 있습니다.

원본: `EunseongOH/tea_ad`, `feat/composable-block-editor` 브랜치 기반.

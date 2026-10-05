# MyCap (ScreenCaptureApp)

간편하고 빠른 데스크톱 화면 캡처 및 주석 편집 애플리케이션입니다.  
전체화면, 영역 지정, 특정 창 캡처를 지원하며, 캡처 즉시 화살표·도형·텍스트·블러(모자이크) 등의 주석을 편집하고 클립보드에 자동 복사할 수 있습니다.

---

## 🚀 주요 기능

- **다양한 캡처 모드 & 옵션**
  - **마우스 커서 포함/제외 선택**: 캡처 시 마우스 커서의 포함 여부를 손쉽게 켜고 끌 수 있습니다 (메인 창 토글 및 시스템 트레이 메뉴 연동).
  - **전체화면 캡처**: 모니터 전체 화면을 한 번에 캡처합니다.
  - **영역 선택 캡처**: 마우스 드래그로 원하는 사각형 영역을 픽셀 단위로 선택하여 캡처합니다.
  - **창 선택 캡처**: 현재 실행 중인 프로그램 창 목록과 썸네일을 확인하고 특정 창만 캡처합니다.
- **강력한 캔버스 편집기**
  - 화살표 그리기 (`Arrow`)
  - 사각형 테두리 그리기 (`Rectangle`)
  - 텍스트 입력 (`Text`)
  - 민감 정보 가림용 블러/모자이크 (`Blur`)
  - 최대 20단계 실행 취소 (`Undo`)
- **편리한 워크플로우**
  - 캡처 즉시 시스템 클립보드(`image/png`)에 자동 복사
  - 자동 PNG 파일 저장: Windows는 `사진/ScreenCaptureApp`, macOS는 `Downloads`(다운로드) 폴더에 자동 저장
  - 파일 저장 시 네이티브 알림 표시 및 클릭 시 저장 폴더 바로 열기
  - 시스템 트레이 상주 및 백그라운드 단축키 상시 대기
- **자동 업데이트 & 다양한 배포 형태**
  - **설치형 (`Setup.exe`)**: `electron-updater`를 통한 백그라운드 무음 자동 업데이트 지원
  - **무설치 포터블 (`Portable.exe`)**: 설치 없이 바로 실행 가능하며, 새 버전 출시 시 원클릭 다운로드 안내

---

## ⌨️ 글로벌 단축키

어느 프로그램에서든 아래 단축키를 눌러 즉시 캡처할 수 있습니다.

| 기능 | Windows 단축키 | macOS 단축키 |
| :--- | :--- | :--- |
| **전체화면 캡처** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> |
| **영역 선택 캡처** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> |
| **창 선택 캡처** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> | <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> |
| **영역/창 선택 취소** | <kbd>Esc</kbd> | <kbd>Esc</kbd> |

---

## 📦 다운로드 및 설치

최신 빌드 파일은 [GitHub Releases](https://github.com/sungback/MyCap/releases)에서 다운로드할 수 있습니다.

- **Windows 설치형**: `ScreenCaptureApp-Setup-x.x.x.exe` (자동 업데이트 지원)
- **Windows 포터블형**: `ScreenCaptureApp-Portable-x.x.x.exe` (무설치 단일 실행 파일)
- **macOS (Apple Silicon)**: `ScreenCaptureApp-x.x.x-arm64.dmg`

> [!NOTE]
> **macOS에서 "손상되었기 때문에 열 수 없습니다" 경고가 뜨는 경우**  
> Apple 개발자 유료 인증서로 서명되지 않은 오픈소스 앱의 경우, macOS 보안(Gatekeeper)에 의해 실행이 차단될 수 있습니다.  
> 앱을 `응용 프로그램` 폴더로 드래그한 뒤, **터미널(Terminal)**에서 다음 명령어를 1회 실행하시면 정상 실행됩니다:  
> ```bash
> xattr -cr /Applications/ScreenCaptureApp.app
> ```
> 또는 **[시스템 설정]** ➡️ **[개인정보 보호 및 보안]** ➡️ **[확인 없이 열기]**를 클릭해 실행할 수 있습니다.

---

## 🛠️ 기술 스택

- **Runtime**: [Electron](https://www.electronjs.org/) 44+
- **Frontend**: [React 19](https://react.dev/), TypeScript
- **Bundler & Build Tool**: [Vite](https://vite.dev/) 8, `vite-plugin-electron`, `vite-plugin-electron-renderer`
- **Packaging**: [electron-builder](https://www.electron.build/)
- **Auto Updater**: [electron-updater](https://www.electron.build/auto-update)
- **Linter**: [Oxlint](https://oxc.rs/)
- **CI/CD**: GitHub Actions

---

## 💻 개발 및 빌드 가이드

### 1. 의존성 패키지 설치
```bash
npm install
```

### 2. 개발 모드 실행
```bash
npm run dev
```

### 3. 코드 린트 및 번들 빌드 검사
```bash
# 코드 린트 (oxlint)
npm run lint

# 타입 검사 및 프론트엔드/메인 번들 빌드
npm run build
```

### 4. 플랫폼별 배포 파일 빌드
```bash
# Windows (설치형 + 포터블 exe 생성)
npm run dist:win

# macOS (DMG 생성)
npm run dist:mac
```

---

## 📂 프로젝트 구조

```
MyCap/
├── .github/workflows/       # GitHub Actions 릴리스 자동화 워크플로우
├── electron/
│   ├── main.ts              # Electron 메인 프로세스 (단축키, 트레이, IPC, 자동 업데이트)
│   └── preload.ts           # 보안 IPC 바인딩 (contextBridge)
├── src/
│   ├── App.tsx              # 메인 대시보드 뷰
│   ├── OverlaySelector.tsx  # 화면 영역 선택 오버레이 뷰
│   ├── WindowPicker.tsx     # 실행 중인 창 목록 선택 뷰
│   ├── EditorCanvas.tsx     # 캡처 이미지 편집/주석 캔버스
│   └── ...
├── build/                   # 앱 아이콘 리소스 (.ico, .icns)
├── package.json             # 프로젝트 메타데이터 및 빌드 설정
└── vite.config.ts           # Vite + Electron 멀티 윈도우 번들러 설정
```

---

## 📄 라이선스

이 프로젝트는 개인 및 업무용으로 자유롭게 사용할 수 있습니다.

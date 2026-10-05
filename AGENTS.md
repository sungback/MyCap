# AGENTS.md

이 문서는 **MyCap (ScreenCaptureApp)** 프로젝트의 개발 규칙, 아키텍처 원칙, 지금까지의 작업 내역 및 과거에 겪었던 시행착오와 핵심 주의사항을 정리한 가이드입니다.  
프로젝트를 유지보수하거나 새 기능을 추가하는 모든 에이전트와 개발자는 작업 전 반드시 이 문서를 숙지해야 합니다.

---

## 📌 0. 대원칙 (Standing Instructions)

1. **기본 릴리스 푸시 자동 수행:**
   * 사용자의 명시적 요청: *"앞으로 다시 얘기하지 않으면 기본으로 릴리스 푸시까지 해줘."*
   * 코드 수정 및 기능 구현이 완료되면 반드시 아래 릴리스 프로세스까지 완료해야 합니다:
     1) `npm run build && npm run lint` 검증
     2) `package.json` 버전 패치 올림 (예: `0.0.8` ➡️ `0.0.9`)
     3) Git 커밋 (`git add . ; git commit -m "..."`)
     4) Git 태그 생성 (`git tag -a vX.X.X -m "Release vX.X.X"`)
     5) 원격 푸시 (`git push origin main ; git push origin vX.X.X`)
     6) GitHub Actions 워크플로우 완료 및 릴리스 배포 확인 (`gh run view ...`)
2. **Windows PowerShell 명령줄 규칙:**
   * 개발 환경이 Windows PowerShell이므로 `&&` 연산자 대신 세미콜론(`;`)을 사용해야 합니다.
3. **문서 및 UI 한글화:**
   * README, UI 텍스트, 사용자 알림 메시지는 일관되게 깔끔한 한국어로 유지합니다.

---

## 🏗️ 1. 프로젝트 개요 및 기술 스택

* **앱 이름:** `ScreenCaptureApp` (리포지토리: `sungback/MyCap`)
* **플랫폼:** Windows 10/11, macOS (Apple Silicon arm64)
* **런타임 및 프레임워크:**
  * Electron 44+
  * React 19, TypeScript 6
  * Vite 8 (`vite-plugin-electron`, `vite-plugin-electron-renderer`)
  * Oxlint (초고속 Rust 기반 린터)
  * `electron-builder` 26 (패키징 및 배포)
  * `electron-updater` 6 (자동 업데이트)

---

## 🧩 2. 핵심 아키텍처 및 윈도우 구조

앱은 용도별로 독립된 4개의 Electron 윈도우로 구성됩니다:

| 윈도우 | 파일 | 역할 및 특이사항 |
| :--- | :--- | :--- |
| **메인 창 (`mainWindow`)** | `index.html` / `App.tsx` | 대시보드 및 단축키/옵션 안내. 창 닫기 시 종료되지 않고 백그라운드 트레이로 숨김 (`mainWindow.hide()`). 고정 크기 (440×540px). |
| **영역 선택 오버레이 (`overlayWindow`)** | `overlay.html` / `OverlaySelector.tsx` | 전체화면 무테두리 투명 창. 캡처된 데스크톱 배경 위에 드래그 박스로 사각형 영역을 선택. |
| **창 선택 피커 (`pickerWindow`)** | `picker.html` / `WindowPicker.tsx` | 열려 있는 다른 응용프로그램 창 목록 및 썸네일을 격자 형태로 표시하고 선택. |
| **캔버스 편집기 (`editorWindow`)** | `editor.html` / `EditorCanvas.tsx` | 캡처 완료된 이미지를 로드하여 화살표, 사각형, 텍스트, 블러 도구로 편집 후 클립보드 복사 및 저장. |

---

## ⚠️ 3. 핵심 주의사항 및 기술적 함정 (Gotchas)

### 🚨 1) 마우스 커서 캡처 관련 (절대 인위적인 커서 합성 금지)
* **Windows (`win32`):**
  * Chromium / WebRTC의 `desktopCapturer`는 내부적으로 `DesktopAndCursorComposer`를 사용합니다.
  * Windows 운영체제 레벨에서 사용자의 **실제 마우스 커서(사용자 지정 색상, 크기, 손 모양/텍스트 빔/화살표 등)**가 캡처 비트맵에 이미 자연스럽게 포함됩니다.
  * **주의:** `drawCursorOnNativeImage`와 같은 인위적인 화살표 커서(`CURSOR_TEMPLATE`)를 비트맵 위에 임의로 덧그리면 **이중 마우스 커서(실제 커서 + 하얀 가짜 마우스)**가 발생합니다. Windows 환경에서는 인위적인 커서 합성을 절대 수행하지 마십시오.
* **macOS (`darwin`):**
  * macOS `desktopCapturer`는 시스템 커서를 포함하지 않습니다.

### 🚨 2) `NativeImage`의 `scaleFactor`와 `crop()` 좌표계 왜곡 주의
* `desktopCapturer.getSources`가 반환하는 `thumbnail` 이미지는 물리 픽셀 크기(`width * scaleFactor`, `height * scaleFactor`)를 가지며 내부 `scaleFactor`는 `1.0`입니다.
* 영역 캡처 시 오버레이에서 전달된 논리 좌표 `rect`는 `pixelRect = { x: Math.round(rect.x * scaleFactor), ... }`로 물리 픽셀로 변환된 후 `image.crop(pixelRect)`를 수행합니다.
* **주의:** 비트맵 조작 시 `nativeImage.createFromBitmap(bmp, { width, height, scaleFactor })`와 같이 `scaleFactor`를 1.0이 아닌 값(예: 1.5, 2.0)으로 넘기면, Electron 내부에서 이미지의 논리 크기를 다시 나누고 `crop()` 호출 시 `pixelRect`에 `scaleFactor`를 **이중으로 곱해버려** 캡처 영역이 오른쪽/아래로 밀리고 좌측이 잘려나가는 심각한 왜곡이 발생합니다.
* 비트맵을 재생성할 때는 반드시 `{ width, height }` (scaleFactor 생략 = 1.0 기본값)을 유지해야 합니다.

### 🚨 3) macOS 자동 업데이트 및 Windows/macOS 업데이트 UI 분기
* `electron-builder` 설정 시 `mac.target`에 `["dmg", "zip"]`이 모두 포함되어야만 GitHub Release에 `latest-mac.yml`과 업데이트용 zip이 생성됩니다 (`dmg`만 지정 시 `latest-mac.yml` 404 에러 발생).
* **사용자 동의 기반 업데이트 다운로드:**
  * 사용자 모르게 백그라운드에서 임의로 데이터를 다운로드하거나 앱 종료 시 설치 마법사가 강제 실행되는 것을 막기 위해 `autoDownload = false`, `autoInstallOnAppQuit = false`를 적용합니다.
  * 새 버전 감지 시 "새 버전(vX.X.X)이 있습니다" 알림 및 UI를 제공하며, 사용자가 직접 **`[업데이트 다운로드]`** 버튼을 눌러야만 다운로드가 시작됩니다.
* **macOS Squirrel.Mac(ShipIt) 서명 제약 및 DMG 인앱 다운로드 해결책:**
  * macOS의 기본 `electron-updater` 백그라운드 엔진인 `Squirrel.Mac (ShipIt)`은 Apple 유료 개발자 계정의 Developer ID 인증서 서명을 강제합니다. 미서명 오픈소스 빌드에서 `autoUpdater.downloadUpdate()`를 호출하면 OS 레벨에서 `ShipIt` 서명 검증 실패 에러(`did not pass validation`)가 발생합니다.
  * **해결책:** macOS에서는 `Squirrel.Mac`을 우회하여, `update:startDownload` 호출 시 최신 `.dmg` 파일을 `~/Downloads`로 인앱 스트리밍 다운로드(실시간 진행률 0~100% 표시)합니다. 다운로드가 완료되면 `shell.openPath()`로 DMG를 자동 마운트하여 사용자가 즉시 응용 프로그램으로 드래그할 수 있도록 하며, UI에는 **`[DMG 열기]`** 버튼을 제공합니다.
* **플랫폼별 버튼 문구 분기:**
  * Windows 설치형은 업데이트 적용 시 내부적으로 NSIS 설치 프로그램이 구동되어 앱을 덮어씌우는 재설치 과정을 거치므로 `[재설치하여 적용]`으로 표기합니다.
  * macOS는 다운로드된 DMG를 열어 설치하므로 `[DMG 열기]`로 표기합니다.

### 🚨 4) 메인 윈도우 크기와 스크롤바 방지
* 메인 윈도우는 고정 크기 창(`resizable: false`)입니다.
* UI에 새로운 요소(토글 스위치, 힌트, 안내 문구 등)를 추가할 때는 반드시 메인 창의 높이(`mainWindow` height, 현재 540px)와 패딩/마진을 점검하여 불필요한 세로 스크롤바가 생기지 않도록 관리해야 합니다.

### 🚨 5) 이미지 기본 저장 경로
* **모든 플랫폼 (Windows, macOS):** 사용자 `Downloads` (`app.getPath('downloads')`) 폴더에 직접 저장. 사용자가 캡처 이미지를 직관적으로 찾아 사용할 수 있도록 일원화.

---

## 📜 4. 릴리스 히스토리 요약

* **v0.0.3**: 기본 전체화면/영역/창 캡처 및 캔버스 편집기, 트레이 연동.
* **v0.0.4**: 전면 한국어화, 저장 위치 경로 표시, 메인 창 높이 최적화.
* **v0.0.5**: 자동 업데이트 UI 안내 기능 추가 및 캡처 버튼별 모던 컬러 테마 적용.
* **v0.0.6**:
  * macOS `latest-mac.yml` 누락 해결 (`mac.target: ["dmg", "zip"]` 반영).
  * UI에 플랫폼별 태그(설치형/무설치/macOS) 표시.
* **v0.0.7**: 캡처 시 마우스 커서 포함 토글 옵션 및 시스템 트레이 연동 추가.
* **v0.0.8**:
  * Windows에서 실 마우스 위에 하얀 가짜 마우스가 덧그려지는 이중 커서 버그 제거.
  * `NativeImage`의 `scaleFactor` 중복 적용으로 인한 영역 캡처 좌표 잘림/밀림 문제 완전 해결.
* **v0.0.9**:
  * 에이전트 개발 지침 및 아키텍처, 과거 오류 및 주의사항을 총정리한 `AGENTS.md` 구축.
* **v0.0.10**:
  * Windows 업데이트 다운로드 완료 버튼 문구를 실제 동작에 부합하도록 `[재설치하여 적용]`으로 변경.
  * macOS를 무설치 모드에서 분리하여 인앱 자동 업데이트(백그라운드 다운로드, 진행률 표시, 재시작 적용) 정상 복원.
  * 업데이트 오류 시 최신 버전을 바로 다운로드할 수 있는 `[수동 다운로드]` 폴백 버튼 추가.
* **v0.0.11**:
  * macOS 캡처 이미지 저장 기본 경로를 `Pictures/ScreenCaptureApp`에서 `Downloads`(`app.getPath('downloads')`) 폴더로 변경.
* **v0.0.12**:
  * Windows에서도 캡처 이미지 저장 기본 경로를 `Downloads`(`app.getPath('downloads')`) 폴더로 일원화.
* **v0.0.13**:
  * 무조건 자동 업데이트 방지: `autoDownload = false`, `autoInstallOnAppQuit = false` 설정.
  * 새 버전 감지 시 "새 버전(vX.X.X)이 있습니다" 알림 노출 후 사용자가 `[업데이트 다운로드]` 버튼을 클릭해야 다운로드 개시.
* **v0.0.14**:
  * macOS `Squirrel.Mac`(`ShipIt`) 서명 검증 실패 에러 원천 해결: macOS 인앱 DMG 직접 스트리밍 다운로드(0~100% 진행률 표시) 및 자동 마운트(`shell.openPath`) 파이프라인 구축. 완료 시 `[DMG 열기]` 버튼 제공.

---

## 🛠️ 5. 유용한 개발 명령어

```powershell
# 개발 서버 실행
npm run dev

# 빌드 및 린트 검증
npm run build ; npm run lint

# Windows 로컬 인스톨러 빌드 테스트
npm run dist:win

# macOS 로컬 패키징 빌드 테스트
npm run dist:mac

# GitHub Actions 워크플로우 모니터링
gh run list --limit 3
gh run view <RUN_ID>
```

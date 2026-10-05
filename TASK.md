# TASK.md

MyCap (ScreenCaptureApp) 프로젝트의 작업 목록, 진행 상태 및 변경 이력을 관리하는 문서입니다.

---

## 📌 현재 작업 (Active Tasks)

| ID | 작업 항목 | 상태 | 설명 및 검증 기준 |
| :--- | :--- | :---: | :--- |
| **T-001** | Windows 업데이트 버튼 문구 변경 | `DONE` | Windows 설치형(NSIS) 업데이트 다운로드 완료 시 버튼 문구를 `[재시작하여 적용]`에서 실제 동작에 부합하는 `[재설치하여 적용]`으로 변경. |
| **T-002** | macOS 인앱 자동 업데이트 복원 | `DONE` | `process.platform === 'darwin'`을 `isPortable`에서 분리하여 `autoDownload = true` 복원. 인앱 백그라운드 다운로드 및 재시작 업데이트 지원, 오류 발생 시 `[수동 다운로드]` 폴백 제공. |
| **T-003** | AGENTS.md 가이드 업데이트 | `DONE` | macOS 자동 업데이트 정책 및 Windows 재설치 버튼 명칭 반영. |
| **T-004** | 빌드 검증 및 릴리스 배포 (v0.0.10) | `DONE` | `npm run build && npm run lint` 통과 후 `v0.0.10` 태그 생성, 원격 푸시 및 GitHub Actions 배포 완료. |
| **T-005** | macOS 캡처 이미지 저장 폴더 변경 (v0.0.11) | `DONE` | macOS에서 이미지 저장 위치를 `Pictures/ScreenCaptureApp`에서 `Downloads` 폴더로 변경 및 v0.0.11 배포 완료. |
| **T-006** | Windows 캡처 이미지 저장 폴더 Downloads 변경 (v0.0.12) | `DONE` | Windows에서도 이미지 기본 저장 폴더를 `Downloads`(`app.getPath('downloads')`)로 일원화 변경 및 v0.0.12 배포 완료. |
| **T-007** | 사용자 동의 기반 업데이트 다운로드 전환 (v0.0.13) | `DONE` | 무조건 자동 다운로드/설치 방지: `autoDownload = false`, `autoInstallOnAppQuit = false` 설정, 새 버전 감지 시 "새 버전(vX.X.X)이 있습니다" 알림 및 `[업데이트 다운로드]` 버튼 클릭 시 다운로드 시작 및 v0.0.13 배포 완료. |
| **T-008** | macOS DMG 직접 다운로드 & 자동 마운트 (v0.0.14) | `DONE` | 무료/미서명 환경에서 Squirrel.Mac(ShipIt) 서명 검증 실패를 방지하기 위해 macOS에서는 DMG를 인앱에서 직접 다운로드(진행률 표시) 후 자동 마운트(`shell.openPath`)하도록 개선 및 v0.0.14 배포 완료. |
| **T-009** | 메인 창 세로 높이 확대 (540px -> 580px) | `DONE` | UI 여백 확보 및 스크롤바 방지를 위해 메인 윈도우 높이를 540px에서 580px로 확대. |

---

## 📋 세부 구현 계획

### 1. 메인 창 세로 높이 확대 (T-009)
* **파일:** `electron/main.ts`, `AGENTS.md`
* **내용:**
  * `createWindow()`에서 `BrowserWindow` 높이를 `height: 540`에서 `height: 580`으로 40px 확대.
  * 업데이트 알림 및 캡처 경로 표시 시 불필요한 스크롤바 발생 원천 차단.

### 2. 문서 및 릴리스 배포
* `AGENTS.md` 업데이트 및 `package.json` 버전 패치 (`0.0.15`).
* 빌드/린트 검증 후 `v0.0.15` 릴리스 태그 푸시 및 GitHub Actions 배포 모니터링.

---

## 📜 완료된 작업 내역 (Completed Tasks)
* **v0.0.3**: 기본 전체화면/영역/창 캡처 및 캔버스 편집기, 트레이 연동.
* **v0.0.4**: 전면 한국어화, 저장 위치 경로 표시, 메인 창 높이 최적화.
* **v0.0.5**: 자동 업데이트 UI 안내 기능 추가 및 캡처 버튼별 모던 컬러 테마 적용.
* **v0.0.6**: macOS zip 아티팩트 추가 및 DMG 배포 링크 연동.
* **v0.0.7**: 캡처 시 마우스 커서 포함 토글 옵션 및 시스템 트레이 연동 추가.
* **v0.0.8**: Windows 네이티브 커서 중복 버그 제거 및 영역 캡처 스케일 팩터 왜곡 해결.
* **v0.0.9**: 개발 원칙 및 주의사항을 총정리한 `AGENTS.md` 구축.
* **v0.0.10**: Windows 재설치 버튼 문구 변경, macOS 인앱 자동 업데이트 복원 및 수동 다운로드 폴백 버튼 추가.
* **v0.0.11**: macOS 캡처 이미지 저장 기본 경로를 `Downloads` 폴더로 변경.
* **v0.0.12**: Windows에서도 캡처 이미지 저장 기본 경로를 `Downloads` 폴더로 일원화.
* **v0.0.13**: 사용자 동의 기반 업데이트 다운로드 전환 (`autoDownload = false`, `autoInstallOnAppQuit = false`).
* **v0.0.14**: macOS `Squirrel.Mac`(`ShipIt`) 서명 검증 실패 에러 원천 해결: macOS 인앱 DMG 직접 스트리밍 다운로드 및 자동 마운트 파이프라인 구축.

# TASK.md

MyCap (ScreenCaptureApp) 프로젝트의 작업 목록, 진행 상태 및 변경 이력을 관리하는 문서입니다.

---

## 📌 현재 작업 (Active Tasks)

| ID | 작업 항목 | 상태 | 설명 및 검증 기준 |
| :--- | :--- | :---: | :--- |
| **T-001** | Windows 업데이트 버튼 문구 변경 | `DONE` | Windows 설치형(NSIS) 업데이트 다운로드 완료 시 버튼 문구를 `[재시작하여 적용]`에서 실제 동작에 부합하는 `[재설치하여 적용]`으로 변경. |
| **T-002** | macOS 인앱 자동 업데이트 복원 | `DONE` | `process.platform === 'darwin'`을 `isPortable`에서 분리하여 `autoDownload = true` 복원. 인앱 백그라운드 다운로드 및 재시작 업데이트 지원, 오류 발생 시 `[수동 다운로드]` 폴백 제공. |
| **T-003** | AGENTS.md 가이드 업데이트 | `DONE` | macOS 자동 업데이트 정책 및 Windows 재설치 버튼 명칭 반영. |
| **T-004** | 빌드 검증 및 릴리스 푸시 | `DONE` | `npm run build && npm run lint` 통과 후 `v0.0.10` 태그 생성, 원격 푸시 및 GitHub Actions 배포 확인. |

---

## 📋 세부 구현 계획

### 1. Windows 업데이트 버튼 명칭 조정 (T-001)
* **파일:** `src/App.tsx`, `electron/main.ts`
* **내용:**
  * Windows 설치형은 NSIS 마법사가 실행되어 기존 앱을 덮어씌우는 재설치 과정을 거치므로 `[재설치하여 적용]`으로 표시.
  * macOS는 앱 번들 자체를 교체하므로 `[재시작하여 적용]`으로 플랫폼별 분기.

### 2. macOS 인앱 자동 업데이트 정상화 (T-002)
* **파일:** `electron/main.ts`, `src/App.tsx`
* **내용:**
  * `isPortable` 정의에서 `process.platform === 'darwin'` 제거 (Windows Portable만 `isPortable = true`로 유지).
  * macOS에서 `autoDownload = true`로 동작하여 인앱 자동 다운로드 및 진행률 표시 복원.
  * 업데이트 오류(`state: 'error'`) 발생 시 사용자가 바로 최신 버전을 받을 수 있도록 `[수동 다운로드]` 버튼 제공.

### 3. 문서 및 릴리스 배포 (T-003, T-004)
* `AGENTS.md` 업데이트 및 `package.json` 버전 패치 (`0.0.10`).
* 빌드/린트 검증 후 `v0.0.10` 릴리스 태그 푸시 및 GitHub Actions 배포 모니터링.

---

## 📜 완료된 작업 내역 (Completed Tasks)
* **v0.0.3**: 기본 전체화면/영역/창 캡처 및 캔버스 편집기, 트레이 연동.
* **v0.0.4**: 전면 한국어화, 저장 위치 경로 표시, 메인 창 높이 최적화.
* **v0.0.5**: 자동 업데이트 UI 안내 기능 추가 및 캡처 버튼별 모던 컬러 테마 적용.
* **v0.0.6**: macOS zip 아티팩트 추가 및 DMG 배포 링크 연동.
* **v0.0.7**: 캡처 시 마우스 커서 포함 토글 옵션 및 시스템 트레이 연동 추가.
* **v0.0.8**: Windows 네이티브 커서 중복 버그 제거 및 영역 캡처 스케일 팩터 왜곡 해결.
* **v0.0.9**: 개발 원칙 및 주의사항을 총정리한 `AGENTS.md` 구축.

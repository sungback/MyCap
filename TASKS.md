# TASKS.md — 리팩토링 / 가독성 / 테스트

- [x] 1. 테스트 환경 구성 (vitest, 별도 `vitest.config.ts`, `npm test`)
- [x] 2. PowerShell 스크립트 상수를 `electron/windows-scripts.ts`로 분리
- [x] 3. 순수 로직 분리 + 테스트
  - [x] `cursor-draw.ts` (합성 커서 그리기)
  - [x] `capture-utils.ts` (검은 화면 판정, 창 핸들 파싱, 창 목록 필터)
  - [x] `settings.ts` (커서 토글 저장/읽기)
  - [x] `update-utils.ts` (맥 업데이트 zip 선택)
- [x] 4. `main.ts` 가독성 정리 (새 모듈 사용, 중복 제거)
- [x] 5. 검증: `npm test`, `npm run build`, `npm run lint`
- [x] 6. AGENTS.md 갱신, 릴리스(v0.0.31)

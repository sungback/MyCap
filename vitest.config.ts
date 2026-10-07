import { defineConfig } from 'vitest/config'

// vite.config.ts의 electron 플러그인이 테스트 중 앱을 띄우지 않도록 별도 설정을 쓴다.
export default defineConfig({
  test: { include: ['electron/**/*.test.ts'] },
})

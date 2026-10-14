// The root vite.config.ts only collects src/**/*.test.ts. Run these unit tests with:
//   npx vitest run -c tests/scripted-playthrough/vitest.config.mts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/scripted-playthrough/**/*.test.ts'],
  },
})

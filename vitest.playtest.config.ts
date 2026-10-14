import { defineConfig } from 'vitest/config'

/** Long bot playthrough. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/playtest-bots.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
    fileParallelism: false,
  },
})

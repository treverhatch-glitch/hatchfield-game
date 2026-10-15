import { defineConfig } from 'vitest/config'

/** 90-day careful bot. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/hub-offer-bot.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
    fileParallelism: false,
  },
})

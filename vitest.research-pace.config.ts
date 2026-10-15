import { defineConfig } from 'vitest/config'

/** Headless 90-day research pace. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/research-pace.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
    fileParallelism: false,
  },
})

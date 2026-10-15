import { defineConfig } from 'vitest/config'

/** Headless 90-day research pace. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/research-pace.mts', 'scripts/spot-probe.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 3_600_000,
    hookTimeout: 3_600_000,
    fileParallelism: false,
    disableConsoleIntercept: true,
  },
})

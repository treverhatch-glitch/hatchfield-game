import { defineConfig } from 'vitest/config'

/** Headless sim-tick benchmark (scripts/sim-bench.mts). Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/sim-bench.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 1_800_000,
    fileParallelism: false,
    disableConsoleIntercept: true,
  },
})

import { defineConfig } from 'vitest/config'

/** Runs scripts/batch-b-proof-save.mts. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/batch-b-proof-save.mts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 600_000,
  },
})

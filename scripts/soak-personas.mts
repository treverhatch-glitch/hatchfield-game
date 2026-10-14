/**
 * Headless 30-day persona soak. The sim imports Vite-only modules, so this
 * launches Vitest. The test file stays skipped unless SOAK_PERSONAS=1.
 *
 * Run: npx tsx scripts/soak-personas.mts
 */
import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  [
    './node_modules/vitest/vitest.mjs',
    'run',
    'src/game/soakPersonas.test.ts',
    '--maxWorkers=1',
    '--no-file-parallelism',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, SOAK_PERSONAS: '1' },
  },
)

process.exit(result.status ?? 1)

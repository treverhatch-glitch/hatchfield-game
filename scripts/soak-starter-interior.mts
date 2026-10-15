/**
 * 30-day starter soak. The sim imports Vite-only modules, so this launches Vitest.
 *   npx tsx scripts/soak-starter-interior.mts
 */
import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['./node_modules/vitest/vitest.mjs', 'run', 'src/game/starterInterior.test.ts', '--maxWorkers=1', '--no-file-parallelism'],
  {
    stdio: 'inherit',
    env: { ...process.env, SOAK_STARTER: '1' },
  },
)

process.exit(result.status ?? 1)

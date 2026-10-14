/**
 * npm run playtest:bots [-- --quick]
 *
 * Vitest rejects unknown flags, so --quick is peeled off here and handed to
 * scripts/playtest-bots.mts as PLAYTEST_QUICK. --quick runs the Careful
 * persona for 15 days and skips the browser smoke.
 */
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const quick = argv.includes('--quick')
const forwarded = argv.filter((arg) => arg !== '--quick')

const result = spawnSync(
  process.execPath,
  [
    './node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.playtest.config.ts',
    ...forwarded,
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYTEST_QUICK: quick ? '1' : process.env.PLAYTEST_QUICK ?? '',
    },
  },
)

process.exit(result.status ?? 1)

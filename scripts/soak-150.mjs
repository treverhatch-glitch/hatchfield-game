/**
 * Headless soak launcher. The sim imports Vite-only modules, so the run goes
 * through Vitest with GC exposed. See src/game/soak150.test.ts.
 *
 *   node scripts/soak-150.mjs            # 150 days (default)
 *   node scripts/soak-150.mjs --days 30  # shorter gate run
 */
import { spawnSync } from 'node:child_process'

function readDays(argv) {
  const inline = argv.find((arg) => arg.startsWith('--days='))
  if (inline) return inline.slice('--days='.length)
  const index = argv.indexOf('--days')
  if (index >= 0) return argv[index + 1]
  return null
}

const daysArg = readDays(process.argv.slice(2))
let soakDays = '150'
if (daysArg != null) {
  if (!/^[1-9]\d*$/.test(daysArg)) {
    console.error(`soak-150: --days expects a positive integer, got ${daysArg || '(missing)'}`)
    process.exit(1)
  }
  soakDays = daysArg
}

const inherited = process.env.NODE_OPTIONS ?? ''
const nodeOptions = `${inherited} --expose-gc`.trim()

const result = spawnSync(
  process.execPath,
  [
    '--expose-gc',
    './node_modules/vitest/vitest.mjs',
    'run',
    'src/game/soak150.test.ts',
    '--execArgv=--expose-gc',
    '--maxWorkers=1',
    '--no-file-parallelism',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SOAK_150: '1',
      SOAK_DAYS: soakDays,
      NODE_OPTIONS: nodeOptions,
    },
  },
)

process.exit(result.status ?? 1)

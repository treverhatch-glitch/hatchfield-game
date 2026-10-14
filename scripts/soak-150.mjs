/**
 * Headless 150-day soak launcher. The sim imports Vite-only modules, so the
 * run goes through Vitest with GC exposed. See src/game/soak150.test.ts.
 */
import { spawnSync } from 'node:child_process'

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
    env: { ...process.env, SOAK_150: '1', NODE_OPTIONS: nodeOptions },
  },
)

process.exit(result.status ?? 1)

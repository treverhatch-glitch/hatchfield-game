/**
 * npm run playtest:bots
 * Headless personas, then a Playwright pass over the production build.
 * Writes docs/playtest/bots/report.md and report.json.
 *
 * Runs under Vitest so Vite can transform import.meta.glob in the sim.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { assembleReport, renderReport } from '../src/playtest/report.ts'
import { runHeadless } from '../src/playtest/run.ts'
import { runSmoke } from './playtest-smoke.mts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs/playtest/bots')

test('bot playtest writes a report', async () => {
  mkdirSync(outDir, { recursive: true })
  const headless = runHeadless({
    onProgress: (line) => {
      console.log(line)
    },
  })
  console.log('building production bundle for the browser smoke')
  let browser
  try {
    execSync('npx vite build', { cwd: root, stdio: 'inherit' })
    console.log('browser smoke')
    browser = await runSmoke(join(outDir, 'smoke'))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    browser = {
      ok: false,
      skipped: true,
      reason,
      wallMs: 0,
      script: [],
      screenshots: [],
      timeToFirstLandingSec: null,
      cashCurve: [],
      stuck: [],
      recovered: [],
      consoleErrors: [reason],
      softlocks: [],
      satisfaction: [],
      satisfactionAvg: null,
      slowestTicks: [],
      couldNot: [],
      clockEnd: 0,
      cashEnd: null,
      notes: [],
    }
  }
  const report = assembleReport(headless, browser)
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(outDir, 'report.md'), renderReport(report))
  console.log(`wrote ${join(outDir, 'report.md')}`)
})

/**
 * npm run playtest:bots [-- --quick]
 * Headless personas, then a Playwright pass over the production build.
 * Writes docs/playtest/bots/report.md and report.json.
 *
 * --quick (PLAYTEST_QUICK=1) runs the Careful persona for 15 days only and
 * skips the browser smoke. The full command runs every persona, then smoke.
 *
 * Runs under Vitest so Vite can transform import.meta.glob in the sim.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { assembleReport, renderReport } from '../src/playtest/report.ts'
import { PERSONAS, runHeadless } from '../src/playtest/run.ts'
import type { BrowserReport } from '../src/playtest/types.ts'
import { runSmoke } from './playtest-smoke.mts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs/playtest/bots')
const quick = process.env.PLAYTEST_QUICK === '1'
const QUICK_DAYS = 15

function skippedBrowser(reason: string): BrowserReport {
  return {
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
    consoleErrors: [],
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

test('bot playtest writes a report', async () => {
  mkdirSync(outDir, { recursive: true })
  const careful = PERSONAS.find((persona) => persona.id === 'careful')
  if (quick && !careful) throw new Error('Careful persona is missing; --quick cannot run.')
  const headless = runHeadless({
    personas: quick && careful ? [{ ...careful, days: QUICK_DAYS }] : undefined,
    onProgress: (line) => {
      console.log(line)
    },
  })
  let browser: BrowserReport
  if (quick) {
    browser = skippedBrowser('Quick mode runs the Careful persona for 15 days and skips the browser smoke.')
  } else {
    console.log('building production bundle for the browser smoke')
    try {
      execSync('npx vite build', { cwd: root, stdio: 'inherit' })
      console.log('browser smoke')
      browser = await runSmoke(join(outDir, 'smoke'))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      browser = skippedBrowser(reason)
      browser.consoleErrors = [reason]
    }
  }
  const report = assembleReport(headless, browser)
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(outDir, 'report.md'), renderReport(report))
  console.log(`wrote ${join(outDir, 'report.md')}`)
})

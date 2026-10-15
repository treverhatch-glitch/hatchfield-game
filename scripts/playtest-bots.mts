/**
 * npm run playtest:bots [-- --quick]
 * Headless personas, then a Playwright pass over the production build.
 * Writes docs/playtest/bots/report.md and report.json.
 *
 * --quick (PLAYTEST_QUICK=1) runs the Careful persona for 15 days only and
 * skips the browser smoke and the opening check. The full command runs every
 * persona, then smoke, then the opening check.
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
import { runOpeningCheck } from './opening-check.mts'
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
  let browser: BrowserReport | undefined
  let openingError = ''
  if (quick) {
    browser = skippedBrowser('Quick mode runs the Careful persona for 15 days and skips the browser smoke.')
  } else {
    console.log('building production bundle for the browser smoke')
    try {
      execSync('npx vite build', { cwd: root, stdio: 'inherit' })
      console.log('browser smoke')
      browser = await runSmoke(join(outDir, 'smoke'))
      console.log('opening check')
      const openingShots = await runOpeningCheck(join(root, 'docs/playtest/opening'))
      browser.notes.push(`Opening check passed. Screenshots: ${openingShots.join(', ')}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (browser) {
        browser.ok = false
        browser.notes.push(`Opening check failed: ${reason}`)
        browser.consoleErrors.push(reason)
      } else {
        browser = skippedBrowser(reason)
        browser.consoleErrors = [reason]
      }
      openingError = reason
    }
  }
  if (!browser) browser = skippedBrowser('Browser smoke produced no report.')
  const report = assembleReport(headless, browser)
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(outDir, 'report.md'), renderReport(report))
  console.log(`wrote ${join(outDir, 'report.md')}`)
  if (openingError) throw new Error(openingError)
  const failures = botFailures(report.headless, quick ? null : browser)
  if (failures.length) throw new Error(`Bot playtest found problems:\n${failures.join('\n')}`)
})

function botFailures(
  runs: { persona: string; softlocks: string[]; consoleErrors: string[]; nanFlags?: string[]; daysRan: number; daysRequested: number }[],
  browser: BrowserReport | null,
): string[] {
  const out: string[] = []
  for (const run of runs) {
    for (const line of run.softlocks) out.push(`${run.persona}: softlock — ${line}`)
    for (const line of run.consoleErrors) out.push(`${run.persona}: error — ${line}`)
    for (const line of run.nanFlags ?? []) out.push(`${run.persona}: NaN — ${line}`)
    if (run.daysRan < run.daysRequested) out.push(`${run.persona}: stopped on day ${run.daysRan} of ${run.daysRequested}`)
  }
  if (browser && (browser.skipped || !browser.ok)) {
    out.push(`browser smoke: ${browser.skipped ? `skipped (${browser.reason ?? 'no reason'})` : 'failed'}`)
    for (const line of browser.consoleErrors) out.push(`browser: error — ${line}`)
  }
  return out
}

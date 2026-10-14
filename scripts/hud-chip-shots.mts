/**
 * Top bar vs. info-view chips at 1280x800: a fresh standard game (coach up)
 * and the same game once the starter kit is down. Needs `npm run dev`.
 * Usage: tsx scripts/hud-chip-shots.mts <label>
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const label = process.argv[2] ?? 'shot'
const OUT = 'docs/playtest/hud-chips'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${label}-01-new-game.png` })
  await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { buildStarterKit: () => void; xp: number } }).__hatch
    g.buildStarterKit()
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${label}-02-kit-down.png` })
} finally {
  await browser.close()
}

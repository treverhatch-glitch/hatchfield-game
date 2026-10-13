/** Short cargo browser check + one FPS sample. No video. */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.clear()
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.waitForTimeout(300)
await page.getByTestId('start-cargo').click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'docs/playtest/19-cargo-empty.png' })
await page.getByTestId('tab-economy').click()
await page.waitForTimeout(200)
await page.getByTestId('starter-kit').click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'docs/playtest/20-cargo-starter.png' })
const kit = await page.evaluate(() => {
  const g = (window as unknown as { __hatch?: { fits: unknown[]; startFocus: string; tiles: string[][] } }).__hatch!
  let guard = 0
  let shed = 0
  for (const row of g.tiles) for (const t of row) {
    if (t === 'guard') guard++
    if (t === 'cargo') shed++
  }
  return { fits: g.fits.length, focus: g.startFocus, guard, shed }
})
console.log('cargo kit', kit)
const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
if (await close.isVisible().catch(() => false)) await close.click()
await page.getByRole('button', { name: /^5x$/ }).click()
const fps = await page.evaluate(
  new Function(
    'ms',
    `return new Promise((resolve) => {
      let frames = 0
      const start = performance.now()
      const step = (now) => {
        frames += 1
        if (now - start < ms) requestAnimationFrame(step)
        else resolve(Math.round((frames * 1000) / (now - start)))
      }
      requestAnimationFrame(step)
    })`,
  ) as (ms: number) => Promise<number>,
  2500,
)
console.log('fps', fps, 'errors', errors)
await page.waitForTimeout(8000)
await page.screenshot({ path: 'docs/playtest/22-cargo-5x.png' })
await browser.close()

/**
 * Art-pass apron shots. Dev server on :45217.
 *   npx tsx scripts/artpass-shots.mts before|after
 * Writes docs/devlog/media/artpass/<tag>-overview.png and <tag>-close.png.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const tag = process.argv[2] ?? 'after'
const outDir = 'docs/devlog/media/artpass'
mkdirSync(outDir, { recursive: true })
const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto('http://127.0.0.1:45217/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'high')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: object }).__hatch))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForFunction(
  () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
)
const gotIt = page.getByRole('button', { name: 'Got it' })
if (await gotIt.count()) await gotIt.click().catch(() => {})

await page.evaluate(() => {
  const g = (window as unknown as { __hatch: { tiles: string[][]; camGoal: object | null } }).__hatch
  let c = 0
  let r = 0
  let n = 0
  for (let rr = 0; rr < g.tiles.length; rr++) {
    for (let cc = 0; cc < g.tiles[rr].length; cc++) {
      if (g.tiles[rr][cc] !== 'runway') continue
      c += cc
      r += rr
      n++
    }
  }
  g.camGoal = { view: 'apron', c: n ? Math.round(c / n) : 16, r: n ? Math.round(r / n) : 12, seq: 1 }
})
await page.waitForTimeout(800)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})
const canvas = page.locator('canvas.field')
const box = await canvas.boundingBox()
if (box) await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55)
await page.waitForTimeout(2200)
await page.screenshot({ path: `${outDir}/${tag}-overview.png` })
if (box) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55)
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -280)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/${tag}-close.png` })
console.log(`wrote ${outDir}/${tag}-overview.png and ${tag}-close.png`)
await browser.close()

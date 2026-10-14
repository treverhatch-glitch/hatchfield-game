/**
 * Check-in and security interior stills. Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 * Usage: SHOT_TAG=after npx tsx scripts/hall-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.argv[2] || process.env.SHOT_TAG || 'after'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.evaluate(call('window.__hatch.speed = 8'))
for (let i = 0; i < 400; i++) {
  const ok = await page.evaluate(
    call(`const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.flights.some((f) => f.phase === 'boarding' || f.phase === 'servicing' || f.phase === 'deboard')`),
  )
  if (ok) break
  await page.waitForTimeout(400)
}
await page.waitForTimeout(8000)
await page.evaluate(call('window.__hatch.speed = 1; window.__hatch.setView("hall")'))
await page.evaluate(
  call(`const g = window.__hatch
    const fit = g.fits[0]
    const cell = g.zoneCellsOf(fit, 'security')[0] ?? g.zoneCellsOf(fit, 'checkin')[0]
    if (cell) g.camGoal = { view: 'hall', c: cell.c, r: cell.r, seq: (g.camGoal?.seq ?? 0) + 1 }
    return JSON.stringify(cell)`),
)
await page.waitForTimeout(1500)
await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas.hall-canvas { visibility: visible !important }' })
const box = await page.locator('canvas.hall-canvas').boundingBox()
if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.screenshot({ path: `${OUT}/HALL-overview-${TAG}.png` })
for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -160)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/HALL-zoom-${TAG}.png` })
console.log('errors', errors.slice(0, 8))
await browser.close()

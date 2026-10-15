/**
 * One parked Brisa narrowbody for the livery art pass.
 * Dev server on :45217. Writes docs/devlog/media/artpass/livery-brisa-apron.png
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

mkdirSync('docs/devlog/media/artpass', { recursive: true })
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
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { showStarterKit?: () => boolean } }).__hatch))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForFunction(
  () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
)
const spawned = await page.evaluate(() => {
  const g = (window as unknown as {
    __hatch: {
      clock: number
      signed: string[]
      schedule: { id: string; airline: string; eta: number; status: string; airframeId?: string }[]
      flights: { airline: string; x: number; y: number; airframeId?: string; stand?: unknown }[]
      seedScheduleForAirline: (id: string, n: number) => void
      trySpawn: () => void
      camGoal: object | null
    }
  }).__hatch
  g.signed = ['brisa']
  g.seedScheduleForAirline('brisa', 1)
  const slot = g.schedule.find((s) => s.airline === 'brisa')
  if (!slot) return 'no-slot'
  slot.eta = g.clock - 1
  slot.status = 'scheduled'
  g.trySpawn()
  const live = g.flights.find((f) => f.airline === 'brisa')
  if (!live) return 'no-flight'
  g.camGoal = { view: 'apron', c: Math.round(live.x), r: Math.round(live.y), seq: 1 }
  return live.airframeId ?? 'spawned'
})
console.log('spawn', spawned)
await page.waitForTimeout(1500)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})
const canvas = page.locator('canvas.field')
const box = await canvas.boundingBox()
if (box) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55)
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -240)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: 'docs/devlog/media/artpass/livery-brisa-apron.png' })
console.log('wrote livery-brisa-apron.png')
await browser.close()

/**
 * Before/after stills for the Grok livery plates.
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const PLATES = ['bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo'] as const

function call(body: string) {
  return new Function(body) as () => unknown
}

async function aimFlight(page: Page) {
  await page.evaluate(
    call(`const g = window.__hatch
      const f = g.flights.find((f) => f.stand) ?? g.flights[0]
      if (!f) return null
      g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
      return f.airframeId`),
  )
  await page.waitForTimeout(700)
}

async function zoom(page: Page, steps: number) {
  const canvas = page.locator('canvas.field')
  const box = await canvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, -160)
  await page.waitForTimeout(200)
}

async function orbit(page: Page) {
  const canvas = page.locator('canvas.field')
  const box = await canvas.boundingBox()
  if (!box) return
  const x = box.x + box.width * 0.55
  const y = box.y + box.height * 0.45
  await page.mouse.move(x, y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x - 80, y + 40, { steps: 8 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(300)
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'low')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.evaluate(call('window.__hatch.speed = 5'))
for (let i = 0; i < 80; i++) {
  const parked = await page.evaluate(
    call(`const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.flights.some((f) => f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding' || f.phase === 'parked')`),
  )
  if (parked) break
  await page.waitForTimeout(400)
}
await page.evaluate(call('window.__hatch.speed = 0'))
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})
await aimFlight(page)
await zoom(page, 10)
await orbit(page)
const hook = await page.evaluate(call(`return typeof window.__liveryPreview`))
if (hook !== 'function') throw new Error(`__liveryPreview missing (${hook})`)
await page.evaluate(call(`window.__liveryPreview('off')`))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/LIVERY-before.png` })

for (const id of PLATES) {
  await page.evaluate(
    new Function('id', `window.__liveryPreview(id)`) as (id: string) => void,
    id,
  )
  await page.waitForFunction(
    new Function('id', `return window.__liveryReady && window.__liveryReady(id)`) as (id: string) => boolean,
    id,
    { timeout: 8000 },
  )
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/LIVERY-after-${id}.png` })
}
console.log('errors', errors.slice(0, 8))
await browser.close()

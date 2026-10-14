/**
 * Before/after stills for the Gemini art wiring: apron ground (Low flat vs Medium photos) and
 * four roster liveries on the parked aircraft.
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const AIRLINES = ['alpine_swift', 'atlas_cargo', 'andaman_hop', 'aurora_nordic'] as const

function call(body: string) {
  return new Function(body) as () => unknown
}

async function setup(page: Page, gfx: string) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    new Function('gfx', `localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', gfx)`) as (g: string) => void,
    gfx,
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.evaluate(call('window.__hatch.speed = 8'))
  for (let i = 0; i < 300; i++) {
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
  await page.evaluate(
    call(`const g = window.__hatch
      const f = g.flights.find((f) => f.stand) ?? g.flights[0]
      if (!f) return null
      g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
      return f.airframeId`),
  )
  await page.waitForTimeout(800)
  console.log(gfx, await page.evaluate(call(`const g = window.__hatch; return JSON.stringify({ n: g.flights.length, ph: g.flights.map((f) => f.phase + ':' + (f.stand ? 's' : '-')), cam: g.camGoal })`)))
}

async function zoom(page: Page, steps: number) {
  const box = await page.locator('canvas.field').boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, -160)
  await page.waitForTimeout(300)
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const errors: string[] = []

// Apron ground: Low keeps flat rasters, Medium swaps in the Gemini photos.
for (const [gfx, name] of [['low', 'before'], ['med', 'after']] as const) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (err) => errors.push(err.message))
  await setup(page, gfx)
  await zoom(page, 6)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/ART-apron-${name}.png` })
  if (gfx === 'med') {
    await zoom(page, 5)
    await page.screenshot({ path: `${OUT}/ART-apron-gse-after.png` })
    for (const id of AIRLINES) {
      await page.evaluate(new Function('id', `window.__rosterPreview(id)`) as (id: string) => void, id)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/ART-livery-${id}.png` })
    }
  } else {
    await zoom(page, 5)
    await page.screenshot({ path: `${OUT}/ART-apron-gse-before.png` })
    await page.screenshot({ path: `${OUT}/ART-livery-before.png` })
  }
  await page.close()
}
console.log('errors', errors.slice(0, 8))
await browser.close()

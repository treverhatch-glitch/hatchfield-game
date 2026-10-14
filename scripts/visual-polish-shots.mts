/**
 * Issue 193: apron screenshots and FPS for the visual polish pass.
 * Needs the dev server (the `__hatch` probe is dev-only): `npx vite --port 45217`, then `npx tsx scripts/visual-polish-shots.mts before|after [low|med|high]`.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const TAG = process.argv[2] ?? 'after'
const GFX = process.argv[3] ?? ''
const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function call(body: string) {
  return new Function(body) as () => unknown
}

async function fps(page: Page, ms = 3000): Promise<{ min: number; avg: number }> {
  return page.evaluate(
    new Function(
      'duration',
      `return new Promise((resolve) => {
        const gaps = []
        const start = performance.now()
        let last = start
        const step = (now) => {
          gaps.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(step)
          else {
            const worst = Math.max(...gaps.slice(1))
            resolve({ min: Math.round(1000 / worst), avg: Math.round((gaps.length * 1000) / (now - start)) })
          }
        }
        requestAnimationFrame(step)
      })`,
    ) as (duration: number) => Promise<{ min: number; avg: number }>,
    ms,
  )
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  new Function(
    'gfx',
    `localStorage.clear(); sessionStorage.clear(); if (gfx) localStorage.setItem('hatchfield-gfx', gfx)`,
  ) as (gfx: string) => void,
  GFX,
)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.getByTestId('tab-economy').click()

// Sign the first contract and run until an aircraft is parked on a stand.
await page.evaluate(call('window.__hatch.speed = 5'))
for (let i = 0; i < 120; i++) {
  const parked = await page.evaluate(
    call(`
      const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.flights.some((f) => f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding')
    `),
  )
  if (parked) break
  await page.waitForTimeout(500)
}
// Freeze the turn so the aircraft is still on stand for every shot (rendering keeps running).
await page.evaluate(call('window.__hatch.speed = 0'))
// Point the camera at the first aircraft on the ground.
const aimAtAircraft = call(`
  const g = window.__hatch
  const f = g.flights.find((f) => f.stand) ?? g.flights[0]
  if (f) g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
`)
await page.evaluate(aimAtAircraft)
await page.waitForTimeout(1500)
// Hide the HUD for the shots only, so the panels do not cover the apron.
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})
const canvas = page.locator('canvas.field')
const box = await canvas.boundingBox()
if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

const rate = await fps(page)
console.log(TAG, GFX || 'auto', 'overview fps', JSON.stringify(rate))
await page.screenshot({ path: `${OUT}/ISSUE-193-${TAG}-overview.png` })

await page.evaluate(aimAtAircraft)
for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -200)
await page.waitForTimeout(1500)
console.log(TAG, GFX || 'auto', 'close fps', JSON.stringify(await fps(page)))
await page.screenshot({ path: `${OUT}/ISSUE-193-${TAG}-close.png` })

// Ground vehicles: aim at the first service vehicle or road truck.
const vehicle = await page.evaluate(
  call(`
    const g = window.__hatch
    const f = g.flights.find((f) => f.stand) ?? g.flights[0]
    const all = [...g.servicePoses(), ...g.trucks]
    const d = (v) => (f ? Math.hypot(v.x - f.x, v.y - f.y) : 0)
    const v = all.sort((a, b) => d(a) - d(b))[0]
    if (!v) return null
    g.camGoal = { view: 'apron', c: Math.round(v.x), r: Math.round(v.y), seq: (g.camGoal?.seq ?? 0) + 1 }
    return v.type ?? v.kind
  `),
)
if (vehicle) {
  await page.waitForTimeout(1500)
  console.log(TAG, 'vehicle', vehicle)
  await page.screenshot({ path: `${OUT}/ISSUE-193-${TAG}-vehicle.png` })
}

for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 200)
await page.evaluate(call('window.__hatch.speed = 5'))
await page.waitForTimeout(12000)
console.log(TAG, GFX || 'auto', '5x fps', JSON.stringify(await fps(page)))
await page.evaluate(call('window.__hatch.speed = 1'))
await page.screenshot({ path: `${OUT}/ISSUE-193-${TAG}-later.png` })
await browser.close()

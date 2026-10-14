/**
 * Before/after stills for the wired terminal, vehicle, and livery art.
 * Start a dev server, then:
 *   SHOT_URL=http://127.0.0.1:45217 SHOT_TAG=after npx tsx scripts/art-wire-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { ROSTER } from '../src/airlines/roster.ts'

const OUT = 'docs/screens/art-wire'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.env.SHOT_TAG || 'after'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function call(body: string) {
  return new Function(body) as () => unknown
}

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high'); localStorage.setItem('hatchfield-texture-quality', 'high')`),
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  const dock = page.getByTestId('starter-kit-dock')
  if (await dock.count()) await dock.click({ timeout: 15000 })
  else await page.evaluate(call('window.__hatch.buildStarterKit()'))
  await page.evaluate(call('window.__hatch.speed = 8'))
  for (let i = 0; i < 400; i++) {
    const ready = await page.evaluate(
      call(`const g = window.__hatch
        if (g.offer && g.signed.length === 0) g.acceptOffer()
        return g.flights.some((f) => f.stand && (f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding' || f.phase === 'parked'))`),
    )
    if (ready) break
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(2500)
  await page.evaluate(call('window.__hatch.speed = 0'))
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await boot(page)

await page.evaluate(call(`window.__hatch.setView("hall")`))
await page.evaluate(
  call(`const g = window.__hatch
    const fit = g.fits[0]
    const cell = g.zoneCellsOf(fit, 'checkin')[0] ?? g.zoneCellsOf(fit, 'security')[0]
    if (cell) g.camGoal = { view: 'hall', c: cell.c, r: cell.r, seq: (g.camGoal?.seq ?? 0) + 1 }
    return true`),
)
await page.waitForTimeout(1600)
await page.evaluate(
  call(`const h = window.__hall
    if (!h) return
    h.dist = 12
    h.pitch = 0.95
    h.placeCam()`),
)
await page.waitForTimeout(1500)
await page.locator('canvas.hall-canvas').screenshot({ path: `${OUT}/${TAG}-hall.png` })

await page.evaluate(call(`window.__hatch.setView("apron")`))
const airframe = await page.evaluate(
  call(`const g = window.__hatch
    const f = g.flights.find((f) => f.stand) ?? g.flights[0]
    if (!f) return ''
    g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
    return f.airframeId || ''`),
)
await page.waitForTimeout(1200)
await page.evaluate(
  call(`const w = window.__world
    if (!w) return
    w.followHeld = false
    w.dist = 28
    w.pitch = 0.55
    w.placeCam()`),
)
await page.waitForTimeout(800)
await page.locator('canvas.field').screenshot({ path: `${OUT}/${TAG}-apron.png` })

const airline = ROSTER.find((row) => airframe && row.fleet.includes(String(airframe))) ?? ROSTER.find((row) => row.fleet.includes('a320neo'))
if (airline && typeof airframe === 'string') {
  await page.evaluate(
    new Function('id', `if (typeof window.__rosterPreview === 'function') window.__rosterPreview(id)`) as (id: string) => void,
    airline.id,
  )
  await page.waitForTimeout(700)
  await page.evaluate(
    call(`const w = window.__world
      if (!w) return
      w.followHeld = false
      w.dist = 16
      w.pitch = 0.28
      w.yaw += 1.15
      w.placeCam()`),
  )
  await page.waitForTimeout(900)
  await page.locator('canvas.field').screenshot({ path: `${OUT}/${TAG}-livery.png` })
  console.log(TAG, 'livery', airline.id, 'on', airframe)
}

console.log(TAG, 'errors', errors.slice(0, 6))
await browser.close()

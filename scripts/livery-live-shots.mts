/**
 * Stills of painted aircraft from a running game.
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 *
 * Each shot retargets one parked flight onto that carrier and airframe, then
 * waits for the real paint path (photographed plate or procedural roster livery).
 * It does not use the livery preview override.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media/liveries'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'

const SHOTS: { file: string; airline: string; airframe: string; plate: string | null }[] = [
  { file: 'bushline', airline: 'bushline', airframe: 'bn2', plate: 'bushline' },
  { file: 'zoomjet', airline: 'zoomjet', airframe: 'b738', plate: 'zoomjet' },
  { file: 'crown', airline: 'crown', airframe: 'b77w', plate: 'crown' },
  { file: 'siam-breeze-plate', airline: 'siam_breeze', airframe: 'b789', plate: 'siam_breeze' },
  { file: 'northstar-cargo-plate', airline: 'northstar_cargo', airframe: 'b752f', plate: 'northstar_cargo' },
  { file: 'puddle-jumper', airline: 'air_regional_1', airframe: 'crj700', plate: null },
  { file: 'skycheap', airline: 'air_lowcost_1', airframe: 'b738', plate: null },
  { file: 'prestige-air', airline: 'air_fullservice_1', airframe: 'b789', plate: null },
  { file: 'national-airways', airline: 'air_flag_1', airframe: 'a359', plate: null },
  { file: 'heavylift', airline: 'air_cargo_1', airframe: 'b752f', plate: null },
]

function call(body: string) {
  return new Function(body) as () => unknown
}

async function frameAircraft(page: Page) {
  await page.evaluate(
    call(`const g = window.__hatch
      const w = window.__world
      const f = g.flights.find((row) => row.stand) ?? g.flights[0]
      if (!f || !w) return false
      g.setView('apron')
      g.speed = 0
      // Face noon. A new game starts at midnight, which hides the paint.
      g.clock = 90
      w.setTimeOfDay(12)
      const CELL = 22 * 0.45
      const half = (g.tiles.length - 1) / 2
      const tx = (f.x - half) * CELL
      const tz = (f.y - half) * CELL
      const lock = { cx: tx + 18, cy: 14, cz: tz + 22, tx, ty: 3, tz }
      if (!w.__liveryWrapped) {
        const gl = w.renderer.render.bind(w.renderer)
        w.renderer.render = function (scene, camera) {
          const l = w.__liveryLock
          if (l) {
            w.camera.position.set(l.cx, l.cy, l.cz)
            w.camera.lookAt(l.tx, l.ty, l.tz)
            w.camera.updateMatrixWorld()
          }
          return gl(scene, camera)
        }
        w.__liveryWrapped = true
      }
      w.__liveryLock = lock
      return true`),
  )
  await page.waitForTimeout(600)
}

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'low'); localStorage.setItem('hatchfield-texture-quality', 'high')`),
)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(call(`return Boolean(window.__hatch && window.__hatch.site)`), null, { timeout: 20000 })
const kit = page.getByTestId('starter-kit-coach')
if (await kit.count()) await kit.click()
else await page.evaluate(call(`window.__hatch.buildStarterKit()`))
await page.waitForFunction(call(`return !window.__hatch.showStarterKit()`), null, { timeout: 20000 })
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.evaluate(call('window.__hatch.speed = 8'))
for (let i = 0; i < 100; i++) {
  const parked = await page.evaluate(
    call(`const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.flights.some((f) => f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding' || f.phase === 'parked' || f.phase === 'board')`),
  )
  if (parked) break
  await page.waitForTimeout(400)
}
await page.evaluate(call('window.__hatch.speed = 0'))
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})

for (const shot of SHOTS) {
  const posed = await page.evaluate(
    new Function(
      'shot',
      `const g = window.__hatch
       const f = g.flights.find((row) => row.stand) ?? g.flights[0]
       if (!f) return false
       f.airline = shot.airline
       f.airframeId = shot.airframe
       f.phase = 'parked'
       g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
       return true`,
    ) as (shot: { airline: string; airframe: string }) => boolean,
    { airline: shot.airline, airframe: shot.airframe },
  )
  if (!posed) throw new Error(`no flight to paint for ${shot.file}`)
  if (shot.plate) {
    await page.waitForFunction(
      new Function('id', `return window.__liveryReady && window.__liveryReady(id)`) as (id: string) => boolean,
      shot.plate,
      { timeout: 8000 },
    )
  }
  await page.waitForTimeout(shot.plate ? 600 : 1000)
  await frameAircraft(page)
  await page.screenshot({ path: `${OUT}/${shot.file}.png` })
  console.log('wrote', shot.file)
}
console.log('errors', errors.slice(0, 8))
await browser.close()

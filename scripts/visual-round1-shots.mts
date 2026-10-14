/**
 * Visual round 1 stills and a heavy-field frame-rate sample.
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45217`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
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

async function aim(page: Page, tile: string) {
  await page.evaluate(
    new Function(
      'tile',
      `const g = window.__hatch
       let hit = null
       for (let r = 0; r < g.tiles.length && !hit; r++) {
         for (let c = 0; c < g.tiles[r].length; c++) {
           if (g.tiles[r][c] === tile) { hit = { c, r }; break }
         }
       }
       if (hit) g.camGoal = { view: 'apron', c: hit.c, r: hit.r, seq: (g.camGoal?.seq ?? 0) + 1 }
       return hit`,
    ) as (tile: string) => unknown,
    tile,
  )
  await page.waitForTimeout(700)
}

async function aimCell(page: Page, c: number, r: number) {
  await page.evaluate(
    new Function(
      'cell',
      `const g = window.__hatch
       g.camGoal = { view: 'apron', c: cell.c, r: cell.r, seq: (g.camGoal?.seq ?? 0) + 1 }`,
    ) as (cell: { c: number; r: number }) => void,
    { c, r },
  )
  await page.waitForTimeout(700)
}

async function orbit(page: Page, dx: number, dy: number) {
  const canvas = page.locator('canvas.field')
  const box = await canvas.boundingBox()
  if (!box) return
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x + dx, y + dy, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(350)
}

async function zoom(page: Page, steps: number, delta: number) {
  const canvas = page.locator('canvas.field')
  const box = await canvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < steps; i++) await page.mouse.wheel(0, delta)
  await page.waitForTimeout(400)
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
await page.getByTestId('tab-economy').click()
await page.evaluate(call('window.__hatch.speed = 5'))
for (let i = 0; i < 80; i++) {
  const parked = await page.evaluate(
    call(`const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.flights.some((f) => f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding')`),
  )
  if (parked) break
  await page.waitForTimeout(400)
}
await page.evaluate(call('window.__hatch.speed = 0'))
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})

await aim(page, 'runway')
await zoom(page, 2, 180)
const wide = await fps(page, 2500)
console.log('starter wide fps', JSON.stringify(wide))
await page.screenshot({ path: `${OUT}/ROUND1-overview.png` })

await aim(page, 'runway')
await zoom(page, 6, -160)
await page.screenshot({ path: `${OUT}/ROUND1-runway.png` })

await aim(page, 'taxi')
await zoom(page, 2, -80)
await page.screenshot({ path: `${OUT}/ROUND1-taxi.png` })

await aim(page, 'stand')
await zoom(page, 3, -120)
await page.screenshot({ path: `${OUT}/ROUND1-stand.png` })

const roadCell = await page.evaluate(
  call(`const g = window.__hatch
    const rows = g.tiles.length
    const cols = g.tiles[0].length
    const road = (c, r) => g.tiles[r] && g.tiles[r][c] === 'road'
    let hit = null
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!road(c, r)) continue
        const stretch = road(c + 1, r) || road(c - 1, r) || road(c, r + 1) || road(c, r - 1)
        if (!stretch) continue
        hit = { c, r }
      }
    }
    return hit`),
)
console.log('road cell', roadCell)
if (roadCell && typeof roadCell === 'object') {
  const cell = roadCell as { c: number; r: number }
  await aimCell(page, cell.c, cell.r)
}
await zoom(page, 8, -180)
await orbit(page, 40, 70)
await page.screenshot({ path: `${OUT}/ROUND1-road.png` })

const aimed = await page.evaluate(
  call(`const g = window.__hatch
    const f = g.flights.find((f) => f.stand) ?? g.flights[0]
    if (f) g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
    return f ? f.airframeId : null`),
)
console.log('aircraft', aimed)
await page.waitForTimeout(600)
await zoom(page, 14, -180)
await orbit(page, -30, 90)
await page.screenshot({ path: `${OUT}/ROUND1-aircraft.png` })

const vehicle = await page.evaluate(
  call(`const g = window.__hatch
    const want = ['fuel', 'fuel_truck', 'baggage_tug', 'catering_truck', 'pushback_tug', 'pax_bus', 'belt_loader']
    const all = [...g.servicePoses(), ...g.trucks]
    const v = all.find((t) => want.includes(t.type) || want.includes(t.kind)) ?? all[0]
    if (!v) return null
    g.camGoal = { view: 'apron', c: Math.round(v.x), r: Math.round(v.y), seq: (g.camGoal?.seq ?? 0) + 1 }
    return v.type ?? v.kind`),
)
console.log('vehicle', vehicle)
if (vehicle) {
  await page.waitForTimeout(600)
  await zoom(page, 12, -180)
  await orbit(page, 20, 80)
  await page.screenshot({ path: `${OUT}/ROUND1-vehicle.png` })
}

const clock = await page.evaluate(call('return window.__hatch.clock'))
await page.evaluate(call('window.__hatch.clock = 150'))
await aim(page, 'taxi')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/ROUND1-taxi-night.png` })
await page.evaluate(new Function('clock', 'window.__hatch.clock = clock') as (clock: number) => void, clock as number)

// Heavy field: extra runway, carriers, then a short 5× soak. Same renderer the bot uses.
await page.evaluate(
  call(`const g = window.__hatch
    g.cash += 3000000
    g.reputation = 70
    g.fieldXp = 700
    g.researchPoints = 4000
    for (let c = 8; c < 28; c++) { g.tiles[26][c] = 'runway'; g.tiles[27][c] = 'runway' }
    for (let c = 4; c < 18; c++) g.tiles[7][c] = 'taxi'
    for (let r = 7; r <= 22; r++) g.tiles[r][8] = 'taxi'
    g.bumpMap()
    const all = g.allAirlines()
    for (const a of all.filter((a) => a.kind !== 'cargo').slice(0, 4)) {
      if (!g.signed.includes(a.id)) { g.offer = { airline: a.id }; g.acceptOffer() }
    }
    g.speed = 5`),
)
await page.waitForTimeout(10000)
await aim(page, 'runway')
await zoom(page, 3, 220)
const heavySamples: number[] = []
for (let i = 0; i < 3; i++) {
  const sample = await fps(page, 1000)
  heavySamples.push(sample.avg)
}
const heavy = await fps(page, 3000)
console.log('heavy fps', JSON.stringify(heavy), 'bot samples', JSON.stringify(heavySamples), 'bot min', Math.min(...heavySamples))
await page.screenshot({ path: `${OUT}/ROUND1-heavy.png` })
console.log('errors', errors.slice(0, 8))
await browser.close()

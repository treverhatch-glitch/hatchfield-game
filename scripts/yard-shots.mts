/** Service-yard interactions: screenshots + a short clip (webm). */
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const BASE = process.env.URL || 'http://127.0.0.1:45219/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const vidDir = `${OUT}/_vid`
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: vidDir, size: { width: 1280, height: 800 } } })
const page = await ctx.newPage()
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {})
const ev = <T,>(src: string) => page.evaluate(new Function(src) as () => T)

// Stage a service row on open grass: each building gets returning trucks that the yard queues and docks.
const row = await ev<{ c: number; r: number } | null>(`
  const g = window.__hatch
  for (let r = 4; r < 28; r++) for (let c = 2; c < 12; c++) {
    let ok = true
    for (let dr = -1; dr <= 2; dr++) for (let dc = 0; dc < 18; dc++) if (g.tile({c:c+dc,r:r+dr}) !== 'grass') ok = false
    if (ok) return {c, r}
  }
  return null`)
if (!row) throw new Error('no grass row')
const B = { fuel: 0, cargo: 3, snack: 6, bags: 9, deice: 12, fire: 15 }
await ev(`
  const g = window.__hatch
  g.cash = 5e6
  const R = ${row.r}, C = ${row.c}
  const B = ${JSON.stringify(B)}
  for (const [t, dc] of Object.entries(B)) g.tiles[R][C + dc] = t
  for (let dc = -1; dc < 19; dc++) if (g.tiles[R + 1][C + dc] === 'grass') g.tiles[R + 1][C + dc] = 'road'
  g.mapRev++
  g.syncYard()
  window.__yardFeed = () => {
    const home = (kind, dc, n, mission) => {
      const at = { c: C + dc, r: R }
      const have = g.trucks.filter((t) => t.kind === kind && t.home && t.home.c === at.c).length
      for (let i = have; i < n; i++) {
        g.spawnTruck(kind, null, [{ c: at.c - 1 - i * 0.4, r: R + 1 }, at], mission, at)
        const t = g.trucks[g.trucks.length - 1]
        t.preDwell = 0; t.returning = true; t.seg = 1; t.x = at.c; t.y = R + 0.9; t.cargoUnits = 30
      }
    }
    home('fuel', B.fuel, 3, 'fuel')
    home('citycargo', B.cargo, 2, 'city_shed')
    home('catering', B.snack, 2, 'cater')
    home('bags', B.bags, 4, 'sort_inbound')
    home('deice', B.deice, 2, 'deice')
    if (!g.trucks.some((t) => t.kind === 'fire')) g.spawnTruck('fire', null, [{ c: C + B.fire, r: R }, { c: C + B.fire, r: R + 1 }, { c: C + B.fire - 3, r: R + 1 }], 'patrol', { c: C + B.fire, r: R })
  }
  window.__yardFeed()
  g.speed = 1
`)
for (const n of ['Walk', 'Close', 'Refuse']) for (let i = 0; i < 3; i++) await page.getByRole('button', { name: n, exact: true }).first().click({ timeout: 800 }).catch(() => {})
const canvas = page.locator('canvas').first()
const bb = (await canvas.boundingBox())!
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(80) }
const focus = async (dc: number, name: string, wait = 2600) => {
  await ev(`const g = window.__hatch; window.__yardFeed(); g.camGoal = { view: 'apron', c: ${row.c + dc}, r: ${row.r + 0.4}, seq: ${Math.floor(Math.random() * 1e9)} }`)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}/yard-${name}.png` })
  const st = await ev<string>(`const g = window.__hatch; return JSON.stringify(g.yard.keys().map(k => [g.yard.tileOf(k), g.yard.occupancy(k), g.yard.queueLength(k), g.yard.served(k)]))`)
  console.log(name, st)
}
await page.waitForTimeout(1500)
await focus(B.fuel, 'fuel-hoses')
await focus(B.cargo, 'cargo-backin')
await focus(B.snack, 'catering-lift')
await focus(B.bags, 'bags-doors')
await focus(B.deice, 'deice-pad')
await ev(`const g = window.__hatch; for (const t of g.trucks) if (t.kind === 'fire') g.yard.forget(t.id); g.trucks = g.trucks.filter(t => t.kind !== 'fire')`)
await focus(B.fire, 'fire-bay', 400)
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/yard-fire-bay-open.png` })
await focus(B.cargo, 'cargo-backin-2', 3000)
await ctx.close()
const vids = readdirSync(vidDir).filter((f) => f.endsWith('.webm'))
if (vids[0]) renameSync(`${vidDir}/${vids[0]}`, `${OUT}/yard-interactions.webm`)
await browser.close()

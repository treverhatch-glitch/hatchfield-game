/** Round A in-game check: park one of every truck kind on the apron and screenshot it. */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://127.0.0.1:45391/'
const OUT = process.env.OUT || '/workspace/shots/veh-a-ingame.png'
const CHROME = '/usr/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.setDefaultTimeout(300000)
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click().catch(() => {})
await page.getByTestId('starter-kit').click().catch(() => {})
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {})
await page.waitForTimeout(3000)
const at = await page.evaluate(() => {
  const g = (window as any).__hatch
  const rows = g.tiles.length, cols = g.tiles[0].length
  let spot: { c: number; r: number } | null = null
  for (let r = 3; r < rows - 3 && !spot; r++) for (let c = 3; c < cols - 24 && !spot; c++) {
    let ok = true
    for (let dc = 0; dc < 20 && ok; dc++) for (let dr = 0; dr < 3; dr++) if (g.tiles[r + dr][c + dc] !== 'grass') { ok = false; break }
    if (ok) spot = { c, r }
  }
  if (!spot) return null
  const kinds = ['fuel', 'bags', 'catering', 'deice', 'termbus', 'citycargo', 'coach', 'fire', 'tow', 'delivery']
  kinds.forEach((k, i) => {
    const p = { c: spot!.c + 1 + i * 1.9, r: spot!.r + 1 + (i % 2) * 0.9 }
    g.spawnTruck(k, null, [p, { c: p.c + 0.01, r: p.r }], 'patrol', null)
    const t = g.trucks[g.trucks.length - 1]
    t.preDwell = 1e9; t.x = p.c; t.y = p.r
  })
  g.focusAt({ view: 'apron', cells: [{ c: spot.c + 9, r: spot.r + 1 }] })
  return spot
})
console.log('spot', at)
await page.getByRole('button', { name: 'Walk' }).click().catch(() => {})
await page.getByRole('button', { name: 'Refuse' }).click().catch(() => {})
await page.getByRole('button', { name: '5x' }).first().click().catch(() => {})
// Let the starter field run so real service traffic is on the apron, then follow the busiest spot.
let kinds: string[] = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(8000)
  kinds = await page.evaluate(() => {
    const g = (window as any).__hatch
    const ts = g.trucks.filter((t: any) => t.preDwell !== 1e9)
    const ps = g.servicePoses?.() ?? []
    const all = [...ts.map((t: any) => ({ k: t.kind, c: t.x, r: t.y })), ...ps.map((p: any) => ({ k: p.type, c: p.x, r: p.y }))]
    if (all.length) {
      const pick = all[Math.floor(all.length / 2)]
      g.focusAt({ view: 'apron', cells: [{ c: Math.round(pick.c), r: Math.round(pick.r) }] })
    }
    return all.map((a: any) => a.k)
  })
  if (new Set(kinds).size >= 3) break
}
console.log('kinds', kinds.join(','))
await page.getByRole('button', { name: 'Pause' }).first().click().catch(() => {})
await page.waitForTimeout(3000)
await page.mouse.move(800, 500)
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(300) }
await page.waitForTimeout(3000)
await page.screenshot({ path: OUT })
await browser.close()

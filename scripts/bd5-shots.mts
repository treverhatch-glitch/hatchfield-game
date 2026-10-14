/**
 * Round-4 building detail: in-game before/after stills + a yard clip.
 *   URL=http://127.0.0.1:45302/ PREFIX=bd4-after npx tsx scripts/bd4-shots.mts
 * Stages a service row (fuel, cargo, snack, bags, de-ice, fire, hangar, bus kerb)
 * on open grass, feeds it vehicles, and shoots day + night close-ups, the
 * placement ghost and the build-menu icons. Offers are suppressed so no panel
 * covers the field; the fire bay is framed from further out.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || '/workspace/shots'
const PREFIX = process.env.PREFIX || 'bd4'
const CLIP = process.env.CLIP || ''
mkdirSync(OUT, { recursive: true })
const BASE = process.env.URL || 'http://127.0.0.1:45302/'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const vidDir = `${OUT}/_vid_${PREFIX}`
rmSync(vidDir, { recursive: true, force: true })
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  ...(CLIP ? { recordVideo: { dir: vidDir, size: { width: 1600, height: 900 } } } : {}),
})
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
const ev = <T,>(src: string) => page.evaluate(new Function(src) as () => T)
// No airline letters / counters during the shoot: they cover the right of the field.
const quiet = `const g = window.__hatch; g.offer = null; g.offerCool = 1e9; g.mxOffer = null; g.mxOfferCool = 1e9;`
await ev(quiet)
const dismiss = async () => {
  for (const n of ['Walk', 'Close', 'Refuse', 'Got it']) {
    const b = page.getByRole('button', { name: n, exact: true })
    for (let i = 0; i < Math.min(4, await b.count()); i++) await b.nth(0).click({ timeout: 400 }).catch(() => {})
  }
}
await dismiss()

const row = await ev<{ c: number; r: number } | null>(`
  const g = window.__hatch
  const H = g.tiles.length, W = g.tiles[0].length
  for (let r = 3; r < H - 8; r++) for (let c = 2; c < W - 14; c++) {
    let ok = true
    for (let dr = -1; dr <= 8 && ok; dr++) for (let dc = -1; dc < 14; dc++) if (g.tile({c:c+dc,r:r+dr}) !== 'grass') { ok = false; break }
    if (ok) return {c, r}
  }
  return null`)
if (!row) throw new Error('no grass row')
// Two rows of four (row 2 sits 4 cells south). dc >= 20 means row 2 at dc - 20.
const B = { fuel: 0, cargo: 3, kitchen: 6, bags: 9, tower: 12, deice: 20, fire: 23, hangar: 26, bus: 30 }
const at = (dc: number) => (dc >= 20 ? { c: dc - 20, r: 4 } : { c: dc, r: 0 })
await ev(`
  ${quiet}
  g.cash = 5e6
  const R = ${row.r}, C = ${row.c}
  const B = ${JSON.stringify(B)}
  const at = (dc) => (dc >= 20 ? { c: dc - 20, r: 4 } : { c: dc, r: 0 })
  for (const [t, dc] of Object.entries(B)) { const p = at(dc); g.tiles[R + p.r][C + p.c] = t }
  for (const rr of [1, 5]) for (let dc = -1; dc < 14; dc++) if (g.tiles[R + rr][C + dc] === 'grass') g.tiles[R + rr][C + dc] = 'road'
  // Bus kerb sits on a loop: road both sides so coaches drive in and out.
  const bp = at(B.bus)
  for (let dr = 2; dr <= 5; dr++) for (const dx of [-1, 1]) if (g.tiles[R + dr][C + bp.c + dx] === 'grass') g.tiles[R + dr][C + bp.c + dx] = 'road'
  for (let dc = -1; dc < 14; dc++) if (g.tiles[R + 2][C + dc] === 'grass') g.tiles[R + 2][C + dc] = 'road'
  g.mapRev++
  g.syncYard()
  // Hangar tow demo: two tugs for one door, the second waits in the hangar lane.
  const hk = (C + at(B.hangar).c) + ',' + (R + at(B.hangar).r)
  if (g.tugJobs && g.yard.serves(hk, 'tow')) {
    g.tickTugs = function (step) { for (const id of [...this.tugJobs.keys()]) this.yard.step(id, step) }
    const spec = g.yard.spec(hk)
    for (const id of ['tug:demoA:in', 'tug:demoB:in', 'tug:demoC:in']) { g.yard.arrive(id, 'tow', hk, spec.queue[spec.queue.length - 1], 900); g.tugJobs.set(id, hk) }
  }
  window.__yardFeed = () => {
    ${quiet}
    const home = (kind, dc, n, mission) => {
      const p = at(dc)
      const cell = { c: C + p.c, r: R + p.r }
      const have = g.trucks.filter((t) => t.kind === kind && t.home && t.home.c === cell.c && t.home.r === cell.r).length
      for (let i = have; i < n; i++) {
        g.spawnTruck(kind, null, [{ c: cell.c - 1 - i * 0.4, r: cell.r + 1 }, cell], mission, cell)
        const t = g.trucks[g.trucks.length - 1]
        t.preDwell = 0; t.returning = true; t.seg = 1; t.x = cell.c; t.y = cell.r + 0.9; t.cargoUnits = 30
      }
    }
    home('fuel', B.fuel, 3, 'fuel')
    home('citycargo', B.cargo, 2, 'city_shed')
    home('catering', B.kitchen, 2, 'cater')
    home('bags', B.bags, 4, 'sort_inbound')
    home('deice', B.deice, 2, 'deice')
    if (g.tickCoaches) { g.coachClock = 0; g.tickCoaches() }
  }
  window.__yardFeed()
  g.speed = 1
`)
await dismiss()
const canvas = page.locator('canvas').first()
const bb = (await canvas.boundingBox())!
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(80) }
const zoom = async (n: number) => {
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
  for (let i = 0; i < Math.abs(n); i++) { await page.mouse.wheel(0, n > 0 ? 200 : -200); await page.waitForTimeout(80) }
}
const shot = async (dc: number, name: string, wait = 2600, dr = 0.4) => {
  const p = at(dc)
  await ev(`const g = window.__hatch; window.__yardFeed(); g.camGoal = { view: 'apron', c: ${row.c + p.c}, r: ${row.r + p.r + dr}, seq: ${Math.floor(Math.random() * 1e9)} }`)
  await page.waitForTimeout(wait)
  await dismiss()
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` })
  const st = await ev<string>(`const g = window.__hatch; return JSON.stringify(g.yard.keys().map(k => [g.yard.tileOf(k), g.yard.occupancy(k), g.yard.queueLength(k), g.yard.served(k)]))`)
  console.log(name, st)
}

const fps = async (label: string, ms = 5000) => {
  const r = await ev<{ fps: number; calls: number; tris: number }>(`return new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else { const w = window.__world; const i = w && w.renderer ? w.renderer.info.render : {}; res({ fps: +(n * 1000 / (performance.now() - t0)).toFixed(1), calls: i.calls || 0, tris: i.triangles || 0 }) } }; requestAnimationFrame(f) })`)
  console.log('FPS', label, JSON.stringify(r))
  return r
}
const setFx = async (p: string) => ev(`try { if (${JSON.stringify(p)} === 'auto') localStorage.removeItem('hatchfield-matfx'); else localStorage.setItem('hatchfield-matfx', ${JSON.stringify(p)}) } catch {} const w = window.__world; if (w && w.applyBuildingFx) w.applyBuildingFx(w.wr.quality); return 1`)
await page.waitForTimeout(2000)
if (process.env.FPS) {
  await zoom(3)
  await shot(6, 'fps-row', 2500, 2)
  const q = await ev<string>(`const w = window.__world; return w && w.wr ? w.wr.quality : '?'`)
  console.log('QUALITY', q)
  await fps('row-default')
  await setFx('on'); await page.waitForTimeout(1500); await fps('row-fx-on')
  await setFx('off'); await page.waitForTimeout(1500); await fps('row-fx-off')
  await setFx('auto'); await page.waitForTimeout(1500)
  await ev(`const g = window.__hatch; g.clock = Math.floor(g.clock / 180) * 180 + 180 * 0.86`)
  await page.waitForTimeout(1500); await fps('row-night-default')
  await ev(`const w = window.__world; if (w && w.lotLamps) w.lotLamps.setBudget(6); return 1`)
  await page.waitForTimeout(1500); await fps('row-night-lamps6')
  await ev(`const w = window.__world; if (w && w.lotLamps) w.lotLamps.setBudget(0); return 1`)
  await page.waitForTimeout(1500); await fps('row-night-lamps0')
  await browser.close()
  process.exit(0)
}
await shot(B.fuel, 'fuel-hose')
await shot(B.cargo, 'cargo')
await shot(B.kitchen, 'kitchen')
await shot(B.tower, 'tower')
await shot(B.bags, 'bags')
await shot(B.deice, 'deice')
await shot(B.hangar, 'hangar-tugs')
await shot(B.bus, 'bus-kerb', 4500)
// Fire bay: pull back so the whole station and apron are in frame.
await zoom(2)
await ev(`const g = window.__hatch; for (const t of g.trucks) if (t.kind === 'fire') g.yard.forget(t.id); g.trucks = g.trucks.filter(t => t.kind !== 'fire'); g.dispatchFireTender && g.dispatchFireTender({ c: ${row.c + at(B.fire).c - 3}, r: ${row.r + at(B.fire).r + 1} })`)
await shot(B.fire, 'fire-bay', 1800, 0.2)
await zoom(-2)
// Wide day + night of the whole row.
await zoom(3)
await shot(6, 'row-day', 2200, 2)
await ev(`const g = window.__hatch; g.clock = Math.floor(g.clock / 180) * 180 + 180 * 0.86`)
await shot(6, 'row-night', 3000, 2)
await zoom(-3)
await shot(B.cargo, 'cargo-night', 2200)
await shot(B.hangar, 'hangar-night', 2200)
await ev(`const g = window.__hatch; g.clock = Math.floor(g.clock / 180) * 180 + 180 + 30`)
// Placement ghost on open grass below the row.
await ev(`const g = window.__hatch; g.camGoal = { view: 'apron', c: ${row.c + 6}, r: ${row.r + 7}, seq: 4242 }`)
await page.waitForTimeout(1500)
await ev(`const g = window.__hatch; g.setTool('cargo'); g.hover = { c: ${row.c + 8}, r: ${row.r + 7} }`)
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/${PREFIX}-ghost-cargo.png` })
await ev(`const g = window.__hatch; g.setTool('hangar_j'); g.hover = { c: ${row.c + 4}, r: ${row.r + 7} }`)
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/${PREFIX}-ghost-hangar.png` })
await ev(`const g = window.__hatch; g.setTool('select'); g.hover = null`)
await ctx.close()
if (CLIP) {
  const vids = existsSync(vidDir) ? readdirSync(vidDir).filter((f) => f.endsWith('.webm')) : []
  if (vids[0]) renameSync(`${vidDir}/${vids[0]}`, `${OUT}/${CLIP}`)
  rmSync(vidDir, { recursive: true, force: true })
}
// Build-menu icons (second, clean page).
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await p2.goto(BASE, { waitUntil: 'domcontentloaded' })
await p2.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await p2.reload({ waitUntil: 'networkidle' })
await p2.getByTestId('new-game').click()
await p2.getByTestId('start-pax').click()
await p2.getByTestId('tab-economy').click()
await p2.getByTestId('starter-kit').click()
const c2 = p2.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await c2.count()) await c2.click()
await p2.evaluate(new Function(`const g = window.__hatch; g.cash = 5e6; g.speed = 0; g.offer = null; g.offerCool = 1e9`) as () => void)
for (const label of ['Ops', 'Landside', 'Terminal']) {
  await p2.getByRole('button', { name: label, exact: true }).first().click().catch((e) => console.log('menu', label, e.message))
  await p2.waitForTimeout(label === 'Ops' ? 25000 : 12000)
  const tray = p2.getByTestId('build-tray')
  if (await tray.count()) await tray.screenshot({ path: `${OUT}/${PREFIX}-icons-${label.toLowerCase()}.png` })
}
await browser.close()

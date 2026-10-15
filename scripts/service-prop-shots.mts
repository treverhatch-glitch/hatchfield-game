// In-game hall shots of bag drop, baggage claim, and passport control.
// npx tsx scripts/service-prop-shots.mts docs/devlog/media/service-props before
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'docs/devlog/media/service-props'
const prefix = process.argv[3] ?? 'after'
mkdirSync(out, { recursive: true })

const server = await createServer({ server: { port: 45351, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('console', msg.text())
})
await page.addInitScript(() => {
  localStorage.setItem('hatchfield-gfx', 'ultra')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 240000 })
await page.getByTestId('new-game').click({ timeout: 60000 })
await page.getByTestId('start-pax').waitFor({ state: 'visible', timeout: 60000 })
await page.waitForTimeout(500)
await page.getByTestId('start-pax').click({ timeout: 120000, noWaitAfter: true, force: true })
await page.waitForTimeout(800)
await page.evaluate(`(() => { const g = window.__hatch; g.buildStarterKit(); g.setView('hall'); g.speed = 1 })()`)
await page.waitForFunction(`!!window.__hall`, null, { timeout: 120000 })
await page.evaluate(`window.__hatch.closeNegotiationPanel?.()`)
await page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }).catch(() => {})
await page.addStyleTag({ content: '[class*=offer],[class*=Offer],[class*=negotiat]{display:none!important}' })

const placed = await page.evaluate(`(() => {
  const g = window.__hatch
  const bag = g.placeHallItemAt('bag_drop', 5, 0, 0)
  const pass = g.placeHallItemAt('passport_booth', 6, 1, 0)
  return JSON.stringify({ bag, pass })
})()`)
console.log('placed', placed)

await page.evaluate(`(() => { const w = window.__hall; w.__keepKit = setInterval(() => { if (w.roomPlan) { w.roomPlan = null; w.interiorFit = null; w.roomHash = '' } }, 50) })()`)
await page.waitForTimeout(7000)

const found = await page.evaluate(`(() => {
  const g = window.__hatch
  const seen = new Set(), hits = []
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || seen.has(o) || d > 5) return
    seen.add(o)
    if (Array.isArray(o)) {
      for (const x of o) { if (x && typeof x.def === 'string' && typeof x.c === 'number') hits.push(x) }
      if (!o.length || typeof o[0] !== 'object') return
    }
    for (const k of Object.keys(o)) { try { walk(o[k], d + 1) } catch {} }
  }
  walk(g, 0)
  const pick = (def) => hits.find((i) => i.def === def)
  return JSON.stringify({
    claim: pick('claim_carousel'),
    bag: pick('bag_drop'),
    pass: pick('passport_booth'),
    defs: [...new Set(hits.map((i) => i.def))],
  })
})()`)
console.log('found', found)
const f = JSON.parse(found as string)

async function aim(it: { c: number; r: number }, dist: number, pitch: number, yaw: number) {
  await page.evaluate(`(() => {
    const w = window.__hall
    const z = w.zoneGrid()
    const cw = 48 / z.cols
    const ch = 32 / z.rows
    w.goalTo = null
    w.pivot.x = -24 + (${it.c} + 0.5) * cw
    w.pivot.z = -16 + (${it.r} + 0.5) * ch
    w.dist = ${dist}
    w.pitch = ${pitch}
    w.yaw = ${yaw}
    w.placeCam()
  })()`)
  await page.waitForTimeout(3500)
}

await page.screenshot({ path: `${out}/${prefix}-hall-wide.png`, timeout: 240000 })
console.log('shot wide')

const shots: [string, { c: number; r: number } | undefined, number][] = [
  ['baggage-claim', f.claim, 0.4],
  ['bag-drop', f.bag, -0.5],
  ['passport', f.pass, 0.2],
]
for (const [name, it, yaw] of shots) {
  if (!it) {
    console.log('missing', name)
    continue
  }
  await aim(it, 16, 0.72, yaw)
  await page.screenshot({ path: `${out}/${prefix}-${name}.png`, timeout: 240000 })
  await aim(it, 8, 0.48, yaw)
  await page.screenshot({ path: `${out}/${prefix}-${name}-close.png`, timeout: 240000 })
  console.log('shot', name)
}

await browser.close()
await server.close()

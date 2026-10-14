// In-game hall shots at High graphics: npx tsx scripts/terminal-r5-ingame.mts outDir prefix  (starts vite itself)
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
const out = process.argv[2] ?? '/workspace/shots/term5'
const prefix = process.argv[3] ?? 'after-'
mkdirSync(out, { recursive: true })
const server = await createServer({ server: { port: 45341, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(base, { waitUntil: 'networkidle', timeout: 240000 })
await page.evaluate(`(() => { localStorage.clear(); localStorage.setItem(${JSON.stringify(process.env.QKEY)}, 'ultra') })()`)
await page.reload({ waitUntil: 'networkidle', timeout: 240000 })
await page.getByTestId('new-game').click()
await page.waitForTimeout(400)
await page.getByTestId('start-pax').click()
await page.waitForTimeout(800)
await page.evaluate(`(() => { const g = window.__hatch; g.buildStarterKit(); g.setView('hall'); g.speed = 1 })()`)
await page.waitForFunction(`!!window.__hall`, null, { timeout: 120000 })
await page.evaluate(`window.__hatch.closeNegotiationPanel?.()`)
await page.getByRole('button', { name: 'Close' }).first().click({ timeout: 3000 }).catch(() => {})
await page.addStyleTag({ content: '[class*=offer],[class*=Offer],[class*=negotiat]{display:none!important}' })
console.log('q', await page.evaluate(`JSON.stringify({ q: localStorage.getItem('hatchfield-gfx'), grid: window.__hall.zoneGrid() })`))
await page.waitForTimeout(8000)
// Kit-layout hall (no room plan): this is where catalog check-in / security items draw their detailed models.
await page.evaluate(`(() => { const w = window.__hall; w.__keepKit = setInterval(() => { if (w.roomPlan) { w.roomPlan = null; w.interiorFit = null; w.roomHash = '' } }, 50) })()`)
await page.waitForTimeout(6000)
console.log('kit', await page.evaluate(`(() => { let n = 0; window.__hall.scene.traverse((o) => { if (o.name === 'hall-kit-detail') n++ }); return n })()`))
await page.screenshot({ path: `${out}/${prefix}hall-wide.png`, timeout: 240000 })
console.log('shot wide')
// Close-ups: find the placed check-in and security items and aim the hall camera at them.
const found = await page.evaluate(`(() => {
  const g = window.__hatch
  const seen = new Set(), hits = []
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || seen.has(o) || d > 4) return
    seen.add(o)
    if (Array.isArray(o)) { for (const x of o) { if (x && typeof x.def === 'string' && typeof x.c === 'number') hits.push(x) } ; if (!o.length || typeof o[0] !== 'object') return }
    for (const k of Object.keys(o)) { try { walk(o[k], d + 1) } catch {} }
  }
  walk(g, 0)
  const pick = (re) => hits.find((i) => re.test(i.def))
  return JSON.stringify({ checkin: pick(/^checkin/), security: pick(/^security/), defs: [...new Set(hits.map((i) => i.def))] })
})()`)
console.log('found', found)
const f = JSON.parse(found as string)
for (const [name, it, yaw] of [['checkin', f.checkin, 0.5], ['security', f.security, -0.6]] as const) {
  if (!it) continue
  for (const [suffix, dist, pitch] of [['', 14, 0.7], ['-close', 8, 0.5]] as const) {
    await page.evaluate(`(() => { const w = window.__hall; const z = w.zoneGrid(); const cw = 48 / z.cols, ch = 32 / z.rows; w.goalTo = null; w.pivot.x = -24 + (${it.c} + 0.5) * cw; w.pivot.z = -16 + (${it.r} + 0.5) * ch; w.dist = ${dist}; w.pitch = ${name === 'security' ? pitch + 0.45 : pitch}; w.yaw = ${yaw}; w.placeCam() })()`)
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${out}/${prefix}${name}${suffix}.png`, timeout: 240000 })
    console.log('shot', name + suffix)
  }
}
await browser.close()
await server.close()

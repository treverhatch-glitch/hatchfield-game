// Hall stills for the real-size service kit. Not part of the game build.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'docs/devlog/media/hall-kit-scale'
mkdirSync(out, { recursive: true })

const server = await createServer({ server: { port: 45361, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.addInitScript(() => {
  localStorage.setItem('hatchfield-gfx', 'ultra')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 240000 })
await page.getByTestId('new-game').click({ timeout: 60000 })
await page.getByTestId('start-pax').waitFor({ state: 'visible', timeout: 60000 })
await page.waitForTimeout(400)
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
  return JSON.stringify({ bag, pass, open: g.fits?.[0]?.items?.filter(i => !i.def).length })
})()`)
console.log('placed', placed)

await page.evaluate(`(() => { const w = window.__hall; w.__keepKit = setInterval(() => { if (w.roomPlan) { w.roomPlan = null; w.interiorFit = null; w.roomHash = '' } }, 50) })()`)
await page.waitForTimeout(8000)

async function aim(c: number, r: number, dist: number, pitch: number, yaw: number) {
  await page.evaluate(`(() => {
    const w = window.__hall
    const z = w.zoneGrid()
    const cw = 48 / z.cols
    const ch = 32 / z.rows
    w.goalTo = null
    w.pivot.x = -24 + (${c} + 0.5) * cw
    w.pivot.z = -16 + (${r} + 0.5) * ch
    w.dist = ${dist}
    w.pitch = ${pitch}
    w.yaw = ${yaw}
    w.placeCam()
  })()`)
  await page.waitForTimeout(2500)
}

await aim(3, 2, 42, 0.95, 0.4)
await page.screenshot({ path: `${out}/hall-wide.png`, timeout: 240000 })
console.log('wide')

const shots: [string, number, number, number, number, number][] = [
  ['checkin', 2, 0, 14, 0.62, 0.2],
  ['security', 0, 2, 16, 0.7, 0.6],
  ['security-gap', 2, 2, 18, 0.85, 0.35],
  ['cafe', 2, 3, 14, 0.7, -0.4],
  ['claim', 6, 0, 16, 0.72, 0.4],
  ['bag-drop', 5, 0, 12, 0.55, -0.4],
  ['passport', 6, 1, 14, 0.6, 0.15],
]
for (const [name, c, r, dist, pitch, yaw] of shots) {
  await aim(c, r, dist, pitch, yaw)
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 240000 })
  console.log('shot', name)
}

await browser.close()
await server.close()

/**
 * In-game apron still of a parked jet with the aircraft close LOD.
 * Dev server only (`window.__hatch`). `npx vite --port 45231`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.SHOT_OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:45231/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

// DOM clicks: SwiftShader keeps the main thread busy, so Playwright's stability wait can stall.
async function tap(id: string) {
  await page.waitForSelector(`[data-testid="${id}"]`)
  await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).click(), `[data-testid="${id}"]`)
  await page.waitForTimeout(800)
}
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(240000)
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high')`))
await page.reload({ waitUntil: 'networkidle' })
await tap('new-game')
await tap('start-pax')
await tap('tab-economy')
await tap('starter-kit')
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.evaluate(call(`window.__hatch.setSpeed(5)`))
const parked = call(`
  const g = window.__hatch
  if (g.offer && g.signed.length === 0) g.acceptOffer()
  window.__airDbg = g.flights.map((f) => f.phase + ':' + (f.stand ? 's' : '-')).join(',')
  return g.flights.some((f) => f.stand && f.phase !== 'approach' && f.phase !== 'landing' && f.phase !== 'inbound')
`)
let ready = false
for (let i = 0; i < 360 && !ready; i++) {
  if (i % 40 === 0) console.log('flights', await page.evaluate(call('return window.__airDbg')))
  ready = Boolean(await page.evaluate(parked))
  if (!ready) await page.waitForTimeout(500)
}
if (!ready) {
  console.log('no aircraft on stand')
  await browser.close()
  process.exit(1)
}
await page.evaluate(call(`window.__hatch.setSpeed(1)`))
await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }' })
const aim = call(`
  const g = window.__hatch
  const w = window.__world
  const f = g.flights.find((f) => f.stand)
  if (!w || !f) return null
  const CELL = 22 * 0.45
  const HALF = 15.5
  const ax = (f.x - HALF) * CELL
  const az = (f.y - HALF) * CELL
  const h = f.heading || 0
  // Front three-quarter, a little above the wing: nose, engines, gear and service in frame.
  const ang = h + 0.75
  const d = 15
  const lock = { cx: ax + Math.cos(ang) * d, cy: 5.5, cz: az + Math.sin(ang) * d, tx: ax, ty: 1.2, tz: az }
  if (!w.__airWrapped) {
    const gl = w.renderer.render.bind(w.renderer)
    w.renderer.render = function (scene, camera) {
      const l = w.__airLock
      if (l) {
        w.camera.position.set(l.cx, l.cy, l.cz)
        w.camera.lookAt(l.tx, l.ty, l.tz)
        w.camera.updateMatrixWorld()
      }
      return gl(scene, camera)
    }
    w.__airWrapped = true
  }
  w.__airLock = lock
  w.goalTo = null
  return { id: f.type || f.airframe || null, phase: f.phase, at: [ax, az] }
`)
console.log('aim', JSON.stringify(await page.evaluate(aim)))
if (process.env.LAMP_DEBUG) {
  console.log('lamps', JSON.stringify(await page.evaluate(call(`
    const out = []
    window.__world.scene.traverse((o) => {
      if (/^nav-|^strobe|^beacon/.test(o.name) && o.isMesh) {
        const s = new o.matrixWorld.constructor()
        const v = { x: 0, y: 0, z: 0 }
        const e = o.matrixWorld.elements
        out.push([o.name, o.scale.x.toFixed(3), Math.hypot(e[0], e[1], e[2]).toFixed(3), o.geometry.parameters ? JSON.stringify(o.geometry.parameters) : o.geometry.name])
      }
    })
    return out.slice(0, 12)
  `))))
}
await page.waitForTimeout(6000)
await page.screenshot({ path: `${OUT}/air-apron-ingame.png` })
console.log('saved air-apron-ingame')
await browser.close()

/**
 * In-game still of the five turnaround vehicles on the live apron.
 * Dev server: `npx vite --port 45931 --host 127.0.0.1`
 *
 *   SHOT_OUT=docs/devlog/media SHOT_NAME=vehicles-before npx tsx scripts/vehicle-ingame-shot.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.SHOT_OUT || '/opt/cursor/artifacts'
const NAME = process.env.SHOT_NAME || 'vehicles-ingame'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:45931/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

async function tap(page: import('playwright').Page, id: string) {
  await page.waitForSelector(`[data-testid="${id}"]`, { timeout: 120000 })
  await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).click(), `[data-testid="${id}"]`)
  await page.waitForTimeout(700)
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(180000)
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high')`))
await page.reload({ waitUntil: 'domcontentloaded' })
await tap(page, 'new-game')
await tap(page, 'start-pax')
const economy = page.locator('[data-testid="tab-economy"]')
if (await economy.count()) await tap(page, 'tab-economy')
const starter = page.locator('[data-testid="starter-kit"]')
if (await starter.count()) {
  await page.evaluate(() => (document.querySelector('[data-testid="starter-kit"]') as HTMLElement | null)?.click())
  await page.waitForTimeout(800)
}
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click().catch(() => {})
await page.waitForFunction(call(`return Boolean(window.__world && window.__world.camera && window.__hatch)`), null, { timeout: 120000 })
await page.evaluate(call(`window.__hatch.setView('apron')`))
await page.waitForTimeout(600)

const placed = await page.evaluate(call(`
  const w = window.__world
  const g = window.__hatch
  const S = 0.45
  const CELL = 22 * S
  const HALF = (g.tiles.length - 1) / 2
  let spot = null
  for (let r = 2; r < g.tiles.length - 2 && !spot; r++) {
    for (let c = 2; c < g.tiles[r].length - 2; c++) {
      let open = true
      for (let dr = -1; dr <= 1 && open; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const t = g.tiles[r + dr][c + dc]
          if (t !== 'grass' && t !== 'taxi') open = false
        }
      }
      if (open) { spot = [c, r]; break }
    }
  }
  const dist = 14
  const pitch = 0.36
  const yaw = 1.05
  w.dist = dist
  w.pitch = pitch
  w.yaw = yaw
  const px = spot ? (spot[0] - HALF) * CELL : w.pivot.x
  const pz = spot ? (spot[1] - HALF) * CELL : w.pivot.z
  w.pivot.set(px, 0, pz)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const fwdX = -Math.sin(yaw)
  const fwdZ = -Math.cos(yaw)
  const yard = [
    ['fuel_truck', '#c9a227', [10, 3.2, 2.5]],
    ['catering_truck', '#e07a3d', [8.6, 3.7, 2.5]],
    ['belt_loader', '#f2bf1f', [7.6, 2.4, 2.1]],
    ['pushback_tug', '#f2d24a', [7.8, 1.7, 3.2]],
    ['pax_bus', '#3d6a8a', [14, 3.1, 3]],
  ]
  window.__vehicleYard = yard.map((row, i) => {
    const along = (i - 2) * 6.4
    return {
      kind: row[0], color: row[1], size: row[2],
      x: px + rightX * along + fwdX * 4,
      y: 0,
      z: pz + rightZ * along + fwdZ * 4,
      yaw: yaw + Math.PI * 0.85,
      scale: S,
    }
  })
  if (!w.__dayLock) {
    const render = w.render.bind(w)
    w.render = function (game) {
      this.setTimeOfDay(13)
      return render(game)
    }
    w.__dayLock = true
  }
  if (!w.__yardLock) {
    const place = w.placeCam.bind(w)
    w.placeCam = function () {
      this.dist = dist
      this.pitch = pitch
      this.yaw = yaw
      this.pivot.set(px, 0, pz)
      return place()
    }
    w.__yardLock = true
  }
  w.placeCam()
  document.querySelectorAll('.hud, .tt-root, aside, .owner-chrome, .photo-bar, .inspect-card, [data-hud-part]').forEach((n) => { n.style.display = 'none' })
  const canvas = document.querySelector('canvas.field')
  const r = canvas ? canvas.getBoundingClientRect() : null
  return { view: window.__hatch.view, pivot: [px, pz], cam: [w.camera.position.x, w.camera.position.y, w.camera.position.z], canvas: r && [r.width, r.height] }
`))
console.log('placed', JSON.stringify(placed))
await page.waitForTimeout(2500)
const gl = await page.evaluate(call(`
  const w = window.__world
  const c = w.renderer.domElement
  const gl = w.renderer.getContext()
  const pix = new Uint8Array(4)
  gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix)
  return {
    pix: Array.from(pix),
    calls: w.renderer.info.render.calls,
    tris: w.renderer.info.render.triangles,
    bg: w.scene.background && w.scene.background.getHexString ? w.scene.background.getHexString() : null,
    buf: [c.width, c.height],
    cam: [w.camera.position.x, w.camera.position.y, w.camera.position.z],
    pivot: [w.pivot.x, w.pivot.z],
    dist: w.dist,
    vehicles: (window.__vehicleYard || []).length,
    fleet: w.vehicleFleet ? w.vehicleFleet.root.children.length : -1,
  }
`))
console.log('gl', JSON.stringify(gl))
const top = await page.evaluate(call(`
  const el = document.elementFromPoint(800, 450)
  const cs = el ? getComputedStyle(el) : null
  return { tag: el && el.tagName, className: el && el.className, bg: cs && cs.backgroundColor, op: cs && cs.opacity }
`))
console.log('top', JSON.stringify(top))
await page.locator('canvas.field').screenshot({ path: `${OUT}/${NAME}.png` })
console.log('saved', `${OUT}/${NAME}.png`)
await browser.close()

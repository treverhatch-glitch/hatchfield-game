/**
 * Airport + Terminal stills and an airport-view GPU sample.
 * Usage: SHOT_TAG=before OUT=docs/devlog/media/terminal-consistency npx tsx /tmp/terminal-consistency-shots.mts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || 'docs/devlog/media/terminal-consistency'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.argv[2] || process.env.SHOT_TAG || 'before'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high')`))
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
await page.waitForFunction(call(`return Boolean(window.__world && window.__hatch.fits && window.__hatch.fits.length)`), null, { timeout: 20000 })
await page.waitForTimeout(1200)

const focus = await page.evaluate(call(`
  const g = window.__hatch
  const w = window.__world
  g.speed = 0
  g.camGoal = null
  let c = 0, r = 0, n = 0
  for (let rr = 0; rr < g.tiles.length; rr++) {
    for (let cc = 0; cc < g.tiles[rr].length; cc++) {
      if (g.tiles[rr][cc] !== 'terminal') continue
      c += cc; r += rr; n++
    }
  }
  const SIZE = g.tiles.length
  const CELL = 22 * 0.45
  const x = ((c / n) - (SIZE - 1) / 2) * CELL
  const z = ((r / n) - (SIZE - 1) / 2) * CELL
  w.pivot.set(x, 0, z)
  w.yaw = 0.72
  w.pitch = 0.62
  w.dist = 36
  w.placeCam()
  return { x, z, n }
`))

await page.waitForTimeout(900)
const gpuClose = await page.evaluate(call(`
  const r = window.__world.renderer
  r.info.reset()
  window.__world.render(window.__hatch)
  const info = r.info.render
  const terminals = window.__world.wr.stats().terminals
  let interior = 0
  window.__world.scene.traverse((o) => {
    if (!o.visible) return
    const n = o.name || ''
    if (n.startsWith('props') || n.startsWith('people') || n.startsWith('room-') || n.startsWith('terminal-floor') || n.startsWith('terminal-carpet') || n === 'terminal-ceiling' || n.startsWith('desk-') || n.startsWith('wayfinding') || n === 'gate-sign') interior++
  })
  return { calls: info.calls, triangles: info.triangles, lines: info.lines, points: info.points, terminals, interiorNamed: interior, dist: window.__world.dist }
`))

await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas:not(.hall-canvas) { visibility: visible !important }' })
await page.screenshot({ path: `${OUT}/airport-close-${TAG}.png` })

await page.evaluate(call(`const w = window.__world; w.dist = 92; w.pitch = 0.7; w.placeCam()`))
await page.waitForTimeout(700)
const gpuWide = await page.evaluate(call(`
  const r = window.__world.renderer
  r.info.reset()
  window.__world.render(window.__hatch)
  const info = r.info.render
  return { calls: info.calls, triangles: info.triangles, dist: window.__world.dist }
`))
await page.screenshot({ path: `${OUT}/airport-${TAG}.png` })

await page.addStyleTag({ content: 'body * { visibility: visible !important }' })
await page.evaluate(call(`window.__hatch.setView('hall')`))
await page.waitForFunction(call(`return Boolean(window.__hall && window.__hall.placeCam)`), null, { timeout: 15000 })
await page.waitForTimeout(1600)
await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas.hall-canvas { visibility: visible !important }' })
await page.screenshot({ path: `${OUT}/terminal-${TAG}.png` })

await page.evaluate(call(`const h = window.__hall; h.dist = 28; h.pitch = 0.85; h.placeCam()`))
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/terminal-close-${TAG}.png` })

const note = { tag: TAG, focus, gpuClose, gpuWide, errors: errors.slice(0, 12) }
writeFileSync(`${OUT}/gpu-${TAG}.json`, JSON.stringify(note, null, 2))
console.log(JSON.stringify(note, null, 2))
await browser.close()

/**
 * After stills at mid zoom and max zoom. The roof beat is scripts/view-budget-clip.mts.
 * Usage: npx tsx scripts/view-budget-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media/view-budget'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const budgetLogs: string[] = []
page.on('console', (msg) => {
  const text = msg.text()
  if (text.includes('[view-budget]')) budgetLogs.push(text)
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high'); localStorage.setItem('hatchfield-aircraft-quality', 'high')`))
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

const aim = await page.evaluate(call(`
  const w = window.__world
  const g = window.__hatch
  g.setSpeed(1)
  let steps = 0
  while ((g.flights || []).length < 1 && steps < 400) { g.tick(0.5); steps++ }
  const building = w.wr.buildings && w.wr.buildings[0]
  const aim = (w.wr.terminalAim && w.wr.terminalAim()) || (building && building.center)
  if (aim) { w.pivot.x = aim.x; w.pivot.z = aim.z }
  w.yaw = 0.4
  w.pitch = 0.55
  w.dist = 140
  w.placeCam()
  return { flights: (g.flights || []).length, steps, dist: w.dist, aim }
`))
console.log('aim', JSON.stringify(aim))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/after-mid-zoom.png` })

const shell = await page.evaluate(call(`
  const b = window.__world.wr.buildings[0]
  return {
    roof: b.roofSections.length,
    wall: b.shellSections.length,
    names: b.roofSections.map((g) => g.name),
  }
`))
console.log('shell', JSON.stringify(shell))

await page.evaluate(call(`
  const w = window.__world
  w.dist = 280
  w.placeCam()
`))
await page.waitForTimeout(1500)
const lodFar = await page.evaluate(call(`
  const root = window.__world.scene || window.__world.wr.scene
  const found = []
  const walk = (obj) => {
    if (!obj) return
    if (obj.name === 'lod' && obj.buckets) {
      found.push({
        high: !!obj.buckets.highGroup.visible,
        mid: !!obj.buckets.midGroup.visible,
        low: !!obj.buckets.lowGroup.visible,
      })
    }
    for (const child of obj.children || []) walk(child)
  }
  walk(window.__world.scene)
  if (!found.length && window.__world.wr && window.__world.wr.scene) walk(window.__world.wr.scene)
  return { dist: window.__world.dist, lod: found.slice(0, 4) }
`))
console.log('lod-far', JSON.stringify(lodFar))
await page.screenshot({ path: `${OUT}/after-max-zoom.png` })

const sample = await page.evaluate(call(`
  return new Promise((resolve) => {
    let n = 0
    const t0 = performance.now()
    const step = () => {
      n++
      if (performance.now() - t0 >= 2500 || n >= 8) resolve({ frames: n, ms: Math.round(performance.now() - t0) })
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
`))
console.log('max-zoom-raf', JSON.stringify(sample))

await browser.close()
console.log('budget-logs', JSON.stringify(budgetLogs))

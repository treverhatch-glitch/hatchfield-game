/**
 * Max-zoom apron still, before the view-budget change.
 * Usage: npx tsx scripts/view-budget-before.mts
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
await page.evaluate(call(`
  const w = window.__world
  const g = window.__hatch
  g.setSpeed(1)
  let steps = 0
  while ((g.flights || []).length < 1 && steps < 400) { g.tick(0.5); steps++ }
  const b = w.wr.buildings && w.wr.buildings[0]
  const aim = b && b.center
  if (aim) { w.pivot.x = aim.x; w.pivot.z = aim.z }
  w.yaw = 0.4
  w.pitch = 0.55
  w.dist = 140
  w.placeCam()
`))
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/before-mid-zoom.png` })
await page.evaluate(call(`
  const w = window.__world
  w.dist = 280
  w.placeCam()
`))
await page.waitForTimeout(800)
const sample = await page.evaluate(call(`
  return new Promise((resolve) => {
    let n = 0
    const t0 = performance.now()
    const step = () => {
      n++
      if (performance.now() - t0 >= 1200) resolve({ frames: n, ms: performance.now() - t0 })
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
`))
const lodFar = await page.evaluate(call(`
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
  return { dist: window.__world.dist, lod: found.slice(0, 4) }
`))
console.log('lod-far', JSON.stringify(lodFar))
await page.screenshot({ path: `${OUT}/before-max-zoom.png` })
await page.evaluate(call(`
  const w = window.__world
  const b = w.wr.buildings && w.wr.buildings[0]
  const aim = b && b.center
  if (aim) { w.pivot.x = aim.x; w.pivot.z = aim.z }
  w.yaw = 0.55
  w.pitch = 0.85
  w.dist = 72
  w.placeCam()
`))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/before-roof.png` })
console.log(JSON.stringify(sample))
await browser.close()

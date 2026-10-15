/**
 * Parked fleets: Bushline commuter beside a grown Crown A380.
 *   SHOT_URL=http://127.0.0.1:45218/ npx tsx scripts/fleet-growth-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media/fleet-growth'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45218/'
const CHROME = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find((p) => existsSync(p))

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'high')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForTimeout(400)

await page.evaluate(`(() => {
  const g = window.__hatch
  g.speed = 0
  const base = { pax: 0, cargo: false, craft: 'jet', phase: 'parked', z: 0, heading: 0.4, path: [], seg: 0, t: 0, holdAngle: 0, posted: {}, waitingOn: {}, phaseTime: 0, ledger: [] }
  g.flights.push(
    Object.assign({}, base, { id: 'small-fleet', airline: 'bushline', flightNo: 'BN2', airframeId: 'dhc6', airframeName: 'Twin Otter', kind: 'regional', stand: { c: 12, r: 10 }, x: 12, y: 10 }),
    Object.assign({}, base, { id: 'large-fleet', airline: 'crown', flightNo: 'CRN', airframeId: 'a380', airframeName: 'A380', kind: 'widebody', stand: { c: 20, r: 10 }, x: 20, y: 10 }),
  )
  g.bumpMap()
})()`)
await page.waitForTimeout(800)
await page.addStyleTag({ content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }' })
await page.evaluate(() => {
  const w = (window as unknown as {
    __world: { pivot: { set: (x: number, y: number, z: number) => void }; yaw: number; pitch: number; dist: number; placeCam: () => void }
  }).__world
  const cell = 22 * 0.45
  w.pivot.set((16 - 15.5) * cell, 0, (10 - 15.5) * cell)
  w.yaw = 0.7
  w.pitch = 0.55
  w.dist = 78
  w.placeCam()
})
await page.waitForTimeout(700)
const path = `${OUT}/small-vs-large-fleet.png`
await page.screenshot({ path })
console.log('wrote', path)
await browser.close()

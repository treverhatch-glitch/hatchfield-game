/**
 * High-quality dawn / noon / dusk / night stills, plus cycle-off at a night clock.
 * Capture at speed 0. Speed 5 drops apron floodlight pools (lite mode).
 * Needs the dev server: `npx vite --port 45921`, then `npx tsx scripts/daynight-oct15-shots.mts`.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { ALWAYS_DAY } from '../src/render/graphicsPrefs.ts'
import { clockForHour, DAY_NIGHT } from '../src/render/world/dayNight.ts'

const OUT = 'docs/playtest/daynight_oct15'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45921/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

const SHOTS: { name: string; day: number; hour: number; yaw: number; cycle?: boolean }[] = [
  { name: 'dawn', day: 100, hour: DAY_NIGHT.shots.dawn, yaw: -1.15 },
  { name: 'noon', day: 100, hour: DAY_NIGHT.shots.noon, yaw: -0.4 },
  { name: 'dusk', day: 100, hour: DAY_NIGHT.shots.dusk, yaw: 1.15 },
  { name: 'night', day: 300, hour: DAY_NIGHT.shots.night, yaw: -0.55 },
  { name: 'cycle-off', day: 300, hour: DAY_NIGHT.shots.night, yaw: -0.4, cycle: false },
]

function call(body: string) {
  return new Function(body) as () => unknown
}

async function ready(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high'); localStorage.setItem('hatchfield-day-night', 'on')`))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  const kit = page.getByTestId('starter-kit-coach')
  await kit.waitFor({ timeout: 15000 })
  await kit.click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.evaluate(call('window.__hatch.speed = 1'))
  for (let i = 0; i < 180; i++) {
    const parked = await page.evaluate(
      call(`
        const g = window.__hatch
        if (g.offer && g.signed.length === 0) g.acceptOffer()
        return g.flights.some((f) => f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'boarding')
      `),
    )
    if (parked) break
    await page.waitForTimeout(500)
  }
  await page.evaluate(call('window.__hatch.speed = 0'))
  await page.evaluate(
    call(`
      const g = window.__hatch
      const f = g.flights.find((f) => f.stand) ?? g.flights[0]
      if (f) g.camGoal = { view: 'apron', c: Math.round(f.x), r: Math.round(f.y), seq: (g.camGoal?.seq ?? 0) + 1 }
    `),
  )
  await page.waitForTimeout(800)
  await page.addStyleTag({
    content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
  })
  await page.evaluate(
    call(`
      const w = window.__world
      if (!w) return
      w.releaseFollow()
      w.dist = 148
      w.pitch = 0.42
      w.placeCam()
    `),
  )
  await page.waitForTimeout(400)
}

async function show(page: Page, day: number, hour: number, yaw: number, cycle = true) {
  const clock = clockForHour(day, hour)
  const hold = { hour: ALWAYS_DAY.hour, daylight: ALWAYS_DAY.daylight, lights: ALWAYS_DAY.lights }
  await page.evaluate(
    ((arg: { stamp: number; yaw: number; cycle: boolean; hold: { hour: number; daylight: number; lights: number } }) => {
      const g = (window as unknown as { __hatch: { clock: number; speed: number; weather: string } }).__hatch
      const w = (window as unknown as {
        __world?: {
          setTimeOfDay: (h: number | null) => void
          setDayNight: (c: { hour: number; daylight: number; lights: number } | null) => void
          releaseFollow: () => void
          dist: number
          pitch: number
          yaw: number
          placeCam: () => void
        }
      }).__world
      localStorage.setItem('hatchfield-day-night', arg.cycle ? 'on' : 'off')
      g.speed = 0
      g.weather = 'clear'
      g.clock = arg.stamp
      w?.setDayNight(arg.cycle ? null : arg.hold)
      w?.setTimeOfDay(null)
      if (w) {
        w.releaseFollow()
        w.dist = 148
        w.pitch = 0.42
        w.yaw = arg.yaw
        w.placeCam()
      }
    }) as (arg: { stamp: number; yaw: number; cycle: boolean; hold: typeof hold }) => void,
    { stamp: clock, yaw, cycle, hold },
  )
  const want = cycle ? hour : ALWAYS_DAY.hour
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200)
    const hourNow = await page.evaluate(
      call(`
        const s = window.__world && window.__world.wr && window.__world.wr.dayNightSample
        return s ? s.hour : null
      `),
    )
    if (typeof hourNow === 'number' && Math.abs(hourNow - want) < 0.35) return
  }
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await ready(page)
const canvas = page.locator('canvas.field')
for (const shot of SHOTS) {
  await show(page, shot.day, shot.hour, shot.yaw, shot.cycle !== false)
  const sample = await page.evaluate(
    call(`
      const w = window.__world
      const s = w && w.wr && w.wr.dayNightSample
      return s ? { hour: s.hour, lights: s.lights, windows: s.windows, runway: s.runwayEdge, apron: s.apron, pools: s.apronPools, aircraft: s.aircraft, headlights: s.headlights, quality: w.wr.quality, speed: window.__hatch.speed } : null
    `),
  )
  const path = `${OUT}/${shot.name}.png`
  await canvas.screenshot({ path })
  console.log(shot.name, JSON.stringify(sample), path)
}
await browser.close()

/**
 * Dawn, noon, dusk, and night stills of the apron.
 * Night is a winter day so snow is on the ground.
 * Needs the dev server: `npx vite --port 45921`, then `npx tsx scripts/day-night-shots.mts`.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { clockForHour, DAY_NIGHT } from '../src/render/world/dayNight.ts'

const OUT = 'docs/devlog/media/day-night'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45921/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

const SHOTS: { name: string; day: number; hour: number; yaw: number }[] = [
  { name: 'dawn', day: 100, hour: DAY_NIGHT.shots.dawn, yaw: -1.15 },
  { name: 'noon', day: 100, hour: DAY_NIGHT.shots.noon, yaw: -0.4 },
  { name: 'dusk', day: 100, hour: DAY_NIGHT.shots.dusk, yaw: 1.15 },
  { name: 'night', day: 300, hour: DAY_NIGHT.shots.night, yaw: -0.55 },
]

function call(body: string) {
  return new Function(body) as () => unknown
}

async function ready(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.getByTestId('tab-economy').click()
  await page.evaluate(call('window.__hatch.speed = 5'))
  for (let i = 0; i < 120; i++) {
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
      w.dist = 168
      w.pitch = 0.34
      w.placeCam()
    `),
  )
  await page.waitForTimeout(400)
}

async function show(page: Page, day: number, hour: number, yaw: number) {
  const clock = clockForHour(day, hour)
  await page.evaluate(
    ((arg: { stamp: number; yaw: number }) => {
      const g = (window as unknown as { __hatch: { clock: number; speed: number; weather: string } }).__hatch
      const w = (window as unknown as {
        __world?: {
          setTimeOfDay: (h: number | null) => void
          setDayNight: (c: null) => void
          releaseFollow: () => void
          dist: number
          pitch: number
          yaw: number
          placeCam: () => void
        }
      }).__world
      g.speed = 0
      g.weather = 'clear'
      g.clock = arg.stamp
      w?.setDayNight(null)
      w?.setTimeOfDay(null)
      if (w) {
        w.releaseFollow()
        w.dist = 168
        w.pitch = 0.34
        w.yaw = arg.yaw
        w.placeCam()
      }
    }) as (arg: { stamp: number; yaw: number }) => void,
    { stamp: clock, yaw },
  )
  await page.waitForTimeout(500)
}

const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await ready(page)
const canvas = page.locator('canvas.field')
for (const shot of SHOTS) {
  await show(page, shot.day, shot.hour, shot.yaw)
  const sample = await page.evaluate(
    call(`
      const w = window.__world
      const s = w && w.wr && w.wr.dayNightSample
      return s ? { hour: s.hour, lights: s.lights, snow: s.snow, season: s.seasonId, windows: s.windows } : null
    `),
  )
  const path = `${OUT}/${shot.name}.png`
  await canvas.screenshot({ path })
  console.log(shot.name, JSON.stringify(sample), path)
}
await browser.close()

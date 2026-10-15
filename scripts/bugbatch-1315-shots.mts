/**
 * Stills for the visual/UX bug batch.
 * `npx vite --host 127.0.0.1 --port 46115` then `npx tsx scripts/bugbatch-1315-shots.mts`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { clockForFaceHour } from '../src/core/faceClock.ts'

const OUT = 'docs/devlog/media/bugbatch-1315'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:46115/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

async function boot(page: Page, gfx: 'low' | 'med', cycle: boolean) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ gfx, cycle }) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('hatchfield-gfx', gfx)
      localStorage.setItem('hatchfield.settings.v1', JSON.stringify({ dayNightCycle: cycle }))
    },
    { gfx, cycle },
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('map-temperate').click()
  await page.getByTestId('start-pax').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.getByTestId('starter-kit-dock').click()
  await page.evaluate(call('window.__hatch.speed = 0'))
}

async function frame(page: Page, hour: number, weather: string) {
  const clock = clockForFaceHour(0, hour)
  await page.evaluate(
    ({ clock, weather }) => {
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
      g.weather = weather
      g.clock = clock
      w?.setDayNight(null)
      w?.setTimeOfDay(null)
      if (w) {
        w.releaseFollow()
        w.dist = 88
        w.pitch = 0.42
        w.yaw = -0.6
        w.placeCam()
      }
    },
    { clock, weather },
  )
  await page.waitForTimeout(700)
}

async function hideChrome(page: Page) {
  await page.addStyleTag({
    content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
  })
}

const part = process.env.SHOT_PART || 'all'

const browser = await chromium.launch({
  executablePath: CHROME && existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))

if (part === 'all') {
  await boot(page, 'med', true)
  await hideChrome(page)
  await frame(page, 11, 'rain')
  await page.screenshot({ path: `${OUT}/rain-med.png` })
  await frame(page, 11, 'fog')
  await page.screenshot({ path: `${OUT}/fog-med.png` })
  await frame(page, 11, 'storm')
  await page.screenshot({ path: `${OUT}/storm-med.png` })
  await frame(page, 3, 'clear')
  await page.screenshot({ path: `${OUT}/night-0300.png` })
  await frame(page, 0, 'clear')
  await page.screenshot({ path: `${OUT}/night-midnight.png` })

  await boot(page, 'low', true)
  await hideChrome(page)
  await frame(page, 11, 'rain')
  await page.screenshot({ path: `${OUT}/rain-low.png` })
  await frame(page, 3, 'clear')
  await page.screenshot({ path: `${OUT}/night-0300-low.png` })

  await boot(page, 'med', false)
  await hideChrome(page)
  await frame(page, 3, 'clear')
  await page.screenshot({ path: `${OUT}/cycle-off-0300.png` })
}

await boot(page, 'med', true)
await page.evaluate(call('window.__hatch.speed = 8'))
for (let i = 0; i < 80; i++) {
  const ready = await page.evaluate(
    call(`const g = window.__hatch
      if (g.offer && g.signed.length === 0) g.acceptOffer()
      return g.terminalPaxCount() > 8 || g.hallNav.passengers > 8`),
  )
  if (ready) break
  await page.waitForTimeout(400)
}
await page.evaluate(
  call(`const g = window.__hatch
    g.speed = 1
    g.reputation = 55.20799999999992
    g.paxServed = 200
    g.flightsDone = 3
    g.hallGuests = []
    g.setView('hall')`),
)
await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/terminal-pax.png` })
const before = await page.locator('canvas.hall-canvas').screenshot()
await page.waitForTimeout(700)
const after = await page.locator('canvas.hall-canvas').screenshot()
let moved = 0
const n = Math.min(before.length, after.length)
for (let i = 0; i < n; i++) if (before[i] !== after[i]) moved++
const pax = await page.locator('.hall-chrome').innerText()
await page.evaluate(call(`window.__hatch.setView('apron')`))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/goals-clocks.png` })
const hud = await page.getByTestId('hud-clock').innerText()
const pill = await page.getByTestId('tt-pill-clock').innerText()
const goal = (await page.getByTestId('milestone-reputation_60').count())
  ? await page.getByTestId('milestone-reputation_60').innerText()
  : await page.getByTestId('milestone-stack').innerText()
const mapGoals = await page.getByTestId('map-goals').innerText()
console.log(JSON.stringify({ hud, pill, goal, mapGoals, pax, canvasBytesChanged: moved, errors: errors.slice(0, 6) }, null, 2))
await browser.close()

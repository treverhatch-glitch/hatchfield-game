/**
 * Dawn, noon, dusk, and night stills after the cycle pass.
 * Dev server on :45217. Writes docs/devlog/media/artpass/daynight-*.png.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { clockForHour } from '../src/render/world/dayNight.ts'

const outDir = 'docs/devlog/media/artpass'
mkdirSync(outDir, { recursive: true })
const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const shots: { name: string; hour: number }[] = [
  { name: 'dawn', hour: 6.6 },
  { name: 'noon', hour: 12 },
  { name: 'dusk', hour: 18.6 },
  { name: 'night', hour: 23 },
]

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto('http://127.0.0.1:45217/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'high')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: object }).__hatch))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForFunction(
  () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
)
const gotIt = page.getByRole('button', { name: 'Got it' })
if (await gotIt.count()) await gotIt.click().catch(() => {})
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})

for (const shot of shots) {
  const clock = clockForHour(4, shot.hour)
  const sample = await page.evaluate(
    ({ clock, hour }) => {
      const g = (window as unknown as { __hatch: { clock: number; speed: number; weather: string } }).__hatch
      const w = (window as unknown as {
        __world?: { setDayNight: (c: null) => void; setTimeOfDay: (h: number | null) => void; wr?: { dayNightSample?: { hour: number; lights: number } } }
      }).__world
      g.speed = 0
      g.weather = 'clear'
      g.clock = clock
      w?.setDayNight(null)
      w?.setTimeOfDay(hour)
      return w?.wr?.dayNightSample ?? null
    },
    { clock, hour: shot.hour },
  )
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${outDir}/daynight-${shot.name}.png` })
  console.log(shot.name, sample)
}
await browser.close()

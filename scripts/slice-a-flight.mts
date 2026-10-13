/** Charts close-up and a 5x approach-to-departure clip. */
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
]

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
}

function readState() {
  return new Function(`
    const g = window.__hatch
    if (!g) return null
    const live = g.flights.filter((f) => f.phase !== 'gone')
    const f = live[0]
    return {
      done: g.flightsDone,
      hist: g.econHist.length,
      phase: f ? f.phase : null,
      x: f ? Math.round(f.x * 10) / 10 : null,
      z: f ? Math.round(f.z * 10) / 10 : null,
      name: f ? f.airframeName : null,
      pax: f ? f.pax : null,
    }
  `) as () => unknown
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await boot(page)
await page.getByRole('button', { name: '5x' }).first().click()
const letter = page.getByTestId('contract-letter')
await letter.waitFor({ timeout: 20000 })
await letter.getByRole('button').first().click()
await page.getByRole('button', { name: 'Accept' }).click()
await page.locator('.eco-tabs button', { hasText: 'Charts' }).click()
await page.waitForTimeout(12000)
const charts = page.getByTestId('eco-charts')
console.log('charts visible', await charts.count())
if (await charts.count()) {
  await charts.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/SLICE-A-charts.png` })
  await charts.screenshot({ path: `${OUT}/SLICE-A-charts-panel.png` })
}
await page.close()

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: '/tmp/slice-a-flight2', size: { width: 1280, height: 720 } },
})
const flight = await context.newPage()
flight.on('pageerror', (err) => console.log('pageerror', err.message))
await boot(flight)
const canvas = flight.locator('canvas').first()
const box = await canvas.boundingBox()
if (box) {
  await flight.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 10; i++) await flight.mouse.wheel(0, 500)
}
await flight.getByRole('button', { name: '5x' }).first().click()
const letter2 = flight.getByTestId('contract-letter')
await letter2.waitFor({ timeout: 20000 })
await letter2.getByRole('button').first().click()
await flight.getByRole('button', { name: 'Accept' }).click()
await flight.keyboard.down('d')
await flight.keyboard.down('s')
let shotApproach = false
let shotDepart = false
const start = Date.now()
while (Date.now() - start < 70000) {
  const s = (await flight.evaluate(readState())) as {
    done: number
    phase: string | null
    x: number | null
    z: number | null
    name: string | null
  } | null
  if (s?.phase === 'approach' && !shotApproach) {
    shotApproach = true
    await flight.screenshot({ path: `${OUT}/SLICE-A-approach.png` })
    console.log('approach', s)
  }
  if (s?.phase === 'takeoff' && !shotDepart) {
    shotDepart = true
    await flight.screenshot({ path: `${OUT}/SLICE-A-departure.png` })
    console.log('takeoff', s)
  }
  if ((s?.done ?? 0) >= 1) {
    console.log('complete', s, 'ms', Date.now() - start)
    break
  }
  await flight.waitForTimeout(300)
}
await flight.keyboard.up('d')
await flight.keyboard.up('s')
const video = flight.video()
await context.close()
if (video) await video.saveAs(`${OUT}/SLICE-A-departure.webm`)
await browser.close()
console.log('saved', { shotApproach, shotDepart })

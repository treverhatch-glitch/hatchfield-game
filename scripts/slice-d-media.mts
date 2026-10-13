/** Stills and a UI-hidden service-vehicle clip for the ground logistics slice. */
import { mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
]

async function boot(page: Page) {
  page.on('pageerror', (err) => console.log('pageerror', err.message))
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
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(400)
}

function call(body: string) {
  return new Function(body) as () => unknown
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.getByRole('button', { name: 'Ops', exact: true }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/SLICE-D-tray.png` })
  const tray = await page.getByTestId('build-tray').innerText()
  console.log('tray', tray.replace(/\n/g, ' | '))
  await page.close()
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.evaluate(
    call(`
      const game = window.__hatch
      game.tiles[10][15] = 'depot'
      game.bumpMap()
      game.speed = 1
      game.tick(1)
    `),
  )
  await page.getByTestId('advice-low-meals').waitFor({ timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/SLICE-D-advisor.png` })
  console.log('advisor', await page.getByTestId('advice-low-meals').innerText())
  await page.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-d-ramp', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  const hiddenAt = Date.now()
  await page.evaluate(
    call(`
      document.querySelectorAll('.hud, .hall-build, .owner-chrome, .hall-chrome, .coach').forEach((el) => {
        el.style.display = 'none'
      })
      const game = window.__hatch
      game.tiles[10][15] = 'depot'
      game.tiles[10][17] = 'kitchen'
      game.bumpMap()
      game.scheduleAuto = false
      game.schedule = []
      game.spawnCool = 1e9
      game.offerCool = 1e9
      const stand = { c: 12, r: 21 }
      const flight = {
        id: 'flt-ramp',
        airline: 'northline',
        flightNo: 'NL100',
        airframeId: 'crj700',
        airframeName: 'CRJ-700',
        pax: 20,
        cargo: false,
        craft: 'jet',
        kind: 'regional',
        phase: 'servicing',
        stand,
        x: stand.c,
        y: stand.r,
        z: 0.12,
        heading: 0,
        path: [stand],
        seg: 0,
        t: 0,
        holdAngle: 0,
        posted: { landing: true, bags: false, bagsLoad: false, fuel: false, catering: false, bagDrop: false, mx: false, deiced: false },
        waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
        phaseTime: 30,
        ledger: [],
        fuelLevel: 0.4,
        caterLevel: 0.2,
      }
      game.flights.push(flight)
      game.beginServicing(flight)
      game.speed = 1
      const canvas = document.querySelector('canvas')
      if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -550, bubbles: true, cancelable: true }))
    `),
  )
  await page.waitForTimeout(7000)
  const pose = await page.evaluate(
    call(`
      const game = window.__hatch
      const poses = game.servicePoses()
      const moved = poses.filter((p) => Math.hypot(p.x - 15, p.y - 10) > 0.4).length
      return { total: poses.length, moved, fuel: Math.round(game.groundBooks.fuelSales) }
    `),
  )
  console.log('ramp', pose, 'hidden for', Date.now() - hiddenAt, 'ms')
  const video = page.video()
  await page.close()
  await context.close()
  const src = await video?.path()
  if (src) {
    const { renameSync } = await import('node:fs')
    renameSync(src, `${OUT}/SLICE-D-ramp-raw.webm`)
    console.log('raw video', src)
  }
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.evaluate(
    call(`
      document.querySelectorAll('.hud, .hall-build, .owner-chrome, .hall-chrome, .coach').forEach((el) => {
        el.style.display = 'none'
      })
      const game = window.__hatch
      game.tiles[10][15] = 'depot'
      game.tiles[10][17] = 'kitchen'
      game.bumpMap()
      game.scheduleAuto = false
      game.schedule = []
      game.spawnCool = 1e9
      const stand = { c: 12, r: 21 }
      const flight = {
        id: 'flt-still',
        airline: 'northline',
        flightNo: 'NL100',
        airframeId: 'crj700',
        airframeName: 'CRJ-700',
        pax: 20,
        cargo: false,
        craft: 'jet',
        kind: 'regional',
        phase: 'servicing',
        stand,
        x: stand.c,
        y: stand.r,
        z: 0.12,
        heading: 0,
        path: [stand],
        seg: 0,
        t: 0,
        holdAngle: 0,
        posted: { landing: true, bags: false, bagsLoad: false, fuel: false, catering: false, bagDrop: false, mx: false, deiced: false },
        waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
        phaseTime: 30,
        ledger: [],
      }
      game.flights.push(flight)
      game.beginServicing(flight)
      game.speed = 1
      game.tick(4)
      const canvas = document.querySelector('canvas')
      if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -700, bubbles: true, cancelable: true }))
    `),
  )
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/SLICE-D-ramp.png` })
  console.log('still saved')
  await page.close()
}

await browser.close()

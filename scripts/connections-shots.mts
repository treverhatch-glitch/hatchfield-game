/**
 * Connections info view, hotel panel and a connections alert after a
 * simulated hub day. Needs `npm run dev -- --port 45217`.
 * Usage: tsx scripts/connections-shots.mts
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/screenshots/connections'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (err) => console.error('pageerror', err.message))
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(800)
  const stats = await page.evaluate(() => {
    type G = Record<string, any>
    const g = (window as unknown as { __hatch: G }).__hatch
    g.buildStarterKit()
    g.cash = 2_000_000
    g.fieldXp = 420
    g.researchPoints = 400
    g.buyResearch('transfer_centre')
    g.signed = ['harbor', 'northline', 'umazon']
    g.hubAirlines = ['harbor']
    g.scheduleAuto = false
    const fleet = ['harbor', 'harbor', 'northline', 'umazon']
    g.schedule = Array.from({ length: 40 }, (_, n) => ({
      id: `hub${n}`,
      airline: fleet[n % fleet.length],
      flightNo: `HB${200 + n}`,
      eta: g.clock + 4 + n * 12,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    }))
    g.offerCool = 1e9
    g.threatCool = 1e9
    g.emergencyCool = 1e9
    const origin = g.fits[0].origin
    let placed = false
    for (let r = 1; r < g.tiles.length - 1 && !placed; r++) {
      for (let c = 1; c < g.tiles[r].length - 1 && !placed; c++) {
        if (g.tiles[r][c] !== 'grass' || g.siteAt({ c, r })) continue
        if (Math.hypot(c - origin.c, r - origin.r) > 8) continue
        g.tiles[r][c] = 'hotel'
        g.hotelClass[`${c},${r}`] = 'inn'
        placed = true
      }
    }
    g.fits[0].rooms.dayhotel = 1
    const speed = g.speed
    g.speed = 1
    for (let t = 0; t < 190; t += 0.25) g.tick(0.25)
    g.speed = speed
    g.emit()
    return { day: g.connections.ledger.history.at(-1), night: g.connections.lastNight }
  })
  console.log(JSON.stringify(stats))
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^Connections/ }).first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-connections-view.png` })
  await page.getByRole('button', { name: /^Transfer bags/ }).click()
  await page.getByRole('button', { name: /^Stranded/ }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/02-connections-bags-stranded.png` })
  await page.getByRole('button', { name: /^Hotels/ }).first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-hotel-panel.png` })
  await page.getByTestId('hotel-rows').getByRole('button', { name: 'Show' }).first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/04-hotel-pan-to.png` })
} finally {
  await browser.close()
}

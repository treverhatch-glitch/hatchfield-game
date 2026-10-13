/** Stills and short clips for the Cities UI and the off-map approach. */
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

async function state(page: Page) {
  const read = new Function(`
    const g = window.__hatch
    if (!g) return null
    const live = g.flights.filter((f) => f.phase !== 'gone')
    return {
      offer: g.offer ? g.offer.airline : null,
      done: g.flightsDone,
      hist: g.econHist.length,
      income: g.incomePerHour,
      live: live.map((f) => ({
        no: f.flightNo,
        phase: f.phase,
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        z: Math.round(f.z * 10) / 10,
        pax: f.pax,
        bags: f.bagUnits || 0,
        name: f.airframeName,
      })),
    }
  `) as () => Promise<unknown>
  return page.evaluate(read) as Promise<{
    offer: string | null
    done: number
    hist: number
    income: number
    live: { no: string; phase: string; x: number; y: number; z: number; pax: number; bags: number; name: string }[]
  } | null>
}

async function zoomOut(page: Page) {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 400)
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await page.getByRole('button', { name: 'Stands' }).click()
  await page.screenshot({ path: `${OUT}/SLICE-A-toolbar.png` })
  console.log('toolbar')
  await page.getByRole('button', { name: '5x' }).first().click()
  const letter = page.getByTestId('contract-letter')
  await letter.waitFor({ timeout: 20000 })
  const letterBox = await page.getByTestId('letter-stack').boundingBox()
  console.log('letter box', letterBox)
  await letter.getByRole('button').first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/SLICE-A-letter.png` })
  console.log('letter', await state(page))
  await page.getByRole('button', { name: 'Accept' }).click()
  await page.getByTestId('tab-economy').click()
  await page.locator('.eco-tabs button', { hasText: 'Charts' }).click({ force: true })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${OUT}/SLICE-A-charts.png` })
  console.log('charts', await state(page))
  await page.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-a-ui', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  await page.getByRole('button', { name: 'Ops' }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Landside' }).click()
  await page.waitForTimeout(600)
  await page.getByTestId('tab-economy').click()
  await page.locator('.eco-tabs button', { hasText: 'Charts' }).click({ force: true })
  await page.waitForTimeout(700)
  await page.locator('.eco-tabs button', { hasText: 'Loans' }).click({ force: true })
  await page.waitForTimeout(700)
  const video = page.video()
  await context.close()
  if (video) await video.saveAs(`${OUT}/SLICE-A-ui.webm`)
  console.log('ui clip saved')
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-a-flight', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  await zoomOut(page)
  await page.getByRole('button', { name: '5x' }).first().click()
  const letter = page.getByTestId('contract-letter')
  await letter.waitFor({ timeout: 20000 })
  await letter.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Accept' }).click()
  await page.getByRole('button', { name: '1x' }).first().click()
  let sawApproach = false
  const start = Date.now()
  while (Date.now() - start < 90000) {
    const s = await state(page)
    const live = s?.live[0]
    if (live && (live.phase === 'approach' || live.phase === 'landing') && !sawApproach) {
      sawApproach = true
      await page.screenshot({ path: `${OUT}/SLICE-A-approach.png` })
      console.log('approach', s)
    }
    if (live && live.phase === 'takeoff') {
      await page.screenshot({ path: `${OUT}/SLICE-A-departure.png` })
      console.log('departure', s)
    }
    if ((s?.done ?? 0) >= 1) {
      console.log('done', s)
      break
    }
    await page.waitForTimeout(400)
  }
  const video = page.video()
  await context.close()
  if (video) await video.saveAs(`${OUT}/SLICE-A-departure.webm`)
  console.log('flight clip saved', { sawApproach })
}

await browser.close()

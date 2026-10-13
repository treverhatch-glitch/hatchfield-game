/** Browser check for the 13 Oct owner decisions: info submenu and an empty-counter wish. */
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

function call(body: string) {
  return new Function(body) as () => unknown
}

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
  await page.waitForTimeout(300)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await boot(page)

const buttons = page.getByTestId('info-hotspots')
await buttons.waitFor()
const buttonText = await buttons.innerText()
console.log('hotspot buttons', buttonText.replace(/\n/g, ' | '))
if (/\d/.test(buttonText)) {
  console.log('FAIL buttons contain a number')
  process.exitCode = 1
}
const flow = page.getByTestId('flow-toggle').locator('input')
console.log('flows checked', await flow.isChecked())
if (await flow.isChecked()) {
  console.log('FAIL flows should start off')
  process.exitCode = 1
}

await page.getByTestId('info-hotspot-queue').click()
const panel = page.getByTestId('info-panel')
await panel.waitFor()
const panelText = await panel.innerText()
console.log('panel', panelText.replace(/\n/g, ' | '))
if (!/\d+ waiting at security/.test(panelText)) {
  console.log('FAIL panel missing the queue count')
  process.exitCode = 1
}
await page.screenshot({ path: `${OUT}/OCT13-info.png` })

await page.getByRole('button', { name: 'Hall', exact: true }).click()
const wish = await page.evaluate(
  call(`
    const game = window.__hatch
    game.foodShelf = 0
    game.demoHallCrowd(1)
    const g = game.hallGuests[game.hallGuests.length - 1]
    g.node = 'food'
    g.path = []
    g.needs.hunger = 90
    g.wallet = 80
    g.prefs.food = 1
    g.clearedSec = true
    const cash = game.cash
    game.serveNode(g, game.hallOpen())
    game.selectedGuest = g.id
    game.emit()
    return {
      thought: g.thought,
      lostSpend: game.lostSpend,
      cashSame: game.cash === cash,
      left: g.path.length > 1 && g.path[g.path.length - 1] !== 'food',
      happyDrop: g.happiness,
    }
  `),
)
console.log('wish', JSON.stringify(wish))
const result = wish as {
  thought: string
  lostSpend: number
  cashSame: boolean
  left: boolean
}
if (result.thought !== 'wish they had burgers' || !result.cashSame || result.lostSpend <= 0 || !result.left) {
  console.log('FAIL empty counter')
  process.exitCode = 1
}
await page.getByTestId('guest-thought').waitFor()
const card = await page.getByTestId('guest-thought').innerText()
console.log('card', card)
if (!card.includes('wish they had burgers')) {
  console.log('FAIL thought card')
  process.exitCode = 1
}
await page.screenshot({ path: `${OUT}/OCT13-wish.png` })
await browser.close()
console.log(process.exitCode ? 'browser check failed' : 'browser check ok')

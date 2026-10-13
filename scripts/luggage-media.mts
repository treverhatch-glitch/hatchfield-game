/** Stills and a short clip of the passenger bag chain. */
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

async function parade(page: Page) {
  await page.evaluate(
    call(`
      document.querySelectorAll('.hud, .hall-build, .owner-chrome, .hall-chrome, .coach').forEach((el) => {
        el.style.display = 'none'
      })
      const game = window.__hatch
      game.speed = 0
      game.demoBagParade()
      game.setView('hall')
    `),
  )
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page)
  await parade(page)
  await page.waitForTimeout(600)
  const counts = await page.evaluate(
    call(`
      const game = window.__hatch
      const g = game.hallGuests
      return {
        n: g.length,
        checked: g.filter((p) => p.hasChecked).length,
        carry: g.filter((p) => p.carryOn !== false).length,
        claim: g.filter((p) => p.node === 'claim').length,
        checkin: g.filter((p) => p.node === 'checkin').length,
        motion: game.luggageMotion(),
        lost: game.bagsLost,
      }
    `),
  )
  console.log('parade', counts)
  await page.screenshot({ path: `${OUT}/LUGGAGE-hall.png` })
  const canvas = page.locator('.view-layer.live canvas')
  await canvas.dispatchEvent('wheel', { deltaY: -400 })
  await page.keyboard.down('a')
  await page.keyboard.down('w')
  await page.waitForTimeout(700)
  await page.keyboard.up('a')
  await page.keyboard.up('w')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/LUGGAGE-checkin.png` })
  await page.keyboard.down('d')
  await page.keyboard.down('s')
  await page.waitForTimeout(1400)
  await page.keyboard.up('d')
  await page.keyboard.up('s')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/LUGGAGE-claim.png` })
  await page.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/luggage-hall', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page)
  await parade(page)
  await page.waitForTimeout(4500)
  const video = page.video()
  await page.close()
  await context.close()
  const src = await video?.path()
  if (src) {
    const { renameSync } = await import('node:fs')
    renameSync(src, `${OUT}/LUGGAGE-hall.webm`)
    console.log('video', src)
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
      game.speed = 0
      game.demoBagParade()
      game.setView('apron')
    `),
  )
  await page.waitForTimeout(400)
  const canvas = page.locator('.view-layer.live canvas')
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + 240, box.y + 400)
    await page.mouse.down()
    await page.mouse.move(box.x + 840, box.y + 360, { steps: 24 })
    await page.mouse.up()
  }
  for (let i = 0; i < 4; i++) await canvas.dispatchEvent('wheel', { deltaY: -280 })
  await page.waitForTimeout(400)
  const cart = await page.evaluate(
    call(`
      const game = window.__hatch
      const t = game.trucks.find((x) => x.id === 'parade-cart')
      return t ? { x: t.x, y: t.y, cargo: t.cargoUnits } : null
    `),
  )
  console.log('cart', cart)
  await page.screenshot({ path: `${OUT}/LUGGAGE-apron.png` })
  await page.close()
}

await browser.close()
console.log('done')

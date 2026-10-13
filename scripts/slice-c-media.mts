/** Stills and a UI-hidden construction clip for the prefab / build slice. */
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

async function boot(page: Page, hall = false) {
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
  if (hall) {
    await page.getByRole('button', { name: 'Hall', exact: true }).click()
    await page.getByTestId('prefab-ceilings').waitFor()
  }
  await page.waitForTimeout(600)
}

function call(body: string) {
  return new Function(body) as () => unknown
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page, true)
  await page.screenshot({ path: `${OUT}/SLICE-C-linear.png` })
  console.log('linear', await page.getByTestId('prefab-ceilings').innerText())
  await page.close()
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await boot(page, true)
  await page.evaluate(
    call(`
      const game = window.__hatch
      game.speed = 5
      game.cash = 200000
      game.demoHallCrowd(36)
      game.markHallOverloaded()
    `),
  )
  // Hints live behind the collapsed advisor badge.
  await page.getByTestId('hint-badge').click()
  await page.getByTestId('advice-over-capacity').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/SLICE-C-advisor.png` })
  console.log('advisor', await page.getByTestId('advice-over-capacity').innerText())
  await page.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/slice-c-build', size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await boot(page, false)
  await page.evaluate(
    call(`
      document.querySelectorAll('.hud, .hall-build, .owner-chrome, .hall-chrome, .coach').forEach((el) => {
        el.style.display = 'none'
      })
      const game = window.__hatch
      game.speed = 5
      let cell = null
      for (let r = 1; r < 31 && !cell; r++) {
        for (let c = 1; c < 31; c++) {
          const v = { c, r }
          if (game.tile(v) !== 'grass') continue
          const near = [{ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 }].some((p) => {
            const t = game.tile(p)
            return t === 'road' || t === 'taxi' || t === 'guard'
          })
          if (near) { cell = v; break }
        }
      }
      game.setTool('stand')
      game.placeSingle(cell)
      window.__buildCell = cell
    `),
  )
  const started = Date.now()
  let done = false
  while (Date.now() - started < 20000) {
    done = Boolean(
      await page.evaluate(
        call(`
          const game = window.__hatch
          const cell = window.__buildCell
          return game.sites.length === 0 && cell && game.tile(cell) === 'stand'
        `),
      ),
    )
    if (done) break
    await page.waitForTimeout(250)
  }
  console.log('build finished', done, 'in', Date.now() - started, 'ms')
  await page.waitForTimeout(800)
  const video = page.video()
  await page.close()
  if (video) await video.saveAs(`${OUT}/SLICE-C-build.webm`)
  await context.close()
}

await browser.close()
console.log('media done')

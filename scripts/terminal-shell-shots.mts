/**
 * Airport palette and terminal-interior stills.
 * Usage: SHOT_TAG=before OUT=docs/devlog/media/terminal-shell-build npx tsx scripts/terminal-shell-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || 'docs/devlog/media/terminal-shell-build'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.argv[2] || process.env.SHOT_TAG || 'before'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const call = (body: string) => new Function(body) as () => unknown

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high')`))
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(call(`return Boolean(window.__hatch && window.__hatch.site)`), null, { timeout: 20000 })
const kit = page.getByTestId('starter-kit-coach')
if (await kit.count()) await kit.click()
else await page.evaluate(call(`window.__hatch.buildStarterKit()`))
await page.waitForFunction(call(`return !window.__hatch.showStarterKit()`), null, { timeout: 20000 })
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.waitForFunction(call(`return Boolean(window.__world && window.__hatch.fits && window.__hatch.fits.length)`), null, { timeout: 20000 })
await page.evaluate(call(`window.__hatch.speed = 0; window.__hatch.camGoal = null`))
await page.waitForTimeout(600)

await page.getByTestId('build-terminal').click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/airport-palette-${TAG}.png` })

await page.getByTestId('build-retail').click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/airport-retail-${TAG}.png` })

await page.evaluate(call(`window.__hatch.setView('hall')`))
await page.waitForSelector('canvas.hall-canvas', { timeout: 15000 })
await page.waitForTimeout(900)
const rooms = page.getByTestId('kit-tab-rooms')
if (await rooms.count()) await rooms.click()
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/terminal-palette-${TAG}.png` })

if (TAG === 'after') {
  const expanded = await page.evaluate(call(`
    const g = window.__hatch
    g.setView('apron')
    g.sandbox = true
    g.cash = 9000000
    const origin = g.fits[0].origin
    const tries = [
      { c: origin.c + 3, r: origin.r },
      { c: origin.c - 2, r: origin.r },
      { c: origin.c, r: origin.r + 3 },
      { c: origin.c, r: origin.r - 2 },
    ]
    let kind = null
    for (const at of tries) {
      const before = g.sites.length
      g.placeTerminal(at)
      const site = g.sites.at(-1)
      if (g.sites.length > before && site && site.kind === 'expand') {
        kind = site.kind
        g.finishSite(site)
        break
      }
    }
    g.setView('hall')
    return { kind, fits: g.fits.length, cols: g.fits[0].zones[0].length, extra: g.fits[0].floorExtra, news: g.news[0] && g.news[0].text }
  `))
  console.log(expanded)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/terminal-expanded-${TAG}.png` })
}

if (errors.length) console.error(errors.join('\n'))
await browser.close()
console.log(`wrote ${OUT} tag=${TAG}`)

/**
 * Stills of the tier III landmarks and the Ops-wallet solar and battery pieces.
 *   npx vite --port 45217 &
 *   SHOT_URL=http://127.0.0.1:45217 npx tsx scripts/landmark-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/screens/landmarks'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

function call(body: string) {
  return new Function(body) as () => unknown
}

async function boot(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'high')`))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  const dock = page.getByTestId('starter-kit-dock')
  if (await dock.count()) await dock.click({ timeout: 15000 })
  else await page.evaluate(call('window.__hatch.buildStarterKit()'))
  await page.evaluate(call('window.__hatch.speed = 0'))
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await boot(page)

const placed = await page.evaluate(
  call(`const g = window.__hatch
    g.cash = 50000000
    g.fieldXp = 20000
    const ids = ['observation_tower','aviation_museum','sky_garden','art_concourse','grand_arrivals_hall','quiet_hall']
    const out = []
    let c = 2
    for (const id of ids) {
      let done = false
      for (let r = 2; r < 30 && !done; r++) {
        for (let cc = 2; cc < 30 && !done; cc++) {
          if (g.tiles[r][cc] !== 'grass') continue
          if (![[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => g.tiles[r+dr]?.[cc+dc] === 'road')) continue
          g.setTool('pan'); g.setTool(id); g.clickTile({ c: cc, r })
          if (g.lateSites.some((s) => s.id === id)) { out.push({ id, c: cc, r }); done = true }
        }
      }
    }
    for (let i = 0; i < 40; i++) { g.clock += 180; g.tickPayroll(0) }
    g.setTool('pan')
    return out`),
)
console.log('placed', JSON.stringify(placed))
await page.evaluate(call(`window.__hatch.setView("apron")`))
for (const row of placed as { id: string; c: number; r: number }[]) {
  await page.evaluate(
    call(`const g = window.__hatch; g.camGoal = { view: 'apron', c: ${row.c}, r: ${row.r}, seq: (g.camGoal?.seq ?? 0) + 1 }; return true`),
  )
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/${row.id}.png` })
}
console.log('errors', JSON.stringify(errors))
await browser.close()

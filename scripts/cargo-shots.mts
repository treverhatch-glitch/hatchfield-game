/**
 * Stills of cargo hub II, the cold store, and the Ops-wallet solar array and battery bank.
 *   npx vite --port 45217 &
 *   SHOT_URL=http://127.0.0.1:45217 npx tsx scripts/landmark-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/screens/cargo-late'
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
    g.sandbox = true
    for (const id of ['cargo.t1','cargo.t2','safety_security.t1','safety_security.t2','safety_security.t3','cargo.t3','cargo.t4','sustainability.t1','sustainability.t2']) g.buyOpsTech(id)
    g.sandbox = false
    const out = []
    const free = (pred) => {
      for (let r = 2; r < 30; r++) for (let c = 2; c < 30; c++) {
        if (g.tiles[r][c] !== 'grass') continue
        if (!pred(c, r)) continue
        return { c, r }
      }
      return null
    }
    const roadBeside = (c, r) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => g.tiles[r+dr]?.[c+dc] === 'road')
    const hubCell = free((c, r) => roadBeside(c, r) && c > 4)
    g.tiles[hubCell.r][hubCell.c] = 'nighthub'
    out.push({ id: 'nighthub', ...hubCell })
    for (const id of ['cargo_hub_ii','cold_store']) {
      const cell = free((c, r) => roadBeside(c, r) && !(c === hubCell.c && r === hubCell.r))
      g.setTool('pan'); g.setTool(id); g.clickTile({ c: cell.c, r: cell.r })
      if (g.lateSites.some((s) => s.id === id)) out.push({ id, c: cell.c, r: cell.r })
    }
    for (let i = 0; i < 30; i++) { g.clock += 180; g.tickPayroll(0) }
    g.setTool('pan')
    return out`),
)
console.log('placed', JSON.stringify(placed))
await page.evaluate(call(`window.__hatch.setView("apron")`))
for (const row of placed as { id: string; c: number; r: number }[]) {
  if (row.id === 'nighthub') continue
  await page.evaluate(
    call(`const g = window.__hatch; g.camGoal = { view: 'apron', c: ${row.c}, r: ${row.r}, seq: (g.camGoal?.seq ?? 0) + 1 }; return true`),
  )
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/${row.id}.png` })
}
const info = await page.evaluate(call(`const g = window.__hatch; return g.lateSites.map((s) => g.infoLines('late-site:' + s.c + ',' + s.r))`))
console.log('info', JSON.stringify(info))
console.log('errors', JSON.stringify(errors))
await browser.close()

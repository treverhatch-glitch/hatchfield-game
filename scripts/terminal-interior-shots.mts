/**
 * Terminal interior editor stills.
 * Usage: OUT=docs/devlog/media/terminal-interior npx tsx scripts/terminal-interior-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || 'docs/devlog/media/terminal-interior'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
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
await page.evaluate(call(`window.__hatch.speed = 0; window.__hatch.camGoal = null; window.__hatch.setView('hall')`))
await page.waitForSelector('[data-testid="interior-bar"]', { timeout: 15000 })
await page.waitForTimeout(800)
await page.getByTestId('interior-wall').click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/interior-tools.png` })

await page.getByTestId('interior-floor').click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/interior-paints.png` })

const built = await page.evaluate(call(`
  const g = window.__hatch
  g.sandbox = true
  g.cash = 9000000
  g.dragInteriorWall({ x: 4, y: 3 }, { x: 7, y: 3 }, false)
  g.paintInteriorFloor([{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }], 'gate_carpet')
  g.paintInteriorWalls([{ x: 4, y: 3, dir: 'S' }, { x: 5, y: 3, dir: 'S' }], 'wall_panel')
  g.placeInteriorDoor({ x: 6, y: 3, dir: 'S' })
  const assigned = g.assignInteriorRoom('retail', { x: 4, y: 4, w: 3, h: 2 })
  const room = g.activeHall().interior.rooms[0]
  const before = room ? g.interiorFindings(room.id).map((f) => f.title) : []
  if (room) g.furnishInteriorRoom(room.id)
  const after = room ? g.interiorFindings(room.id).map((f) => f.title) : []
  return { assigned, id: room && room.id, walls: g.activeHall().interior.walls.length, before, after }
`))
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/interior-built.png` })

const roomId = (built as { id?: string }).id
if (roomId) {
  await page.getByTestId(`interior-room-${roomId}`).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/interior-room.png` })
}
console.log(JSON.stringify({ built, errors }, null, 2))
await browser.close()

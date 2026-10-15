/**
 * Before/after stills for the r9 building port.
 *   SHOT_TAG=before SHOT_URL=http://127.0.0.1:45217/ npx tsx scripts/buildings-r9-shots.mts
 * Writes docs/devlog/media/buildings-r9/<tag>-{fuel,hangar-small,hangar-wide,hangar-jumbo}.png
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media/buildings-r9'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.env.SHOT_TAG || 'after'
const CHROME = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find((p) => existsSync(p))

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'high')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForTimeout(400)

await page.evaluate(() => {
  const g = (window as unknown as {
    __hatch: {
      speed: number
      tiles: string[][]
      hangarScale: Record<string, string>
      bumpMap: () => void
    }
  }).__hatch
  g.speed = 0
  for (let r = 1; r <= 20; r++) {
    for (let c = 1; c <= 28; c++) g.tiles[r]![c] = 'grass'
  }
  g.tiles[4]![4] = 'fuel'
  g.tiles[5]![12] = 'hangar'
  g.hangarScale['12,5'] = 'small'
  g.tiles[14]![12] = 'hangar'
  g.hangarScale['12,14'] = 'wide'
  g.tiles[8]![24] = 'hangar'
  g.hangarScale['24,8'] = 'jumbo'
  g.bumpMap()
})
await page.waitForTimeout(600)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
})

async function look(page: Page, c: number, r: number, dist: number) {
  await page.evaluate(
    ({ c, r, dist }) => {
      const w = (window as unknown as {
        __world: { pivot: { set: (x: number, y: number, z: number) => void }; yaw: number; pitch: number; dist: number; placeCam: () => void }
      }).__world
      const cell = 22 * 0.45
      const x = (c - 15.5) * cell
      const z = (r - 15.5) * cell
      w.pivot.set(x, 0, z)
      w.yaw = 0.55
      w.pitch = 0.62
      w.dist = dist
      w.placeCam()
    },
    { c, r, dist },
  )
  await page.waitForTimeout(500)
}

const shots: [string, number, number, number][] = [
  ['fuel', 4, 4, 32],
  ['hangar-small', 12, 5, 58],
  ['hangar-wide', 12, 14, 78],
  ['hangar-jumbo', 24, 8, 96],
]
for (const [name, c, r, dist] of shots) {
  await look(page, c, r, dist)
  const path = `${OUT}/${TAG}-${name}.png`
  await page.screenshot({ path })
  console.log('wrote', path)
}
await browser.close()

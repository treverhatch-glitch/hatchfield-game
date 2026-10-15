/**
 * Hall stills for the interior texture pass.
 * Dev server: npx vite --host 127.0.0.1 --port 45217
 *   SHOT_TAG=before npx tsx scripts/texture-shots.mts
 * Writes docs/devlog/media/textures/<tag>-<name>.png
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media/textures'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.env.SHOT_TAG || 'after'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', 'high')
  localStorage.setItem('hatchfield-texture-quality', 'high')
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
const coach = page.getByTestId('starter-kit-coach')
if (await coach.count()) await coach.click()
await page.waitForFunction(
  () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
)
const gotIt = page.getByRole('button', { name: 'Got it' })
if (await gotIt.count()) await gotIt.click().catch(() => {})
await page.evaluate(() => {
  const g = (window as unknown as { __hatch: { setView: (v: string) => void; speed: number } }).__hatch
  g.setView('hall')
  g.speed = 0
})
await page.waitForFunction(() => {
  const hall = (window as unknown as { __hall?: { scene?: { getObjectByName: (n: string) => unknown } } }).__hall
  return Boolean(hall?.scene?.getObjectByName('terminal-floor') || hall?.scene?.getObjectByName('terminal-carpet'))
})
await page.waitForTimeout(1800)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
})

async function frameRoom(page: Page, kind: string, dist: number) {
  return page.evaluate(
    ({ roomKind, camDist }) => {
      const hall = (window as unknown as {
        __hall: {
          interior: { plan: { rooms: { rooms: { kind: string; x: number; z: number; squares: unknown[] }[] } } } | null
          interiorFit: { scale: number; cx: number; cz: number } | null
          dist: number
          pitch: number
          yaw: number
          pivot: { set: (x: number, y: number, z: number) => void }
          placeCam: () => void
          goalTo: unknown
          scene: { getObjectByName: (n: string) => { material?: { map?: { image?: { width?: number } } } } | null }
        }
      }).__hall
      const game = (window as unknown as { __hatch: { camGoal: unknown } }).__hatch
      const fit = hall.interiorFit
      const rooms = hall.interior?.plan.rooms.rooms ?? []
      const room = rooms.filter((r) => r.kind === roomKind).sort((a, b) => b.squares.length - a.squares.length)[0]
      if (!room || !fit) return { ok: false, kind: roomKind }
      const x = (room.x - fit.cx) * fit.scale
      const z = (room.z - fit.cz) * fit.scale
      game.camGoal = null
      hall.goalTo = null
      hall.dist = camDist
      hall.pitch = 1.05
      hall.yaw = 0.4
      hall.pivot.set(x, 0, z)
      hall.placeCam()
      const wall = hall.scene.getObjectByName('room-walls')
      const tex = wall?.material?.map?.image?.width ?? 0
      return { ok: true, kind: roomKind, x, z, wallTex: tex }
    },
    { roomKind: kind, camDist: dist },
  )
}

const shots = [
  ['gate', 'gate', 11],
  ['security', 'security', 11],
  ['shops', 'shops', 11],
  ['checkin', 'desks', 10],
  ['office', 'office', 10],
  ['airside', 'lounge', 12],
] as const

for (const [kind, file, dist] of shots) {
  const framed = await frameRoom(page, kind, dist)
  if (!framed.ok) {
    console.log('skip', file, framed)
    continue
  }
  await page.waitForTimeout(900)
  const path = `${OUT}/${TAG}-${file}.png`
  await page.screenshot({ path })
  console.log('wrote', path, framed)
}

console.log(JSON.stringify({ tag: TAG, errors: errors.slice(0, 6) }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)

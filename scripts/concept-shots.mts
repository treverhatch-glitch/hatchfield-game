/**
 * Stills for the gadget shop, food court, and jet-bridge interior.
 *   SHOT_TAG=before npx tsx scripts/concept-shots.mts
 * Writes docs/devlog/media/textures/<tag>-{gadget,food,jet}.png
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
  return Boolean(hall?.scene?.getObjectByName('hall-jet-bridge') || hall?.scene?.getObjectByName('terminal-floor'))
})
await page.waitForTimeout(1600)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
})

async function lookAt(page: Page, x: number, z: number, dist: number, pitch: number, yaw: number) {
  await page.evaluate(
    ({ x, z, dist, pitch, yaw }) => {
      const hall = (window as unknown as {
        __hall: {
          dist: number
          pitch: number
          yaw: number
          pivot: { set: (x: number, y: number, z: number) => void }
          placeCam: () => void
          goalTo: unknown
        }
      }).__hall
      const game = (window as unknown as { __hatch: { camGoal: unknown } }).__hatch
      game.camGoal = null
      hall.goalTo = null
      hall.dist = dist
      hall.pitch = pitch
      hall.yaw = yaw
      hall.pivot.set(x, 0, z)
      hall.placeCam()
    },
    { x, z, dist, pitch, yaw },
  )
}

function roomCenter(page: Page, kind: string) {
  return page.evaluate((roomKind) => {
    const hall = (window as unknown as {
      __hall: {
        interior: { plan: { rooms: { rooms: { kind: string; x: number; z: number; squares: unknown[] }[] } } } | null
        interiorFit: { scale: number; cx: number; cz: number } | null
      }
    }).__hall
    const fit = hall.interiorFit
    const rooms = hall.interior?.plan.rooms.rooms ?? []
    const room = rooms.filter((r) => r.kind === roomKind).sort((a, b) => b.squares.length - a.squares.length)[0]
    if (!room || !fit) return null
    return { x: (room.x - fit.cx) * fit.scale, z: (room.z - fit.cz) * fit.scale }
  }, kind)
}

function anchorCenter(page: Page, name: string) {
  return page.evaluate((anchor) => {
    const hall = (window as unknown as {
      __hall: {
        interiorFit: { scale: number; cx: number; cz: number } | null
        scene: { getObjectByName: (n: string) => { userData?: { anchors?: Record<string, { x: number; z: number }> } } | null }
      }
    }).__hall
    const fit = hall.interiorFit
    const hit = hall.scene.getObjectByName('interior-dressing')?.userData?.anchors?.[anchor]
    if (!hit || !fit) return null
    return { x: (hit.x - fit.cx) * fit.scale, z: (hit.z - fit.cz) * fit.scale }
  }, name)
}

const shops = (await anchorCenter(page, 'gadget')) ?? (await roomCenter(page, 'shops'))
const food = (await anchorCenter(page, 'food')) ?? shops
if (shops) {
  await lookAt(page, shops.x, shops.z, 10, 0.95, 0.55)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${TAG}-gadget.png` })
  console.log('wrote', `${TAG}-gadget`, shops)
}
if (food) {
  await lookAt(page, food.x, food.z, 11, 0.85, -0.4)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${TAG}-food.png` })
  console.log('wrote', `${TAG}-food`, food)
}

const jet = await page.evaluate(() => {
  const hall = (window as unknown as {
    __hall: {
      scene: {
        getObjectByName: (n: string) => {
          updateWorldMatrix: (a: boolean, b: boolean) => void
          traverse: (fn: (o: {
            isInstancedMesh?: boolean
            count?: number
            matrixWorld: { elements: number[] }
            instanceMatrix?: { array: ArrayLike<number> }
          }) => void) => void
        } | null
      }
    }
  }).__hall
  const jb = hall.scene.getObjectByName('hall-jet-bridge')
  if (!jb) return null
  jb.updateWorldMatrix(true, true)
  let minX = 1e9
  let maxX = -1e9
  let minZ = 1e9
  let maxZ = -1e9
  let n = 0
  jb.traverse((o) => {
    if (!o.isInstancedMesh || !o.instanceMatrix || !o.count) return
    n += o.count
    const e = o.matrixWorld.elements
    const a = o.instanceMatrix.array
    for (let i = 0; i < o.count; i++) {
      const o16 = i * 16
      const x = a[o16 + 12]
      const y = a[o16 + 13]
      const z = a[o16 + 14]
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12]
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14]
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
      minZ = Math.min(minZ, wz)
      maxZ = Math.max(maxZ, wz)
    }
  })
  const alongX = maxX - minX >= maxZ - minZ
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    yaw: alongX ? 0.15 : Math.PI / 2 + 0.15,
    span: [maxX - minX, maxZ - minZ],
    parts: n,
  }
})
if (jet) {
  await lookAt(page, jet.x, jet.z, 16, 1.15, jet.yaw)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${TAG}-jet.png` })
  console.log('wrote', `${TAG}-jet`, jet)
} else console.log('skip jet')

console.log(JSON.stringify({ tag: TAG, errors: errors.slice(0, 6) }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)

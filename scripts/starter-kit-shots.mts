/**
 * Stills of each starter kit on the apron, plus the passenger hall.
 * Dev server: `npx vite --host 127.0.0.1 --port 45217`
 * Usage: SHOT_TAG=before npx tsx scripts/starter-kit-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const OUT = 'docs/devlog/media/starter_kits'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45217/'
const TAG = process.env.SHOT_TAG || 'after'
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

const call = (body: string) => new Function(body) as () => unknown

async function dismiss(page: Page) {
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
}

async function stamp(page: Page, focus: 'pax' | 'cargo' | 'hybrid') {
  await page.evaluate(call('localStorage.clear(); sessionStorage.clear(); localStorage.setItem("hatchfield-gfx", "high")'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId(`start-${focus}`).click()
  await page.waitForFunction(() => Boolean((window as unknown as { __hatch?: { site?: string } }).__hatch?.site))
  const coach = page.getByTestId('starter-kit-coach')
  if (await coach.count()) await coach.click()
  else {
    await page.evaluate(call('window.__hatch.buildStarterKit()'))
  }
  await page.waitForFunction(
    () => !(window as unknown as { __hatch: { showStarterKit: () => boolean } }).__hatch.showStarterKit(),
  )
  await dismiss(page)
  await page.waitForTimeout(500)
  await page.addStyleTag({
    content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }',
  })
}

async function frameApron(page: Page, c: number, r: number) {
  await page.evaluate(
    call(`
      const g = window.__hatch
      const w = window.__world
      g.setView('apron')
      g.speed = 0
      const CELL = 22 * 0.45
      const HALF = 15.5
      const tx = (${c} - HALF) * CELL
      const tz = (${r} - HALF) * CELL
      const lock = { cx: tx + 28, cy: 22, cz: tz + 34, tx, ty: 2, tz }
      if (w && !w.__kitWrapped) {
        const gl = w.renderer.render.bind(w.renderer)
        w.renderer.render = function (scene, camera) {
          const l = w.__kitLock
          if (l) {
            w.camera.position.set(l.cx, l.cy, l.cz)
            w.camera.lookAt(l.tx, l.ty, l.tz)
            w.camera.updateMatrixWorld()
          }
          return gl(scene, camera)
        }
        w.__kitWrapped = true
      }
      if (w) w.__kitLock = lock
      return lock
    `),
  )
  await page.waitForTimeout(700)
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors: string[] = []
page.on('pageerror', (err) => errors.push(err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })

const kits = [
  { focus: 'pax', c: 14, r: 9 },
  { focus: 'cargo', c: 12, r: 10 },
  { focus: 'hybrid', c: 14, r: 9 },
] as const

for (const kit of kits) {
  await stamp(page, kit.focus)
  await frameApron(page, kit.c, kit.r)
  await page.screenshot({ path: `${OUT}/${kit.focus}-apron-${TAG}.png` })
  if (kit.focus !== 'cargo') {
    await page.evaluate(
      call(`
        const g = window.__hatch
        g.setView('hall')
        g.speed = 0
        const fit = g.fits[0]
        const cell = g.zoneCellsOf(fit, 'checkin')[0]
        if (cell) g.camGoal = { view: 'hall', c: cell.c, r: cell.r, seq: (g.camGoal?.seq ?? 0) + 1 }
      `),
    )
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/${kit.focus}-hall-${TAG}.png` })
  }
}

console.log(JSON.stringify({ tag: TAG, errors: errors.slice(0, 8) }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)

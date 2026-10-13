/**
 * Slice E graphics stills + FPS. `before` renders the legacy apron; `after` attaches
 * src/render/world/ to the live World through a prototype hook (no UI edits needed).
 *   npx tsx scripts/slice-e-media.mts before
 *   npx tsx scripts/slice-e-media.mts after [low|med|high]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const mode = (process.argv[2] ?? 'after') as 'before' | 'after'
const quality = process.argv[3] ?? 'med'
const OUT = process.env.SLICE_E_OUT ?? 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
]

function call<T>(body: string) {
  return new Function('arg', body) as (arg: T) => unknown
}

async function boot(page: Page) {
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text())
  })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  // Hook the World before Field mounts so the first frame already has the layer.
  await page.evaluate(
    call<{ mode: string; quality: string }>(`
      return (async () => {
        const mod = await import('/src/render/world.ts')
        const proto = mod.World.prototype
        const orig = proto.render
        let wr = null
        if (arg.mode === 'after') {
          const w = await import('/src/render/world/index.ts')
          proto.render = function (game) {
            window.__world = this
            if (!wr) {
              wr = w.initWorldRender(this.scene, arg.quality, { renderer: this.renderer, sun: this.sun })
              window.__wr = wr
            }
            this.resize()
            this.applyPerfMode(game)
            this.rebuildTiles(game)
            wr.hideLegacyTiles(this.tilesGroup, game)
            this.syncGhost(game)
            this.syncEntities(game)
            this.syncSites(game)
            wr.update(game, this.camera, 1 / 60)
            this.renderer.render(this.scene, this.camera)
          }
        } else {
          proto.render = function (game) {
            window.__world = this
            return orig.call(this, game)
          }
        }
      })()
    `),
    { mode, quality },
  )
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('tab-economy').click()
  await page.getByTestId('starter-kit').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(800)
}

async function cam(page: Page, view: { x: number; z: number; dist: number; pitch: number; yaw: number; hour?: number }) {
  await page.evaluate(
    call<typeof view>(`
      const w = window.__world
      w.pivot.set(arg.x, 0, arg.z)
      w.dist = arg.dist
      w.pitch = arg.pitch
      w.yaw = arg.yaw
      w.placeCam()
      if (window.__wr && arg.hour != null) window.__wr.setTimeOfDay(arg.hour)
      if (window.__wr && arg.hour == null) window.__wr.setTimeOfDay(null)
    `),
    view,
  )
  await page.waitForTimeout(900)
}

async function fps(page: Page, ms = 3000): Promise<number> {
  return (await page.evaluate(
    call<number>(`
      return new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const step = (now) => {
          frames += 1
          if (now - start < arg) requestAnimationFrame(step)
          else resolve(Math.round((frames * 1000) / (now - start)))
        }
        requestAnimationFrame(step)
      })
    `),
    ms,
  )) as number
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await boot(page)
const tag = mode === 'before' ? 'before' : `after-${quality}`
// Starter hall sits at c15–17, r19–21 → world centre ≈ (3.1, 0, 27.9).
const shots = [
  { name: 'wide', x: 0, z: 20, dist: 150, pitch: 0.95, yaw: 0.72 },
  { name: 'mid', x: 3, z: 26, dist: 60, pitch: 0.8, yaw: 0.55 },
  { name: 'close', x: 3, z: 28, dist: 28, pitch: 0.7, yaw: 0.45 },
  { name: 'closest', x: 4, z: 29, dist: 14, pitch: 0.62, yaw: 0.4 },
]
if (process.env.SLICE_E_HUD !== '1') {
  // Hide UI chrome so the field reads; the canvas and its ancestors stay visible.
  await page.addStyleTag({ content: '.hud, .owner-chrome, .coach, .bottom-bar, .inspect-card, .news { display: none !important; }' })
}
const report: Record<string, number> = {}
for (const s of shots) {
  await cam(page, s)
  await page.screenshot({ path: `${OUT}/SLICE-E-${tag}-${s.name}.png` })
  report[s.name] = await fps(page)
  console.log(tag, s.name, 'fps', report[s.name])
}
if (mode === 'after') {
  await cam(page, { ...shots[1], hour: 22 })
  await page.screenshot({ path: `${OUT}/SLICE-E-${tag}-night.png` })
  report.night = await fps(page)
  await cam(page, { ...shots[2], hour: 21.5 })
  await page.screenshot({ path: `${OUT}/SLICE-E-${tag}-night-close.png` })
  report.nightClose = await fps(page)
  console.log(tag, 'night fps', report.night, report.nightClose)
  const stats = await page.evaluate(call<null>(`return window.__wr.stats()`))
  console.log('stats', JSON.stringify(stats))
}
writeFileSync(`/tmp/slice-e-${tag}.json`, JSON.stringify(report, null, 2))
await browser.close()

/**
 * Visual rounds 1–2: apron stills and a short Low-quality FPS sample.
 * Dev server required (`npx vite --port 45217`). SwiftShader, same flags as the heavy bot.
 *
 *   npx tsx scripts/visual-rounds-shots.mts before|after [low|med|high]
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const TAG = process.argv[2] ?? 'after'
const GFX = process.argv[3] ?? 'low'
const OUT = process.env.SHOT_OUT ?? 'docs/devlog/media'
mkdirSync(OUT, { recursive: true })
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'
const args = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--no-sandbox',
]

function call(body: string) {
  return new Function(body) as () => unknown
}

async function fps(page: Page, ms = 3000): Promise<{ min: number; avg: number }> {
  return page.evaluate(
    new Function(
      'duration',
      `return new Promise((resolve) => {
        const gaps = []
        const start = performance.now()
        let last = start
        const step = (now) => {
          gaps.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(step)
          else {
            const body = gaps.slice(1)
            const worst = Math.max(...body)
            resolve({ min: Math.round(1000 / worst), avg: Math.round((body.length * 1000) / (now - start)) })
          }
        }
        requestAnimationFrame(step)
      })`,
    ) as (duration: number) => Promise<{ min: number; avg: number }>,
    ms,
  )
}

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
page.on('console', (msg) => {
  const text = msg.text()
  if (/shader|WebGLProgram|INVALID/i.test(text)) console.log('console', msg.type(), text.slice(0, 400))
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  new Function(
    'gfx',
    `localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', gfx)`,
  ) as (gfx: string) => void,
  GFX,
)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.waitForTimeout(800)

const rate = await fps(page)
console.log(TAG, GFX, 'hud fps', JSON.stringify(rate))

await page.evaluate(
  call(`
    const w = window.__world
    const g = window.__hatch
    g.speed = 0
    g.clock = 48
    w.pivot.set(0, 0, 8)
    w.yaw = 0.72
    w.pitch = 0.62
    w.dist = 96
    w.placeCam()
  `),
)
await page.waitForTimeout(400)
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } canvas.field { visibility: visible !important }',
})
const stem = `${OUT}/visual-r1-${TAG}-${GFX}`
await page.screenshot({ path: `${stem}-overview.png` })

await page.evaluate(
  call(`
    const w = window.__world
    w.dist = 36
    w.pitch = 0.78
    w.placeCam()
  `),
)
await page.waitForTimeout(500)
await page.screenshot({ path: `${stem}-close.png` })

await page.evaluate(
  call(`
    const g = window.__hatch
    const w = window.__world
    g.clock = 155
    w.dist = 78
    w.pitch = 0.5
    w.placeCam()
  `),
)
await page.waitForTimeout(500)
await page.screenshot({ path: `${stem}-night.png` })
console.log(TAG, GFX, 'wrote', stem)
await browser.close()

/**
 * Perf benchmark: boots a preview build, starts a game, samples fps for a fixed window and
 * reads the `?perf` overlay (draws, triangles, texture MB). Prints one JSON line.
 *
 *   npm run build && npm run preview &
 *   npm run perf:bench -- --quality high --seconds 10 --speed 5x --out docs/perf/high.json
 *
 * Run it on a real GPU (RTX 4070 Super is the target). Headless SwiftShader numbers only
 * prove the script works; they say nothing about desktop frame rate.
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const url = arg('url', 'http://127.0.0.1:45217/')
const quality = arg('quality', 'high')
const seconds = Number(arg('seconds', '10'))
const speed = arg('speed', '5x')
const out = arg('out', '')
const useGpu = arg('gpu', 'on') === 'on'

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  args: useGpu
    ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate((q) => {
  localStorage.clear()
  localStorage.setItem('hatchfield-gfx', q)
}, quality)
await page.goto(`${url}?perf`, { waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.waitForTimeout(500)
const starter = page.getByTestId('starter-kit')
if (await starter.isVisible().catch(() => false)) await starter.click()
await page.getByRole('button', { name: new RegExp(`^${speed}$`) }).click().catch(() => {})
await page.waitForTimeout(3000)

// Fixed camera path: the same held keys on the same schedule every run, so tiers compare.
// Driven through the real camera.pan*/zoom bindings; no game internals needed.
const PATH: Array<[string, number]> = [
  ['KeyW', 1500], ['KeyD', 1500], ['Minus', 1000], ['KeyS', 1500], ['KeyA', 1500], ['Equal', 1000],
]
const followPath = arg('path', 'on') === 'on'
const pathDone = (async () => {
  if (!followPath) return
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    for (const [code, ms] of PATH) {
      if (Date.now() >= end) return
      await page.keyboard.down(code)
      await page.waitForTimeout(ms)
      await page.keyboard.up(code)
    }
  }
})()

const fps = await page.evaluate(
  new Function(
    'ms',
    `return new Promise((resolve) => {
      const d = []
      let last = performance.now()
      const start = last
      const step = (now) => {
        d.push(now - last)
        last = now
        if (now - start < ms) requestAnimationFrame(step)
        else {
          d.sort((a, b) => a - b)
          const sum = d.reduce((a, b) => a + b, 0)
          const p99 = d[Math.min(d.length - 1, Math.floor(d.length * 0.99))]
          resolve({
            avg: Math.round((d.length * 10000) / sum) / 10,
            min: Math.round(10000 / d[d.length - 1]) / 10,
            low1: Math.round(10000 / p99) / 10,
            p99Ms: Math.round(p99 * 10) / 10,
            frames: d.length,
          })
        }
      }
      requestAnimationFrame(step)
    })`,
  ) as (ms: number) => Promise<{ avg: number; min: number; low1: number; p99Ms: number; frames: number }>,
  seconds * 1000,
)
await pathDone
const overlay = await page.getByTestId('perf-overlay').textContent().catch(() => null)
const result = { quality, speed, gpu: useGpu, fps, overlay, errors }
console.log(JSON.stringify(result))
if (out) writeFileSync(out, JSON.stringify(result, null, 2))
await browser.close()

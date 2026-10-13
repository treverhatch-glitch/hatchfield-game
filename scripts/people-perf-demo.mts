// Playwright perf run: npx tsx src/render/people/perf-demo.mts  (starts vite itself)
// Saves screenshots + perf.json to /workspace/people/ (override with PEOPLE_OUT).
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = process.env.PEOPLE_OUT ?? '/workspace/people'
mkdirSync(out, { recursive: true })
const server = await createServer({ server: { port: 45219, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls!.local[0]
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const results: unknown[] = []
for (const [n, view] of [[5000, 'wide'], [5000, 'close'], [1000, 'wide']] as const) {
  await page.goto(`${base}src/render/people/demo.html?n=${n}&view=${view}`)
  await page.waitForFunction(() => (window as any).__perf?.samples?.length >= 6, null, { timeout: 120000 })
  const perf = await page.evaluate(() => (window as any).__perf)
  const s = perf.samples.slice(1)
  perf.avgFps = s.reduce((a: number, b: number) => a + b, 0) / s.length
  results.push(perf)
  await page.screenshot({ path: `${out}/people-${n}-${view}.png` })
  console.log(`${n} ${view}: avg ${perf.avgFps.toFixed(1)} fps, calls ${perf.calls}, tris ${perf.tris}, LOD ${perf.stats.lod}, gpu ${perf.gl}`)
}
writeFileSync(`${out}/perf.json`, JSON.stringify(results, null, 2))
await browser.close(); await server.close()

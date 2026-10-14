/** Round B: render the apron demo frame by frame (deterministic clock) and write PNG frames. */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const [url, dir, n = '120', fps = '12', from = '0'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(url, { timeout: 240000 })
await p.waitForFunction(() => (window as any).__done, null, { timeout: 240000 })
for (let i = Number(from); i < Number(n); i++) {
  const out = `${dir}/f${String(i).padStart(4, '0')}.png`
  if (existsSync(out)) continue // resume: the page clock is deterministic, frames can be skipped
  await p.evaluate((t) => (window as any).renderAt(t), i / Number(fps))
  await p.screenshot({ path: out, timeout: 240000 })
}
await b.close()

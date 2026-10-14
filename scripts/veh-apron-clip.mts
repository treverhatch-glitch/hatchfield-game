/** Round B: render the apron demo frame by frame (deterministic clock) and write PNG frames. */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const [url, dir, n = '120', fps = '12'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(url)
await p.waitForFunction(() => (window as any).__done, null, { timeout: 240000 })
for (let i = 0; i < Number(n); i++) {
  await p.evaluate((t) => (window as any).renderAt(t), i / Number(fps))
  await p.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.png` })
}
await b.close()

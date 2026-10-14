import { chromium } from 'playwright'
const [url, out, w, h] = process.argv.slice(2)
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args })
const p = await b.newPage({ viewport: { width: Number(w || 2400), height: Number(h || 1700) } })
p.on('pageerror', (e) => console.log('pageerror', e.message))
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()) })
await p.goto(url, { timeout: 240000 })
await p.waitForFunction(() => (window as any).__done, null, { timeout: 240000 })
await p.waitForTimeout(1500)
console.log('stats', JSON.stringify(await p.evaluate(() => [(window as any).__agents, (window as any).__stats])))
await p.screenshot({ path: out, fullPage: true })
await b.close()

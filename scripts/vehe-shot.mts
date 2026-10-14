import { chromium } from 'playwright'
const [url, out] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
p.on('pageerror', e => console.log('PE', e.message))
p.on('console', m => { if (m.type()==='error') console.log('CE', m.text()) })
await p.goto(url, { timeout: 120000, waitUntil: 'domcontentloaded' })
try { await p.waitForFunction(() => (window as any).__done, null, { timeout: 120000 }) } catch(e) { console.log('waitfail', e.message); console.log(await p.evaluate(() => document.body.innerHTML.slice(0,500))) }
await p.waitForTimeout(800)
console.log('stats', await p.evaluate(() => (window as any).__stats))
await p.screenshot({ path: out }); await b.close()

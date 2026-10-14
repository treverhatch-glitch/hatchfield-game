// Usage: npx vite --port 45334 & then: npx tsx scripts/terminal-r4-shots.mts outDir [prefix]
import { chromium } from 'playwright'
const out = process.argv[2] ?? '/workspace/shots/term4'
const prefix = process.argv[3] ?? ''
const base = process.env.BASE ?? 'http://localhost:45334'
const views = (process.env.VIEWS ?? 'checkin,security,interior,exterior').split(',')
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
for (const v of views) {
  await page.goto(`${base}/terminal-props.html?view=${v}`, { timeout: 240000 })
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240000 })
  await page.screenshot({ timeout: 240000, path: `${out}/${prefix}${v}.png` })
  console.log('shot', v)
}
await browser.close()

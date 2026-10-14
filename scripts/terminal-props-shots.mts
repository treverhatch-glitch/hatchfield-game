// Usage: npx vite --port 45333 & then: npx tsx scripts/terminal-props-shots.mts [outDir]
import { chromium } from 'playwright'
const out = process.argv[2] ?? '/workspace/shots'
const base = process.env.BASE ?? 'http://localhost:45333'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
for (const v of ['lineup', 'interior', 'exterior']) {
  await page.goto(`${base}/terminal-props.html?view=${v}`)
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240000 })
  await page.screenshot({ timeout: 240000, path: `${out}/term-${v}.png` })
  console.log('shot', v)
}
await browser.close()

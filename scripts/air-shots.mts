/** Aircraft lineup and stand stills. Start `npx vite --port 45231` first. */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const OUT = process.env.SHOT_OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const BASE = process.env.SHOT_URL || 'http://127.0.0.1:45231/scripts/air-lineup/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const shots: [string, string][] = [
  ['air-lineup', '?view=lineup'],
  ['air-lineup-night', '?view=lineup&night=1'],
  ['air-stand-closeup', '?view=stand&id=b789'],
  ['air-stand-a380', '?view=stand&id=a380'],
  ['air-landing-flaps', '?view=flaps&id=a321'],
]
for (const [name, query] of shots) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (e) => console.error(name, e.message))
  await page.goto(BASE + query)
  await page.waitForFunction('window.__ready === true', null, { timeout: 240000 })
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('saved', name)
  await page.close()
}
await browser.close()

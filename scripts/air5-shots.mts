/** Aircraft pass 5 close-ups. Start `npx vite --port 45251` first. SHOT_OUT picks the folder. */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const OUT = process.env.SHOT_OUT || '/workspace/shots/air5'
mkdirSync(OUT, { recursive: true })
const BASE = process.env.SHOT_URL || 'http://127.0.0.1:45251/scripts/air-lineup/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const shots: [string, string][] = [
  ['nose-well-b789', '?view=stand&id=b789&rot=0&cam=0.36,0.012,0.16&look=0.36,0.04,0'],
  ['engine-b738', '?view=stand&id=b738&rot=0&cam=0.2,0.03,0.25&look=0.05,0.04,0.1'],
  ['engine-a320', '?view=stand&id=a320neo&rot=0&cam=0.2,0.03,0.25&look=0.05,0.04,0.1'],
  ['engine-b789', '?view=stand&id=b789&rot=0.6&cam=0.25,0.05,0.35&look=0.02,0.05,0.1'],
  ['engine-a380', '?view=stand&id=a380&rot=0&cam=0.18,0.03,0.3&look=0.03,0.04,0.15'],
  ['flaps-a321', '?view=flaps&id=a321&rot=0&cam=-0.3,0.08,0.4&look=-0.05,0.05,0.15'],
  ['flaps-b789', '?view=flaps&id=b789&rot=0&cam=-0.3,0.08,0.4&look=-0.05,0.05,0.15'],
  ['service-b738', '?view=stand&id=b738&rot=0&cam=0.05,0.06,0.5&look=0,0.04,0'],
  ['service-a380', '?view=stand&id=a380&rot=0&cam=0.05,0.06,0.5&look=0,0.05,0'],
  ['night-a320', '?view=stand&id=a320neo&night=1&rot=0.3'],
  ['night-a380', '?view=stand&id=a380&night=1&rot=0.3'],
]
const only = process.env.ONLY?.split(',')
for (const [name, query] of shots) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (e) => console.error(name, e.message))
  await page.goto(BASE + query)
  await page.waitForFunction('window.__ready === true', null, { timeout: 600000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('saved', name)
  await page.close()
}
await browser.close()

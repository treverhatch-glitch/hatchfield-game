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
  ['air-lineup-regional', '?view=lineup&group=regional'],
  ['air-lineup-narrow', '?view=lineup&group=narrow'],
  ['air-lineup-wide', '?view=lineup&group=wide'],
  ['air-lineup-freight', '?view=lineup&group=freight'],
  ['air-lineup-special', '?view=lineup&group=special'],
  ['air-lineup-night', '?view=lineup&group=narrow&night=1'],
  ['air-stand-closeup', '?view=stand&id=b789'],
  ['air-stand-a380', '?view=stand&id=a380'],
  ['air-landing-flaps', '?view=flaps&id=a321'],
  ['air-gear-b77w', '?view=stand&id=b77w&rot=0&cam=0.12,0.03,0.22&look=-0.02,0.02,0'],
  ['air-gear-a380', '?view=stand&id=a380&rot=0&cam=0.1,0.03,0.24&look=-0.03,0.02,0'],
  ['air-gear-nose', '?view=stand&id=a321&rot=0.5&cam=0.42,0.04,0.2&look=0.3,0.03,0'],
  ['air-gear-retract', '?view=flaps&id=a321&gearT=0.45&rot=0&cam=0.05,-0.02,0.5&look=0,0.08,0'],
  ['air-night-stand', '?view=stand&id=b789&night=1'],
]
const only = process.env.ONLY?.split(',')
for (const [name, query] of shots) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (e) => console.error(name, e.message))
  await page.goto(BASE + query)
  await page.waitForFunction('window.__ready === true', null, { timeout: 600000 })
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('saved', name)
  await page.close()
}
await browser.close()

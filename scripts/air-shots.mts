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
  ['air-gear-a321-main', '?view=stand&id=a321&rot=0&cam=0.12,0.03,0.22&look=-0.02,0.02,0'],
  ['air-gear-c130', '?view=stand&id=c130&rot=0&cam=0.16,0.04,0.5&look=0,0.05,0'],
  ['air-gear-atr72', '?view=stand&id=atr72&rot=0&cam=0.12,0.03,0.24&look=-0.02,0.02,0'],
  ['air-under-b77w', '?view=stand&id=b77w&rot=0&cam=-0.04,0.012,0.13&look=0.0,0.05,0.02'],
  ['air-under-a321', '?view=stand&id=a321&rot=0&cam=-0.04,0.014,0.14&look=0.0,0.06,0.02'],
  ['air-under-nose', '?view=stand&id=a321&rot=0&cam=0.28,0.014,0.09&look=0.38,0.06,0'],
  ['air-under-c130', '?view=stand&id=c130&rot=0&cam=-0.05,0.02,0.2&look=0,0.06,0.03'],
  ['air-door-open', '?view=stand&id=a321&rot=0&cam=0.36,0.05,0.22&look=0.34,0.05,0'],
  ['air-cargo-door-open', '?view=stand&id=b748f&rot=0.4&cam=0.3,0.08,0.45&look=0.1,0.05,0'],
  ['air-wing-engine', '?view=stand&id=a321&rot=0&cam=0.12,0.03,0.3&look=0.02,0.05,0.12'],
  ['air-wing-engine-b789', '?view=stand&id=b789&rot=0.6&cam=0.25,0.05,0.35&look=0.02,0.05,0.1'],
  ['air-door-open-b789', '?view=stand&id=b789&rot=0.35&cam=0.38,0.06,0.2&look=0.36,0.06,0'],
  ['air-chrome-gear', '?view=stand&id=a321&rot=0&cam=-0.02,0.02,0.1&look=-0.02,0.03,0.04'],
  ['air-night-stand', '?view=stand&id=b789&night=1'],
]
const only = process.env.ONLY?.split(',')
for (const [name, query] of shots) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (e) => console.error(name, e.message))
  await page.goto(BASE + query)
  await page.waitForFunction('window.__ready === true', null, { timeout: 600000 })
  // Doors ease open over a couple of seconds: let them finish before the capture.
  if (name.includes('door')) await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('saved', name)
  await page.close()
}
await browser.close()

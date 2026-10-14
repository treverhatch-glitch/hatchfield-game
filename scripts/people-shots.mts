/**
 * Screenshots of the shared-body people: a lineup (passengers + crew) and a hall crowd.
 * Needs `npm run dev -- --port 45218` running. Output goes to docs/devlog/media/.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media'
const BASE = process.env.PEOPLE_BASE || 'http://127.0.0.1:45218'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome'
mkdirSync(OUT, { recursive: true })

const shots = [
  { url: '/src/people/demo.html?view=lineup', file: 'people-lineup.png', w: 1600, h: 800 },
  { url: '/src/render/people/demo.html?n=1300&view=close', file: 'people-hall-crowd.png', w: 1600, h: 900 },
  { url: '/src/render/people/demo.html?n=1300&view=wide', file: 'people-hall-crowd-wide.png', w: 1600, h: 900 },
]
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
})
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } })
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await page.goto(BASE + s.url)
  await page.waitForTimeout(6000)
  const hud = await page.evaluate(() => document.getElementById('hud')?.textContent ?? '')
  console.log(s.file, hud.replace(/\n/g, ' | '))
  await page.screenshot({ path: `${OUT}/${s.file}` })
  await page.close()
}
await browser.close()

/**
 * Round-6 bay fit shots: buildings at real lot scale with real vehicle models in the bays.
 *   URL=http://127.0.0.1:45302/ PREFIX=bd6 npx tsx scripts/bd6-shots.mts
 */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const OUT = process.env.OUT || '/workspace/shots'
const PREFIX = process.env.PREFIX || 'bd6'
const BASE = process.env.URL || 'http://127.0.0.1:45302/'
mkdirSync(OUT, { recursive: true })
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const SHOTS: [string, string, string?][] = [
  ['fuel', 'fuel'], ['fire', 'fire'], ['cargo', 'cargo'], ['kitchen', 'kitchen'], ['bags', 'bags'],
  ['deice', 'deice'], ['termbus', 'termbus'], ['bus', 'bus'], ['hangar', 'hangar'], ['hangar_w', 'hangar-wide'], ['hangar_j', 'hangar-jumbo'], ['snack', 'snack'],
  ['fire', 'fire-front', '0.05,0.35,1'],
]
for (const [id, name, view] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 860 } })
  page.on('pageerror', (e) => console.log('pageerror', id, e.message))
  await page.goto(`${BASE}scripts/bd6-bays.html?ids=${id}&cols=1&cw=1200&ch=860${view ? `&view=${view}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 120000 })
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` })
  console.log('shot', name)
  await page.close()
}
await browser.close()

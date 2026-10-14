/** Hangar tiers side by side + each alone. URL=http://127.0.0.1:45309/ PREFIX=after npx tsx scripts/hangar-tier-shots.mts */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const OUT = process.env.OUT || '/workspace/shots/hangars'
const PREFIX = process.env.PREFIX || 'after'
const BASE = process.env.URL || 'http://127.0.0.1:45309/'
mkdirSync(OUT, { recursive: true })
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const shot = async (q: string, name: string, w: number, h: number) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.log('pageerror', name, e.message))
  await page.goto(`${BASE}scripts/bd7-bays.html?${q}`)
  await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 180000 })
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` })
  console.log('shot', name)
  await page.close()
}
await shot('ids=hangar,hangar_w,hangar_j&cols=3&cw=700&ch=600', 'lineup', 2100, 600)
for (const id of ['hangar', 'hangar_w', 'hangar_j']) await shot(`ids=${id}&cols=1&cw=1200&ch=860`, id, 1200, 860)
await browser.close()

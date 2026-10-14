/**
 * Round-7 shots: polished bays day + night, starter kits, and a door-open clip.
 *   URL=http://127.0.0.1:45302/ PREFIX=bd7 npx tsx scripts/bd7-shots.mts
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'
const OUT = process.env.OUT || '/workspace/shots'
const PREFIX = process.env.PREFIX || 'bd7'
const BASE = process.env.URL || 'http://127.0.0.1:45302/'
mkdirSync(OUT, { recursive: true })
const CHROME = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const shot = async (url: string, name: string, w = 1200, h = 860) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.log('pageerror', name, e.message))
  await page.goto(BASE + url)
  await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 120000 })
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` })
  console.log('shot', name)
  await page.close()
}
if (!process.env.CLIP_ONLY) {
  await shot('scripts/bd7-kit.html', 'starter-kits', 2040, 760)
  for (const id of ['fuel', 'fire', 'cargo', 'kitchen', 'bags', 'deice', 'termbus', 'bus', 'hangar']) await shot(`scripts/bd7-bays.html?ids=${id}&cols=1&cw=1200&ch=860`, id)
  for (const id of ['fire', 'cargo', 'fuel']) await shot(`scripts/bd7-bays.html?ids=${id}&cols=1&cw=1200&ch=860&night=1`, `${id}-night`)
}
// Door clip: fire, cargo, bags and bus depot side by side, bay 1 busy then free (two loops).
const vid = `${OUT}/_vid_${PREFIX}`
rmSync(vid, { recursive: true, force: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } })
const page = await ctx.newPage()
await page.goto(`${BASE}scripts/bd7-bays.html?ids=fire,cargo,bags,termbus&cols=2&cw=640&ch=360&anim=1&view=0.25,0.45,1`)
await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 120000 })
await page.waitForTimeout(17000)
await ctx.close()
const f = readdirSync(vid).find((n) => n.endsWith('.webm'))
if (f) renameSync(`${vid}/${f}`, `${OUT}/${PREFIX}-doors-clip.webm`)
console.log('clip', f)
await browser.close()

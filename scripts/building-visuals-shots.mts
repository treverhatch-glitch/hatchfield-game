/** Screenshots: placement ghost, mid-construction building, build-menu icons. */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const URL = process.env.URL || 'http://127.0.0.1:45219/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
const ev = <T,>(src: string) => page.evaluate(new Function(src) as () => T)
const cell = await ev<{ c: number; r: number } | null>(`
  const g = window.__hatch; g.cash = 5e6; g.speed = 0
  for (let r = 14; r < 28; r++) for (let c = 14; c < 28; c++) {
    let ok = true
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (g.tile({c:c+dc,r:r+dr}) !== 'grass' || g.siteAt({c:c+dc,r:r+dr})) ok = false
    if (ok) return {c, r}
  }
  return null`)
console.log('cell', cell)
const C = cell!
await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {})
const canvas = page.locator('canvas').first()
const box = (await canvas.boundingBox())!
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
for (let i = 0; i < Number(process.env.ZOOM ?? 2); i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(80) }
await ev(`const g = window.__hatch; g.camGoal = { view: 'apron', c: ${C.c}, r: ${C.r}, seq: 9999 }`)
await page.waitForTimeout(1500)
const tool = process.env.TOOL || 'tower'
await ev(`const g = window.__hatch; g.setTool('${tool}'); g.hover = { c: ${C.c}, r: ${C.r} }`)
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/bv-ghost-valid.png` })
await ev(`const g = window.__hatch; g.hover = { c: 8, r: 26 }`)
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/bv-ghost-invalid.png` })
await ev(`const g = window.__hatch; g.hover = null; g.placeSingle({ c: ${C.c}, r: ${C.r} }); g.setTool('pan')`)
for (const [p, name] of [[0.15, 'foundation'], [0.45, 'frame'], [0.8, 'finish']] as const) {
  await ev(`const g = window.__hatch; for (const s of g.sites) s.elapsed = s.duration * ${p}`)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/bv-construction-${name}.png` })
}
await ev(`const g = window.__hatch; g.camGoal = null`)
for (const label of ['Ops', 'Terminal', 'Stands']) {
  await page.getByRole('button', { name: label, exact: true }).first().click().catch((e) => console.log('menu', label, e.message))
  await page.waitForTimeout(6000)
  const tray = page.getByTestId('build-tray')
  if (await tray.count()) await tray.screenshot({ path: `${OUT}/bv-icons-${label.toLowerCase()}.png` })
  await page.screenshot({ path: `${OUT}/bv-icons-${label.toLowerCase()}-full.png` })
}
await browser.close()

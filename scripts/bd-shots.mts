/** Screenshots: building lineup with labels, every build-menu tab, stand ghost. */
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const BASE = process.env.URL || 'http://127.0.0.1:45219/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, args })
const page = await browser.newPage({ viewport: { width: 1800, height: 1320 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(`${BASE}scripts/bd-lineup.html`)
await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 120000 })
await page.screenshot({ path: `${OUT}/bd-lineup.png`, fullPage: true })
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
await page.getByRole('button', { name: 'Close' }).first().click().catch(() => {})
const ev = <T,>(src: string) => page.evaluate(new Function(src) as () => T)
await ev(`const g = window.__hatch; g.cash = 5e6; g.speed = 0`)
for (const label of ['Pavement', 'Stands', 'Terminal', 'Ops', 'Landside']) {
  await page.getByRole('button', { name: label, exact: true }).first().click().catch((e) => console.log('menu', label, e.message))
  await page.waitForTimeout(label === 'Ops' ? 20000 : 9000)
  const tray = page.getByTestId('build-tray')
  if (await tray.count()) await tray.screenshot({ path: `${OUT}/bd-menu-${label.toLowerCase()}.png` })
}
// Stand ghost on open grass near the field centre.
const cell = await ev<{ c: number; r: number } | null>(`
  const g = window.__hatch
  for (let r = 10; r < 30; r++) for (let c = 10; c < 30; c++) {
    let ok = true
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (g.tile({c:c+dc,r:r+dr}) !== 'grass') ok = false
    if (ok) return {c, r}
  }
  return null`)
if (cell) {
  const canvas = page.locator('canvas').first()
  const b = (await canvas.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(80) }
  await ev(`const g = window.__hatch; g.camGoal = { view: 'apron', c: ${cell.c}, r: ${cell.r}, seq: 9999 }`)
  await page.waitForTimeout(1500)
  await ev(`const g = window.__hatch; g.setTool('stand_w'); g.hover = { c: ${cell.c}, r: ${cell.r} }`)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/bd-stand-ghost.png` })
  await ev(`const g = window.__hatch; g.setTool('substation' in {} ? 'pan' : 'fuel'); g.hover = { c: ${cell.c}, r: ${cell.r} }`)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/bd-ghost-fuel.png` })
}
await browser.close()

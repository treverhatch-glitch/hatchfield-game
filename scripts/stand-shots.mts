/**
 * Stand-card shots. Needs the dev server on port 45217.
 * Usage: tsx scripts/stand-shots.mts <phase>
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const phase = process.argv[2] ?? 'phase'
const OUT = 'docs/devlog/media/stands'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('sandbox-toggle').uncheck()
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { buildStarterKit: () => void } }).__hatch
    g.buildStarterKit()
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${phase}-apron.png` })
  const airfield = page.getByTestId('build-airfield')
  if (await airfield.count()) {
    await airfield.click()
    const stands = page.getByTestId('build-group-stands')
    if (await stands.count()) await stands.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/${phase}-tray.png` })
  }
  await page.evaluate(() => {
    const g = (
      window as unknown as {
        __hatch: {
          tool: string
          clickTile: (v: { c: number; r: number }) => void
        }
      }
    ).__hatch
    g.tool = 'pan'
    g.clickTile({ c: 11, r: 6 })
  })
  await page.waitForTimeout(400)
  const probe = await page.evaluate(() => {
    const g = (window as unknown as { __hatch: { selectedBuilding: string | null; buildingCard: () => { name: string } | null; tile: (v: { c: number; r: number }) => string } }).__hatch
    return { tile: g.tile({ c: 11, r: 6 }), selected: g.selectedBuilding, card: g.buildingCard()?.name ?? null }
  })
  console.log(JSON.stringify(probe))
  await page.screenshot({ path: `${OUT}/${phase}-stand-card.png` })
  const panel = page.locator('[data-testid=building-panel]')
  if (await panel.count()) await panel.screenshot({ path: `${OUT}/${phase}-panel.png` })
} finally {
  await browser.close()
}

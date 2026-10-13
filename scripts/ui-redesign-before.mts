import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = 'docs/devlog/media'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.clear()
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-before-idle.png` })
await page.getByRole('button', { name: 'Stands', exact: true }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-before-menu.png` })
const card = page.locator('.tray-item').first()
await card.hover()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-before-hover.png` })
await page.getByTestId('tab-economy').click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-before-panel.png` })
await browser.close()
console.log('before shots written')

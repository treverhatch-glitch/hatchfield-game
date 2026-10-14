/** Screenshots for issue 181: contract letter buttons/hint and the money summary line. */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'docs/devlog/media'
const URL = 'http://127.0.0.1:45217/'
const CHROME = process.env.PLAYWRIGHT_CHROME || '/usr/local/bin/google-chrome'
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.log('pageerror', err.message))
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.clear()
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('new-game').click()
await page.getByTestId('start-pax').click()
await page.getByTestId('tab-economy').click()
await page.getByTestId('starter-kit').click()
const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
if (await coach.count()) await coach.click()
const setSpeed = (s: number) => page.evaluate(new Function(`window.__hatch.speed = ${s}`) as () => void)
await setSpeed(5)
const letter = page.getByTestId('contract-letter')
await letter.waitFor({ timeout: 30000 })
await setSpeed(1)
await letter.getByRole('button').first().click()
await page.waitForTimeout(3000)
const before = await letter.locator('.letter-timer').textContent()
await page.waitForTimeout(4000)
const after = await letter.locator('.letter-timer').textContent()
console.log('timer while open', before, '->', after)
await page.screenshot({ path: `${OUT}/ISSUE-181-letter.png` })
await page.getByTestId('contract-accept').click()
await setSpeed(5)
await page.waitForTimeout(45000)
await setSpeed(1)
// The inbound traffic card sits over the panel top; hide it for the shot only.
await page.evaluate(
  new Function(
    `document.querySelector('[data-testid="inbound-accept"]')?.closest('aside')?.style.setProperty('display', 'none')`,
  ) as () => void,
)
console.log('summary', await page.getByTestId('money-summary').textContent())
await page.screenshot({ path: `${OUT}/ISSUE-181-money-summary.png` })
await browser.close()

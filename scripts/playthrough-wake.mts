/**
 * Wake-up playthrough — exercises the first 3 minutes of a real session.
 * Fails loud on soft-locks, missing UI, and broken money/flows.
 */
import { chromium, type Page } from 'playwright'

const issues: string[] = []
const notes: string[] = []

function moneyToNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, ''))
}

async function readCash(page: Page): Promise<number> {
  const t = await page.locator('.stat.cash').first().innerText()
  return moneyToNum(t)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const consoleErrors: string[] = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

try {
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  // Title — sandbox OFF for money assertions
  if (!(await page.getByRole('heading', { name: 'Hatchfield' }).isVisible())) {
    issues.push('title missing Hatchfield heading')
  }
  const sandbox = page.getByTestId('sandbox-toggle')
  if (await sandbox.isChecked()) await sandbox.uncheck()
  await page.getByTestId('new-game').click()
  await page.waitForTimeout(300)
  if (!(await page.getByRole('heading', { name: /Choose your start/i }).isVisible())) {
    issues.push('New Game did not reach route pick')
  }

  // Land / route
  const landCash = await page.locator('.kicker').innerText()
  if (!/\$/.test(landCash)) issues.push(`expected cash on land screen, got ${landCash}`)
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(800)

  // Apron
  const brand = await page.locator('.brand span').innerText()
  if (!/Riverside|City/i.test(brand)) issues.push(`brand after land: ${brand}`)
  let c0 = await readCash(page)
  if (c0 < 40_000 || c0 > 200_000) issues.push(`cash after city land odd: ${c0}`)

  // Starter kit lives in the Economy roll-up panel
  await page.locator('.cash-chip').click()
  await page.waitForTimeout(300)
  const starter = page.getByTestId('starter-kit')
  if (!(await starter.isVisible())) issues.push('starter kit button missing')
  await starter.click()
  await page.waitForTimeout(500)
  let c1 = await readCash(page)
  if (c1 > c0 - 40_000) issues.push(`starter kit did not charge (${c0} → ${c1})`)
  notes.push(`starter ${c0} → ${c1}`)

  // Hall toggle
  await page.getByRole('button', { name: /^Hall$/ }).click()
  await page.waitForTimeout(400)
  const hallVisible = await page.locator('.hall-wrap').isVisible().catch(() => false)
  const hallChip = await page
    .locator('.view-chip')
    .innerText()
    .catch(() => '')
  if (!hallVisible && !/Hall|3D/i.test(hallChip)) {
    issues.push(`hall view did not open (chip: ${hallChip || 'missing'})`)
  } else {
    notes.push(`hall ok chip=${hallChip || 'n/a'}`)
  }
  await page.getByRole('button', { name: /^Apron$/ }).click()
  await page.waitForTimeout(300)

  // Speed
  await page.getByRole('button', { name: /^3x$/ }).click()
  await page.waitForTimeout(200)
  const threeOn = await page.getByRole('button', { name: /^3x$/ }).evaluate((b) =>
    b.classList.contains('on'),
  )
  if (!threeOn) issues.push('3x did not activate')
  await page.getByRole('button', { name: /^5x$/ }).click()
  await page.waitForTimeout(200)
  const fiveOn = await page.getByRole('button', { name: /^5x$/ }).evaluate((b) =>
    b.classList.contains('on'),
  )
  if (!fiveOn) issues.push('5x did not activate')
  const inspectAt5 = await page.locator('.inspect-card').count()
  if (inspectAt5 > 0) issues.push('inspect card visible at 5x')
  await page.getByRole('button', { name: /^3x$/ }).click()
  await page.waitForTimeout(100)

  // Accept airline if offered (letter inbox — force click; HUD re-renders on timer ticks)
  for (let i = 0; i < 40; i++) {
    const tab = page.locator('.letter-tab').filter({ hasText: /Contract/i }).first()
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => {})
      await page.waitForTimeout(150)
    }
    const sign = page.locator('.letter-actions button').filter({ hasText: /^Sign$/ }).first()
    if (await sign.isVisible().catch(() => false)) {
      await sign.click({ force: true })
      notes.push('signed airline offer')
      break
    }
    await page.waitForTimeout(250)
  }

  // Run ~45s sim time at 3x (~15s wall)
  await page.waitForTimeout(12_000)
  const airlines = await page.locator('.stat').nth(2).innerText()
  notes.push(`airlines stat: ${airlines}`)

  // Loan (Economy panel — bank desk products)
  const beforeLoan = await readCash(page)
  await page.getByTestId('tab-economy').click()
  await page.waitForTimeout(300)
  const loanBtn = page.locator('.loan-grid button').first()
  if (!(await loanBtn.isVisible().catch(() => false))) {
    await page.locator('.cash-chip').click()
    await page.waitForTimeout(300)
  }
  if (await loanBtn.isVisible().catch(() => false)) {
    await loanBtn.click({ force: true })
    await page.waitForTimeout(300)
    const afterLoan = await readCash(page)
    notes.push(`loan click ${beforeLoan} → ${afterLoan}`)
  } else {
    issues.push('loan product button missing')
  }

  // Dismiss coach if present — then tool select must work (dock above overlays).
  const gotIt = page.getByRole('button', { name: /^Got it$/ })
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click()
    notes.push('dismissed coach')
  }
  await page.locator('.dock').hover()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Ops$/ }).click()
  await page.waitForTimeout(150)
  const hangar = page.getByRole('button', { name: /^Hangar/ })
  await hangar.click({ force: true })
  await page.waitForTimeout(200)
  const hangarOn = await hangar.evaluate((b) => b.classList.contains('on')).catch(() => false)
  if (!hangarOn) issues.push('Hangar tool did not select')

  await page.getByRole('button', { name: /^Pavement$/ }).click()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: /^Select$/ }).first().click({ force: true }).catch(() => {})

  // Emergency / offer UI should not crash
  await page.waitForTimeout(2000)

  // Continue path — reload with save
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const cont = page.getByTestId('continue-game')
  if (await cont.isVisible().catch(() => false)) {
    await cont.click()
    await page.waitForTimeout(800)
    const brand2 = await page.locator('.brand span').innerText().catch(() => '')
    if (/No plot/i.test(brand2)) issues.push('Continue lost the plot')
    else notes.push('continue restored play')
  } else {
    // App may have recovered straight to play via session
    const brand2 = await page.locator('.brand span').innerText().catch(() => '')
    if (/Riverside|City/i.test(brand2)) notes.push('remount recovered to play')
    else issues.push('no Continue and not on play screen')
  }

  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/wake-playthrough.png' })
} catch (e) {
  issues.push(`playthrough threw: ${(e as Error).message}`)
}

const hardConsole = consoleErrors.filter(
  (e) =>
    !e.includes('React DevTools') &&
    !e.includes('PCFSoft') &&
    !e.includes('swiftshader') &&
    !e.includes('Download the React'),
)

if (hardConsole.length) {
  issues.push(...hardConsole.slice(0, 5).map((e) => `console: ${e.slice(0, 120)}`))
}

const out = {
  ok: issues.length === 0,
  issues,
  notes,
  consoleErrors: hardConsole.slice(0, 8),
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
process.exit(issues.length ? 1 : 0)

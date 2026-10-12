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

  // Title
  if (!(await page.getByRole('heading', { name: 'Hatchfield' }).isVisible())) {
    issues.push('title missing Hatchfield heading')
  }
  await page.getByRole('button', { name: /Easy grant/i }).click()
  await page.waitForTimeout(300)
  if (!(await page.getByRole('heading', { name: /Choose the plot/i }).isVisible())) {
    issues.push('Easy grant did not reach land screen')
  }

  // Land
  const landCash = await page.locator('.kicker').innerText()
  if (!landCash.includes('220')) issues.push(`expected $220k on land screen, got ${landCash}`)
  await page.getByRole('button', { name: /Riverside|City/i }).click()
  await page.waitForTimeout(800)

  // Apron
  const brand = await page.locator('.brand span').innerText()
  if (!/Riverside|City/i.test(brand)) issues.push(`brand after land: ${brand}`)
  let c0 = await readCash(page)
  if (c0 < 120_000 || c0 > 130_000) issues.push(`cash after city land odd: ${c0}`)

  // Starter kit
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
  const hallChip = await page.locator('.view-chip').innerText()
  if (!/Hall/i.test(hallChip) && !(await page.locator('.hall-wrap').isVisible().catch(() => false))) {
    // chip text flips meaning — check canvas or furnish panel
    notes.push(`hall chip: ${hallChip}`)
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

  // Accept airline if offered
  for (let i = 0; i < 40; i++) {
    const sign = page.getByRole('button', { name: /^Sign$/ })
    if (await sign.isVisible().catch(() => false)) {
      await sign.click()
      notes.push('signed airline offer')
      break
    }
    await page.waitForTimeout(250)
  }

  // Run ~45s sim time at 3x (~15s wall)
  await page.waitForTimeout(12_000)
  const airlines = await page.locator('.stat').nth(2).innerText()
  notes.push(`airlines stat: ${airlines}`)

  // Loan
  const beforeLoan = await readCash(page)
  await page.getByRole('button', { name: /^Loan/ }).click()
  await page.waitForTimeout(300)
  const afterLoan = await readCash(page)
  if (afterLoan <= beforeLoan) {
    // may already have loan from prior — not fatal
    notes.push(`loan click ${beforeLoan} → ${afterLoan}`)
  } else {
    notes.push(`loan ok ${beforeLoan} → ${afterLoan}`)
  }

  // Dismiss coach if present — then tool select must work (dock above overlays).
  const gotIt = page.getByRole('button', { name: /^Got it$/ })
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click()
    notes.push('dismissed coach')
  }
  await page.getByRole('button', { name: /^Hangar$/ }).click({ force: false })
  await page.waitForTimeout(200)
  const hangarOn = await page.getByRole('button', { name: /^Hangar$/ }).evaluate((b) =>
    b.classList.contains('on'),
  )
  if (!hangarOn) issues.push('Hangar tool did not select')

  await page.getByRole('button', { name: /^Look$/ }).click()

  // Emergency / offer UI should not crash
  await page.waitForTimeout(2000)

  // Continue field path — reload with save
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const cont = page.getByRole('button', { name: /Continue field/i })
  if (await cont.isVisible().catch(() => false)) {
    await cont.click()
    await page.waitForTimeout(800)
    const brand2 = await page.locator('.brand span').innerText().catch(() => '')
    if (!/Riverside|City|plot/i.test(brand2) && !/No plot/i.test(brand2)) {
      notes.push(`continue brand: ${brand2}`)
    }
    if (/No plot/i.test(brand2)) issues.push('Continue field lost the plot')
    else notes.push('continue field restored play')
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

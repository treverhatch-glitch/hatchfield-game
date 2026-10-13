import { chromium, type Page } from 'playwright'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir } from 'node:fs/promises'

const exec = promisify(execFile)

const OUT = 'docs/devlog/media'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})

type Result = { id: string; ok: boolean; detail: string }
const results: Result[] = []
const note = (id: string, ok: boolean, detail: string) => {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`)
}

async function boot(page: Page) {
  await page.goto('http://127.0.0.1:45217/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(500)
  await page.locator('.hf-strip').waitFor({ timeout: 8000 })
}

async function coverage(page: Page) {
  return page.evaluate(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const step = 8
    let hit = 0
    let total = 0
    for (let y = 2; y < h; y += step) {
      for (let x = 2; x < w; x += step) {
        total++
        const els = document.elementsFromPoint(x, y)
        const part = els.map((el) => el.closest('[data-hud-part]')).find(Boolean) as HTMLElement | undefined
        if (part && !part.closest('[data-hud-transient]')) hit++
      }
    }
    return hit / total
  })
}

async function centerHits(page: Page) {
  return page.evaluate(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const bad: string[] = []
    const step = 28
    for (let y = h * 0.2 + 6; y < h * 0.8; y += step) {
      for (let x = w * 0.2 + 6; x < w * 0.8; x += step) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (el.closest('[data-hud-transient]')) break
          if (el.closest('canvas, .field, .field-wrap, .view-layer, .shell, .hall-wrap')) continue
          if (el === document.body || el === document.documentElement || el.id === 'root') continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
          const bg = cs.backgroundColor
          const visibleBg = !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
          const blocks = cs.pointerEvents !== 'none' || visibleBg
          if (!blocks) continue
          bad.push(
            `${Math.round(x)},${Math.round(y)} ${el.tagName}.${String(el.className).slice(0, 60)} pe=${cs.pointerEvents} bg=${bg}`,
          )
          break
        }
      }
    }
    return bad.slice(0, 6)
  })
}

async function overlaps(page: Page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-hud-part]')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 2 && r.height > 2
    })
    const hits: string[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].getBoundingClientRect()
        const b = nodes[j].getBoundingClientRect()
        const iw = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const ih = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (iw > 1 && ih > 1) {
          hits.push(
            `${nodes[i].getAttribute('data-hud-part')}∩${nodes[j].getAttribute('data-hud-part')} ${Math.round(iw)}×${Math.round(ih)}`,
          )
        }
      }
    }
    return hits
  })
}

async function box(page: Page, sel: string) {
  return page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height, top: r.top, left: r.left }
  })
}

async function southBlocked(page: Page) {
  return page.evaluate(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const bad: string[] = []
    for (let y = h * 0.67; y < h - 64; y += 28) {
      for (let x = w * 0.2; x < w * 0.8; x += 48) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (el.closest('[data-hud-transient]')) break
          if (el.closest('canvas, .field, .field-wrap, .view-layer, .shell, .hall-wrap')) continue
          if (el === document.body || el === document.documentElement || el.id === 'root') continue
          const cs = getComputedStyle(el)
          if (cs.pointerEvents === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
          bad.push(`${Math.round(x)},${Math.round(y)} ${el.tagName}.${String(el.className).slice(0, 40)}`)
          break
        }
      }
    }
    return bad.slice(0, 4)
  })
}

async function starterKit(width: number, height: number) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', (err) => console.log('PAGE', err.message))
  await boot(page)
  const tray = await page.getByTestId('build-tray').count()
  const south = await southBlocked(page)
  const budget = await page.getByTestId('tab-budget').isVisible()
  const flows = await page.getByTestId('flow-toggle').locator('input').isChecked()
  await page.getByTestId('tab-economy').click()
  const kit = page.getByTestId('starter-kit')
  const visible = await kit.isVisible()
  await kit.click({ force: true })
  await page.waitForTimeout(300)
  const placed = await page.evaluate(() => {
    const g = (window as unknown as {
      __hatch: { fits: unknown[]; tiles: string[][]; news: { text: string }[] }
    }).__hatch
    const kinds = new Set<string>()
    for (const row of g.tiles) for (const tile of row) if (tile && tile !== 'grass') kinds.add(tile)
    return {
      fits: g.fits.length,
      runway: kinds.has('runway'),
      terminal: kinds.has('terminal'),
      stand: kinds.has('stand'),
      news: g.news[0]?.text ?? '',
    }
  })
  const est = await page.getByTestId('cash-estimate').innerText()
  const close = page.locator('.panel-head button').filter({ hasText: /Close/i })
  const closeVisible = await close.isVisible()
  if (closeVisible) await close.click()
  const panelGone = (await page.locator('.hf-panel').count()) === 0
  note(
    `kit-${width}x${height}`,
    tray === 0 &&
      south.length === 0 &&
      budget &&
      flows === false &&
      visible &&
      placed.fits > 0 &&
      placed.runway &&
      placed.terminal &&
      placed.stand &&
      !/M\/day/.test(est) &&
      closeVisible &&
      panelGone,
    `tray ${tray} south ${south.join('; ') || 'clear'} budget ${budget} flows ${flows} kit ${visible} fits ${placed.fits} ${[...Object.entries(placed).filter(([k]) => k !== 'news')]} est ${est.replace(/\s+/g, ' ')} close ${closeVisible}/${panelGone} news ${placed.news.slice(0, 80)}`,
  )
  await page.close()
}

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('PAGE', e.message))
await boot(page)

note(
  'tray-closed',
  (await page.getByTestId('build-tray').count()) === 0 && (await southBlocked(page)).length === 0,
  `tray ${(await page.getByTestId('build-tray').count())} south ${(await southBlocked(page)).join('; ') || 'clear'}`,
)
const flowsOff = await page.getByTestId('flow-toggle').locator('input').isChecked()
await page.keyboard.press('f')
const flowsOn = await page.evaluate(() => {
  const g = (window as unknown as { __hatch: { showFlows: boolean } }).__hatch
  const ui = (window as unknown as { __ui: { getUiState: () => { openPanel: string | null; openMenu: string | null } } }).__ui.getUiState()
  return { flows: g.showFlows, panel: ui.openPanel, menu: ui.openMenu }
})
await page.keyboard.press('f')
const flowsBack = await page.evaluate(
  () => (window as unknown as { __hatch: { showFlows: boolean } }).__hatch.showFlows,
)
note(
  'F-flows',
  flowsOff === false && flowsOn.flows === true && flowsOn.panel == null && flowsOn.menu == null && flowsBack === false,
  `off ${flowsOff} on ${JSON.stringify(flowsOn)} back ${flowsBack}`,
)

const idleCov = await coverage(page)
const strip = await box(page, '[data-hud-part="strip"]')
const bar = await box(page, '[data-hud-part="bar"]')
note('A1', idleCov <= 0.08 && strip.h <= 32.5 && bar.h <= 56, `cov ${(idleCov * 100).toFixed(2)}% strip ${strip.h.toFixed(1)} bar ${bar.h.toFixed(1)}`)
const idleCenter = await centerHits(page)
note('A2-idle', idleCenter.length === 0, idleCenter.join(' | ') || 'center clear')
const idleOverlap = await overlaps(page)
note('A2b-idle', idleOverlap.length === 0, idleOverlap.join(' | ') || 'no overlap')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-idle.png` })

await page.getByRole('button', { name: 'Stands', exact: true }).click()
await page.waitForTimeout(150)
const menu = await box(page, '[data-hud-part="menu"]')
const menuCov = await coverage(page)
note(
  'A3',
  menu.h <= 150 && menu.w <= 1920 * 0.7 && menuCov <= 0.12,
  `menu ${menu.w.toFixed(0)}×${menu.h.toFixed(0)} cov ${(menuCov * 100).toFixed(2)}%`,
)
note('A2-menu', (await centerHits(page)).length === 0, 'center with menu')
note('A2b-menu', (await overlaps(page)).length === 0, (await overlaps(page)).join(' | ') || 'no overlap')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-menu.png` })

await page.getByRole('tab', { name: 'Medium' }).click()
const card = page.locator('.hf-card', { hasText: 'Stand M' }).first()
await card.hover()
await page.waitForFunction(() => {
  const el = document.querySelector('.hf-card:hover')
  if (!el) return false
  const t = getComputedStyle(el).transform
  return t.includes('1.06') || /matrix\(1\.0[4-9]/.test(t)
})
const hoverTf = await card.evaluate((el) => getComputedStyle(el).transform)
const tipText = await page.locator('.hf-tooltip').innerText()
const parsed = hoverTf.match(/matrix\(([^)]+)\)/)
const nums = parsed ? parsed[1].split(',').map((n) => Number(n.trim())) : []
const scale = nums[0] ?? 0
const ty = nums[5] ?? 0
note(
  'A4-hover',
  ty < -1 && scale > 1.04 && scale < 1.1 && /cost/i.test(tipText) && /upkeep/i.test(tipText) && /shortcut/i.test(tipText),
  `transform ${hoverTf} tip ${tipText.replace(/\s+/g, ' ').slice(0, 140)}`,
)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-hover.png` })
await page.mouse.move(960, 420)
await page.waitForFunction(() => {
  const el = document.querySelector('[data-asset="stand-m"]')
  if (!el) return false
  const t = getComputedStyle(el).transform
  return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'
})
const leaveTf = await card.evaluate((el) => getComputedStyle(el).transform)
note('A4-leave', leaveTf === 'none' || leaveTf === 'matrix(1, 0, 0, 1, 0, 0)', leaveTf)

await card.click()
await page.waitForTimeout(80)
const menuGone = (await page.locator('[data-testid="asset-menu"]').count()) === 0
const toolsOn = await page.locator('[data-testid="tool-options"]').isVisible()
const placeCov = await coverage(page)
note('A5', menuGone && toolsOn && placeCov <= 0.08, `menuGone ${menuGone} tools ${toolsOn} cov ${(placeCov * 100).toFixed(2)}%`)
note('A2-place', (await centerHits(page)).length === 0, 'center while placing')
note('A2b-place', (await overlaps(page)).length === 0, (await overlaps(page)).join(' | ') || 'no overlap')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-placing.png` })

await page.evaluate(() => {
  const g = (window as unknown as { __hatch: { clickTile: (v: { c: number; r: number }) => void } }).__hatch
  g.clickTile({ c: 8, r: 14 })
})
await page.keyboard.press('Escape')
await page.waitForTimeout(80)
const afterEsc = await page.evaluate(() => {
  const ui = (window as unknown as { __ui: { getUiState: () => { openMenu: string | null; openPanel: string | null; tool: string } } }).__ui.getUiState()
  return ui
})
note('A6', afterEsc.openMenu == null && afterEsc.openPanel == null && afterEsc.tool === 'pan', JSON.stringify(afterEsc))

await page.getByRole('button', { name: 'Stands', exact: true }).click()
await page.getByTestId('tab-economy').click()
await page.waitForTimeout(80)
const fin = await page.evaluate(() => {
  const ui = (window as unknown as { __ui: { getUiState: () => { openMenu: string | null; openPanel: string | null } } }).__ui.getUiState()
  return ui
})
await page.getByRole('button', { name: 'Airlines', exact: true }).click()
await page.waitForTimeout(80)
const air = await page.evaluate(() =>
  (window as unknown as { __ui: { getUiState: () => { openMenu: string | null; openPanel: string | null } } }).__ui.getUiState(),
)
note('A7', fin.openMenu == null && fin.openPanel === 'finances' && air.openPanel === 'airlines' && air.openMenu == null, `fin ${JSON.stringify(fin)} air ${JSON.stringify(air)}`)
const panel = await box(page, '[data-hud-part="panel"]')
note('A8', panel.w <= 360.5 && panel.h <= 1080 * 0.7, `panel ${panel.w.toFixed(0)}×${panel.h.toFixed(0)}`)
note('A2-panel', (await centerHits(page)).length === 0, 'center with panel')
note('A2b-panel', (await overlaps(page)).length === 0, (await overlaps(page)).join(' | ') || 'no overlap')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-panel.png` })

const stripText = await page.locator('.hf-strip').innerText()
await page.keyboard.press('1')
const s1 = await page.evaluate(() => (window as unknown as { __hatch: { speed: number } }).__hatch.speed)
await page.keyboard.press(' ')
const paused = await page.evaluate(() => (window as unknown as { __hatch: { speed: number } }).__hatch.speed)
await page.keyboard.press('2')
const s2 = await page.evaluate(() => (window as unknown as { __hatch: { speed: number } }).__hatch.speed)
await page.keyboard.press('3')
const s3 = await page.evaluate(() => (window as unknown as { __hatch: { speed: number } }).__hatch.speed)
note(
  'A9',
  /Day /.test(stripText) && /Field Lv/.test(stripText) && /\/day/.test(stripText) && /Apron/.test(stripText) && /Hall/.test(stripText) && paused === 0 && s1 === 1 && s2 === 3 && s3 === 5,
  `speeds ${paused},${s1},${s2},${s3} strip ${stripText.replace(/\s+/g, ' ').slice(0, 180)}`,
)

await page.keyboard.press('Escape')
await page.keyboard.press('h')
await page.waitForTimeout(100)
const hiddenCount = await page.locator('.hf-root').count()
note('A10', hiddenCount === 0, `roots ${hiddenCount}`)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-hidden.png` })
await page.keyboard.press('h')
await page.waitForTimeout(100)

await page.getByRole('button', { name: 'Stands', exact: true }).click()
await page.getByRole('tab', { name: 'Heavy' }).click()
const locked = page.locator('.hf-card[data-locked="1"]').first()
await locked.hover()
await page.waitForTimeout(300)
const lockTip = await page.locator('.hf-tooltip').innerText()
const lockIcon = await locked.locator('svg').count()
note('A11', /Field Level/i.test(lockTip) && lockIcon > 0, lockTip.replace(/\s+/g, ' '))
await page.keyboard.press('Escape')

await page.getByRole('button', { name: 'Pavement', exact: true }).click()
await page.getByRole('button', { name: 'Short strip', exact: true }).click()
await page.keyboard.press('Escape')
const stepTool = await page.evaluate(() => (window as unknown as { __ui: { getUiState: () => { tool: string; openMenu: string | null } } }).__ui.getUiState())
await page.keyboard.press('r')
await page.keyboard.press('Escape')
const stepMenu = await page.evaluate(() => (window as unknown as { __ui: { getUiState: () => { openMenu: string | null; openPanel: string | null } } }).__ui.getUiState())
await page.keyboard.press('u')
await page.keyboard.press('Escape')
const stepPanel = await page.evaluate(() => (window as unknown as { __ui: { getUiState: () => { openPanel: string | null } } }).__ui.getUiState())
await page.keyboard.press('Escape')
const stepGame = await page.evaluate(() => (window as unknown as { __ui: { getUiState: () => { openPanel: string | null } } }).__ui.getUiState())
const a12 =
  stepTool.tool === 'pan' &&
  stepTool.openMenu == null &&
  stepTool.openPanel == null &&
  stepMenu.openMenu == null &&
  stepMenu.openPanel == null &&
  stepPanel.openPanel == null &&
  stepGame.openPanel === 'menu'
note(
  'A12',
  a12,
  `tool ${JSON.stringify(stepTool)} menu ${JSON.stringify(stepMenu)} panel ${JSON.stringify(stepPanel)} game ${JSON.stringify(stepGame)}`,
)
await page.keyboard.press('Escape')

const hudText = await page.locator('.hf-root').innerText()
note('A16', !/\/hr|\/30s|\/mo\b/.test(hudText) && /\/day/.test(hudText), hudText.includes('/hr') ? 'found /hr' : 'rates use /day')

await page.evaluate(() => (window as unknown as { __ui: { setUiScale: (n: number) => void } }).__ui.setUiScale(0.7))
await page.waitForTimeout(50)
const smallOverlap = await overlaps(page)
await page.evaluate(() => (window as unknown as { __ui: { setUiScale: (n: number) => void } }).__ui.setUiScale(1.5))
await page.waitForTimeout(50)
const bigOverlap = await overlaps(page)
const bigCenter = await centerHits(page)
note('A17', smallOverlap.length === 0 && bigOverlap.length === 0 && bigCenter.length === 0, `70 ${smallOverlap.join(',') || 'ok'} 150 ${bigOverlap.join(',') || 'ok'} center ${bigCenter[0] ?? 'ok'}`)
await page.evaluate(() => (window as unknown as { __ui: { setUiScale: (n: number) => void } }).__ui.setUiScale(1))

await page.keyboard.press('i')
await page.waitForTimeout(100)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-info.png` })
note('A2-info', (await centerHits(page)).length === 0, 'center with info')
note('A2b-info', (await overlaps(page)).length === 0, (await overlaps(page)).join(' | ') || 'no overlap')
await page.keyboard.press('Escape')

await page.getByTestId('tab-economy').hover()
await page.getByTestId('cash-tip').waitFor()
const cashTip = await page.getByTestId('cash-tip').innerText()
const cashAmt = await page.getByTestId('cash-amount').innerText()
const cashEst = await page.getByTestId('cash-estimate').innerText()
note(
  'A18',
  /\$[\d,]/.test(cashAmt) &&
    /\/day/.test(cashEst) &&
    /income/i.test(cashTip) &&
    /costs/i.test(cashTip) &&
    /Next charge/.test(cashTip) &&
    /\/day/.test(cashTip),
  `amt ${cashAmt} est ${cashEst} tip ${cashTip.replace(/\s+/g, ' ').slice(0, 220)}`,
)
await page.screenshot({ path: `${OUT}/UI-REDESIGN-cash-flow.png` })
await page.mouse.move(480, 420)

await page.keyboard.press('3')
const cashBefore = await page.evaluate(
  () => (window as unknown as { __hatch: { cash: number } }).__hatch.cash,
)
const floatSeen = await page
  .waitForFunction(
    (start) => {
      const g = (window as unknown as { __hatch: { cash: number } }).__hatch
      return !!document.querySelector('.hf-float') && g.cash < start
    },
    cashBefore,
    { timeout: 45000 },
  )
  .then(() => true)
  .catch(() => false)
if (floatSeen) {
  await page.screenshot({ path: `${OUT}/UI-REDESIGN-cash-float.png` })
}
note('A18-float', floatSeen, floatSeen ? 'charge or income float visible' : 'no float before timeout')
await page.waitForSelector('.hf-float', { state: 'detached', timeout: 4000 }).catch(() => {})
await page.mouse.move(480, 420)
await page.getByTestId('tab-economy').click()
await page.getByTestId('week-summary').waitFor()
await page.screenshot({ path: `${OUT}/UI-REDESIGN-cash-week.png` })
await page.keyboard.press('Escape')

await page.setViewportSize({ width: 1366, height: 768 })
await page.waitForTimeout(200)
const idleSmall = await coverage(page)
const stripSmall = await box(page, '[data-hud-part="strip"]')
const barSmall = await box(page, '[data-hud-part="bar"]')
note('A1-1366', idleSmall <= 0.08 && stripSmall.h <= 32.5 && barSmall.h <= 56, `cov ${(idleSmall * 100).toFixed(2)}% strip ${stripSmall.h.toFixed(1)} bar ${barSmall.h.toFixed(1)}`)
note('A2-1366', (await centerHits(page)).length === 0, (await centerHits(page)).join(' | ') || 'center clear')
await page.getByRole('button', { name: 'Stands', exact: true }).click()
await page.waitForTimeout(100)
const menuSmall = await box(page, '[data-hud-part="menu"]')
const menuCovSmall = await coverage(page)
note(
  'A3-1366',
  menuSmall.h <= 150 && menuSmall.w <= 1366 * 0.7 && menuCovSmall <= 0.12,
  `menu ${menuSmall.w.toFixed(0)}×${menuSmall.h.toFixed(0)} cov ${(menuCovSmall * 100).toFixed(2)}%`,
)
note('A2b-1366-menu', (await overlaps(page)).length === 0, (await overlaps(page)).join(' | ') || 'no overlap')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-1366-menu.png` })
await page.keyboard.press('Escape')
await page.getByTestId('tab-economy').click()
const panelSmall = await box(page, '[data-hud-part="panel"]')
note('A8-1366', panelSmall.w <= 360.5 && panelSmall.h <= 768 * 0.7, `panel ${panelSmall.w.toFixed(0)}×${panelSmall.h.toFixed(0)}`)
note('A2-1366-panel', (await centerHits(page)).length === 0, (await centerHits(page)).join(' | ') || 'center clear')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-1366-panel.png` })
await page.keyboard.press('Escape')
await page.screenshot({ path: `${OUT}/UI-REDESIGN-after-1366-idle.png` })

await page.setViewportSize({ width: 1280, height: 720 })
await page.keyboard.press('h')
await page.waitForTimeout(200)
const frameDir = '/tmp/ui-redesign-frames'
await mkdir(frameDir, { recursive: true })
await page.keyboard.down('d')
for (let i = 0; i < 16; i++) {
  await page.screenshot({ path: `${frameDir}/f${String(i).padStart(2, '0')}.png` })
  await page.waitForTimeout(120)
}
await page.keyboard.up('d')
await page.keyboard.down('w')
for (let i = 16; i < 28; i++) {
  await page.screenshot({ path: `${frameDir}/f${String(i).padStart(2, '0')}.png` })
  await page.waitForTimeout(120)
}
await page.keyboard.up('w')
for (let i = 28; i < 34; i++) {
  await page.screenshot({ path: `${frameDir}/f${String(i).padStart(2, '0')}.png` })
  await page.waitForTimeout(120)
}
await page.close()

await exec('ffmpeg', [
  '-y',
  '-framerate',
  '8',
  '-i',
  '/tmp/ui-redesign-frames/f%02d.png',
  '-c:v',
  'libvpx-vp9',
  '-pix_fmt',
  'yuv420p',
  '-an',
  `${OUT}/UI-REDESIGN-airfield.webm`,
])
console.log('video', `${OUT}/UI-REDESIGN-airfield.webm`)

await starterKit(1920, 1080)
await starterKit(1366, 768)
await starterKit(1280, 800)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log(failed.map((f) => f.id).join(', '))
  process.exitCode = 1
}

await browser.close()

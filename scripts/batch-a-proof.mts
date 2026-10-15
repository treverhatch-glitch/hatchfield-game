/**
 * In-play proof clips for playtest batch A (#1 #35 #29 #41 #44 #8 #40 #42).
 * Start the dev server first: `npx vite --host 127.0.0.1 --port 45311 --strictPort`
 * Usage: npx tsx scripts/batch-a-proof.mts
 * Writes MP4s to docs/devlog/media/batch-a-proof/.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const OUT = 'docs/devlog/media/batch-a-proof'
const RAW = join(OUT, '.raw')
const URL = process.env.SHOT_URL || 'http://127.0.0.1:45311/'
const CHROME = [process.env.PLAYWRIGHT_CHROME, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(
  (p): p is string => Boolean(p) && existsSync(p as string),
)
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
const SIZE = { width: 1280, height: 720 }
const only = process.argv.slice(2)

mkdirSync(OUT, { recursive: true })
rmSync(RAW, { recursive: true, force: true })
mkdirSync(RAW, { recursive: true })

const call = (body: string) => new Function(body) as () => unknown

/** Caption bar plus a live counter line read from the running game. */
const OVERLAY = `
  if (!document.getElementById('proof-cap')) {
    const box = document.createElement('div')
    box.id = 'proof-cap'
    box.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;pointer-events:none;' +
      'background:rgba(10,14,22,.82);color:#f4f7fb;font:600 15px/1.35 system-ui,sans-serif;padding:8px 14px;border-radius:8px;' +
      'max-width:1100px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.35)'
    box.innerHTML = '<div id="proof-title"></div><div id="proof-live" style="font-weight:500;font-size:13px;opacity:.85"></div>'
    document.body.appendChild(box)
  }
  const g = window.__hatch
  if (g && !g.__proofWrapped) {
    g.__proofWrapped = true
    g.__goArounds = 0
    g.__refunds = 0
    const go = g.goAround.bind(g)
    g.goAround = (f) => { g.__goArounds += 1; return go(f) }
    const charge = g.charge.bind(g)
    g.charge = (...a) => { if (a[3] === 'Cancel refund') g.__refunds += 1; return charge(...a) }
  }
  if (!window.__proofTimer) {
    window.__proofTimer = setInterval(() => {
      const g = window.__hatch
      const el = document.getElementById('proof-live')
      if (!g || !el) return
      const day = 180
      const face = (((g.clock % day) + day) % day) / day * 24
      const h = Math.floor(face % 24), m = Math.floor((face % 1) * 60)
      const live = window.__proofLive ? window.__proofLive(g) : ''
      el.textContent = 'Clock ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + (live ? '  ·  ' + live : '')
    }, 200)
  }
`

async function caption(page: Page, text: string, live?: string) {
  await page.evaluate(call(OVERLAY))
  await page.evaluate(
    ({ text, live }) => {
      const w = window as unknown as { __proofLive?: ((g: unknown) => string) | null }
      w.__proofLive = live ? (new Function('g', `return ${live}`) as (g: unknown) => string) : null
      const el = document.getElementById('proof-title')
      if (el) el.textContent = text
    },
    { text, live: live ?? '' },
  )
}

async function opening(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(call(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hatchfield-gfx', 'med')`))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-pax').click()
  await page.getByTestId('coach').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByTestId('starter-kit-coach').click()
  const coach = page.getByTestId('coach').getByRole('button', { name: 'Got it' })
  if (await coach.count()) await coach.click()
  await page.waitForTimeout(800)
  inPlayAt = Date.now()
}

/** Wall time the clip's page opened and the time play began, so the MP4 skips the title menu. */
let pageAt = 0
let inPlayAt = 0

async function clip(browser: Browser, name: string, run: (page: Page) => Promise<void>) {
  if (only.length && !only.includes(name)) return
  const dir = join(RAW, name)
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } })
  const page = await context.newPage()
  pageAt = Date.now()
  inPlayAt = pageAt
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  try {
    await run(page)
  } finally {
    await context.close()
  }
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'))
  if (!webm) throw new Error(`${name}: no video recorded`)
  const mp4 = join(OUT, `${name}.mp4`)
  const skip = Math.max(0, (inPlayAt - pageAt) / 1000 - 0.5).toFixed(2)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, webm), '-ss', skip, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'veryfast', '-movflags', '+faststart', mp4])
  console.log(`${mp4}${errors.length ? `  (page errors: ${errors.join(' | ')})` : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS })
try {
  await clip(browser, '01-daytime-start-dim-night', async (page) => {
    await opening(page)
    await caption(
      page,
      '#1 New game opens in daylight · #35 no preview passengers are seeded in the hall',
      `'preview passengers ' + g.hallGuests.filter((x) => x.preview).length + ' · hall walkers ' + g.hallGuests.length`,
    )
    await page.waitForTimeout(5000)
    await caption(page, '#1 Clock moved to 21:12 for the clip, then 5× into the night: dim, not black', `'speed ' + g.speed + '×'`)
    await page.evaluate(call(`const g = window.__hatch; g.clock = Math.floor(g.clock / 180) * 180 + 159; g.setSpeed(5)`))
    await page.waitForFunction(
      '(() => { const g = window.__hatch; const f = ((g.clock % 180) + 180) % 180 / 180 * 24; return f >= 22.5 || f < 4 })()',
      undefined,
      { timeout: 120_000, polling: 250 },
    )
    await page.evaluate(call(`window.__hatch.setSpeed(1)`))
    await caption(page, '#1 Night: lights on, field still readable')
    await page.waitForTimeout(5000)
  })

  await clip(browser, '02-camera-speed', async (page) => {
    await opening(page)
    await page.evaluate(call(`window.__hatch.setSpeed(0)`))
    await page.getByTestId('hud-menu').click()
    await page.getByTestId('pause-settings').click()
    const slider = page.getByTestId('settings-camera-speed')
    await slider.scrollIntoViewIfNeeded()
    await caption(page, '#29 Settings › Camera speed (0.5× to 4×)')
    await page.waitForTimeout(1500)
    await slider.fill('0.5')
    await page.waitForTimeout(1200)
    await page.getByTestId('pause-back').click().catch(() => {})
    await page.getByTestId('pause-resume').click()
    await page.mouse.move(640, 400)
    await caption(page, '#29 Camera speed 0.5×: hold D for 2 s')
    await page.keyboard.down('d')
    await page.waitForTimeout(2000)
    await page.keyboard.up('d')
    await page.waitForTimeout(600)
    await page.getByTestId('hud-menu').click()
    await page.getByTestId('pause-settings').click()
    await page.getByTestId('settings-camera-speed').fill('4')
    await caption(page, '#29 Set camera speed to 4×')
    await page.waitForTimeout(1200)
    await page.getByTestId('pause-back').click().catch(() => {})
    await page.getByTestId('pause-resume').click()
    await caption(page, '#29 Camera speed 4×: hold A for 2 s')
    await page.keyboard.down('a')
    await page.waitForTimeout(2000)
    await page.keyboard.up('a')
    await page.waitForTimeout(1500)
  })

  await clip(browser, '03-second-runway-and-hangar', async (page) => {
    await opening(page)
    await page.evaluate(call(`const g = window.__hatch; g.setSpeed(0); g.cash = 2000000; g.emit && g.emit()`))
    await page.getByTestId('build-airfield').click({ timeout: 5000 }).catch(() => {})
    await page.getByTestId('tray-runway').click({ timeout: 5000 }).catch(() => {})
    for (const [tool, label] of [
      ['runway', 'second runway'],
      ['hangar', 'hangar'],
    ] as const) {
      await caption(page, `#41 ${label}: the ghost walks the grass and skips cells the clearance or a footprint refuses`)
      const plan = (await page.evaluate(
        ({ tool }) => {
          const g = (window as unknown as { __hatch: Record<string, any> }).__hatch
          g.setTool(tool)
          const refused: { c: number; r: number; why: string }[] = []
          let ok: { c: number; r: number } | null = null
          for (let r = 1; r < g.tiles.length - 1 && !ok; r++) {
            for (let c = 1; c < g.tiles[r].length - 1; c++) {
              if (g.tiles[r][c] !== 'grass') continue
              g.setHover({ c, r })
              const why = g.placementGhostReason()
              if (!why) {
                ok = { c, r }
                break
              }
              if (refused.length < 4 && !refused.some((x) => x.why === why)) refused.push({ c, r, why })
            }
          }
          return { refused, ok }
        },
        { tool },
      )) as { refused: { c: number; r: number; why: string }[]; ok: { c: number; r: number } | null }
      for (const bad of plan.refused) {
        await page.evaluate(({ c, r }) => {
          const g = (window as unknown as { __hatch: any }).__hatch
          g.focusAt({ view: 'apron', cells: [{ c, r }] })
          g.setHover({ c, r })
        }, bad)
        await caption(page, `#41 ${label} refused here: ${bad.why}`)
        await page.waitForTimeout(1300)
      }
      if (!plan.ok) throw new Error(`no legal cell for ${tool}`)
      await page.evaluate(({ c, r }) => {
        const g = (window as unknown as { __hatch: any }).__hatch
        g.focusAt({ view: 'apron', cells: [{ c, r }] })
        g.setHover({ c, r })
      }, plan.ok)
      await caption(page, `#41 ${label}: legal cell at ${plan.ok.c},${plan.ok.r}`)
      await page.waitForTimeout(1300)
      await page.evaluate(({ c, r }) => (window as unknown as { __hatch: any }).__hatch.clickTile({ c, r }), plan.ok)
      await caption(page, `#41 ${label} stamped at ${plan.ok.c},${plan.ok.r}`)
      await page.waitForTimeout(2200)
    }
    await page.evaluate(call(`const g = window.__hatch; g.setTool('select'); g.setSpeed(5)`))
    await caption(page, '#41 Contractors build both sites')
    await page.waitForTimeout(5000)
  })

  await clip(browser, '04-landing-and-lineup', async (page) => {
    await opening(page)
    await page.evaluate(call(`window.__hatch.setSpeed(5)`))
    await page.waitForFunction('Boolean(window.__hatch && window.__hatch.offer)', undefined, { timeout: 60_000 })
    await page.evaluate(call(`const g = window.__hatch; g.acceptOffer(); g.buyLoads(); g.buyLoads(); g.setSpeed(5)`))
    await caption(
      page,
      '#8 #40 Departures hold at the runway end; a landing keeps its exit · #42 no cancel-refund on a flight that can fuel',
      `'go-arounds ' + g.__goArounds + ' · cancel refunds ' + g.__refunds + ' · flights done ' + g.flightsDone + ' · on field ' + g.flights.filter((f) => f.phase !== 'hold' && f.phase !== 'gone').length`,
    )
    await page.waitForFunction('window.__hatch.flightsDone >= 1', undefined, { timeout: 240_000, polling: 500 })
    await page.waitForTimeout(4000)
  })

  await clip(browser, '05-zoomjet-letter-day0', async (page) => {
    await opening(page)
    await page.evaluate(call(`window.__hatch.setSpeed(5)`))
    await page.waitForFunction('Boolean(window.__hatch && window.__hatch.offer)', undefined, { timeout: 60_000 })
    await page.evaluate(call(`const g = window.__hatch; g.acceptOffer(); g.setSpeed(0); g.offer = { airline: 'zoomjet', age: 0, deadline: 36 }; g.emit && g.emit()`))
    await caption(
      page,
      '#44 Day 0: two desks at 12/min plus the starter kiosk clear 30, so Zoomjet (28) can sign',
      `(() => { const r = g.checkinSignReport('zoomjet'); return 'needs ' + r.peak + ' · clears ' + r.capacity + ' · ' + (r.ok ? 'can sign' : 'blocked') })()`,
    )
    const peek = page.getByTestId('phone-peek')
    await peek.waitFor({ state: 'attached', timeout: 8000 })
    await peek.evaluate((el) => (el as HTMLButtonElement).click())
    const sign = page.getByTestId('phone-action-contract-sign')
    const onMessages = await sign.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
    if (!onMessages) {
      await page.getByTestId('phone-tab-messages').click().catch(() => {})
      await sign.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {})
    }
    await page.waitForTimeout(4500)
    if (await sign.isVisible().catch(() => false)) await sign.click()
    await caption(page, '#44 Zoomjet signed on day 0', `'signed ' + g.signed.join(', ')`)
    await page.waitForTimeout(3000)
  })
} finally {
  await browser.close()
  rmSync(RAW, { recursive: true, force: true })
}

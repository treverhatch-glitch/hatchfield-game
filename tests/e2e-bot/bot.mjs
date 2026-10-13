/**
 * Hatchfield QA bot: plays the game headlessly in Chromium via Playwright.
 *
 *   node tests/e2e-bot/bot.mjs --url http://127.0.0.1:5173/ --label trunk \
 *        --scenario mixed --days 6 --out /workspace/qa/trunk
 *
 * Needs the Vite dev server (window.__hatch is dev-only).
 * Scenarios: mixed (mid-size airport fleet mix) | heavy (heavy-jet stress).
 * Writes <out>/result.json, screenshots, and a Playwright video (run.webm).
 */
import { mkdirSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const URL = arg('url', 'http://127.0.0.1:5173/')
const LABEL = arg('label', 'local')
const SCENARIO = arg('scenario', 'mixed')
const LONG = process.argv.includes('--long') || arg('mode', '') === 'long'
/* --long (or --mode long): 30 game days, ramped traffic. */
const DAYS = Number(arg('days', LONG ? 30 : SCENARIO === 'heavy' ? 4 : 6))
// Ramp: start with starter traffic (1 pax carrier), add a carrier every RAMP_EVERY days.
const RAMP = LONG || arg('ramp', '0') === '1'
const RAMP_EVERY = Number(arg('ramp-every', 3))
const EARLY_DAYS = Number(arg('early-days', 4))
const QUEUE_EARLY_MAX = Number(arg('queue-early-max', 12))
const CASH_DAY_FLOOR = Number(arg('cash-day-floor', -400000))
const OUT = arg('out', `/workspace/qa/${LABEL}-${SCENARIO}`)
const FPS_FLOOR = Number(arg('fps-floor', process.env.FPS_FLOOR ?? 12))
const VIDEO = arg('video', '1') !== '0'
mkdirSync(OUT, { recursive: true })

// Movement-weighted mix. Kind weights drive the game's own airframe picker;
// airframe weights then pick the exact type inside each kind.
const MIXES = {
  mixed: {
    kinds: { narrowbody: 0.6, regional: 0.24, widebody: 0.1, freighter: 0.06 },
    frames: {
      narrowbody: { a320neo: 0.4, b738: 0.4, a321: 0.2 },
      regional: { e175: 0.35, crj700: 0.3, atr72: 0.35 },
      widebody: { b789: 0.45, a359: 0.4, a380: 0.15 },
      freighter: { b763f: 0.35, b752f: 0.3, b748f: 0.25, an124: 0.1 },
    },
    specials: { mil: 0.12, amb: 0.15, helo: 0.15, park: 0.6 },
    slotsPerPoll: 1,
  },
  heavy: {
    kinds: { widebody: 0.45, freighter: 0.3, narrowbody: 0.2, regional: 0.05 },
    frames: {
      narrowbody: { a320neo: 0.3, b738: 0.3, a321: 0.4 },
      regional: { e175: 0.5, crj700: 0.2, atr72: 0.3 },
      widebody: { a380: 0.55, b789: 0.2, a359: 0.25 },
      freighter: { b748f: 0.4, an124: 0.35, b763f: 0.25 },
    },
    specials: { mil: 0.35, amb: 0.1, helo: 0.1, park: 0.3 },
    slotsPerPoll: 3,
  },
}
const MIX = MIXES[SCENARIO]
const NAMES = { a380: 'Airbus A380-800', an124: 'Antonov An-124', b748f: 'Boeing 747-8F', b763f: 'Boeing 767-300F', b752f: 'Boeing 757-200F', b789: 'Boeing 787-9', a359: 'Airbus A350-900', a320neo: 'Airbus A320neo', b738: 'Boeing 737-800', a321: 'Airbus A321', e175: 'Embraer E175', crj700: 'Bombardier CRJ700', atr72: 'ATR 72-600' }

const consoleErrors = []
const findings = []
const shots = []
const samples = []
const find = (severity, title, detail, repro, cls = null) =>
  findings.push({ severity, title, detail, repro, aircraftClass: cls })

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ...(VIDEO ? { recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } } : {}),
})
const page = await context.newPage()
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text().slice(0, 300)}`)
})

async function shot(name) {
  const p = join(OUT, `${String(shots.length + 1).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: p })
  shots.push(p)
}
async function fps(ms = 1500) {
  return page.evaluate(
    (d) =>
      new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const step = (now) => {
          n++
          if (now - t0 < d) requestAnimationFrame(step)
          else res(Math.round((n * 1000) / (now - t0)))
        }
        requestAnimationFrame(step)
      }),
    ms,
  )
}

const steps = []
const step = (s) => {
  steps.push(s)
  console.log(`[${LABEL}/${SCENARIO}] ${s}`)
}

let setup = null
try {
  step(`open ${URL}`)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await shot('title')

  step('New game → passenger start')
  globalThis.__seen = { 'new-game': (await page.getByTestId('new-game').count()) > 0 }
  await page.getByTestId('new-game').click()
  await page.waitForTimeout(400)
  await page.getByTestId('start-pax').click()
  await page.waitForTimeout(800)
  if (!(await page.evaluate(() => Boolean(window.__hatch)))) throw new Error('window.__hatch missing')

  step('Economy tab → starter kit (prefab terminal I)')
  await page.getByTestId('tab-economy').click({ force: true }).catch(() => {})
  await page.waitForTimeout(300)
  const kit = page.getByTestId('starter-kit')
  globalThis.__seen['starter-kit'] = (await kit.count()) > 0
  if (await kit.isVisible().catch(() => false)) await kit.click({ force: true })
  else await page.evaluate(() => window.__hatch.buildStarterKit())
  await page.waitForTimeout(600)
  const kitFits = await page.evaluate(() => window.__hatch.fits.length)
  if (!kitFits) {
    find('high', 'Starter kit did not place prefab terminal I from the UI', `Economy tab → starter-kit left fits=0 (button visible: ${await kit.isVisible().catch(() => false)}). Bot fell back to game.buildStarterKit().`, steps.slice())
    await page.evaluate(() => window.__hatch.buildStarterKit())
  }
  step('Budget tab, flow toggle, panel close, build tray state (PR #4 test ids)')
  const ui = {}
  const tid = (id) => page.getByTestId(id).first()
  ui.buildTrayStartsOpen = await tid('build-tray').evaluate((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
    return el.getAttribute('data-open') === 'true' || el.getAttribute('aria-expanded') === 'true' || (r.height > 160 && cs.visibility !== 'hidden' && cs.display !== 'none')
  }).catch(() => null)
  if (ui.buildTrayStartsOpen) find('medium', 'Build tray starts open and covers the apron', 'data-testid=build-tray is expanded right after New game', steps.slice())
  if (await tid('tab-budget').isVisible().catch(() => false)) { ui.budget = await tid('tab-budget').evaluate((el) => el.click()).then(() => true).catch(() => 'click failed'); await page.waitForTimeout(300); await shot('budget-tab') }
  else ui.budget = false
  const closeBtn = (await tid('panel-close').isVisible().catch(() => false)) ? tid('panel-close') : page.locator('.panel-head button').filter({ hasText: /Close/i }).first()
  if (await closeBtn.isVisible().catch(() => false)) ui.closed = await closeBtn.evaluate((el) => el.click()).then(() => true).catch(() => 'click failed')
  if (await tid('flow-toggle').isVisible().catch(() => false)) {
    const tog = () => tid('flow-toggle').evaluate((el) => (el.querySelector('input') ?? el).click())
    ui.flow = await tog().then(async () => { await page.waitForTimeout(400); await shot('flow-on'); await tog(); return true }).catch((e) => `error: ${e.message.split('\n')[0]}`)
  } else ui.flow = false
  for (const k of ['new-game', 'tab-economy', 'tab-budget', 'starter-kit', 'panel-close', 'flow-toggle', 'build-tray']) ui[`seen:${k}`] = globalThis.__seen[k] ?? ((await page.getByTestId(k).count()) > 0)
  step(`ui ${JSON.stringify(ui)}`)
  globalThis.__ui = ui

  step('Expand: heavy runway, 2nd prefab terminal, hangar/cargo/helipad, research, mil agreement')
  setup = await page.evaluate((mix) => {
    const g = window.__hatch
    const out = { notes: [] }
    g.sandbox = false
    g.cash += 3_000_000
    g.reputation = 70
    for (let c = 4; c < 24; c++) g.tiles[6][c] = 'runway'
    for (let c = 4; c < 18; c++) g.tiles[7][c] = 'taxi'
    for (let r = 7; r <= 22; r++) g.tiles[r][8] = 'taxi'
    const t2 = { c: 22, r: 14 }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.tiles[t2.r + r][t2.c + c] = 'grass'
    g.tool = 'premade'
    const fitsBefore = g.fits.length
    g.placePremade(t2)
    g.tool = 'pan'
    g.tiles[17][24] = 'stand'
    for (let r = 18; r <= 22; r++) g.tiles[r][24] = 'taxi'
    for (const c of [20, 22, 23]) g.tiles[22][c] = 'taxi'
    // Stand L for the new T2 stand + upgrade one starter stand (what a player stamps with stand_l).
    g.standClass ??= {}
    g.standClass['24,17'] = 'L'
    g.standClass['20,21'] = 'L'
    g.tiles[20][10] = 'hangar'
    g.tiles[18][10] = 'cargo'
    g.tiles[20][6] = 'stand'
    for (let r = 21; r <= 22; r++) g.tiles[r][6] = 'taxi'
    for (let c = 6; c <= 8; c++) g.tiles[22][c] = 'taxi'
    for (let r = 7; r <= 22; r++) g.tiles[r][8] = 'taxi'
    g.tiles[19][9] = 'police'
    g.tiles[18][12] = 'helipad'
    g.tiles[18][14] = 'fire' // fire station gates helicopters + air ambulance
    g.researchPoints = 1000
    for (const id of ['night_bank', 'deice', 'stand_class', 'heavy_pack', 'mil_ramp']) {
      try {
        if (!g.hasResearch(id)) g.buyResearch(id)
      } catch (e) {
        out.notes.push(`research ${id}: ${e.message}`)
      }
    }
    try {
      g.signMilitaryAgreement()
    } catch (e) {
      out.notes.push(`mil agreement threw: ${e.message}`)
    }
    if (g.budgets) g.budgets.ambulance = 80
    // Sign carriers through the real acceptOffer path (4 pax + 2 cargo).
    const all = g.allAirlines()
    const pax = all.filter((a) => a.kind !== 'cargo').sort((a, b) => Number(g.meetsReq(b.id)) - Number(g.meetsReq(a.id)))
    const cargo = all.filter((a) => a.kind === 'cargo')
    out.signedForced = []
    window.__qaRampPool = [...pax.slice(1), ...cargo]
    for (const a of mix.ramp ? pax.slice(0, 1) : [...pax.slice(0, 4), ...cargo.slice(0, 2)]) {
      if (g.signed.includes(a.id)) continue
      if (!g.meetsReq(a.id)) out.signedForced.push(a.id)
      g.offer = { airline: a.id }
      g.acceptOffer()
    }
    out.signed = g.signed.slice()
    const orig = g.pickAircraftKind.bind(g)
    const pickW = (w) => {
      let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0)
      for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k
      return Object.keys(w)[0]
    }
    window.__qa = { mix, pickW, origKind: orig }
    g.pickAircraftKind = (id) => {
      const a = g.airline(id)
      if (a.kind === 'cargo') return 'freighter'
      if (window.__qa.forceA380 > 0) return 'widebody'
      const k = pickW(mix.kinds)
      return k === 'freighter' ? 'widebody' : k
    }
    out.fitsBefore = fitsBefore
    out.fits = g.fits.length
    out.heavy = g.hasHeavyRunway()
    out.research = g.researchUnlocked.slice()
    out.mil = Boolean(g.milAgreement)
    out.news = g.news.slice(0, 5).map((n) => n.text)
    g.setSpeed(5)
    return out
  }, { ...MIX, ramp: RAMP })
  step(`setup ${JSON.stringify(setup)}`)
  if (!setup.heavy) find('high', 'Heavy runway not recognised', JSON.stringify(setup), steps.slice())
  if (!setup.research.includes('heavy_pack'))
    find('medium', 'heavy_pack research could not be bought in setup', JSON.stringify(setup), steps.slice())
  // Pull the camera back so the apron, stands and both terminals are in frame.
  await page.mouse.move(640, 330)
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, 250)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(500)
  await shot('setup')

  const CHUNK = 30
  const total = DAYS * 180
  let lastDayShot = 0
  let a380Shot = false
  let heavyShot = false
  let fpsMin = Infinity
  let pollN = 0
  for (let clock = 0; clock < total; ) {
    const s = await page.evaluate(
      ({ chunk, specials, slotsPerPoll, names, ramp, rampEvery, earlyDays }) => {
        const g = window.__hatch
        const qa = window.__qa
        const res = { newFlights: [], gone: [], stuckFlights: [], stuckTrucks: [], errors: [], standMisfit: [], pathViol: [] }
        qa.ramp = ramp; qa.rampEvery = rampEvery; qa.earlyDays = earlyDays
        const RANK = { S: 0, M: 1, L: 2 }
        const needClass = (f) => {
          try { if (g.standClassFor) return g.standClassFor(f.kind) } catch {}
          if (['a380', 'an124', 'b748f', 'c5'].includes(f.airframeId) || ['widebody', 'freighter'].includes(f.kind)) return 'L'
          if (f.kind === 'narrowbody') return 'M'
          return 'S'
        }
        const AIRSIDE = new Set(['gate', 'lounge', 'golf', 'waterfall', 'gaming', 'dayhotel', 'spa', 'pool'])
        qa.qmax ??= { checkin: 0, security: 0 }
        qa.pathSeen ??= {}
        qa.flights ??= {}
        qa.trucks ??= {}
        const rewrite = (f) => {
          const w = qa.mix.frames[f.kind]
          if (!w || f.craft !== 'jet') return
          let want = qa.pickW(w)
          if (f.kind === 'widebody' && qa.forceA380 > 0) {
            want = 'a380'
            qa.forceA380--
          }
          if (want && want !== f.airframeId) {
            f.airframeId = want
            if (names[want]) f.airframeName = names[want]
          }
        }
        try {
          // Explicit A380 trigger: every in-game day, request at least one A380 arrival.
          const day = Math.floor(g.clock / 180)
          // Ramp mode: no forced heavies during the early starter-traffic window.
          if (qa.a380Day !== day && !(qa.ramp && day < qa.earlyDays)) {
            qa.a380Day = day
            qa.forceA380 = (qa.forceA380 ?? 0) + 1
            const pax = g.signed.filter((id) => g.airline(id).kind !== 'cargo')
            if (pax.length) g.addManualSlot(pax[0], 12)
          }
          if (qa.ramp) {
            const want = 1 + Math.floor(day / qa.rampEvery)
            while (g.signed.length < want && window.__qaRampPool.length) {
              const a = window.__qaRampPool.shift()
              if (g.signed.includes(a.id)) continue
              g.offer = { airline: a.id }; g.acceptOffer(); qa.rampLog = [...(qa.rampLog ?? []), `day${day + 1}:${a.id}`]
            }
          } else if (g.offer) g.acceptOffer()
          if (g.parkingOffer && Math.random() < specials.park) g.acceptParking()
          for (let i = 0; i < (qa.ramp ? (Math.random() < 0.35 ? 1 : 0) : slotsPerPoll); i++) {
            const pax = g.signed.filter((id) => !g.isBanned?.(id))
            if (pax.length && g.openSchedule().length < g.scheduleCap())
              g.addManualSlot(pax[Math.floor(Math.random() * pax.length)], 10 + Math.random() * 20)
          }
          if (Math.random() < specials.mil) {
            g.milCool = 0
            g.trySpawnMilitary()
          }
          if (Math.random() < specials.amb) g.trySpawnAirAmbulance()
          if (Math.random() < specials.helo) g.trySpawnHelo()
        } catch (e) {
          res.errors.push(`driver: ${e.message}`)
        }
        const n = Math.round(chunk / (0.25 * g.speed))
        for (let i = 0; i < n; i++) {
          try {
            g.tick(0.25)
          } catch (e) {
            res.errors.push(`tick threw: ${e.message}`)
            break
          }
          for (const f of g.flights) {
            if (!qa.flights[f.id]) {
              if (f.phase === 'approach' || f.phase === 'hold') rewrite(f)
              qa.flights[f.id] = { born: g.clock, phase: f.phase, since: g.clock, af: f.airframeId, kind: f.kind, flagged: false, maxPhase: {} }
              res.newFlights.push({ id: f.id, af: f.airframeId, kind: f.kind, craft: f.craft, no: f.flightNo })
            }
            const r = qa.flights[f.id]
            r.af = f.airframeId
            r.last = { phase: f.phase, bagUnits: f.bagUnits ?? 0, bagsDeposited: f.bagsDeposited ?? 0, bagStage: f.bagStage, pax: f.pax, cargo: f.cargo, kind: f.kind,
              bagsLoaded: f.bagsLoaded ?? f.bagsOnboard ?? f.bagsCarried, bagsOffloaded: f.bagsOffloaded ?? f.bagsUnloaded, bagsInbound: f.inboundBags ?? f.bagsIn ?? f.arrBagUnits }
            if (f.stand && !['military', 'helicopter', 'air_ambulance'].includes(f.kind) && f.craft !== 'helo' && ['taxi_in', 'deboard', 'servicing', 'board'].includes(f.phase) && !r.fitChecked) {
              r.fitChecked = true
              const key = `${f.stand.c ?? f.stand.x},${f.stand.r ?? f.stand.y}`
              const have = g.standClass?.[key] ?? 'M'
              const need = needClass(f)
              if (RANK[need] > RANK[have]) res.standMisfit.push({ id: f.id, no: f.flightNo, af: f.airframeId, kind: f.kind, stand: key, have, need })
            }
            if (f.phase !== r.phase) {
              r.maxPhase[r.phase] = Math.max(r.maxPhase[r.phase] ?? 0, g.clock - r.since)
              r.phase = f.phase
              r.since = g.clock
              r.flagged = false
            }
          }
        }
        let qc = 0, qs = 0
        for (const h of g.hallGuests) {
          if (h.dead) continue
          // Waiting at the desk/lane (reached the node, not yet cleared), not walking toward it.
          if (h.job === 'depart' && h.node === 'checkin' && !h.clearedSec) qc++
          if (h.job === 'depart' && h.node === 'security' && !h.clearedSec) qs++
          if (h.job === 'depart' && !h.clearedSec && AIRSIDE.has(h.node) && !qa.pathSeen[h.id]) {
            qa.pathSeen[h.id] = 1
            res.pathViol.push({ id: h.id, node: h.node, path: (h.path ?? []).join('>') })
          }
        }
        const live = new Set(g.flights.map((f) => f.id))
        for (const [id, r] of Object.entries(qa.flights)) {
          if (!live.has(id) && !r.done) {
            r.done = true
            res.gone.push({ id, af: r.af, kind: r.kind, life: Math.round(g.clock - r.born), last: r.last, maxPhase: r.maxPhase })
          }
        }
        const LIMIT = { hold: 600, approach: 400, landing: 120, taxi_in: 240, deboard: 500, servicing: 700, board: 600, pushback: 180, taxi_out: 300, takeoff: 120, mx_taxi: 300, mx_return: 300, mx_bay: 1200 }
        for (const f of g.flights) {
          const r = qa.flights[f.id]
          const lim = LIMIT[f.phase]
          if (lim && g.clock - r.since > lim && !r.flagged) {
            r.flagged = true
            res.stuckFlights.push({ id: f.id, no: f.flightNo, af: f.airframeId, kind: f.kind, phase: f.phase, secs: Math.round(g.clock - r.since), waitingOn: JSON.stringify(f.waitingOn ?? {}).slice(0, 200), stand: f.stand })
          }
        }
        for (const t of g.trucks) {
          const k = `${t.x.toFixed(2)},${t.y.toFixed(2)}`
          const r = (qa.trucks[t.id] ??= { k, since: g.clock, flagged: false })
          if (r.k !== k) {
            r.k = k
            r.since = g.clock
          } else if (!t.patrol && (t.dwell ?? 0) <= 0 && (t.preDwell ?? 0) <= 0 && g.clock - r.since > 240 && !r.flagged) {
            r.flagged = true
            res.stuckTrucks.push({ id: t.id, kind: t.kind, mission: t.mission, at: k, secs: Math.round(g.clock - r.since), flightId: t.flightId, pathLen: t.path?.length ?? 0, seg: t.seg, returning: t.returning })
          }
        }
        const phases = {}
        for (const f of g.flights) phases[f.phase] = (phases[f.phase] ?? 0) + 1
        res.state = {
          clock: g.clock, day: Math.floor(g.clock / 180) + 1, cash: g.cash, cashFinite: Number.isFinite(g.cash),
          lostPax: g.lostPaxCount(), missed: g.missedFlights, flights: g.flights.length, phases,
          trucks: g.trucks.length, guests: g.hallGuests.length, qCheckin: qc, qSecurity: qs,
          caterTrucks: g.trucks.filter((t) => /cater/i.test(`${t.kind} ${t.mission}`)).length,
          stockNews: g.news.filter((x) => /stock ?out|out of stock|sold out|restock|ran out|shortage/i.test(x.text)).map((x) => x.text).slice(0, 5),
          stockState: (() => { const s = g.shopStock ?? g.stock ?? g.groundStock; if (!s || typeof s !== 'object') return null; const o = {}; for (const [k, v] of Object.entries(s)) if (typeof v === 'number') o[k] = v; return o })(),
          rampLog: qa.rampLog ?? [], signed: g.signed.length,
          done: g.flightsDone, overloaded: Boolean(g.hallOverloaded),
          a380: g.flights.filter((f) => f.airframeId === 'a380').map((f) => f.phase),
          news: g.news.slice(0, 3).map((x) => x.text),
          nanFields: ['cash', 'reputation', 'loanBalance', 'researchPoints'].filter((k) => typeof g[k] === 'number' && !Number.isFinite(g[k])),
        }
        return res
      },
      { chunk: CHUNK, specials: MIX.specials, slotsPerPoll: MIX.slotsPerPoll, names: NAMES, ramp: RAMP, rampEvery: RAMP_EVERY, earlyDays: EARLY_DAYS },
    )
    clock = s.state.clock
    pollN++
    samples.push(s)
    for (const e of s.errors) consoleErrors.push(e)
    await page.waitForTimeout(250)
    if (pollN % 6 === 0) {
      const f = await fps(1000)
      fpsMin = Math.min(fpsMin, f)
      s.state.fps = f
    }
    if (!a380Shot && s.state.a380.some((p) => ['taxi_in', 'deboard', 'servicing', 'board'].includes(p))) {
      a380Shot = true
      await shot(`a380-${s.state.a380.join('-')}-day${s.state.day}`)
    }
    if (!heavyShot && s.state.flights >= 6) {
      heavyShot = true
      await shot(`busy-${s.state.flights}flights-day${s.state.day}`)
    }
    if (s.state.day > lastDayShot) {
      lastDayShot = s.state.day
      await shot(`day${s.state.day}`)
      step(`day ${s.state.day}: cash=${Math.round(s.state.cash)} flights=${s.state.flights} done=${s.state.done} lostPax=${s.state.lostPax} missed=${s.state.missed} trucks=${s.state.trucks} guests=${s.state.guests}`)
    }
    if (s.errors.some((e) => e.startsWith('tick threw'))) break
  }
  await page.evaluate(() => window.__hatch.setSpeed(1))
  await page.getByRole('button', { name: /^Hall$/ }).click({ force: true, timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await shot('hall-end')
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(500)
  await shot('apron-end')
  setup.fpsMin = fpsMin
} catch (err) {
  find('critical', 'Bot run crashed', err?.stack ?? String(err), steps.slice())
  await page.screenshot({ path: join(OUT, '99-crash.png') }).catch(() => {})
}
await context.close()
await browser.close()
if (VIDEO) {
  const v = readdirSync(OUT).find((f) => f.endsWith('.webm') && f !== 'run.webm')
  if (v) renameSync(join(OUT, v), join(OUT, 'run.webm'))
}

// ---- Assertions → findings ----
const repro = (extra) => [
  `node tests/e2e-bot/bot.mjs --label ${LABEL} --scenario ${SCENARIO} --days ${DAYS}`,
  'New game → Passenger start → Economy → Starter kit',
  'Bot adds heavy runway, 2nd prefab terminal, hangar/cargo/helipad, research, mil agreement',
  extra,
]
const blank = () => ({ spawned: 0, departed: 0, stuck: 0, bagShort: 0, types: {}, maxLife: 0 })
const klass = (af, kind) =>
  ({ a380: 'heavy', an124: 'heavy', b748f: 'heavy', c5: 'heavy', atr72: 'turboprop', pc12: 'bizjet/GA', citation: 'bizjet/GA' }[af] ??
  { helo_med: 'helicopter', helo_exec: 'helicopter', air_ambulance: 'special (ambulance/firefighting)' }[kind] ?? kind)
const errs = [...new Set(consoleErrors)].filter((e) => !/React DevTools|favicon/i.test(e))
for (const e of errs.slice(0, 15)) find(e.startsWith('tick threw') ? 'critical' : 'high', 'Console/page error', e, repro('Watch the browser console during the run'))
const last = samples.at(-1)?.state
const nanAt = samples.find((s) => !s.state.cashFinite || s.state.nanFields.length)
if (nanAt) find('critical', 'Non-finite money/stat', `${JSON.stringify(nanAt.state.nanFields)} cash=${nanAt.state.cash} at clock ${Math.round(nanAt.state.clock)}`, repro(`Run to day ${nanAt.state.day}`))
const maxLost = Math.max(0, ...samples.map((s) => s.state.lostPax))
if (maxLost > 0) find('high', 'Lost passengers in prefab terminals', `peak lostPaxCount=${maxLost}; missedFlights=${last?.missed}`, repro('Check lostPaxCount() each poll'))
if ((last?.missed ?? 0) > 0) find(last.missed > 10 ? 'medium' : 'low', 'Missed flights (passengers)', `missedFlights=${last.missed} (hallOverloaded=${last.overloaded})`, repro('Only expected when a prefab is overloaded'))
const gone = samples.flatMap((s) => s.gone)
const byClass = {}
for (const s of samples)
  for (const f of s.newFlights) {
    const b = (byClass[klass(f.af, f.kind)] ??= blank())
    b.spawned++
    b.types[f.af] = (b.types[f.af] ?? 0) + 1
  }
let bagShort = 0
const bagEx = []
for (const f of gone) {
  const b = (byClass[klass(f.af, f.kind)] ??= blank())
  b.departed++
  b.maxLife = Math.max(b.maxLife, f.life)
  const L = f.last
  if (L && !L.cargo && L.pax > 0 && L.bagUnits > 0 && L.bagsDeposited < L.bagUnits && ['takeoff', 'taxi_out'].includes(L.phase)) {
    bagShort++
    b.bagShort++
    if (bagEx.length < 3) bagEx.push(`${f.af} ${L.bagsDeposited}/${L.bagUnits} stage=${L.bagStage}`)
  }
}
if (bagShort) find('medium', 'Outbound bag ledger short at takeoff (bagsDeposited < bagUnits)', `${bagShort}/${gone.length} departures had bagsDeposited < bagUnits; e.g. ${bagEx.join('; ')}`, repro('Compare f.bagsDeposited to f.bagUnits at takeoff'))
// ---- Bag checks: offloaded vs carried per departure ----
const bagRows = []
let bagFail = 0
for (const f of gone) {
  const L = f.last
  if (!L || L.cargo || !(L.pax > 0) || !['takeoff', 'taxi_out'].includes(L.phase)) continue
  const carried = L.bagsLoaded ?? L.bagsDeposited
  const row = { id: f.id, af: f.af, expected: L.bagUnits, carried, offloaded: L.bagsOffloaded ?? null, inbound: L.bagsInbound ?? null }
  row.pass = !(L.bagUnits > 0) || carried >= L.bagUnits
  if (row.offloaded != null && row.inbound != null && row.offloaded < row.inbound) row.pass = false
  if (!row.pass) bagFail++
  bagRows.push(row)
}
const checks = {}
const ran = samples.length > 0
const chk = (name, pass, detail) => (checks[name] = { pass: ran || name === 'uiSelectors' ? pass : null, detail: ran ? detail : `not evaluated (run crashed before play): ${detail}` })
chk('bags', bagRows.length ? bagFail === 0 : null, bagRows.length ? `${bagRows.length - bagFail}/${bagRows.length} pax departures carried all expected bags (offload field ${gone.some((f) => f.last?.bagsOffloaded != null) ? 'present' : 'absent: offload not checkable'}); worst: ${JSON.stringify(bagRows.filter((r) => !r.pass).slice(0, 3))}` : 'no pax departures')
if (bagFail) find('high', 'Departures left with bags missing (carried < expected)', checks.bags.detail, repro('Compare carried/offloaded bag counts at takeoff'))
// ---- Early-game prefab queues ----
const byDay = {}
for (const s of samples) { const d = (byDay[s.state.day] ??= { qc: 0, qs: 0, cash0: s.state.cash, cash1: s.state.cash, signed: s.state.signed }); d.qc = Math.max(d.qc, s.state.qCheckin ?? 0); d.qs = Math.max(d.qs, s.state.qSecurity ?? 0); d.cash1 = s.state.cash; d.signed = s.state.signed }
const early = Object.entries(byDay).filter(([d]) => Number(d) <= EARLY_DAYS)
const earlyMax = Math.max(0, ...early.map(([, v]) => Math.max(v.qc, v.qs)))
chk('earlyQueues', RAMP ? earlyMax <= QUEUE_EARLY_MAX : null, `${RAMP ? '' : '(informational: non-ramp runs sign 6 carriers at t=0) '}peak check-in/security queue days 1–${EARLY_DAYS} = ${earlyMax} (limit ${QUEUE_EARLY_MAX}); per day ${JSON.stringify(Object.fromEntries(Object.entries(byDay).map(([d, v]) => [d, [v.qc, v.qs, v.signed]])))}`)
if (checks.earlyQueues.pass === false) find('high', 'Prefab terminal bottlenecks too early at starter traffic', checks.earlyQueues.detail, repro('--ramp 1, watch queue counts days 1–4'))
// ---- Stand-class fit ----
const misfit = samples.flatMap((s) => s.standMisfit)
chk('standFit', misfit.length === 0, misfit.length ? `${misfit.length} oversize parks, e.g. ${JSON.stringify(misfit.slice(0, 3))}` : 'no aircraft parked on a stand smaller than its class')
if (misfit.length) find('high', 'Oversize aircraft on small stand', checks.standFit.detail, repro('Check standClass[stand] vs aircraft class'))
// ---- Catering / stockouts ----
const caterSeen = Math.max(0, ...samples.map((s) => s.state.caterTrucks ?? 0))
const stockEv = [...new Set(samples.flatMap((s) => s.state.stockNews ?? []))]
const stockStates = samples.map((s) => s.state.stockState).filter(Boolean)
const negStock = stockStates.some((o) => Object.values(o).some((v) => v < 0))
chk('catering', gone.length ? caterSeen > 0 && !negStock : null, `catering trucks peak=${caterSeen}; stockout/restock events=${stockEv.length} ${JSON.stringify(stockEv.slice(0, 4))}; stock fields ${stockStates.length ? 'present' : 'absent'}${negStock ? '; NEGATIVE stock seen' : ''}`)
if (checks.catering.pass === false) find('medium', 'Catering/stock check failed', checks.catering.detail, repro('Watch catering trucks and shop stock'))
// ---- Room pathing ----
const viol = samples.flatMap((s) => s.pathViol)
chk('roomPathing', viol.length === 0, viol.length ? `${viol.length} departing guests reached airside without clearing security, e.g. ${JSON.stringify(viol.slice(0, 3))}` : 'every departing guest airside had cleared security')
if (viol.length) find('high', 'Guests reached airside without security', checks.roomPathing.detail, repro('Track clearedSec vs node per guest'))
// ---- Cash pace ----
const deltas = Object.entries(byDay).map(([d, v]) => [Number(d), Math.round(v.cash1 - v.cash0)])
const fullDays = deltas.slice(0, -1).length ? deltas.slice(0, -1) : deltas
const avg = fullDays.length ? fullDays.reduce((a, [, v]) => a + v, 0) / fullDays.length : 0
chk('cashPace', !nanAt && avg >= CASH_DAY_FLOOR, `avg daily cash delta ${Math.round(avg)} (floor ${CASH_DAY_FLOOR}); per day ${JSON.stringify(deltas)}`)
if (checks.cashPace.pass === false) find('high', 'Cash pace out of range', checks.cashPace.detail, repro('Track cash per in-game day'))
const ui = globalThis.__ui ?? {}
chk('uiSelectors', ['new-game', 'tab-economy', 'starter-kit'].every((k) => ui[`seen:${k}`] !== false), JSON.stringify(ui))
chk('starterKit', setup ? !findings.some((f) => /Starter kit/.test(f.title)) : false, 'starter-kit button places terminal')
const stuckF = samples.flatMap((s) => s.stuckFlights)
for (const f of stuckF) (byClass[klass(f.af, f.kind)] ??= blank()).stuck++
const groupedF = {}
for (const f of stuckF) (groupedF[`${f.af}@${f.phase}`] ??= []).push(f)
for (const list of Object.values(groupedF)) {
  const f = list[0]
  find(['hold', 'approach'].includes(f.phase) ? 'medium' : 'high', `Flight stuck in ${f.phase} (${f.af})`, `${list.length}× e.g. ${f.no} ${f.secs}s in ${f.phase}; waitingOn=${f.waitingOn}; stand=${JSON.stringify(f.stand)}`, repro(`Spawn ${f.af} and watch its phase timer`), klass(f.af, f.kind))
}
const groupedT = {}
for (const t of samples.flatMap((s) => s.stuckTrucks)) (groupedT[`${t.kind}/${t.mission}`] ??= []).push(t)
for (const [k, list] of Object.entries(groupedT)) find('high', `Stuck service vehicle: ${k}`, `${list.length}× motionless >240 game-s; e.g. ${JSON.stringify(list[0])}`, repro('Track truck x/y per poll'))
if (setup && Number.isFinite(setup.fpsMin) && setup.fpsMin < FPS_FLOOR) find('medium', `FPS below floor (${FPS_FLOOR})`, `min ${setup.fpsMin} fps (headless SwiftShader CPU renderer, 1280×800)`, repro('Measure rAF rate at 5x'))
const seen = new Set(samples.flatMap((s) => s.newFlights.map((f) => f.af)))
const ALL = ['crj700', 'e175', 'a320neo', 'b738', 'a321', 'b789', 'a359', 'atr72', 'b752f', 'b763f', 'b748f', 'c130', 'c17', 'kc135', 'f15', 'citation', 'pc12', 'cl415', 'at802', 'aw139', 's76', 'a380', 'an124', 'c5']
const never = ALL.filter((a) => !seen.has(a))
if (!seen.has('a380')) find('medium', 'A380 never arrived', 'Mix asked for A380s but none spawned', repro('Heavy runway + heavy_pack + widebody slots'), 'heavy')
const sevRank = { critical: 0, high: 1, medium: 2, low: 3 }
findings.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
const result = {
  label: LABEL, scenario: SCENARIO, days: DAYS, url: URL, setup, final: last,
  fpsSamples: samples.map((s) => s.state.fps).filter(Boolean),
  byClass, airframesSeen: [...seen].sort(), airframesNever: never,
  departures: gone.length, checks, bagRows, mode: LONG ? 'long' : 'standard', ramp: RAMP, findings, shots, steps,
}
writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2))
console.log(Object.entries(checks).map(([k, v]) => `CHECK ${k}: ${v.pass === null ? 'SKIP' : v.pass ? 'PASS' : 'FAIL'} — ${v.detail}`).join('\n'))
console.log(JSON.stringify({ label: LABEL, scenario: SCENARIO, findings: findings.map((f) => `${f.severity}: ${f.title}`), byClass, never }, null, 1))

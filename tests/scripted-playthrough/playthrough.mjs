/**
 * Hatchfield scripted playthrough: plays the real game in headless Chromium like a new
 * player and audits the money and ops for anomalies. Never edits game code.
 *
 *   npm run playthrough:scripted -- --days 30
 *   node tests/scripted-playthrough/playthrough.mjs --url http://127.0.0.1:5173/ --days 150
 *   node tests/scripted-playthrough/playthrough.mjs --resume --days 150
 *
 * Flags
 *   --url URL           use a running dev server (default: start Vite on a free port)
 *   --days N            game days to run (default 150)
 *   --resume            continue from out/log.json + the saved game in out/profile
 *   --out DIR           scratch dir (default tests/scripted-playthrough/out, gitignored)
 *   --render            keep the render loop running (default: stubbed after setup, ticks are scripted)
 *   --no-publish        do not copy checkpoints/screenshots under docs/devlog
 *   --report FILE       write the markdown report here (default docs/devlog/SCRIPTED_PLAYTHROUGH_REPORT.md)
 *   --max-minutes M     stop cleanly after M wall minutes and report the days reached
 *   --stuck-hours H     stuck-flight threshold in game hours (default 2)
 *
 * Needs the dev server: window.__hatch is dev-only (see src/App.tsx).
 */
import { spawn } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { CONFIG, clockLabel, dayOf, formatTable, runChecks } from './checks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

const flag = (k) => process.argv.includes(`--${k}`)
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}

// Tunables live here, not in the logic below.
const TUNE = {
  chunkSimSeconds: 30, // one driver poll
  tickDt: 0.25,
  speed: 5, // max sim speed
  checkpointEveryDays: 5,
  screenshotEveryDays: 10,
  vehicleStuckSeconds: 240,
  contracts: ['bushline', 'zoomjet'],
  researchRetryEveryDays: 5,
  viewport: { width: 1280, height: 800 },
  chromeArgs: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
}

const DAYS = Number(arg('days', 150))
const RESUME = flag('resume')
const OUT = resolve(arg('out', join(HERE, 'out')))
const RENDER = flag('render')
const PUBLISH = !flag('no-publish')
const REPORT = resolve(arg('report', join(ROOT, 'docs/devlog/SCRIPTED_PLAYTHROUGH_REPORT.md')))
const MAX_MIN = Number(arg('max-minutes', 0))
const cfg = { ...CONFIG, stuckHours: Number(arg('stuck-hours', CONFIG.stuckHours)) }
const DOC_CP = join(ROOT, 'docs/devlog/scripted150')
const DOC_MEDIA = join(ROOT, 'docs/devlog/media/scripted150')
const SEC_PER_DAY = cfg.secPerDay

mkdirSync(OUT, { recursive: true })
// Files under docs/ are only written after the browser is closed: Vite watches the repo and
// full-reloads the page when a file appears, which killed the run at the first checkpoint.
const pendingPublish = new Map()
const publish = (src, dest) => {
  if (PUBLISH) pendingPublish.set(dest, src)
}
function flushPublish() {
  for (const [dest, src] of pendingPublish) {
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
  }
  say(`published ${pendingPublish.size} files under docs/devlog`)
}

const pad3 = (n) => String(n).padStart(3, '0')
const runLog = join(OUT, 'run.log')
const say = (s) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${s}`
  console.log(line)
  appendFileSync(runLog, `${line}\n`)
}

// ---- state carried across --resume ----
const fresh = () => ({
  log: { money: [], cashSamples: [], fees: [], flightEvents: [], signed: [], consoleErrors: [], scriptGaps: [], endT: 0 },
  steps: [],
  checkpoints: [],
  shots: [],
  lastCheckpointDay: 0,
  lastShotDay: 0,
  researchDone: false,
  wallMinutes: 0,
})
const stateFile = join(OUT, 'log.json')
let S = fresh()
if (RESUME) {
  if (!existsSync(stateFile)) {
    console.error(`--resume: ${stateFile} not found`)
    process.exit(2)
  }
  S = { ...fresh(), ...JSON.parse(readFileSync(stateFile, 'utf8')) }
} else {
  writeFileSync(runLog, '')
}
const L = S.log
const gap = (what, detail, t = L.endT) => {
  L.scriptGaps.push({ t, what, detail })
  say(`GAP: ${what} :: ${detail}`)
}
const step = (s) => {
  S.steps.push(s)
  say(`step: ${s}`)
}
const saveState = () => writeFileSync(stateFile, JSON.stringify(S))

// ---- dev server ----
let vite = null
const viteLog = []
async function startVite() {
  const port = 5200 + Math.floor(Math.random() * 600)
  const bin = join(ROOT, 'node_modules/.bin/vite')
  vite = spawn(bin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  vite.stdout.on('data', (d) => {
    for (const line of String(d).split('\n')) if (/reload|optimi|error/i.test(line)) viteLog.push(line.trim().slice(0, 160))
  })
  vite.stderr.on('data', (d) => {
    const s = String(d)
    if (/error/i.test(s)) say(`vite: ${s.trim().slice(0, 200)}`)
  })
  const url = `http://127.0.0.1:${port}/`
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return url
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite did not start within 60 s')
}
const URL_ARG = arg('url', '')
const URL = URL_ARG || (await startVite())
say(`game url ${URL}; days=${DAYS}; resume=${RESUME}; render=${RENDER}`)

// ---- browser ----
const context = await chromium.launchPersistentContext(join(OUT, 'profile'), {
  headless: true,
  viewport: TUNE.viewport,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: TUNE.chromeArgs,
})
const page = context.pages()[0] ?? (await context.newPage())

/** Headless world audit. A missing game (crash before boot) leaves the log alone. */
async function pullWorldAudit() {
  try {
    L.worldViolations = await page.evaluate(() => {
      const hatch = window.__hatch
      const rows = hatch && typeof hatch.worldAudit === 'function' ? hatch.worldAudit() : []
      return (rows ?? []).map((v) => ({ rule: v.rule, c: v.c, r: v.r, message: v.message }))
    })
  } catch {
    /* page may already be gone */
  }
}

const simNow = () => L.endT
page.on('pageerror', (e) => L.consoleErrors.push({ t: simNow(), text: `pageerror: ${e.message}` }))
page.on('console', (m) => {
  if (m.type() === 'error') L.consoleErrors.push({ t: simNow(), text: `console: ${m.text().slice(0, 300)}` })
})

const navLog = []
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) navLog.push(`${new Date().toISOString().slice(11, 19)} ${f.url()}`)
})

page.on('crash', () => navLog.push('PAGE CRASH'))
page.on('load', () => navLog.push(`load ${new Date().toISOString().slice(11, 19)}`))

const hasHatch = () => page.evaluate(() => Boolean(window.__hatch))
async function clickTestId(id, what) {
  const loc = page.getByTestId(id)
  if (await loc.first().isVisible().catch(() => false)) {
    await loc.first().click({ force: true })
    return true
  }
  gap(`testid "${id}" not visible`, `${what}; fell back to the game API`)
  return false
}

// In-page driver: wraps the money methods, tracks flights, and runs ticks.
async function installProbes(runResidual = true) {
  await page.evaluate(
    ({ tune, residual }) => {
      const g = window.__hatch
      if (window.__pt) return
      const pt = {
        money: [],
        flightEvents: [],
        action: null,
        actionSeq: 0,
        lastCash: g.cash,
        accounted: 0,
        residualAcc: 0,
        residualMark: g.clock,
        phases: new Map(),
        trucks: new Map(),
        stuckTrucks: new Set(),
        stuckVehicleNow: 0,
        airlinesSeen: {},
      }
      window.__pt = pt
      const wrap = (kind, name) => {
        const orig = g[name].bind(g)
        g[name] = (...a) => {
          // The caller's method name (dev build keeps names) tells apart otherwise unlabeled charges.
          const m = /at (?:Game\.)?([\w$.]+)/.exec((new Error().stack || '').split('\n')[2] || '')
          const via = m ? m[1] : 'unknown'
          const before = g.cash
          const ret = orig(...a)
          const after = g.cash
          const amount = kind === 'earn' || kind === 'spend' || kind === 'charge' ? a[0] : 0
          const label = kind === 'charge' ? `charge via ${via}` : a[1]
          const ok = kind === 'spend' ? ret !== false : true
          if (ok) {
            pt.money.push({ t: g.clock, kind, amount, label: String(label), category: kind === 'earn' ? (a[3] ?? 'landing_fees') : undefined, before, after, action: pt.action, via })
            pt.accounted += Number.isFinite(after - before) ? after - before : 0
          }
          return ret
        }
      }
      wrap('earn', 'earn')
      wrap('spend', 'spend')
      wrap('charge', 'charge')
      pt.flush = (why) => {
        const cash = g.cash
        if (Number.isFinite(cash) && Number.isFinite(pt.lastCash)) {
          const res = cash - pt.lastCash - pt.accounted
          pt.residualAcc += res
        }
        pt.lastCash = cash
        pt.accounted = 0
        if (why || g.clock - pt.residualMark >= 7.5) {
          if (Math.abs(pt.residualAcc) > 0.51) {
            pt.money.push({ t: g.clock, kind: 'untracked', amount: pt.residualAcc, label: why ?? 'residual cash change (payroll/upkeep/loan/etc. outside earn/spend/charge)', before: cash - pt.residualAcc, after: cash, action: pt.action })
          }
          pt.residualAcc = 0
          pt.residualMark = g.clock
        }
      }
      pt.drain = () => {
        const out = { money: pt.money, flightEvents: pt.flightEvents }
        pt.money = []
        pt.flightEvents = []
        return out
      }
      pt.snapshot = () => {
        const f = g.fieldLevel()
        const ledger = g.bank?.ledger?.()
        return {
          clock: g.clock,
          day: Math.floor(g.clock / tune.secPerDay) + 1,
          cash: g.cash,
          revenue: g.revenue,
          loanBalance: g.loanBalance,
          reputation: g.reputation,
          fieldXp: g.fieldXp,
          fieldLevel: typeof f === 'object' ? JSON.stringify(f) : f,
          researchPoints: g.researchPoints,
          researchUnlocked: g.researchUnlocked.slice(),
          signed: g.signed.slice(),
          flights: g.flights.length,
          flightsDone: g.flightsDone,
          trucks: g.trucks.length,
          lostPax: g.lostPaxCount(),
          bagsLost: g.bagsLost ?? 0,
          missedFlights: g.missedFlights,
          stuckVehicles: pt.stuckVehicleNow,
          airlinesSeen: { ...pt.airlinesSeen },
          byCategory: ledger?.byCategory ?? {},
          totalIncome: ledger?.totalIncome,
          totalExpense: ledger?.totalExpense,
          fees: { ...g.fees },
          rooms: g.fits[0] ? { ...g.fits[0].rooms } : null,
        }
      }
      pt.run = (chunk, dt, doDrive) => {
        const errors = []
        if (doDrive) {
          try {
            // A new player accepts parking offers; contracts are only the two the script signs.
            if (g.parkingOffer) g.acceptParking()
          } catch (e) {
            errors.push(`driver: ${e.message}`)
          }
        }
        const n = Math.max(1, Math.round(chunk / (dt * g.speed)))
        for (let i = 0; i < n; i++) {
          try {
            g.tick(dt)
          } catch (e) {
            errors.push(`tick threw: ${e.message}`)
            break
          }
          if (residual) pt.flush()
          const live = new Set()
          for (const f of g.flights) {
            live.add(f.id)
            if (pt.phases.get(f.id) !== f.phase) {
              if (!pt.phases.has(f.id)) pt.airlinesSeen[f.airline] = (pt.airlinesSeen[f.airline] ?? 0) + 1
              pt.phases.set(f.id, f.phase)
              pt.flightEvents.push({ t: g.clock, id: f.id, airline: f.airline, phase: f.phase })
            }
          }
          for (const id of [...pt.phases.keys()]) {
            if (!live.has(id)) {
              pt.phases.delete(id)
              pt.flightEvents.push({ t: g.clock, id, airline: '', phase: 'gone', gone: true })
            }
          }
          for (const t of g.trucks) {
            const k = `${t.x.toFixed(2)},${t.y.toFixed(2)}`
            const r = pt.trucks.get(t.id) ?? { k, since: g.clock }
            if (r.k !== k) {
              r.k = k
              r.since = g.clock
              pt.stuckTrucks.delete(t.id)
            } else if (!t.patrol && (t.dwell ?? 0) <= 0 && (t.preDwell ?? 0) <= 0 && g.clock - r.since > tune.vehicleStuckSeconds) {
              pt.stuckTrucks.add(t.id)
            }
            pt.trucks.set(t.id, r)
          }
          pt.stuckVehicleNow = pt.stuckTrucks.size
        }
        return { errors, clock: g.clock, cash: g.cash }
      }
    },
    { tune: { ...TUNE, secPerDay: SEC_PER_DAY }, residual: runResidual },
  )
}

// Flight events whose airline is blank (removals) inherit the airline from the last phase seen.
function absorb(drained) {
  const lastAirline = absorb.lastAirline ?? (absorb.lastAirline = new Map())
  for (const e of drained.flightEvents) {
    if (e.airline) lastAirline.set(e.id, e.airline)
    else e.airline = lastAirline.get(e.id) ?? ''
    if (e.gone) lastAirline.delete(e.id)
  }
  L.money.push(...drained.money)
  L.flightEvents.push(...drained.flightEvents)
}

async function drain() {
  absorb(await page.evaluate(() => window.__pt.drain()))
}

// A scripted player action: bump the action counter so duplicate postings inside one action are detectable.
async function act(label, fn, arg0) {
  await page.evaluate(() => {
    window.__pt.action = ++window.__pt.actionSeq
    window.__pt.flush()
  })
  const res = await page.evaluate(fn, arg0)
  await page.evaluate((why) => {
    window.__pt.flush(`action: ${why}`)
  }, label)
  await drain()
  await page.evaluate(() => {
    window.__pt.action = null
  })
  return res
}

async function stubRaf(on) {
  await page.evaluate((stub) => {
    if (stub && !window.__realRaf) {
      window.__realRaf = window.requestAnimationFrame.bind(window)
      window.__pendingRaf = null
      window.requestAnimationFrame = (cb) => {
        window.__pendingRaf = cb
        return 1
      }
    } else if (!stub && window.__realRaf) {
      window.requestAnimationFrame = window.__realRaf
      if (window.__pendingRaf) window.__realRaf(window.__pendingRaf)
      window.__pendingRaf = null
      window.__realRaf = null
    }
  }, on)
}

async function screenshot(day) {
  if (!RENDER) {
    await stubRaf(false)
    await page.waitForTimeout(700)
  }
  const file = join(OUT, `day${pad3(day)}.png`)
  await page.screenshot({ path: file })
  if (!RENDER) await stubRaf(true)
  publish(file, join(DOC_MEDIA, `day${pad3(day)}.png`))
  S.shots.push(`day${pad3(day)}.png`)
}

/** Catalog price scan: nothing is free, so any $0/$1/NaN price in data is a finding. */
async function scanCatalogPrices() {
  return page.evaluate(async () => {
    const out = {}
    const KEYS = /^(cost|price|fee|sign|buildCost|principal|repairCost|upkeep|dailyUpkeep)$/
    const walk = (v, path, depth) => {
      if (depth > 3 || v == null) return
      if (Array.isArray(v)) {
        v.slice(0, 400).forEach((x, i) => walk(x, `${path}[${(x && (x.id ?? x.name)) ?? i}]`, depth + 1))
      } else if (typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (typeof x === 'number' && KEYS.test(k)) out[`${path}.${k}`] = x
          else if (typeof x === 'object') walk(x, `${path}.${k}`, depth + 1)
        }
      }
    }
    try {
      const cat = await import('/src/game/catalog.ts')
      for (const [name, v] of Object.entries(cat)) if (typeof v === 'object') walk(v, `catalog.${name}`, 0)
    } catch (e) {
      out['scan-error'] = Number.NaN
      window.__catalogScanError = String(e)
    }
    return out
  })
}

function writeCheckpoint(snap, final = false) {
  const day = snap.day
  const findings = runChecks({ ...L, endT: snap.clock }, cfg)
  const cp = {
    day,
    clock: snap.clock,
    gameTime: clockLabel(snap.clock),
    cash: snap.cash,
    loanBalance: snap.loanBalance,
    revenue: snap.revenue,
    incomeByCategory: Object.fromEntries(Object.entries(snap.byCategory).filter(([, v]) => v > 0)),
    costsByCategory: Object.fromEntries(Object.entries(snap.byCategory).filter(([, v]) => v < 0)),
    byCategoryRaw: snap.byCategory,
    totalIncome: snap.totalIncome,
    totalExpense: snap.totalExpense,
    fieldXp: snap.fieldXp,
    fieldLevel: snap.fieldLevel,
    reputation: snap.reputation,
    researchUnlocked: snap.researchUnlocked,
    activeAirlines: snap.signed,
    airlinesFlying: Object.keys(snap.airlinesSeen),
    flightsActive: snap.flights,
    flightsDone: snap.flightsDone,
    paxLost: snap.lostPax,
    bagsLost: snap.bagsLost,
    missedFlights: snap.missedFlights,
    stuckVehicles: snap.stuckVehicles,
    anomalies: findings.map((f) => ({ severity: f.severity, category: f.category, title: f.title, gameTime: f.gameTime, evidence: f.evidence })),
    consoleErrors: L.consoleErrors.length,
    moneyLines: L.money.length,
    final,
  }
  S.checkpoints = S.checkpoints.filter((c) => c.day !== day).concat(cp)
  const name = `checkpoint-day${pad3(day)}.json`
  writeFileSync(join(OUT, name), JSON.stringify(cp, null, 2))
  publish(join(OUT, name), join(DOC_CP, name))
  say(`checkpoint day ${day}: cash=${Math.round(cp.cash)} flights=${cp.flightsDone} paxLost=${cp.paxLost} bagsLost=${cp.bagsLost} stuckVeh=${cp.stuckVehicles} anomalies=${cp.anomalies.length} consoleErrors=${cp.consoleErrors}`)
  saveState()
  return cp
}

// ---- cash curve (SVG from checkpoints) ----
function cashCurveSvg(cps) {
  const W = 760
  const H = 320
  const m = { l: 70, r: 20, t: 20, b: 40 }
  const pts = cps.filter((c) => Number.isFinite(c.cash)).sort((a, b) => a.day - b.day)
  if (pts.length < 2) return ''
  const xs = pts.map((p) => p.day)
  const ys = pts.map((p) => p.cash)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(0, ...ys)
  const y1 = Math.max(...ys, 1)
  const sx = (v) => m.l + ((v - x0) / Math.max(1, x1 - x0)) * (W - m.l - m.r)
  const sy = (v) => H - m.b - ((v - y0) / Math.max(1, y1 - y0)) * (H - m.t - m.b)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.day).toFixed(1)},${sy(p.cash).toFixed(1)}`).join(' ')
  const yt = [0, 0.25, 0.5, 0.75, 1].map((f) => y0 + f * (y1 - y0))
  const fmt = (v) => `$${Math.round(v).toLocaleString('en-US')}`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" font-size="11">`,
    `<rect width="${W}" height="${H}" fill="#fff"/>`,
    ...yt.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="#ddd"/><text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end" fill="#444">${fmt(v)}</text>`),
    ...pts.map((p) => `<text x="${sx(p.day)}" y="${H - m.b + 16}" text-anchor="middle" fill="#444">${p.day}</text>`),
    `<text x="${(W + m.l) / 2}" y="${H - 6}" text-anchor="middle" fill="#444">game day</text>`,
    `<path d="${path}" fill="none" stroke="#1f6feb" stroke-width="2"/>`,
    ...pts.map((p) => `<circle cx="${sx(p.day)}" cy="${sy(p.cash)}" r="3" fill="#1f6feb"/>`),
    `<text x="${m.l}" y="14" fill="#111" font-weight="bold">Cash by game day (checkpoints)</text>`,
    '</svg>',
  ].join('\n')
}

function writeReport(findings, reached, wallMin) {
  const cps = S.checkpoints.slice().sort((a, b) => a.day - b.day)
  const svg = cashCurveSvg(cps)
  if (svg) {
    writeFileSync(join(OUT, 'cash-curve.svg'), svg)
    publish(join(OUT, 'cash-curve.svg'), join(DOC_MEDIA, 'cash-curve.svg'))
  }
  const money = (v) => (Number.isFinite(v) ? `$${Math.round(v).toLocaleString('en-US')}` : String(v))
  const last = cps.at(-1)
  const rows = cps
    .map((c) => `| ${c.day} | ${money(c.cash)} | ${money(c.totalIncome)} | ${money(-(c.totalExpense ?? 0))} | ${c.flightsDone} | ${c.paxLost} | ${c.bagsLost} | ${c.stuckVehicles} | ${c.anomalies.length} |`)
    .join('\n')
  const fr = findings.map((f, i) => `${i + 1}. **${f.severity}** \`${f.category}\` ${f.title}\n   - game time: ${f.gameTime}\n   - evidence: ${String(f.evidence).replace(/\n/g, ' ')}`).join('\n')
  const cat = last
    ? Object.entries(last.byCategoryRaw)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([k, v]) => `| ${k} | ${money(v)} |`)
        .join('\n')
    : ''
  const md = `# Scripted playthrough report

Generated by \`tests/scripted-playthrough/playthrough.mjs\` (issue #153). Do not hand-edit the generated sections; the notes at the bottom are written after the run.

- Requested days: ${DAYS}; **reached: day ${reached}** (${clockLabel(L.endT)})
- Wall time this session: ${wallMin.toFixed(1)} min; stuck-flight threshold: ${cfg.stuckHours} game hours
- Money lines logged: ${L.money.length}; flight phase events: ${L.flightEvents.length}; console/page errors: ${L.consoleErrors.length}

## Steps done

${S.steps.map((s) => `- ${s}`).join('\n')}

## Money timeline

${svg ? '![Cash by game day](media/scripted150/cash-curve.svg)' : '_Not enough checkpoints for a curve._'}

| Day | Cash | Income (bank) | Costs (bank) | Flights done | Pax lost | Bags lost | Stuck vehicles | Anomalies so far |
|---|---|---|---|---|---|---|---|---|
${rows}

### Bank totals by category at day ${last?.day ?? '-'}

| Category | Net |
|---|---|
${cat}

## Findings (${findings.length})

${findings.length ? fr : 'None.'}

## Could not do

${L.scriptGaps.length ? L.scriptGaps.map((g) => `- ${g.what}: ${g.detail}`).join('\n') : 'Nothing; every step ran through its intended path.'}

Screenshots: ${S.shots.map((s) => `\`media/scripted150/${s}\``).join(', ') || 'none'}.
Checkpoints: \`docs/devlog/scripted150/\`.
`
  writeFileSync(join(OUT, 'report.md'), md)
  if (!flag('no-report')) pendingPublish.set(REPORT, join(OUT, 'report.md'))
}

// ============================ main ============================
const wallStart = Date.now()
let exitCode = 1
try {
  if (!RESUME) {
    step(`open ${URL}`)
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(600)

    step('New game (sandbox OFF) -> Passenger start')
    if (!(await clickTestId('new-game', 'title screen new game'))) throw new Error('cannot start a new game from the UI')
    await page.waitForTimeout(400)
    if (!(await clickTestId('start-pax', 'land screen passenger start'))) throw new Error('cannot choose the passenger start')
    await page.waitForTimeout(800)
  } else {
    step(`resume from day ${S.lastCheckpointDay}`)
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    if (!(await clickTestId('continue-game', 'title screen continue'))) throw new Error('no saved game to continue')
    await page.waitForTimeout(800)
  }
  if (!(await hasHatch())) throw new Error('window.__hatch missing: the dev server must be used (dev-only hook)')

  await installProbes()
  await page.evaluate(() => window.__pt.flush('probe start'))
  if (!RESUME) {
    const sandbox = await page.evaluate(() => window.__hatch.sandbox)
    if (sandbox) {
      await act('sandbox off', () => {
        window.__hatch.sandbox = false
      })
      gap('Sandbox was ON after Passenger start', 'script forced sandbox=false')
    }
    L.fees.push({ t: 0, schedule: await page.evaluate(() => ({ ...window.__hatch.fees })) })
    const prices = await scanCatalogPrices()
    L.fees.push({ t: 0, schedule: prices })
    const scanErr = await page.evaluate(() => window.__catalogScanError ?? null)
    if (scanErr) gap('catalog price scan failed', scanErr)
    S.catalogPriceCount = Object.keys(prices).length

    step('Economy tab -> starter kit')
    await page.getByTestId('tab-economy').click({ force: true, timeout: 3000 }).catch(() => gap('testid "tab-economy" not clickable', 'continued without opening the Economy tab'))
    await page.waitForTimeout(300)
    const kitBtn = page.getByTestId('starter-kit')
    await page.evaluate(() => window.__pt.flush('before starter kit'))
    if (await kitBtn.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        window.__pt.action = ++window.__pt.actionSeq
      })
      await kitBtn.click({ force: true })
    } else {
      gap('testid "starter-kit" not visible after opening the Economy tab', 'used game.buildStarterKit()')
      await act('starter kit (api)', () => window.__hatch.buildStarterKit())
    }
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__pt.flush('action: starter kit'))
    await drain()
    await page.evaluate(() => {
      window.__pt.action = null
    })
    if (!(await page.evaluate(() => window.__hatch.fits.length))) {
      gap('starter kit placed no terminal hall', 'fits=0 after the button; retrying via game.buildStarterKit()')
      await act('starter kit (api retry)', () => window.__hatch.buildStarterKit())
    }
    const close = page.getByTestId('panel-close')
    if (await close.isVisible().catch(() => false)) await close.click({ force: true })

    step('Place starter kit: done')
    L.fees.push({ t: 0, schedule: await page.evaluate(() => ({ ...window.__hatch.fees })) })

    step('Sign Bushline and Zoomjet contracts')
    for (const id of TUNE.contracts) {
      const r = await act(`sign ${id}`, (want) => {
        const g = window.__hatch
        const a = g.allAirlines().find((x) => x.id === want || new RegExp(want, 'i').test(x.name))
        if (!a) return { ok: false, why: 'airline not in game.allAirlines() (it only exists in negotiation/diplomacy data)' }
        const met = g.meetsReq(a.id)
        g.offer = { airline: a.id }
        g.acceptNegotiation()
        let viaFallback = false
        if (!g.signed.includes(a.id) && g.offer) {
          g.acceptOffer()
          viaFallback = true
        }
        return { ok: g.signed.includes(a.id), id: a.id, met, name: a.name, viaFallback, news: g.news[0]?.text }
      }, id)
      if (!r.ok) gap(`could not sign ${id}`, JSON.stringify(r))
      else {
        if (r.viaFallback) gap(`${r.name} would not sign through acceptNegotiation()`, `script fell back to acceptOffer(); last news: ${r.news}`)
        L.signed.push({ t: await page.evaluate(() => window.__hatch.clock), airline: r.id })
        if (!r.met) gap(`${r.name} signed although requirements were not met`, 'script forced the offer through acceptOffer(); a player could not do this yet')
      }
    }

    step('Take a loan')
    const loan = await act('loan', () => {
      const g = window.__hatch
      const before = g.cash
      g.takeLoan()
      return { took: g.loanBalance > 0, delta: g.cash - before, balance: g.loanBalance }
    })
    if (!loan.took) gap('loan was refused', JSON.stringify(loan))
    else step(`loan taken: +$${Math.round(loan.delta)} cash, balance ${Math.round(loan.balance)}`)

    step('Buy a shop (Souvenirs room)')
    const shop = await act('shop', () => {
      const g = window.__hatch
      const before = g.fits[0]?.rooms.souvenir ?? 0
      if (g.fits[0]) g.selectedTile = { ...g.fits[0].origin }
      g.buyRoom('souvenir')
      return { before, after: g.fits[0]?.rooms.souvenir ?? 0, news: g.news[0]?.text }
    })
    if (shop.after <= shop.before) gap('shop was not placed', JSON.stringify(shop))
  }

  const tryResearch = async () => {
    const r = await act('research', () => {
      const g = window.__hatch
      const ids = ['night_bank', 'bag_sorter', 'self_service', 'ct_lanes', 'egates', 'deice']
      const before = g.researchUnlocked.length
      for (const id of ids) {
        if (g.hasResearch(id) || !g.canBuyResearch(id).ok) continue
        g.buyResearch(id)
        if (g.researchUnlocked.length > before) return { ok: true, id }
      }
      return { ok: false, rp: g.researchPoints, why: ids.map((id) => `${id}: ${g.canBuyResearch(id).why || 'ok'}`).join('; ') }
    })
    return r
  }
  if (!RESUME) {
    step('Try a research purchase')
    const r = await tryResearch()
    if (r.ok) {
      S.researchDone = true
      step(`research bought: ${r.id}`)
    } else step(`research not affordable at start (RP ${Math.round(r.rp)}); retrying every ${TUNE.researchRetryEveryDays} days`)
  }

  // Pull the camera back so screenshots show the apron.
  await page.mouse.move(640, 330)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 250)
    await page.waitForTimeout(40)
  }
  await act('set max speed', (sp) => window.__hatch.setSpeed(sp), TUNE.speed)
  if (!RENDER) await stubRaf(true)

  step(`Run ${DAYS} game days at speed ${TUNE.speed} (render ${RENDER ? 'on' : 'off'})`)
  const targetClock = DAYS * SEC_PER_DAY
  let clock = L.endT
  let snap = await page.evaluate(() => window.__pt.snapshot())
  clock = snap.clock
  let stopped = ''
  let reloads = 0
  // The page reloaded under us (dev server HMR full-reload, a crash, ...): reload the last saved game and go on.
  const recover = async (why) => {
    gap('page reloaded during the run', `${why}; navigations: ${navLog.slice(-3).join(' | ')}; vite: ${viteLog.slice(-3).join(' | ')}`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(2000)
    if (!(await hasHatch().catch(() => false))) throw new Error('reload recovery: window.__hatch missing after reload')
    // __hatch exists on the title screen too; continue the saved game if no field is open.
    if (!(await page.evaluate(() => Boolean(window.__hatch.site)))) {
      await page.getByTestId('continue-game').waitFor({ state: 'visible', timeout: 15000 })
      await page.getByTestId('continue-game').click({ force: true })
      await page.waitForTimeout(1000)
    }
    await installProbes()
    await act('recover speed', (sp) => window.__hatch.setSpeed(sp), TUNE.speed)
    if (!RENDER) await stubRaf(true)
    const sn = await page.evaluate(() => window.__pt.snapshot())
    // The save is from the last checkpoint: drop log lines from the lost time.
    L.money = L.money.filter((m) => m.t <= sn.clock)
    L.flightEvents = L.flightEvents.filter((m) => m.t <= sn.clock)
    L.cashSamples = L.cashSamples.filter((m) => m.t <= sn.clock)
    L.endT = sn.clock
    absorb.lastAirline?.clear()
    return sn.clock
  }
  while (clock < targetClock) {
    let res
    try {
      res = await page.evaluate(({ chunk, dt }) => window.__pt.run(chunk, dt, true), { chunk: TUNE.chunkSimSeconds, dt: TUNE.tickDt })
    } catch (e) {
      if (!/context was destroyed|navigation|__pt/i.test(String(e)) || ++reloads > 5) throw e
      clock = await recover(String(e).split('\n')[0])
      continue
    }
    clock = res.clock
    L.endT = clock
    L.cashSamples.push({ t: clock, cash: res.cash })
    for (const e of res.errors) L.consoleErrors.push({ t: clock, text: e })
    await drain()
    const day = dayOf(clock)
    const doneDays = Math.floor(clock / SEC_PER_DAY)
    if (doneDays >= S.lastCheckpointDay + TUNE.checkpointEveryDays || clock >= targetClock) {
      snap = await page.evaluate(() => window.__pt.snapshot())
      L.fees.push({ t: clock, schedule: snap.fees })
      for (const id of snap.signed) if (!L.signed.some((s) => s.airline === id)) L.signed.push({ t: clock, airline: id })
      if (!S.researchDone && doneDays % TUNE.researchRetryEveryDays === 0) {
        const r = await tryResearch()
        if (r.ok) {
          S.researchDone = true
          step(`research bought on day ${day}: ${r.id}`)
        }
      }
      const cp = writeCheckpoint({ ...snap, day: doneDays })
      S.lastCheckpointDay = doneDays
      await page.evaluate(() => window.__hatch.persist?.())
      if (doneDays >= S.lastShotDay + TUNE.screenshotEveryDays) {
        await screenshot(doneDays)
        S.lastShotDay = doneDays
      }
      saveState()
      if (cp.cash < -1e9) throw new Error('cash is unrealistic; aborting')
    }
    if (res.errors.some((e) => e.startsWith('tick threw'))) {
      stopped = 'tick threw'
      break
    }
    if (MAX_MIN && (Date.now() - wallStart) / 60000 + S.wallMinutes > MAX_MIN) {
      stopped = `--max-minutes ${MAX_MIN} reached`
      break
    }
  }
  if (stopped) step(`stopped early: ${stopped}`)
  snap = await page.evaluate(() => window.__pt.snapshot())
  L.endT = snap.clock
  if (!S.researchDone) gap('no research purchase succeeded during the whole run', 'every canBuyResearch() check failed; see log for reasons')
  if (!RENDER) await stubRaf(false)
  writeCheckpoint({ ...snap, day: Math.floor(snap.clock / SEC_PER_DAY) }, true)
  await page.evaluate(() => window.__hatch.persist?.())
  S.wallMinutes += (Date.now() - wallStart) / 60000
  await pullWorldAudit()

  const findings = runChecks(L, cfg)
  writeFileSync(join(OUT, 'findings.json'), JSON.stringify(findings, null, 2))
  saveState()
  writeReport(findings, Math.floor(L.endT / SEC_PER_DAY), S.wallMinutes)
  console.log(`\n${formatTable(findings)}\n`)
  say(`finished: day ${Math.floor(L.endT / SEC_PER_DAY)}, ${findings.length} findings`)
  exitCode = findings.length ? 1 : 0
} catch (err) {
  const msg = err?.stack ?? String(err)
  say(`CRASH: ${msg}`)
  gap('script crashed', msg.slice(0, 400))
  await page.screenshot({ path: join(OUT, 'crash.png') }).catch(() => {})
  S.wallMinutes += (Date.now() - wallStart) / 60000
  saveState()
  try {
    await pullWorldAudit()
    const findings = runChecks(L, cfg)
    writeFileSync(join(OUT, 'findings.json'), JSON.stringify(findings, null, 2))
    writeReport(findings, Math.floor(L.endT / SEC_PER_DAY), S.wallMinutes)
    console.log(`\n${formatTable(findings)}\n`)
  } catch {
    /* nothing more to save */
  }
  exitCode = 1
}
await context.close().catch(() => {})
if (vite) vite.kill('SIGTERM')
flushPublish()
process.exit(exitCode)

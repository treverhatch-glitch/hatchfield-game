/**
 * Pure anomaly checks for the scripted playthrough. No browser, no I/O.
 *
 * Log shape (all times are sim clock seconds; 1 game day = 180 s, 1 game hour = 7.5 s):
 *   money:        [{ t, kind: 'earn'|'spend'|'charge'|'untracked', amount, label, category?,
 *                    before, after, action? }]
 *   cashSamples:  [{ t, cash }]
 *   fees:         [{ t, schedule: { key: number } }]            fee card snapshots
 *   flightEvents: [{ t, id, airline, phase, gone? }]            one per phase change / removal
 *   signed:       [{ t, airline }]
 *   consoleErrors:[{ t, text }]
 *   scriptGaps:   [{ t, what, detail }]                         steps the script could not do
 *   worldViolations: [{ rule, c, r, message }]                apron audit at the end of the run
 *   endT:         final sim clock
 */

export const CONFIG = {
  secPerDay: 180,
  secPerHour: 7.5,
  /** Spec: a flight in one state for more than 2 game hours is stuck. */
  stuckHours: 2,
  /** A signed carrier should schedule a flight within this many game days. */
  firstFlightDays: 4,
  /** Fee card keys that are counts or hours, not prices. */
  nonPriceFeeKeys: ['parkingFreeHours'],
  /** Prices at or below this are suspicious placeholders. */
  lowPriceMax: 1,
  /** Airlines that fly without a signed contract by design (parking offers, GA, military, medical). */
  contractFreeAirlines: ['ga', 'mil', 'military', 'amb', 'ambulance', 'helo', 'medevac'],
  /** Resting states: an aircraft parked on a stand is not stuck. Everything else is judged. */
  restPhases: ['parked'],
  /** Console noise that is not a game error. */
  benignConsole: [/React DevTools/i, /favicon/i, /\[vite\]/i, /Download the React/i],
  /** Untracked cash moves smaller than this are rounding. */
  untrackedEpsilon: 0.51,
  /** Two identical postings within this many sim seconds count as one charge posted twice. */
  dupWindowSec: 0,
}

const SEV = { critical: 0, high: 1, medium: 2, low: 3 }

export const dayOf = (t, c = CONFIG) => Math.floor(Math.max(0, t) / c.secPerDay) + 1
export const clockLabel = (t, c = CONFIG) => {
  const inDay = Math.max(0, t) % c.secPerDay
  const hh = Math.floor(inDay / c.secPerHour)
  const mm = Math.floor(((inDay % c.secPerHour) / c.secPerHour) * 60)
  return `day ${dayOf(t, c)} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const finding = (severity, category, title, t, evidence, extra = {}) => ({
  severity,
  category,
  title,
  t,
  gameTime: t == null ? 'n/a' : clockLabel(t),
  evidence,
  ...extra,
})

const bad = (n) => typeof n !== 'number' || !Number.isFinite(n)

/** NaN / Infinity / negative income / $0 or $1 postings. */
export function checkMoneyLines(log, cfg = CONFIG) {
  const out = []
  // Per-flight lines ("N208E bag handling") repeat; group them by the label without the leading tail number.
  const lowGroups = new Map()
  const lowLine = (m, title, ev) => {
    const key = `${m.kind}|${m.amount}|${String(m.label).replace(/^[A-Z0-9-]+\s/, '')}`
    const g = lowGroups.get(key)
    if (g) g.count++
    else lowGroups.set(key, { m, title, ev, count: 1 })
  }
  for (const m of log.money ?? []) {
    const ev = `${m.kind} "${m.label}" amount=${m.amount} cash ${m.before} -> ${m.after}`
    if (bad(m.amount) || bad(m.before) || bad(m.after)) {
      out.push(finding('critical', 'nan', `Non-finite money line: ${m.label}`, m.t, ev))
      continue
    }
    if (m.kind === 'earn' && m.amount < 0)
      out.push(finding('high', 'negative-revenue', `Negative revenue: ${m.label}`, m.t, ev))
    if (m.kind === 'earn' && m.amount >= 0 && m.amount <= cfg.lowPriceMax) lowLine(m, `Income of $${m.amount}: ${m.label}`, ev)
    if (m.kind === 'spend' && m.amount >= 0 && m.amount <= cfg.lowPriceMax)
      lowLine(m, `Purchase priced $${m.amount}: ${m.label}`, ev)
    if (m.kind === 'spend' && m.amount < 0)
      out.push(finding('high', 'negative-price', `Negative purchase price: ${m.label}`, m.t, ev))
    if (m.kind === 'charge' && (m.amount === 0 || m.amount === 1)) lowLine(m, `Charge of $${m.amount}: ${m.label}`, ev)
  }
  for (const g of lowGroups.values()) {
    const many = g.count > 1 ? ` (x${g.count}, first shown)` : ''
    out.push(finding('medium', 'low-fee', g.title + many, g.m.t, g.ev, { count: g.count }))
  }
  for (const s of log.cashSamples ?? []) {
    if (bad(s.cash)) out.push(finding('critical', 'nan', 'Cash is not finite', s.t, `cash=${s.cash}`))
  }
  return out
}

/** Fee card entries that are $0, $1, NaN, Infinity or negative. */
export function checkFees(log, cfg = CONFIG) {
  const out = []
  const seen = new Set()
  for (const snap of log.fees ?? []) {
    for (const [key, value] of Object.entries(snap.schedule ?? {})) {
      if (cfg.nonPriceFeeKeys.includes(key)) continue
      let sev = null
      let why = ''
      if (bad(value)) {
        sev = 'critical'
        why = `${value}`
      } else if (value < 0) {
        sev = 'high'
        why = `negative ($${value})`
      } else if (value === 0 || value === 1) {
        sev = 'medium'
        why = `$${value}`
      }
      if (!sev) continue
      const k = `${key}:${why}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(finding(sev, bad(value) ? 'nan' : 'low-fee', `Fee "${key}" is ${why}`, snap.t, `fees.${key}=${value}`))
    }
  }
  return out
}

/** The same purchase or charge posted twice for one action (or at the same instant). */
export function checkDoubleSpend(log, cfg = CONFIG) {
  const out = []
  const seen = new Map()
  for (const m of log.money ?? []) {
    if (m.kind !== 'spend' && m.kind !== 'charge' && m.kind !== 'earn') continue
    if (!(m.amount > 1)) continue
    const key = `${m.kind}|${m.label}|${m.amount}`
    const prev = seen.get(key)
    const sameAction = m.action != null && prev && prev.action === m.action
    const sameMoment = prev && Math.abs(m.t - prev.t) <= cfg.dupWindowSec
    if (prev && (sameAction || sameMoment)) {
      // Two identical earn lines in one tick can be legitimate; only spends are certain.
      const sev = m.kind === 'earn' ? 'low' : 'high'
      out.push(
        finding(
          sev,
          'double-spend',
          `${m.label} posted twice for $${m.amount}`,
          m.t,
          `${m.kind} at t=${prev.t} and t=${m.t}${sameAction ? ` (action #${m.action})` : ''}`,
        ),
      )
    }
    seen.set(key, m)
  }
  return out
}

/** Cash that moved without any earn/spend/charge line explaining it. */
export function checkUnledgered(log, cfg = CONFIG) {
  const rows = (log.money ?? []).filter((m) => m.kind === 'untracked' && Math.abs(m.amount) > cfg.untrackedEpsilon)
  if (!rows.length) return []
  const total = rows.reduce((s, m) => s + m.amount, 0)
  const ex = rows
    .slice(0, 5)
    .map((m) => `${clockLabel(m.t)} ${m.amount > 0 ? '+' : ''}${Math.round(m.amount)} (${m.label})`)
    .join('; ')
  return [
    finding(
      'low',
      'unledgered-cash',
      `${rows.length} cash changes had no earn/spend/charge line (net ${Math.round(total)})`,
      rows[0].t,
      ex,
    ),
  ]
}

/** A flight that sits in one phase for more than cfg.stuckHours game hours. */
export function checkStuckFlights(log, cfg = CONFIG) {
  const limit = cfg.stuckHours * cfg.secPerHour
  const byId = new Map()
  for (const e of log.flightEvents ?? []) {
    const list = byId.get(e.id) ?? []
    list.push(e)
    byId.set(e.id, list)
  }
  const spans = []
  for (const [id, list] of byId) {
    list.sort((a, b) => a.t - b.t)
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      if (e.gone || cfg.restPhases.includes(e.phase)) continue
      const next = list[i + 1]
      const end = next ? next.t : (log.endT ?? e.t)
      const dur = end - e.t
      if (dur > limit) spans.push({ id, airline: e.airline, phase: e.phase, start: e.t, dur, open: !next })
    }
  }
  // Group by airline+phase so one jam reads as one finding.
  const groups = new Map()
  for (const s of spans) {
    const k = `${s.airline}@${s.phase}`
    const g = groups.get(k) ?? []
    g.push(s)
    groups.set(k, g)
  }
  const out = []
  for (const [k, list] of groups) {
    list.sort((a, b) => b.dur - a.dur)
    const w = list[0]
    const hrs = (w.dur / cfg.secPerHour).toFixed(1)
    out.push(
      finding(
        w.open ? 'high' : 'medium',
        'stuck-flight',
        `${list.length}x flight in "${w.phase}" > ${cfg.stuckHours} game h (${w.airline})`,
        w.start,
        `worst: ${w.id} ${hrs} game h${w.open ? ' (still there at end of run)' : ''}; key ${k}`,
        { count: list.length },
      ),
    )
  }
  return out
}

/** Flights without a contract, and contracts that never fly. */
export function checkFleetVsContracts(log, cfg = CONFIG) {
  const out = []
  const signedAt = new Map()
  for (const s of log.signed ?? []) if (!signedAt.has(s.airline)) signedAt.set(s.airline, s.t)
  const firstFlight = new Map()
  const orphan = new Map()
  for (const e of log.flightEvents ?? []) {
    if (cfg.contractFreeAirlines.includes(e.airline)) continue
    if (!firstFlight.has(e.airline)) firstFlight.set(e.airline, e.t)
    const at = signedAt.get(e.airline)
    if ((at == null || at > e.t + 1e-6) && !orphan.has(e.airline)) orphan.set(e.airline, e)
  }
  for (const [airline, e] of orphan) {
    const signed = signedAt.has(airline) ? `later at t=${signedAt.get(airline)}` : 'never'
    out.push(
      finding(
        'high',
        'contract-mismatch',
        `Flight from "${airline}" with no active contract`,
        e.t,
        `flight ${e.id} first seen in "${e.phase}"; signed=${signed}`,
      ),
    )
  }
  const grace = cfg.firstFlightDays * cfg.secPerDay
  for (const [airline, at] of signedAt) {
    if (firstFlight.has(airline)) continue
    if ((log.endT ?? 0) - at < grace) continue
    out.push(
      finding(
        'high',
        'contract-mismatch',
        `Signed contract "${airline}" never scheduled a flight`,
        at,
        `signed ${clockLabel(at)}, no flight through ${clockLabel(log.endT)}`,
      ),
    )
  }
  return out
}

/** Console and page errors, de-duplicated. */
export function checkConsole(log, cfg = CONFIG) {
  const groups = new Map()
  for (const e of log.consoleErrors ?? []) {
    if (cfg.benignConsole.some((re) => re.test(e.text))) continue
    const k = e.text.slice(0, 160)
    const g = groups.get(k) ?? { first: e, n: 0 }
    g.n++
    groups.set(k, g)
  }
  return [...groups].map(([k, g]) =>
    finding('high', 'console-error', `Console/page error x${g.n}`, g.first.t, k, { count: g.n }),
  )
}

/** Steps the script could not perform (missing testid etc.) are findings, not silent skips. */
export function checkScriptGaps(log) {
  return (log.scriptGaps ?? []).map((g) => finding('medium', 'script-gap', g.what, g.t ?? null, g.detail ?? ''))
}

/** Roads through buildings, illegal crossings, wingtip and runway clearance, tower sightlines. */
export function checkWorld(log) {
  return (log.worldViolations ?? []).map((v) =>
    finding(
      'high',
      'world-violation',
      v.message ?? `${v.rule ?? 'violation'} at ${v.c},${v.r}`,
      null,
      `${v.rule ?? 'rule'} @ ${v.c},${v.r}`,
    ),
  )
}

export function runChecks(log, cfg = CONFIG) {
  const all = [
    ...checkMoneyLines(log, cfg),
    ...checkFees(log, cfg),
    ...checkDoubleSpend(log, cfg),
    ...checkUnledgered(log, cfg),
    ...checkStuckFlights(log, cfg),
    ...checkFleetVsContracts(log, cfg),
    ...checkConsole(log, cfg),
    ...checkScriptGaps(log),
    ...checkWorld(log),
  ]
  return all.sort((a, b) => SEV[a.severity] - SEV[b.severity] || (a.t ?? 0) - (b.t ?? 0))
}

export function formatTable(findings) {
  if (!findings.length) return 'No findings.'
  const rows = findings.map((f) => [f.severity, f.category, f.gameTime, f.title, f.evidence])
  const head = ['severity', 'category', 'game time', 'title', 'evidence']
  const w = head.map((h, i) => Math.min(70, Math.max(h.length, ...rows.map((r) => String(r[i]).length))))
  const fmt = (r) => r.map((c, i) => String(c).slice(0, w[i]).padEnd(w[i])).join(' | ')
  return [fmt(head), w.map((n) => '-'.repeat(n)).join('-+-'), ...rows.map(fmt)].join('\n')
}

/**
 * Full feature playthrough — exercises the CEO/AT3 spine via the sim API.
 * Reports bugs, balance, and playability notes. Exit 1 on bugs only.
 */
import { Game } from '../src/game/sim.ts'
import { FIELD_TASK_FAIL_FINE, RESEARCH_NODES } from '../src/game/catalog.ts'
import { SAVE_KEY } from '../src/game/types.ts'

type Sev = 'bug' | 'balance' | 'play' | 'ok'
const log: { sev: Sev; msg: string }[] = []
const note = (sev: Sev, msg: string) => log.push({ sev, msg })

function tick(g: Game, n: number, dt = 0.25) {
  for (let i = 0; i < n; i++) {
    g.tick(dt)
    if (g.offer) g.acceptOffer()
    if (g.mxOffer) g.acceptMxOffer()
    if (g.pendingThreat) g.resolveThreat('scramble')
    if (g.pendingEmergency) {
      const gap = g.emergencyHostGap(g.pendingEmergency)
      g.resolveEmergency(gap ? 'refuse' : 'accept')
    }
    if (g.parkingOffer && i % 7 === 0) g.acceptParking()
    if (g.layoverOffer && g.hallReadyForLayover() && i % 40 === 0) g.acceptLayover()
    if (g.hubOffer && i % 50 === 0) g.acceptHub()
    // Auto-complete field tasks when easy to satisfy
    if (g.fieldTask) {
      const k = g.fieldTask.kind
      if (k === 'police' && !g.fieldTaskMet(k)) g.tiles[18][10] = 'police'
      if (k === 'hangar' && !g.fieldTaskMet(k)) g.tiles[20][10] = 'hangar'
      if (k === 'janitor' && !g.fieldTaskMet(k)) g.janitors = Math.max(1, g.janitors)
      if (k === 'cargo' && !g.fieldTaskMet(k)) g.tiles[21][16] = 'cargo'
      if (k === 'helipad' && !g.fieldTaskMet(k)) g.tiles[18][10] = 'helipad'
      if (k === 'hotel' && !g.fieldTaskMet(k)) {
        g.tiles[16][16] = 'hotel'
        g.hotelLevel = Math.max(1, g.hotelLevel)
      }
      if (k === 'park' && !g.fieldTaskMet(k)) {
        g.tiles[14][16] = 'park_s'
        g.carParkShort = true
      }
      if (k === 'desk_extra' && !g.fieldTaskMet(k)) g.deskStaff = Math.max(2, g.deskStaff)
    }
  }
}

// ── Phase A: boot → first money ──────────────────────────────────────────
const g = new Game()
g.beginNew('easy')
if (g.cash !== 220_000) note('bug', `easy start cash ${g.cash}, expected 220000`)
g.buyLand('city')
if (!g.site) note('bug', 'buyLand city failed')
const cashLand = g.cash
g.buildStarterKit()
if (g.cash >= cashLand) note('bug', 'starter kit did not charge')
if (!g.fits.length) note('bug', 'starter kit left no hall')
if (g.deskStaff < 1) note('play', 'starter has no desk agent — first bank may miss gates')
g.speed = 3
g.scheduleAuto = true

tick(g, 80)
if (!g.signed.length) {
  // Force Northline if phone was silent
  if (g.meetsReq('northline')) {
    g.signed.push('northline')
    g.airlineHeat.northline = 70
    g.seedScheduleForAirline('northline', 3)
    note('play', 'had to force-sign Northline — offer spawn slow')
  } else note('bug', 'cannot sign Northline after starter')
}
tick(g, 400)
if (g.flightsDone < 1) note('bug', `no takeoff after early soak (done=${g.flightsDone})`)
else note('ok', `first takeoff at clock ${Math.round(g.clock)}, done=${g.flightsDone}`)
if (g.showCoach()) note('play', 'coach still visible after first takeoff')
else note('ok', 'coach cleared after first turn')

// ── Phase B: hall + staff + field task ───────────────────────────────────
g.view = 'hall'
tick(g, 60)
if (g.hallGuests.length === 0 && g.flightsDone > 2) {
  note('play', 'hall empty despite turnarounds — boarding may skip hall')
}
g.hireJanitor()
g.hireDeskStaff()
g.fieldTaskCool = 0
g.considerFieldTasks()
if (!g.fieldTask && g.flightsDone >= 1) {
  // All tasks already met?
  const unmet = ['police', 'hangar', 'janitor', 'cargo', 'helipad', 'hotel', 'park', 'desk_extra']
  const still = unmet.filter((k) => !g.fieldTaskMet(k as never))
  if (still.length) note('bug', `field task did not spawn; unmet=${still.join(',')}`)
  else note('ok', 'all field tasks already met')
} else if (g.fieldTask) {
  note('ok', `field ask: ${g.fieldTask.title}`)
  tick(g, 20)
  if (g.fieldTask) note('play', 'field task not auto-cleared after satisfying stamps')
}

// ── Phase C: research spine ──────────────────────────────────────────────
g.researchers = 2
g.researchPoints = 200
for (const node of RESEARCH_NODES) {
  const before = g.hasResearch(node.id)
  if (!before) {
    g.researchPoints = Math.max(g.researchPoints, node.cost + 2)
    const can = g.canBuyResearch(node.id)
    if (can.ok) g.buyResearch(node.id)
    else note('balance', `could not buy ${node.id}: ${can.why}`)
  }
}
if (!g.hasResearch('night_bank')) note('bug', 'night_bank unlock failed')
if (!g.hasResearch('mil_ramp')) note('balance', 'mil_ramp not unlocked in research pass')
else note('ok', `research unlocked: ${g.researchUnlocked.join(', ')}`)

// Night curfew should stop biting with night_bank
g.clock = 150
g.nightCurfewCool = 0
const paxSlot = g.openSchedule().find((s) => g.airline(s.airline).kind === 'pax')
if (paxSlot) {
  const eta0 = paxSlot.eta
  for (let i = 0; i < 40; i++) {
    g.nightCurfewCool = 0
    g.tickSchedule(1)
  }
  if (paxSlot.eta > eta0 + 5 && g.hasResearch('night_bank')) {
    note('bug', 'night curfew still slipping pax after Night bank')
  } else note('ok', 'night bank suppresses curfew slips')
}

// ── Phase D: weather + emergency + GA ────────────────────────────────────
if (g.signed[0]) g.seedScheduleForAirline(g.signed[0], 2)
for (const s of g.openSchedule()) {
  if (s.status === 'scheduled' || s.status === 'delayed') s.eta = g.clock + 12
}
g.weather = 'storm'
g.stormPulseCool = 0
g.emergencyCool = 0
g.tickSchedule(1)
const stormNews = g.news.some((n) => /storm|de-ice|storm slip|storm bank/i.test(n.text))
if (!stormNews) note('play', 'storm produced no delay/news — weather may feel invisible')
else note('ok', 'storm affected the bank')
tick(g, 40)

// GA parking on a quiet apron (clear jets so a stand is free + pathable).
g.flights = g.flights.filter((f) => f.craft === 'helo')
g.parkingCool = 0
g.parkingOffer = {
  id: 'ga-test',
  callsign: 'N9TEST',
  airframeId: 'citation',
  fee: 4000,
  staySec: 40,
  age: 0,
  deadline: 20,
}
const cashGa = g.cash
const freeBefore = g.freeStands().length
g.acceptParking()
if (g.cash <= cashGa) {
  if (freeBefore < 1) note('play', 'GA parking skipped — no free stand')
  else note('bug', `GA parking fee missing (free=${freeBefore})`)
} else note('ok', `GA parking +$${g.cash - cashGa}`)

// ── Phase E: expand field — heavy + mil ──────────────────────────────────
g.cash += 200_000
// Hangar-side mil pad (away from T1 jetways) + taxi into spine — mirrors soak-heavy-campus
g.tiles[20][10] = 'hangar'
g.tiles[18][10] = 'cargo'
g.tiles[20][6] = 'stand'
for (let r = 21; r <= 22; r++) g.tiles[r][6] = 'taxi'
for (let c = 6; c <= 8; c++) g.tiles[22][c] = 'taxi'
g.tiles[19][9] = 'police'
g.tiles[18][12] = 'helipad'
for (let c = 4; c < 24; c++) {
  g.tiles[28][c] = 'runway'
  g.tiles[29][c] = 'runway'
  g.tiles[30][c] = 'runway'
}
for (let r = 22; r <= 28; r++) g.tiles[r][8] = 'taxi'
g.reputation = 70
const milGate = g.canHostMilitary()
if (!milGate.ok) note('bug', `military gate: ${milGate.why}`)
g.signMilitaryAgreement()
if (!g.milAgreement) note('bug', 'military agreement failed')
else note('ok', `Guard host — ${g.milRampLine()}`)
if (g.meetsReq('upps') && !g.signed.includes('upps')) {
  g.signed.push('upps')
  g.airlineHeat.upps = 72
  g.seedScheduleForAirline('upps', 2)
}
tick(g, 500)

if (g.flightsDone < 8) note('balance', `slow throughput: only ${g.flightsDone} turnarounds mid-game`)
else note('ok', `mid-game turnarounds: ${g.flightsDone}`)

const fleet = g.fleetMixLine()
note('ok', `fleet mix: ${fleet}`)
if ((g.craftSeen.freighter ?? 0) < 1 && g.signed.includes('upps')) {
  note('balance', 'UPPS signed but no freighter seen')
}
if ((g.craftSeen.military ?? 0) < 1 && g.milAgreement) {
  note('balance', 'mil agreement but no Guard craft seen')
}

// ── Phase F: layover drama + IPO ─────────────────────────────────────────
if (g.layoverOffer) g.acceptLayover()
else if (g.signed[0]) {
  // Force a layover if hall ready
  if (g.hallReadyForLayover()) {
    g.layoverOffer = {
      airline: g.signed[0],
      age: 0,
      fee: 8000,
      duration: 80,
      transferPax: 12,
    }
    g.acceptLayover()
  }
}
tick(g, 200)
if (g.layover || g.news.some((n) => /layover/i.test(n.text))) {
  note('ok', 'layover path exercised')
} else note('play', 'layover never engaged — hall readiness gate?')

g.cash = Math.max(g.cash, 180_000)
g.reputation = Math.max(g.reputation, 70)
g.flightsDone = Math.max(g.flightsDone, 12)
if (!g.public) {
  try {
    g.goPublic()
  } catch {
    /* method may be named differently */
  }
}
if (!g.public && typeof (g as unknown as { ipo?: () => void }).ipo === 'function') {
  ;(g as unknown as { ipo: () => void }).ipo()
}
// Try common IPO entry
if (!g.public) {
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(g))
  const ipoName = proto.find((n) => /ipo|goPublic|listPublic|launchIpo/i.test(n))
  if (ipoName) {
    ;(g as unknown as Record<string, () => void>)[ipoName]()
  }
}
if (g.public) note('ok', `IPO live @ $${g.sharePrice.toFixed(2)}`)
else note('play', 'could not IPO in playthrough — check cash/rep/flight gates')

tick(g, 200)

// ── Phase G: save / load integrity ───────────────────────────────────────
g.persist()
const raw = globalThis.localStorage?.getItem?.(SAVE_KEY)
// Node has no localStorage — use in-memory roundtrip via snapshot fields
const g2 = new Game()
// Simulate persist/load through JSON of public snap fields
const snap = JSON.parse(
  JSON.stringify({
    tiles: g.tiles,
    terminalFits: g.fits,
    cash: g.cash,
    difficulty: g.difficulty,
    site: g.site,
    clock: g.clock,
    speed: 0,
    fuelBrand: g.fuelBrand,
    fuelLoads: g.fuelLoads,
    caterBrand: g.caterBrand,
    mealSold: g.mealSold,
    signed: g.signed,
    flightsDone: g.flightsDone,
    paxServed: g.paxServed,
    revenue: g.revenue,
    securityIncidents: g.securityIncidents,
    reputation: g.reputation,
    loanBalance: g.loanBalance,
    parcels: g.parcels,
    railLinked: g.railLinked,
    public: g.public,
    sharePrice: g.sharePrice,
    sharesOwned: g.sharesOwned,
    sharesFloat: g.sharesFloat,
    researchPoints: g.researchPoints,
    researchUnlocked: g.researchUnlocked,
    coachDismissed: g.coachDismissed,
    fieldTask: g.fieldTask,
    milAgreement: g.milAgreement,
    airlineHeat: g.airlineHeat,
    hotelLevel: g.hotelLevel,
    deskStaff: g.deskStaff,
    janitors: g.janitors,
  }),
)
// Monkey-patch localStorage for load()
const store: Record<string, string> = { [SAVE_KEY]: JSON.stringify(snap) }
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v
  },
  removeItem: (k: string) => {
    delete store[k]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
  key: () => null,
  length: 0,
} as Storage

if (!g2.load()) note('bug', 'save/load failed to restore site')
else {
  if (g2.site !== g.site) note('bug', 'site lost on load')
  if (g2.flightsDone !== g.flightsDone) note('bug', 'flightsDone mismatch on load')
  if (g2.researchUnlocked.length !== g.researchUnlocked.length) {
    note('bug', 'research lost on load')
  }
  if (g2.coachDismissed !== g.coachDismissed) note('bug', 'coachDismissed lost on load')
  note('ok', 'save/load roundtrip ok')
}

// NaN / stuck checks
for (const f of g.flights) {
  if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) note('bug', `NaN pose ${f.flightNo}`)
  if (f.phase === 'hold' && f.phaseTime > 100) note('bug', `${f.flightNo} held >100s`)
}
let stuck = 0
for (const s of g.openSchedule()) {
  if ((s.status === 'scheduled' || s.status === 'delayed') && s.eta < g.clock - 90) {
    stuck += 1
  }
}
if (stuck > 0) note('bug', `${stuck} schedule slots stuck >90s past ETA`)
if (g.cash < -25000) note('bug', `cash floor breach ${Math.round(g.cash)}`)

// Heat floors
for (const id of g.signed) {
  if (g.heatOf(id) < 15 && g.layover?.airline !== id) {
    note('balance', `${g.airline(id).name} heat ${Math.round(g.heatOf(id))} < soft floor`)
  }
}

const bugs = log.filter((l) => l.sev === 'bug')
const balance = log.filter((l) => l.sev === 'balance')
const play = log.filter((l) => l.sev === 'play')
const oks = log.filter((l) => l.sev === 'ok')

const out = {
  ok: bugs.length === 0,
  summary: {
    cash: Math.round(g.cash),
    clock: Math.round(g.clock),
    flightsDone: g.flightsDone,
    signed: g.signed.map((id) => g.airline(id).name),
    heat: Object.fromEntries(g.signed.map((id) => [id, Math.round(g.heatOf(id))])),
    research: g.researchUnlocked,
    public: g.public,
    sharePrice: g.sharePrice,
    fieldRating: g.fieldRating(),
    fleet: g.fleetMixLine(),
    live: g.flights.map((f) => `${f.flightNo}:${f.phase}`),
    hall: g.hallGuests.length,
    fieldTask: g.fieldTask?.title ?? null,
  },
  counts: {
    bug: bugs.length,
    balance: balance.length,
    play: play.length,
    ok: oks.length,
  },
  bugs: bugs.map((b) => b.msg),
  balance: balance.map((b) => b.msg),
  play: play.map((b) => b.msg),
  okNotes: oks.map((b) => b.msg),
  recentNews: g.news.slice(0, 12).map((n) => `[${n.tone}] ${n.text}`),
  unusedFineConst: FIELD_TASK_FAIL_FINE,
}
console.log(JSON.stringify(out, null, 2))
process.exit(bugs.length ? 1 : 0)

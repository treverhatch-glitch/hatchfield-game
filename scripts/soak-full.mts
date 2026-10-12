import { Game } from '../src/game/sim.ts'

type Issue = { sev: 'bug' | 'balance' | 'note'; msg: string }

const issues: Issue[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.scheduleAuto = true

// Unlock Guard + cargo path (hangar-side hardstand away from pax jetways)
g.tiles[20][10] = 'hangar'
g.tiles[18][10] = 'cargo'
g.tiles[20][6] = 'stand'
for (let r = 21; r <= 22; r++) g.tiles[r][6] = 'taxi'
for (let c = 6; c <= 8; c++) g.tiles[22][c] = 'taxi'
g.tiles[19][9] = 'police'
g.tiles[18][12] = 'helipad'
g.reputation = 55
g.cash += 80_000
g.budgets.ambulance = 85
g.signMilitaryAgreement()
if (!g.milAgreement) {
  issues.push({ sev: 'bug', msg: `military agreement failed: ${g.canHostMilitary().why}` })
}
if (g.meetsReq('upps') && !g.signed.includes('upps')) {
  g.signed.push('upps')
  g.airlineHeat.upps = 70
}

let threatIgnored = 0
let cashFloorHits = 0
let negEtaStuck = 0
let banEvents = 0
let crashEvents = 0

for (let i = 0; i < 2000; i++) {
  const cashBefore = g.cash
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.layoverOffer && i % 200 < 40) g.acceptLayover()
  if (g.mxOffer) g.acceptMxOffer()
  if (g.pendingThreat) {
    if (i % 3 === 0) g.resolveThreat('ignore')
    else g.resolveThreat('scramble')
    threatIgnored += 1
  }
  if (g.cash <= -25000) cashFloorHits += 1
  if (cashBefore > 0 && g.cash < -5000 && Math.abs(g.cash - cashBefore) > 10000) {
    issues.push({ sev: 'bug', msg: `Cash cliff at t=${Math.round(g.clock)}: ${Math.round(cashBefore)} → ${Math.round(g.cash)}` })
  }
  if (i === 500) g.weather = 'storm'
  if (i === 900 && g.openSchedule()[2]) g.bumpSlot(g.openSchedule()[2].id)
}

// Post checks
for (const s of g.openSchedule()) {
  if ((s.status === 'scheduled' || s.status === 'delayed') && s.eta < g.clock - 60) {
    negEtaStuck += 1
  }
}
for (const id of g.signed) {
  if (g.isBanned(id)) banEvents += 1
  if (g.heatOf(id) < 15 && g.layover?.airline !== id) {
    issues.push({
      sev: 'balance',
      msg: `${g.airline(id).name} heat ${Math.round(g.heatOf(id))} below soft floor 15`,
    })
  }
}
const missHeadlines = g.news.filter((n) => /Missed gate|left angry/i.test(n.text)).length
if (missHeadlines > 6) {
  issues.push({
    sev: 'balance',
    msg: `Hall miss headline spam: ${missHeadlines} in recent news window`,
  })
}
for (const n of g.news) {
  if (/CRASH/i.test(n.text)) crashEvents += 1
  if (/banned/i.test(n.text)) banEvents += 1
}

// NaN / invalid flight state
for (const f of g.flights) {
  if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.z)) {
    issues.push({ sev: 'bug', msg: `NaN pose on ${f.flightNo}` })
  }
  if (f.phase === 'approach' && (!f.path || f.path.length < 1) && (f.craft ?? 'jet') === 'jet') {
    issues.push({ sev: 'bug', msg: `${f.flightNo} approach with empty path` })
  }
}

if (g.signed.length === 0) issues.push({ sev: 'bug', msg: 'No airlines signed after soak' })
if (g.flightsDone < 3) issues.push({ sev: 'balance', msg: `Only ${g.flightsDone} flights completed — spawn too slow?` })
if (negEtaStuck > 0) {
  issues.push({
    sev: 'bug',
    msg: `${negEtaStuck} schedule slots stuck >60s past ETA without spawning`,
  })
}
if (g.cash < -25000) issues.push({ sev: 'bug', msg: `Cash below floor: ${Math.round(g.cash)}` })
if ((g.craftSeen.military ?? 0) < 1 && g.milAgreement) {
  issues.push({ sev: 'balance', msg: 'Guard signed but zero military craft seen' })
}
if ((g.craftSeen.freighter ?? 0) < 1 && g.signed.includes('upps')) {
  issues.push({ sev: 'balance', msg: 'UPPS signed but zero freighters seen' })
}

// Hall without rooms should empty — not crash
const g2 = new Game()
g2.beginNew('easy')
g2.buyLand('factory')
g2.speed = 3
g2.hallGuests = []
for (let i = 0; i < 20; i++) g2.tick(0.5)

console.log(
  JSON.stringify(
    {
      summary: {
        cash: Math.round(g.cash),
        signed: g.signed.map((id) => g.airline(id).name),
        flightsDone: g.flightsDone,
        fleet: g.fleetMixLine(),
        heat: Object.fromEntries(g.signed.map((id) => [id, Math.round(g.heatOf(id))])),
        bans: g.signed.filter((id) => g.isBanned(id)),
        openSlots: g.openSchedule().length,
        stuckPastEta: negEtaStuck,
        live: g.flights.map((f) => `${f.flightNo}:${f.phase}`),
        hall: g.hallGuests.length,
        transfers: g.hallGuests.filter((x) => x.transfer).length,
        mil: g.milAgreement,
        strip: g.stripCapabilityLine(),
        threatResolves: threatIgnored,
        cashFloorHits,
        crashNews: crashEvents,
        banSignals: banEvents,
      },
      issues,
      recentNews: g.news.slice(0, 10).map((n) => `[${n.tone}] ${n.text}`),
    },
    null,
    2,
  ),
)

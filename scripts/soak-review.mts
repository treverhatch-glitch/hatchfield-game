import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.cash += 60_000
g.scheduleAuto = true

// Staff + lab for new systems
g.hireDeskStaff()
g.hireDeskStaff()
g.hireDeskStaff()
g.hireResearcher()
g.fits[0].rooms.rdesk = 1
g.fits[0].rooms.rboard = 1
g.fits[0].rooms.rmachine = 1

let negEta = 0
let stuckHold = 0
let cashFloor = 0
let maxHoldAge = 0
let payrollMiss = 0
const holdAges = new Map<string, number>()
let bagsUnload = 0
let bagsLoad = 0
let warnSeen = false
let rewardSeen = false

for (let i = 0; i < 2200; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.layoverOffer && i % 200 < 60) g.acceptLayover()
  if (g.mxOffer) g.acceptMxOffer()
  if (g.hubOffer && g.cash > 25_000) g.acceptHub()
  if (g.parkingOffer && i % 120 < 50) g.acceptParking()
  if (g.pendingThreat) {
    if (g.cash > 4000) g.resolveThreat('scramble')
    else g.resolveThreat('ignore')
  }
  if (g.pendingEmergency) {
    g.resolveEmergency(Math.random() < 0.75 ? 'accept' : 'refuse')
  }
  if (g.cash < -1000) cashFloor++

  for (const s of g.openSchedule()) {
    if (
      (s.status === 'scheduled' || s.status === 'delayed') &&
      s.eta < g.clock - 45
    ) {
      negEta++
    }
  }
  for (const f of g.flights) {
    if (f.phase === 'hold') {
      const a = (holdAges.get(f.id) ?? 0) + 0.25
      holdAges.set(f.id, a)
      maxHoldAge = Math.max(maxHoldAge, a)
      if (a > 75) stuckHold++
    } else holdAges.delete(f.id)
  }
  for (const t of g.trucks) {
    if (t.kind === 'bags' && t.mission === 'unload') bagsUnload++
    if (t.kind === 'bags' && t.mission === 'load') bagsLoad++
  }
  if (g.warnedAirlines().length) warnSeen = true
  if (Object.keys(g.airlineReward).length) rewardSeen = true
  for (const n of g.news) {
    if (/Payroll missed/i.test(n.text) && n.age < 0.3) payrollMiss++
  }
}

// Relations stress on one carrier
const victim = g.signed[0]
if (victim) {
  delete g.airlineReward[victim]
  g.airlineHeat[victim] = 88
  g.tickAirlineRelations(0.5)
  if (!g.rewardOf(victim)) issues.push('reward grant failed in review')
  rewardSeen = true
  g.airlineHeat[victim] = 30
  g.airlineWarned[victim] = false
  g.tickAirlineRelations(0.5)
  if (!g.airlineWarned[victim]) issues.push('warn failed in review')
  warnSeen = true
}

if (g.flightsDone < 4) issues.push(`only ${g.flightsDone} flights done`)
if (g.signed.length < 1) issues.push('no signed airlines')
if (negEta > 8) issues.push(`${negEta} past-due schedule samples`)
if (stuckHold > 20) issues.push(`${stuckHold} stuck-hold samples (>75s)`)
if (cashFloor > 0) issues.push(`cash floor hits ${cashFloor}`)
if (bagsUnload < 1) issues.push('no unload bags trucks')
if (bagsLoad < 1) issues.push('no load bags trucks')
if (!rewardSeen) issues.push('no rewards observed')
if (g.deskStaff < 3) issues.push('desk staff missing')
if (g.researchRate() <= 0) issues.push('research rate dead')
if (!Number.isFinite(g.fieldRating())) issues.push('bad field rating')

// Secure zone sanity
const open = g.hallOpen()
if (!open.has('security')) issues.push('starter lost security')

const out = {
  ok: issues.length === 0,
  issues,
  clock: Math.round(g.clock),
  cash: Math.round(g.cash),
  signed: g.signed.map((id) => g.airline(id).name),
  flightsDone: g.flightsDone,
  paxServed: g.paxServed,
  rating: g.fieldRating(),
  label: g.fieldRatingLabel(),
  negEtaSamples: negEta,
  stuckHoldSamples: stuckHold,
  maxHoldAge: Math.round(maxHoldAge),
  cashFloor,
  payrollMiss,
  bagsUnload,
  bagsLoad,
  rewards: g.airlineReward,
  warned: g.warnedAirlines(),
  desk: g.deskStaff,
  researchRate: Math.round(g.researchRate() * 100) / 100,
  rp: Math.floor(g.researchPoints),
  landside: {
    income: g.landsideIncome(),
    upkeep: g.landsideUpkeep(),
    uses: g.landsideUses,
  },
  strips: g.runwayStripCount(),
  inbound: g.maxInbound(),
  live: g.flights.map((f) => `${f.flightNo}:${f.phase}`),
  news: g.news.slice(0, 10).map((n) => `[${n.tone}] ${n.text}`),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

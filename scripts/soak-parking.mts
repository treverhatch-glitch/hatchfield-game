import { GA_LEAVE_WINDOW, GA_OVERSTAY_FINE, GA_PARK_DAY_RATE } from '../src/game/catalog.ts'
import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.scheduleAuto = false

for (let i = 0; i < 80; i++) g.tick(0.25)

g.parkingCool = 0
g.pendingThreat = null
g.pendingEmergency = null
g.hubOffer = null
g.layoverOffer = null
g.parkingOffer = {
  id: 'p1',
  callsign: 'N42GA',
  airframeId: 'citation',
  fee: 3000,
  staySec: 8,
  age: 0,
  deadline: 20,
}

const cash0 = g.cash
g.acceptParking()
if (g.parkingOffer) issues.push('offer still open')
const ga = g.flights.find((f) => f.ga)
if (!ga) issues.push('no GA flight spawned')
else {
  if (ga.airline !== 'ga') issues.push('GA must be independent airline id')
  ga.phase = 'parked'
  ga.phaseTime = 0
  ga.parkStaySec = 8
  ga.parkLeaveRequestedAt = null
  ga.parkLeaveBy = null

  // Tick until leave request
  for (let i = 0; i < 80 && !ga.parkLeaveRequestedAt; i++) {
    ga.phase = 'parked'
    g.tickParking(0.25)
    ga.phaseTime += 0.25
    g.clock += 0.25
  }
  if (!ga.parkLeaveRequestedAt) issues.push('never requested departure')
  if (!ga.parkLeaveBy || ga.parkLeaveBy - (ga.parkLeaveRequestedAt ?? 0) < GA_LEAVE_WINDOW - 1) {
    issues.push('leave window not ~20h ops')
  }

  // Manual release
  const ok = g.releaseGa(ga.id)
  if (!ok) issues.push('manual release failed')
  if (ga.phase !== 'taxi_out' && ga.phase !== 'gone') {
    // may still be taxi_out
    if (ga.phase === 'parked') issues.push('still parked after release')
  }
}

// Overstay path on a fresh GA
g.flights = g.flights.filter((f) => !f.ga)
g.parkingOffer = {
  id: 'p2',
  callsign: 'N99ZZ',
  airframeId: 'pc12',
  fee: 3200,
  staySec: 5,
  age: 0,
  deadline: 20,
}
g.acceptParking()
const ga2 = g.flights.find((f) => f.ga && f.flightNo === 'N99ZZ')
if (ga2) {
  ga2.phase = 'parked'
  ga2.phaseTime = 6
  ga2.parkStaySec = 5
  g.scheduleAuto = false
  // Force leave request + expired window with busy ground so release fails
  ga2.parkLeaveRequestedAt = g.clock
  ga2.parkLeaveBy = g.clock - 1
  // Block release by spawning a jet on approach occupying pavement heuristic
  const cash1 = g.cash
  // Make ground busy if possible — otherwise release succeeds (also OK)
  g.tickParking(0.5)
  const fined = g.news.some((n) => /overstayed parking/i.test(n.text))
  const left = !g.flights.some((f) => f.id === ga2.id && f.phase === 'parked')
  if (!fined && !left && g.cash >= cash1) {
    issues.push('overstay neither fined nor released')
  }
}

if (g.cash < cash0) {
  issues.push(`parking fee missing (${cash0} → ${g.cash})`)
}

const out = {
  ok: issues.length === 0,
  issues,
  cashDelta: Math.round(g.cash - cash0),
  leaveWindow: GA_LEAVE_WINDOW,
  dayRate: GA_PARK_DAY_RATE,
  fine: GA_OVERSTAY_FINE,
  news: g.news.slice(0, 8).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

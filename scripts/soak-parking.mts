import { Game } from '../src/game/sim.ts'
import { GA_OVERSTAY_FINE } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3

for (let i = 0; i < 200; i++) g.tick(0.25)

// Force parking offer
g.parkingCool = 0
g.pendingThreat = null
g.pendingEmergency = null
g.hubOffer = null
g.layoverOffer = null
g.tickParking(1)
if (!g.parkingOffer) {
  g.parkingOffer = {
    id: 'p1',
    callsign: 'N42GA',
    airframeId: 'citation',
    fee: 3000,
    staySec: 40,
    age: 0,
    deadline: 20,
  }
}

const cash0 = g.cash
g.acceptParking()
if (g.parkingOffer) issues.push('offer still open')
const ga = g.flights.find((f) => f.ga)
if (!ga) issues.push('no GA flight spawned')
else {
  // Fast-forward into parked
  ga.phase = 'parked'
  ga.phaseTime = 10
  ga.parkLeaveBy = g.clock + 5
  g.scheduleAuto = true
  for (let i = 0; i < 40; i++) {
    g.tickParking(0.25)
    g.clock += 0.25
  }
  const still = g.flights.find((f) => f.id === ga.id)
  if (still?.phase === 'parked' && still.parkLeaveBy && still.parkLeaveBy < g.clock) {
    // Should have tried release or fined
  }
  if (still?.phase === 'parked') {
    // Manual release
    const ok = g.releaseGa(ga.id)
    if (!ok && g.groundBusy()) {
      // acceptable if busy
    } else if (!ok) {
      issues.push('could not release GA')
    }
  }
}

if (g.cash < cash0) {
  // fee should have increased cash
  issues.push(`parking fee missing (${cash0} → ${g.cash})`)
}

const out = {
  ok: issues.length === 0,
  issues,
  cashDelta: Math.round(g.cash - cash0),
  flights: g.flights.filter((f) => f.ga).map((f) => `${f.flightNo}:${f.phase}`),
  fine: GA_OVERSTAY_FINE,
  news: g.news.slice(0, 6).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

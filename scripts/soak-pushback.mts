import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.cash += 40_000

let sawPush = 0
let sawTaxiAfter = 0
let pushThenTaxi = 0
const seen = new Set<string>()

for (let i = 0; i < 1600; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  for (const f of g.flights) {
    if (f.phase === 'pushback') {
      sawPush++
      seen.add(f.id)
    }
    if (f.phase === 'taxi_out' && seen.has(f.id)) {
      sawTaxiAfter++
      pushThenTaxi++
      seen.delete(f.id)
    }
  }
}

if (sawPush < 1) issues.push('never saw pushback phase')
if (pushThenTaxi < 1) issues.push('pushback never advanced to taxi_out')
if (g.flightsDone < 3) issues.push(`only ${g.flightsDone} flights done`)

const out = {
  ok: issues.length === 0,
  issues,
  sawPush,
  pushThenTaxi,
  flightsDone: g.flightsDone,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

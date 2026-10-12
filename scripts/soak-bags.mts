import { Game } from '../src/game/sim.ts'
import { nearestPath, tilesOf } from '../src/game/path.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.cash += 40_000

const bags = tilesOf(g.tiles, 'bags')
const stands = tilesOf(g.tiles, 'stand')
if (!bags.length) issues.push('no bags building')
if (bags[0] && stands[0]) {
  const p = nearestPath(g.tiles, bags[0], [stands[0]], 'truck')
  if (!p || p.length < 2) issues.push('no truck path bags→stand')
  if (p && (p[0].c !== bags[0].c || p[0].r !== bags[0].r)) {
    issues.push('bags path does not start at shed')
  }
}

let sawUnload = false
let sawToClaim = false
let sawLoad = false
let sawPickup = false
let sawReturning = false
let homeMatchesShed = false
let sawPreDwell = false
let bagHandlingPay = 0
let outboundPay = 0

for (let i = 0; i < 2000; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  for (const t of g.trucks) {
    if (t.kind !== 'bags') continue
    if (t.mission === 'unload') sawUnload = true
    if (t.mission === 'to_claim') sawToClaim = true
    if (t.mission === 'load') sawLoad = true
    if (t.mission === 'pickup') sawPickup = true
    if (t.returning) sawReturning = true
    if (t.preDwell > 0) sawPreDwell = true
    if (
      t.home &&
      bags[0] &&
      t.home.c === bags[0].c &&
      t.home.r === bags[0].r
    ) {
      homeMatchesShed = true
    }
  }
  for (const f of g.flights) {
    for (const row of f.ledger) {
      if (/bag handling/i.test(row.label)) bagHandlingPay++
      if (/outbound bags/i.test(row.label)) outboundPay++
    }
  }
}

if (!sawUnload) issues.push('never saw unload bags truck')
if (!sawToClaim) issues.push('never saw to_claim (plane→shed/claim) leg')
if (!sawLoad) issues.push('never saw outbound load bags truck')
if (!homeMatchesShed) issues.push('bags truck home is not the shed')
if (!sawReturning) issues.push('bags truck never entered return/claim leg')
if (!sawPreDwell) issues.push('outbound load never staged makeup preDwell at shed')
if (bagHandlingPay < 1) issues.push('no bag handling ledger pays')
if (outboundPay < 1) issues.push('no outbound bags ledger pays')

const out = {
  ok: issues.length === 0,
  issues,
  sawUnload,
  sawToClaim,
  sawLoad,
  sawPickup,
  homeMatchesShed,
  sawReturning,
  sawPreDwell,
  bagHandlingPay,
  outboundPay,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

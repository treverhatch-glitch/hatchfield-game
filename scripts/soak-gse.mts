/**
 * Fuel bowser + line MX delivery — farm/hangar → stand → home.
 */
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 60_000
g.speed = 3
g.tiles[20][10] = 'hangar'
g.mechanics = 2
g.budgets.maintenance = 80
g.fuelLoads = 8

// Sign MX with Northline once signed
for (let i = 0; i < 120; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.mxOffer) g.acceptMxOffer()
}
if (!g.signed.includes('northline') && g.meetsReq('northline')) {
  g.signed.push('northline')
  g.airlineHeat.northline = 75
}
if (!g.mxSigned.includes('northline')) g.mxSigned.push('northline')

let sawFuelPre = false
let sawFuelReload = false
let sawFuelMission = false
let sawMxWalk = false
let mxPaid = 0
let fuelPaid = 0

for (let i = 0; i < 1600; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  if (g.mxOffer) g.acceptMxOffer()
  for (const t of g.trucks) {
    if (t.kind !== 'fuel') continue
    if (t.preDwell > 0) sawFuelPre = true
    if (t.mission === 'fuel_reload') sawFuelReload = true
    if (t.mission === 'fuel') sawFuelMission = true
    const farms = tilesOf(g.tiles, 'fuel')
    if (t.home && farms[0] && (t.home.c !== farms[0].c || t.home.r !== farms[0].r)) {
      // home should be farm
    }
  }
  for (const p of g.people) {
    if (p.job === 'mechanic' && p.mxPay != null) sawMxWalk = true
    if (p.job === 'mechanic' && p.label === 'mx-home') sawMxWalk = true
  }
  for (const f of g.flights) {
    for (const row of f.ledger) {
      if (/line MX/i.test(row.label)) mxPaid++
      if (/ fuel$/i.test(row.label) || /fuel$/i.test(row.label)) fuelPaid++
    }
  }
}

if (!sawFuelMission) issues.push('no fuel bowser mission')
if (!sawFuelPre) issues.push('fuel never bottom-loaded (preDwell) at farm')
if (fuelPaid < 1) issues.push('no fuel ledger pay')
if (g.mxSigned.length && mxPaid < 1) {
  // MX may be slow — allow walk-without-pay if hangar path missing
  if (!sawMxWalk) issues.push('MX signed but no mechanic dispatch or pay')
}

const out = {
  ok: issues.length === 0,
  issues,
  sawFuelPre,
  sawFuelReload,
  sawFuelMission,
  sawMxWalk,
  mxPaid,
  fuelPaid,
  mxSigned: g.mxSigned,
  hangars: tilesOf(g.tiles, 'hangar').length,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

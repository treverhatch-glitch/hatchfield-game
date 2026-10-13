/**
 * Slice 2 — guard post + city cargo trucks → shed → warehouse.
 */
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 30_000
g.speed = 5

const guards = tilesOf(g.tiles, 'guard')
const sheds = tilesOf(g.tiles, 'cargo')
const edges = g.cityEdgeRoads()
if (!guards.length) issues.push('starter kit missing guard post')
if (!sheds.length) issues.push('starter kit missing cargo shed')
if (!edges.length) issues.push('no city-edge road for truck spawn')

// Force cargo demand early so city trucks roll.
if (!g.signed.includes('upps')) {
  g.signed.push('upps')
  g.airlineHeat['upps'] = 55
}
g.cityCargoCool = 0

let sawCity = false
let sawGuardMission = false
let sawShedMission = false
let sawDepart = false
let sawCrate = false
let peakWarehouse = 0

for (let i = 0; i < 1800; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  peakWarehouse = Math.max(peakWarehouse, g.cargoWarehouse)
  for (const t of g.trucks) {
    if (t.kind !== 'citycargo') continue
    sawCity = true
    if (t.mission === 'city_guard') sawGuardMission = true
    if (t.mission === 'city_shed') sawShedMission = true
    if (t.mission === 'city_depart') sawDepart = true
    if ((t.cargoUnits ?? 0) > 0) sawCrate = true
  }
}

if (!sawCity) issues.push('never saw citycargo truck')
if (!sawGuardMission) issues.push('never saw city_guard mission')
if (!sawShedMission) issues.push('never saw city_shed mission')
if (peakWarehouse <= 0) issues.push('warehouse never received units')
if (!sawCrate) issues.push('city trucks never carried cargoUnits')
if (!sawDepart && peakWarehouse <= 0) issues.push('trucks never departed after deliver')

// Missing guard hurts.
const g2 = new Game()
g2.beginNew('easy')
g2.buyLand('factory')
g2.buildStarterKit()
g2.cash += 20_000
g2.speed = 5
for (const p of tilesOf(g2.tiles, 'guard')) {
  g2.tiles[p.r][p.c] = 'road'
}
g2.bumpMap()
if (!g2.signed.includes('upps')) {
  g2.signed.push('upps')
  g2.airlineHeat['upps'] = 50
}
g2.cityCargoCool = 0
let sawDeny = false
for (let i = 0; i < 500; i++) {
  g2.tick(0.5)
  if (g2.news.some((n) => /denied|unscreened|no guard/i.test(n.text))) {
    sawDeny = true
    break
  }
}
if (!sawDeny) issues.push('no-guard field never denied/unscreened a city truck')

const out = {
  ok: issues.length === 0,
  issues,
  guards: guards.length,
  sheds: sheds.length,
  edges: edges.length,
  sawCity,
  sawGuardMission,
  sawShedMission,
  sawDepart,
  sawCrate,
  peakWarehouse,
  warehouse: g.cargoWarehouse,
  fill: g.cargoWarehouseFill(),
  sawDeny,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)

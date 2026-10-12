/**
 * Wave A: de-ice pad + truck holds pushback in storm/fog;
 * stand S/M/L stamps and class gating.
 */
import { Game } from '../src/game/sim.ts'
import { tilesOf } from '../src/game/path.ts'
import { standClassFor } from '../src/game/airframes.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 80_000
g.speed = 3
g.researchPoints = 200
g.buyResearch('night_bank')
g.buyResearch('deice')
g.buyResearch('stand_class')

if (!g.hasResearch('deice')) issues.push('deice research missing')
if (!g.hasResearch('stand_class')) issues.push('stand_class research missing')

// Stamp de-ice pad on grass beside taxi spine
g.tool = 'deice'
g.placeSingle({ c: 11, r: 21 })
if (!tilesOf(g.tiles, 'deice').length) issues.push('deice pad not stamped')

// Stand L beside taxi (east of hall)
g.tool = 'stand_l'
g.placeSingle({ c: 18, r: 21 })
const clsL = g.standClass['18,21']
if (clsL !== 'L') issues.push(`stand L class=${clsL}`)

// Stand S west of bags
g.tool = 'stand_s'
g.placeSingle({ c: 9, r: 21 })
if (g.standClass['9,21'] !== 'S') issues.push('stand S missing')

// Class filter: widebody needs L
const freeL = g.freeStands().filter((s) => g.standFitsClass(s, 'L'))
if (!freeL.length) issues.push('no L-capable free stands')
const needWide = standClassFor('widebody')
if (needWide !== 'L') issues.push(`widebody class=${needWide}`)

// Lock stand_l without research (temp)
g.researchUnlocked = g.researchUnlocked.filter((x) => x !== 'stand_class')
g.tool = 'stand_l'
const cashBefore = g.cash
g.placeSingle({ c: 7, r: 21 })
if (g.tiles[21][7] === 'stand') issues.push('stand L should stay locked without research')
if (g.cash !== cashBefore) issues.push('locked stand L spent cash')
g.researchUnlocked.push('stand_class')

// Force storm + sign airline + wait for deice truck / posted.deiced
g.weather = 'storm'
g.fuelLoads = 8
for (let i = 0; i < 200; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}
if (!g.signed.length) {
  g.signed.push('northline')
  g.airlineHeat.northline = 80
}

let sawDeiceTruck = false
let sawDeiced = false
let sawHold = false
let deicePay = 0

for (let i = 0; i < 2400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  g.weather = 'storm'
  for (const t of g.trucks) {
    if (t.kind === 'deice') sawDeiceTruck = true
  }
  for (const f of g.flights) {
    if (f.waitingOn.deice) sawHold = true
    if (f.posted.deiced) sawDeiced = true
    for (const row of f.ledger) {
      if (/de-ice/i.test(row.label)) deicePay++
    }
  }
  if (sawDeiceTruck && sawDeiced && deicePay > 0) break
}

if (!sawDeiceTruck) issues.push('no deice truck dispatched in storm')
if (!sawHold && !sawDeiced) issues.push('never waited on / completed deice')
if (!sawDeiced) issues.push('no flight posted.deiced')
if (deicePay < 1) issues.push('no de-ice ledger pay')

// Night band helper
g.clock = 100
const band = g.plannerNightBand(120)
if (!band || band.from < 15 || band.from > 25) {
  issues.push(`bad night band at clock 100: ${JSON.stringify(band)}`)
}

const out = {
  ok: issues.length === 0,
  issues,
  sawDeiceTruck,
  sawHold,
  sawDeiced,
  deicePay,
  pads: tilesOf(g.tiles, 'deice').length,
  standClasses: g.standClass,
  nightBand: band,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

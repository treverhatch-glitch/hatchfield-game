import { Game } from '../src/game/sim.ts'
import { JETWAY_RANGE } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 200_000

if (g.fits.length !== 1) issues.push(`starter should have 1 hall, got ${g.fits.length}`)
const t1 = g.fits[0]
const t1Stands = g.standsForHall(t1)
if (t1Stands.length < 1) issues.push('starter stands should jetway-link to T1')

// Stamp a second premade hall to the east with its own stand.
const t2Origin = { c: 22, r: 12 }
// Clear grass for 3×3 + stand
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const p = { c: t2Origin.c + c, r: t2Origin.r + r }
    if (g.tiles[p.r]?.[p.c] !== undefined) g.tiles[p.r][p.c] = 'grass'
  }
}
g.tiles[15][24] = 'grass'
g.tool = 'premade'
g.placePremade(t2Origin)
if (g.fits.length !== 2) issues.push(`expected 2 halls after premade, got ${g.fits.length}`)

// Stand near T2
g.tiles[15][24] = 'stand'
g.tiles[16][24] = 'taxi'
g.tiles[17][24] = 'taxi'
for (let r = 18; r <= 22; r++) g.tiles[r][24] = 'taxi'
g.tiles[22][22] = 'taxi'
g.tiles[22][23] = 'taxi'

const t2 = g.fits[1]
if (g.hallLabel(t1) !== 'T1') issues.push(`T1 label=${g.hallLabel(t1)}`)
if (g.hallLabel(t2) !== 'T2') issues.push(`T2 label=${g.hallLabel(t2)}`)

const jw2 = g.jetwayHall({ c: 24, r: 15 })
if (!jw2 || jw2.origin.c !== t2.origin.c) {
  issues.push(`stand at 24,15 should jetway to T2 (range ${JETWAY_RANGE})`)
}

const label = g.gateLabel({ c: 24, r: 15 })
if (!label.startsWith('T2·G')) issues.push(`gate label should be T2·G#, got ${label}`)

const t1Label = g.gateLabel(t1Stands[0])
if (!t1Label.startsWith('T1·G')) issues.push(`T1 stand label=${t1Label}`)

// Load-balance: occupy T1 stand, assign should prefer T2 jetway when free.
const s1 = t1Stands[0]
g.flights.push({
  id: 'occ1',
  airline: 'harbor',
  flightNo: 'OCC1',
  airframeId: 'atr72',
  airframeName: 'ATR 72',
  pax: 40,
  cargo: false,
  craft: 'jet',
  kind: 'regional',
  phase: 'servicing',
  stand: s1,
  x: s1.c,
  y: s1.r,
  z: 0,
  heading: 0,
  path: [],
  seg: 0,
  t: 0,
  holdAngle: 0,
  posted: {
    landing: true,
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    bagDrop: false,
  },
  waitingOn: {
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    paxOut: 0,
    paxIn: 0,
  },
  phaseTime: 0,
  ledger: [],
})

const next = g.assignStand()
if (!next) issues.push('assignStand returned null with free T2 stand')
else {
  const hall = g.jetwayHall(next)
  if (!hall || hall.origin.c !== t2.origin.c) {
    // May still pick other T1 stand if starter has 2 — either T2 or less-loaded OK
    const loadT1 = g.occupiedAtHall(t1)
    const loadT2 = g.occupiedAtHall(t2)
    if (hall?.origin.c === t1.origin.c && loadT1 > loadT2) {
      issues.push('assignStand should prefer lighter hall')
    }
  }
}

const inbound1 = g.maxInbound()
// Fake single-hall inbound for compare by temporarily dropping T2
const saved = g.fits
g.fits = [t1]
const inboundSolo = g.maxInbound()
g.fits = saved
if (inbound1 <= inboundSolo) {
  issues.push(`2 halls should boost inbound (${inbound1} vs solo ${inboundSolo})`)
}

// Seed guests into correct hall
g.flights[0].stand = { c: 24, r: 15 }
g.seedHallForFlight(g.flights[0], 'arrive')
const seeded = g.hallGuests.filter((x) => x.flightId === 'occ1')
if (!seeded.length) issues.push('seedHallForFlight produced no guests')
const wrongHall = seeded.some((x) => x.hallId !== g.hallKey(t2))
if (wrongHall) issues.push('guests should carry T2 hallId')

g.selectHall(t2)
if (g.activeHall()?.origin.c !== t2.origin.c) issues.push('selectHall did not focus T2')

const out = {
  ok: issues.length === 0,
  issues,
  campus: g.campusLine(),
  jetways: g.jetwayCount(),
  labels: { t1: t1Label, t2: label },
  inbound: { campus: inbound1, solo: inboundSolo },
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

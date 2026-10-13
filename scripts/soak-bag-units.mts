import { Game } from '../src/game/sim.ts'
import { estimateFlightBagUnits, bagUnitsForTag } from '../src/game/guests.ts'

const issues: string[] = []

if (bagUnitsForTag('premium') <= bagUnitsForTag('budget')) {
  issues.push('premium should carry more bag units than budget')
}

const lux = estimateFlightBagUnits('luxury', 100)
const bud = estimateFlightBagUnits('budget', 100)
if (lux <= bud) issues.push('luxury flight mix should estimate more bags than budget')

const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 20_000
g.speed = 5

for (let i = 0; i < 600; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

const withUnits = g.flights.filter((f) => !f.cargo && (f.bagUnits ?? 0) > 0)
if (!withUnits.length && g.flightsDone < 1) {
  // warm more
  for (let i = 0; i < 800; i++) {
    g.tick(0.25)
    if (g.offer) g.acceptOffer()
  }
}
const anyUnits = [...g.flights, ...g.flights.filter(() => false)].some(
  (f) => (f.bagUnits ?? 0) > 0,
)
const ledgerHit = g.news.some((n) => /bag handling|claim jammed|through-checked|transfer bags/i.test(n.text))
  || g.flights.some((f) => f.ledger.some((r) => /bag handling/i.test(r.label)))

const fit = g.fits[0]
if (!fit?.premade) issues.push('starter missing premade fit')
if (fit && (fit.capGuests == null || fit.claimRate == null)) {
  issues.push('premade fit missing capGuests / claimRate ceilings')
}
if (fit && (fit.capGuests ?? 99) > 40) issues.push('premade capGuests should be a starter ceiling')

// Transfer through-bags: spawn and ensure needs.bags === 0 when food path exists.
if (g.signed.length) {
  const before = g.hallGuests.length
  g.spawnTransferGuest(g.signed[0])
  const t = g.hallGuests[g.hallGuests.length - 1]
  if (!t?.transfer) issues.push('spawnTransferGuest did not mark transfer')
  if (t && t.needs.bags !== 0 && t.node !== 'claim') {
    issues.push('through-transfer guest should have needs.bags = 0 when not on claim fallback')
  }
  if (g.hallGuests.length <= before) issues.push('transfer guest not added')
}

if (!anyUnits && g.flights.every((f) => f.cargo || f.pax <= 0)) {
  // ok if only cargo — still check estimate helper ran via divert later
} else if (!g.flights.some((f) => (f.bagUnits ?? 0) > 0) && g.flights.some((f) => !f.cargo && f.pax > 0)) {
  issues.push('pax flights missing bagUnits')
}

const out = {
  ok: issues.length === 0,
  issues,
  lux,
  bud,
  capGuests: fit?.capGuests,
  claimRate: fit?.claimRate,
  sampleBagUnits: g.flights.filter((f) => !f.cargo).slice(0, 3).map((f) => f.bagUnits),
  ledgerHit,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)

/**
 * Hotel / short+long parking / bus curb / rail station — pax modes + income.
 */
import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 120_000

const roadC = 16
g.tiles[10][roadC - 1] = 'grass'
g.tool = 'hotel'
g.placeSingle({ c: roadC - 1, r: 10 })
if (g.tiles[10][roadC - 1] !== 'hotel') issues.push('hotel not stamped')

g.setParkTerm('short')
g.tool = 'park_s'
g.tiles[8][roadC + 1] = 'grass'
g.placeSingle({ c: roadC + 1, r: 8 })
if (!g.hasShortParking()) issues.push('short parking missing')

g.setParkTerm('long')
g.tool = 'park_g'
g.tiles[12][roadC + 1] = 'grass'
g.placeSingle({ c: roadC + 1, r: 12 })
if (!g.hasLongParking()) issues.push('long parking missing')

g.tool = 'bus'
g.tiles[6][roadC - 1] = 'grass'
g.placeSingle({ c: roadC - 1, r: 6 })
if (!g.hasBusCurb()) issues.push('bus curb missing')

// Rail station needs city rail first
g.tool = 'rail'
g.tiles[14][roadC - 1] = 'grass'
const cashBeforeRail = g.cash
g.placeSingle({ c: roadC - 1, r: 14 })
if (g.tiles[14][roadC - 1] === 'rail') issues.push('rail stamped without city rail')
if (g.cash !== cashBeforeRail) issues.push('locked rail spent cash')

g.investRail()
if (!g.railLinked) issues.push('rail invest failed')
g.tool = 'rail'
g.placeSingle({ c: roadC - 1, r: 14 })
if (!g.hasRailStation()) issues.push('rail station missing after invest')

const pot = g.landsidePotential()
if (pot < 1500) issues.push(`landside potential too low ${pot}`)
g.landsideUses = 0
const idle = g.landsideIncome()
g.landsideUses = 50
const income = g.landsideIncome()
if (!(income > idle)) issues.push(`usage should lift income ${idle}→${income}`)

const multBare = (() => {
  const t = new Game()
  t.beginNew('easy')
  t.buyLand('city')
  t.buildStarterKit()
  return t.landsidePaxMult()
})()
const multFull = g.landsidePaxMult()
if (!(multFull > multBare)) {
  issues.push(`full landside pax mult ${multFull} should beat bare ${multBare}`)
}

// Mode picking on a full landside field
g.signed = ['northline', 'harbor']
g.airlineHeat.northline = 80
g.airlineHeat.harbor = 80
g.seedHallForFlight(
  {
    id: 'f-full',
    airline: 'northline',
    pax: 120,
    cargo: false,
    stand: { c: 12, r: 21 },
  } as never,
  'depart',
)
g.seedHallForFlight(
  {
    id: 'f-biz',
    airline: 'harbor',
    pax: 100,
    cargo: false,
    stand: { c: 20, r: 21 },
  } as never,
  'depart',
)
let sawBus = false
let sawRail = false
let sawPark = false
let sawHotel = false
let sawMissThought = false
for (const guest of g.hallGuests) {
  if (guest.arriveMode === 'bus') sawBus = true
  if (guest.arriveMode === 'rail') sawRail = true
  if (guest.arriveMode === 'car_short' || guest.arriveMode === 'car_long') sawPark = true
  if (guest.arriveMode === 'hotel') sawHotel = true
}
if (!(sawBus || sawRail || sawPark || sawHotel)) {
  issues.push('no landside modes assigned on full field')
}
// Thin field anger — strip bus and reseed
const thin = new Game()
thin.beginNew('easy')
thin.buyLand('city')
thin.buildStarterKit()
thin.signed = ['northline']
thin.airlineHeat.northline = 80
const fakeFit = thin.fits[0]
if (fakeFit) {
  thin.seedHallForFlight(
    {
      id: 'f1',
      airline: 'northline',
      pax: 80,
      cargo: false,
      stand: { c: 12, r: 21 },
    } as never,
    'depart',
  )
}
for (const guest of thin.hallGuests) {
  if (guest.preferMode && guest.preferMode !== guest.arriveMode) sawMissThought = true
  if (/No bus|No rail|No hotel|No short|No long|scramble|circling/i.test(guest.thought)) {
    sawMissThought = true
  }
}
if (!sawMissThought && thin.hallGuests.length) {
  // With only road, budget prefers bus — should miss
  const prefersBus = thin.hallGuests.filter((x) => x.preferMode === 'bus')
  if (prefersBus.length && prefersBus.every((x) => x.arriveMode === 'bus')) {
    issues.push('expected missing bus curb anger on thin field')
  }
}

g.hireJanitor()
if (g.janitors < 1) issues.push('janitor not hired')
g.fits[0].wearBath = 40
g.janitorCool = 0
g.tickJanitors(1)
if ((g.fits[0].wearBath ?? 0) >= 40) issues.push('janitor did not scrub')

g.selectedTile = g.fits[0]?.origin ?? null
g.buyRoom('dayhotel')
const open = g.hallOpen()
if (!open.has('dayhotel')) {
  issues.push(`dayhotel not in hall graph (rooms=${JSON.stringify(g.fits[0]?.rooms)})`)
}

const out = {
  ok: issues.length === 0,
  issues,
  pot,
  idle,
  income,
  multBare,
  multFull,
  modes: { sawBus, sawRail, sawPark, sawHotel, sawMissThought },
  has: {
    hotel: g.hasHotelBeds(),
    short: g.hasShortParking(),
    long: g.hasLongParking(),
    bus: g.hasBusCurb(),
    rail: g.hasRailStation(),
  },
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

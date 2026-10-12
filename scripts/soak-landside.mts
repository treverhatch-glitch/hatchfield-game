/**
 * Hotel grades + 4 park versions × short/long / bus curb / rail — pax modes + income.
 */
import { Game } from '../src/game/sim.ts'
import { HOTEL_CLASS_INCOME, PARK_INCOME } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 200_000

const roadC = 16
// Three outside hotel grades on road edge
for (const [tool, r, want] of [
  ['hotel_inn', 9, 'inn'],
  ['hotel_biz', 10, 'business'],
  ['hotel_resort', 11, 'resort'],
] as const) {
  g.tiles[r][roadC - 1] = 'grass'
  g.tool = tool
  g.placeSingle({ c: roadC - 1, r })
  if (g.tiles[r][roadC - 1] !== 'hotel') issues.push(`${tool} not stamped`)
  if (g.hotelClass[`${roadC - 1},${r}`] !== want) {
    issues.push(`${tool} class want ${want} got ${g.hotelClass[`${roadC - 1},${r}`]}`)
  }
}

// Four park versions: S short, L short, G long, U long
const parkJobs: Array<
  ['park_s' | 'park_l' | 'park_g' | 'park_u', 'short' | 'long', number]
> = [
  ['park_s', 'short', 7],
  ['park_l', 'short', 8],
  ['park_g', 'long', 12],
  ['park_u', 'long', 13],
]
for (const [tool, term, r] of parkJobs) {
  g.setParkTerm(term)
  g.tool = tool
  g.tiles[r][roadC + 1] = 'grass'
  g.placeSingle({ c: roadC + 1, r })
  if (g.tiles[r][roadC + 1] !== tool) issues.push(`${tool} not stamped`)
  if (g.parkTerms[`${roadC + 1},${r}`] !== term) {
    issues.push(`${tool} term want ${term}`)
  }
}
if (!g.hasShortParking()) issues.push('short parking missing')
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

const expense = g.landsideUpkeep()
const expectHotel =
  HOTEL_CLASS_INCOME.inn + HOTEL_CLASS_INCOME.business + HOTEL_CLASS_INCOME.resort
const expectPark =
  PARK_INCOME.park_s.short +
  PARK_INCOME.park_l.short +
  PARK_INCOME.park_g.long +
  PARK_INCOME.park_u.long
if (expense < expectHotel + expectPark) {
  issues.push(`landside expense too low ${expense} (want ≥${expectHotel + expectPark})`)
}
// Place alone → $0 fees. Passenger touch → fee window fills.
g.landsideUses = 0
g.landsideFeeWindow = 0
const idle = g.landsideIncome()
if (idle !== 0) issues.push(`idle fees should be 0, got ${idle}`)
g.landsideFeeWindow = 400
const income = g.landsideIncome()
if (!(income > idle)) issues.push(`passenger fees should lift income ${idle}→${income}`)
g.landsideFeeWindow = 0

// Inside-terminal dayhotel still separate (layover extract)
g.selectedTile = g.fits[0]?.origin ?? null
g.buyRoom('dayhotel')
if (!g.hallOpen().has('dayhotel')) issues.push('dayhotel missing from hall')
if (!(g.landsideUpkeep() > expense)) {
  issues.push('dayhotel should add amenity expense')
}

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

const out = {
  ok: issues.length === 0,
  issues,
  expense,
  idle,
  income,
  multBare,
  multFull,
  hotelClasses: g.hotelClass,
  parkTerms: g.parkTerms,
  modes: { sawBus, sawRail, sawPark, sawHotel, sawMissThought },
  has: {
    hotel: g.hasHotelBeds(),
    short: g.hasShortParking(),
    long: g.hasLongParking(),
    bus: g.hasBusCurb(),
    rail: g.hasRailStation(),
    dayhotel: g.hallOpen().has('dayhotel'),
  },
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

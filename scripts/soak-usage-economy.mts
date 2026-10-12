/**
 * Prove place≠pay: empty landside bleeds; passenger fees are the only landside take.
 */
import { Game } from '../src/game/sim.ts'
import { HOTEL_CLASS_EXPENSE, PARK_EXPENSE } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.cash += 250_000

const roadC = 16
g.tiles[10][roadC - 1] = 'grass'
g.tool = 'hotel_biz'
g.placeSingle({ c: roadC - 1, r: 10 })
g.setParkTerm('long')
g.tool = 'park_g'
g.tiles[12][roadC + 1] = 'grass'
g.placeSingle({ c: roadC + 1, r: 12 })

const expense = g.landsideUpkeep()
const expectMin = HOTEL_CLASS_EXPENSE.business + PARK_EXPENSE.park_g.long
if (expense < expectMin) {
  issues.push(`expense too low ${expense} (want ≥${expectMin})`)
}

// Idle: no passenger fees → income window 0, expense still full.
g.landsideUses = 0
g.landsideFeeWindow = 0
if (g.landsideIncome() !== 0) {
  issues.push(`idle landsideIncome should be 0, got ${g.landsideIncome()}`)
}
const cashBefore = g.cash
g.payrollCool = 0
g.tickPayroll(1)
const bled = cashBefore - g.cash
// payroll may also bill ops — expense portion must bite
if (bled < expense * 0.5) {
  issues.push(`empty buildings should bleed; cash drop ${bled} vs expense ${expense}`)
}
if (g.landsideFeeWindow !== 0) {
  issues.push('fee window should reset after payroll')
}

// Passenger use deposits fees into window (and cash).
g.landsideFeeWindow = 0
const guestCash = g.cash
const fake = {
  wallet: 500,
  spent: 0,
  happiness: 50,
  patience: 50,
  thought: '',
  needs: { energy: 80, hunger: 0, bladder: 0, shop: 0, boarding: 0, play: 0 },
  arriveMode: 'hotel' as const,
  preferMode: 'hotel' as const,
  tag: 'premium' as const,
}
g.applyGuestLandside(fake as never, 'arrive')
if (g.landsideFeeWindow <= 0) issues.push('hotel guest should pay a fee')
if (!(g.cash > guestCash)) issues.push('guest fee should hit cash immediately')
if (g.landsideIncome() !== Math.round(g.landsideFeeWindow)) {
  issues.push('landsideIncome should equal fee window')
}

// Hall amenity expense with no guests still costs.
const h = new Game()
h.beginNew('easy')
h.buyLand('city')
h.buildStarterKit()
h.cash += 80_000
h.selectedTile = h.fits[0]?.origin ?? null
const beforeAmenity = h.landsideUpkeep()
h.buyRoom('spa')
h.buyRoom('pool')
h.buyRoom('dayhotel')
const afterAmenity = h.landsideUpkeep()
if (!(afterAmenity > beforeAmenity + 400)) {
  issues.push(`amenity expense should rise ${beforeAmenity}→${afterAmenity}`)
}
h.landsideFeeWindow = 0
if (h.landsideIncome() !== 0) issues.push('unused amenities must not print income')

const out = {
  ok: issues.length === 0,
  issues,
  expense,
  bled: Math.round(bled),
  feeWindow: g.landsideFeeWindow,
  amenity: { before: beforeAmenity, after: afterAmenity },
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

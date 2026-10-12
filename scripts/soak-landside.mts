import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 80_000

// Stamp landside on road edge
const roadC = 16
g.tiles[10][roadC - 1] = 'grass'
g.tool = 'hotel'
g.placeSingle({ c: roadC - 1, r: 10 })
if (g.tiles[10][roadC - 1] !== 'hotel') issues.push('hotel not stamped')

g.setParkTerm('long')
g.tool = 'park_g'
g.tiles[12][roadC + 1] = 'grass'
g.placeSingle({ c: roadC + 1, r: 12 })
if (g.tiles[12][roadC + 1] !== 'park_g') issues.push('garage not stamped')
if (g.parkTerms['17,12'] !== 'long' && g.parkTerms[`${roadC + 1},12`] !== 'long') {
  issues.push(`park term missing: ${JSON.stringify(g.parkTerms)}`)
}

const pot = g.landsidePotential()
if (pot < 1000) issues.push(`landside potential too low ${pot}`)
g.landsideUses = 0
const idle = g.landsideIncome()
g.landsideUses = 50
const income = g.landsideIncome()
if (!(income > idle)) issues.push(`usage should lift income ${idle}→${income}`)
if (income < 800) issues.push(`busy landside income too low ${income}`)
const upkeep = g.landsideUpkeep()
if (upkeep < 100) issues.push(`upkeep too low ${upkeep}`)

g.hireJanitor()
if (g.janitors < 1) issues.push('janitor not hired')
g.fits[0].wearBath = 40
g.janitorCool = 0
g.tickJanitors(1)
if ((g.fits[0].wearBath ?? 0) >= 40) issues.push('janitor did not scrub')

// Second strip capacity — clear research so tower+2 strips = 3
g.researchUnlocked = []
const strips = g.runwayStripCount()
if (strips < 2) {
  for (let c = 4; c < 18; c++) g.tiles[6][c] = 'runway'
}
const after = g.maxInbound()
if (g.runwayStripCount() >= 2 && after < 3) {
  issues.push(`tower+2 strips should inbound≥3 got ${after} strips=${g.runwayStripCount()}`)
}

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
  upkeep,
  inbound: after,
  strips: g.runwayStripCount(),
  janitors: g.janitors,
  wear: g.fits[0].wearBath,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

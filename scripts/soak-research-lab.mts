import { Game } from '../src/game/sim.ts'
import { RP_RATE_BARE } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 80_000
g.speed = 3

if (!g.fits.length) issues.push('no hall after starter kit')

// Hire without desks — bare drip only
g.hireResearcher()
g.hireResearcher()
if (g.researchers !== 2) issues.push(`researchers ${g.researchers}`)
const bare = g.researchRate()
if (bare < RP_RATE_BARE * 1.5) issues.push(`bare rate too low ${bare}`)
if (bare > RP_RATE_BARE * 3) issues.push(`bare rate too high ${bare}`)

const rp0 = g.researchPoints
for (let i = 0; i < 80; i++) g.tickResearchers(0.25)
const bareGain = g.researchPoints - rp0
if (bareGain <= 0) issues.push('no RP from bare researchers')

// Furnish full lab
const fit = g.fits[0]
fit.rooms.rdesk = 2
fit.rooms.rboard = 1
fit.rooms.rmachine = 1
const geared = g.researchRate()
if (!(geared > bare * 2)) {
  issues.push(`geared rate ${geared} should beat bare ${bare}`)
}

const rp1 = g.researchPoints
for (let i = 0; i < 80; i++) g.tickResearchers(0.25)
const gearGain = g.researchPoints - rp1
if (!(gearGain > bareGain)) {
  issues.push(`lab gain ${gearGain} should beat bare gain ${bareGain}`)
}

const pawns = g.people.filter((p) => p.job === 'researcher')
if (pawns.length < 2) issues.push(`researcher pawns ${pawns.length}`)
const labels = pawns.map((p) => p.label)
if (!labels.some((l) => /desk|board|lab|break|home|idle/i.test(l))) {
  issues.push(`odd labels ${labels.join(',')}`)
}

// Payroll includes researcher wages
const pay = g.lineCost('maintenance')
g.researchers = 0
const payNo = g.lineCost('maintenance')
g.researchers = 2
if (!(pay > payNo)) issues.push(`payroll should include researchers (${pay} vs ${payNo})`)

const out = {
  ok: issues.length === 0,
  issues,
  bare,
  geared,
  bareGain: Math.round(bareGain * 100) / 100,
  gearGain: Math.round(gearGain * 100) / 100,
  researchers: g.researchers,
  labels,
  lab: g.labGear(),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

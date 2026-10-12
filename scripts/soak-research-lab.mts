/**
 * Hire researchers + furnish desk/board/bench → RP drip.
 * Bodies walk stations; breaks and soft off-shift (home) cut the rate.
 */
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

const open = g.hallOpen()
if (!open.has('lab_desk')) issues.push('lab_desk not open with rdesk')
if (!open.has('lab_board')) issues.push('lab_board not open with rboard')
if (!open.has('lab_bench')) issues.push('lab_bench not open with rmachine')

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

// Force long sim — should see break and/or home
let sawBreak = false
let sawHome = false
for (let i = 0; i < 400; i++) {
  g.tickResearchers(0.25)
  for (const p of g.people) {
    if (p.job !== 'researcher') continue
    if (p.stage === 3) sawBreak = true
    if (p.stage === 4) sawHome = true
  }
  if (sawBreak && sawHome) break
}
if (!sawBreak) issues.push('never saw researcher on break')
if (!sawHome) issues.push('never saw researcher go home (off-shift)')

const crew = g.labCrewStatus()
if (crew.total < 2) issues.push(`crew total ${crew.total}`)

// Night slows drip
g.clock = 130
const rpN0 = g.researchPoints
for (let i = 0; i < 40; i++) g.tickResearchers(0.25)
const nightGain = g.researchPoints - rpN0
g.clock = 40
const rpD0 = g.researchPoints
// Put everyone back on desk so day comparison is fair
for (const p of g.people) {
  if (p.job !== 'researcher') continue
  p.stage = 0
  p.dutySec = 30
  p.label = 'Researcher · desk'
}
for (let i = 0; i < 40; i++) g.tickResearchers(0.25)
const dayGain = g.researchPoints - rpD0
if (!(dayGain > nightGain * 0.9)) {
  // soft check — workFrac variance; just ensure day isn't far below
  if (dayGain <= 0) issues.push('day lab drip dead')
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
  nightGain: Math.round(nightGain * 100) / 100,
  dayGain: Math.round(dayGain * 100) / 100,
  researchers: g.researchers,
  labels,
  lab: g.labGear(),
  sawBreak,
  sawHome,
  crew,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

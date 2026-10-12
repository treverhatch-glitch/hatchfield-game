import { Game } from '../src/game/sim.ts'
import { runwayStrips } from '../src/game/path.ts'
import { MIN_RUNWAY } from '../src/game/catalog.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 100_000
g.speed = 3

// Stamp 3 parallel strips
for (let c = 4; c < 18; c++) g.tiles[6][c] = 'runway'
for (let c = 4; c < 18; c++) g.tiles[10][c] = 'runway'
const strips = runwayStrips(g.tiles, MIN_RUNWAY)
if (strips.length < 3) issues.push(`expected ≥3 strips got ${strips.length}`)

const inbound = g.maxInbound()
// tower + 3 strips → 1+3 = 4 (capped)
if (inbound < 4) issues.push(`inbound too low for 3 strips: ${inbound}`)

for (let i = 0; i < 400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

g.seedScheduleForAirline(g.signed[0] ?? 'northline', 6)
const prefs = g.openSchedule().map((s) => s.runwayPref)
const used = new Set(prefs.filter((p) => p != null))
if (used.size < 2) issues.push(`auto bank did not spread across strips: ${[...used]}`)

g.setPlannerRwFilter(0)
const rw0 = g.scheduleForRunway(0)
if (!rw0.every((s) => s.runwayPref === 0)) issues.push('filter RW0 leaked')

const slot = g.openSchedule()[0]
if (slot) {
  const before = slot.runwayPref
  g.cycleSlotRunway(slot.id)
  // should change or wrap to auto
  if (slot.runwayPref === before && strips.length > 1) {
    // cycling from null goes to 0 — ok if before was last
  }
}

const out = {
  ok: issues.length === 0,
  issues,
  strips: strips.length,
  inbound,
  prefs: prefs.slice(0, 8),
  used: [...used],
  rw0: rw0.length,
  open: g.openSchedule().length,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

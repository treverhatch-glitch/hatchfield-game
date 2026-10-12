import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (!g.signed.length) {
  console.log(JSON.stringify({ ok: false, why: 'no airlines' }))
  process.exit(1)
}

g.addManualSlot(g.signed[0], 40)
const slot = g.openSchedule().find((s) => s.manual)
if (!slot) {
  issues.push('manual slot missing')
} else {
  const eta0 = slot.eta
  g.pullSlot(slot.id, 12)
  if (slot.eta >= eta0) issues.push('pull did not move ETA earlier')
  if (slot.eta < g.clock + 5) issues.push('pull went below floor')

  g.bumpSlot(slot.id, 18)
  if (slot.status !== 'delayed' && slot.delaySec <= 0) {
    issues.push('bump should delay')
  }

  const stands = g.freeStands().length + (g.flights.filter((f) => f.stand).length ? 1 : 0)
  // Cycle through stands
  g.cycleSlotStand(slot.id)
  if (!slot.standPref) {
    // might still be null if no stands — starter has stands
    issues.push('stand cycle should assign G1')
  } else {
    const label = g.gateLabel(slot.standPref)
    if (!/^G\d/.test(label)) issues.push(`bad gate label ${label}`)
  }
  // Cycle until auto
  for (let i = 0; i < 8; i++) g.cycleSlotStand(slot.id)
  // Eventually null again
  let sawNull = !slot.standPref
  for (let i = 0; i < 6 && !sawNull; i++) {
    g.cycleSlotStand(slot.id)
    if (!slot.standPref) sawNull = true
  }
  if (!sawNull && stands > 0) issues.push('stand cycle never returned to auto')
}

const strip = g.plannerStrip(120)
if (!Array.isArray(strip.slots)) issues.push('strip missing slots')
if (strip.horizon !== 120) issues.push('bad horizon')

const out = {
  ok: issues.length === 0,
  issues,
  open: g.openSchedule().length,
  strip: strip.slots.slice(0, 6),
  sample: g.openSchedule()[0]
    ? {
        flight: g.openSchedule()[0].flightNo,
        stand: g.openSchedule()[0].standPref
          ? g.gateLabel(g.openSchedule()[0].standPref)
          : 'auto',
        eta: Math.round(g.openSchedule()[0].eta - g.clock),
      }
    : null,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

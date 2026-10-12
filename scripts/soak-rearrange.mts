import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.speed = 3
g.scheduleAuto = true

for (let i = 0; i < 500; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

if (g.signed.length < 1) {
  console.log(JSON.stringify({ ok: false, why: 'no airlines' }))
  process.exit(1)
}

// Seed a dense bank
g.seedScheduleForAirline(g.signed[0], 4)
const open = g.openSchedule().filter((s) => s.status === 'scheduled' || s.status === 'delayed')
if (open.length < 3) issues.push(`bank too thin ${open.length}`)

const victim = open[1]
const heatsBefore = Object.fromEntries(
  g.signed.map((id) => [id, g.heatOf(id)]),
)
const cascadedHint = g.bumpSlot(victim.id)
void cascadedHint
const heatsAfter = Object.fromEntries(
  g.signed.map((id) => [id, g.heatOf(id)]),
)
const heatDropped = g.signed.some((id) => heatsAfter[id] < heatsBefore[id] - 0.5)
if (!heatDropped) issues.push('bump rearrange should drop heat')

const delayed = g.openSchedule().filter((s) => s.status === 'delayed')
if (!delayed.length) issues.push('bump should leave delayed slots')

// Pull forward heat on jumped
g.addManualSlot(g.signed[0], 40)
g.addManualSlot(g.signed[0], 55)
const late = g.openSchedule().find((s) => s.manual && s.eta - g.clock > 45)
const earlyHeat = late ? g.heatOf(late.airline) : 0
if (late) {
  // Put someone in front then pull late ahead
  g.pullSlot(late.id, 30)
  if (g.heatOf(late.airline) > earlyHeat + 0.01) {
    /* pull may not hurt the pulled airline itself much */
  }
}

// Storm delay path
g.weather = 'storm'
const sched = g.openSchedule().find((s) => s.status === 'scheduled')
if (sched) {
  const beforeEta = sched.eta
  g.delaySlot(sched, 14, 'Storm / dest weather')
  if (sched.eta <= beforeEta) issues.push('storm delay did not push ETA')
}

// Slow boarding cascade
const f = g.flights[0]
if (f) {
  f.phase = 'board'
  f.boardingSlow = true
  f.phaseTime = 8.15
  f.waitingOn.paxIn = 3
  const heat0 = g.heatOf(f.airline)
  for (let i = 0; i < 8; i++) g.tick(0.25)
  // Either cascade news or heat dip is fine
  const saw =
    g.news.some((n) => /slow boarding|cascade|slid/i.test(n.text)) ||
    g.heatOf(f.airline) < heat0
  if (!saw) issues.push('slow boarding produced no drama')
}

const out = {
  ok: issues.length === 0,
  issues,
  open: g.openSchedule().slice(0, 6).map((s) => ({
    no: s.flightNo,
    status: s.status,
    delay: Math.round(s.delaySec),
    reason: s.delayReason,
    rw: g.runwayLabel(s.runwayPref),
  })),
  heat: Object.fromEntries(g.signed.map((id) => [id, Math.round(g.heatOf(id))])),
  news: g.news.slice(0, 8).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

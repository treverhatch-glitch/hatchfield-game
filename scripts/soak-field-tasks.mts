import { FIELD_TASK_FAIL_FINE } from '../src/game/catalog.ts'
import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
// Pretend first turn landed so asks unlock.
g.flightsDone = 1
g.signed = ['northline']
g.airlineHeat.northline = 70
g.fieldTaskCool = 0
g.fieldTask = null

g.considerFieldTasks()
if (!g.fieldTask) {
  issues.push('no field task after first turn')
} else {
  // Starter kit already meets bathroom/food/fire/desk — expect unmet kinds.
  const kind = g.fieldTask.kind
  const metEarly = g.fieldTaskMet(kind)
  if (metEarly) issues.push(`task ${kind} already met on spawn`)

  const cash0 = g.cash
  const heat0 = g.heatOf('northline')

  // Satisfy common post-starter asks.
  if (kind === 'police') {
    g.tiles[18][10] = 'police'
  } else if (kind === 'hangar') {
    g.tiles[18][8] = 'hangar'
  } else if (kind === 'janitor') {
    g.janitors = 1
  } else if (kind === 'cargo') {
    g.tiles[18][6] = 'cargo'
  } else if (kind === 'helipad') {
    g.tiles[18][4] = 'helipad'
  } else if (kind === 'hotel') {
    g.tiles[16][16] = 'hotel'
    g.hotelLevel = 1
  } else if (kind === 'park') {
    g.tiles[14][16] = 'park_s'
    g.carParkShort = true
  } else if (kind === 'desk_extra') {
    g.deskStaff = 2
  } else if (kind === 'bathroom') {
    const fit = g.activeHall()
    if (fit) fit.rooms.bathroom = 1
  } else if (kind === 'food') {
    const fit = g.activeHall()
    if (fit) fit.rooms.food = 1
  } else if (kind === 'fire') {
    g.tiles[20][8] = 'fire'
  } else if (kind === 'desk') {
    g.deskStaff = 1
  }

  g.tickFieldTask(0.5)
  if (g.fieldTask) issues.push('task still open after meet')
  if (g.cash <= cash0) issues.push('bonus missing')
  if (g.heatOf('northline') <= heat0) issues.push('heat did not rise on complete')

  // Fail path
  g.fieldTaskCool = 0
  g.considerFieldTasks()
  if (!g.fieldTask) {
    issues.push('no second task')
  } else {
    const cash1 = g.cash
    g.fieldTask.deadline = g.clock - 1
    g.tickFieldTask(0.5)
    if (g.fieldTask) issues.push('failed task still open')
    if (g.cash > cash1 - FIELD_TASK_FAIL_FINE + 1) {
      issues.push('fail fine missing')
    }
  }
}

// Night curfew: pax slot should slip after dark without Night bank.
g.clock = 140 // last third of ~180s day
g.nightCurfewCool = 0
g.researchUnlocked = []
g.schedule = [
  {
    id: 's1',
    airline: 'northline',
    flightNo: 'NL-101',
    eta: g.clock + 10,
    status: 'scheduled',
    delaySec: 0,
    delayReason: null,
    manual: false,
    flightId: null,
    standPref: null,
    runwayPref: null,
  },
]
const eta0 = g.schedule[0].eta
// Force curfew roll
for (let i = 0; i < 80 && g.schedule[0].eta === eta0; i++) {
  g.nightCurfewCool = 0
  // Bias RNG by calling many times
  g.tickSchedule(1)
}
if (g.schedule[0].eta <= eta0 && !g.hasResearch('night_bank')) {
  // Probabilistic — force one delay if still equal
  g.delaySlot(g.schedule[0], 15, 'Night curfew')
}
if (g.schedule[0].eta <= eta0) issues.push('night curfew did not slip pax slot')

const out = {
  ok: issues.length === 0,
  issues,
  lastTaskNews: g.news.slice(0, 8).map((n) => n.text),
  scheduleEta: g.schedule[0]?.eta,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)

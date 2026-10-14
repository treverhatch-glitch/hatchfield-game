import type { Difficulty, StartFocus } from '../game/types.ts'
import { tryStamp } from './build.ts'
import { createPlayer } from './commands.ts'
import { chaoticIntents, carefulIntents, freshMemory, greedyIntents, mulberry32 } from './personas.ts'
import { PLAYTEST_TUNING as T } from './tuning.ts'
import type {
  CommandResult,
  CouldNot,
  DaySystems,
  Intent,
  PersonaDecision,
  PersonaMemory,
  PersonaReport,
  PlayerCommands,
  Probe,
  ResearchBuy,
  ResearchPools,
  SlowTick,
  StuckRecord,
  SystemsPeaks,
} from './types.ts'

export interface PersonaSpec {
  id: PersonaReport['persona']
  label: string
  days: number
  difficulty: Difficulty
  focus: StartFocus
  seed: number
  decide: (view: ReturnType<PlayerCommands['view']>, memory: PersonaMemory, rng: () => number) => PersonaDecision
}

export const PERSONAS: PersonaSpec[] = [
  {
    id: 'careful',
    label: 'Careful',
    days: T.carefulDays,
    difficulty: 'standard',
    focus: 'pax',
    seed: 0x5eed,
    decide: (view, memory) => carefulIntents(view, memory),
  },
  {
    id: 'greedy',
    label: 'Greedy expander',
    days: T.greedyDays,
    difficulty: 'standard',
    focus: 'pax',
    seed: 0x6eed,
    decide: (view, memory) => greedyIntents(view, memory),
  },
  {
    id: 'chaotic',
    label: 'Chaotic random clicker',
    days: T.chaoticDays,
    difficulty: 'standard',
    focus: 'pax',
    seed: 0xc0a0,
    decide: (view, memory, rng) => chaoticIntents(view, memory, rng),
  },
]

export function runHeadless(options?: {
  personas?: PersonaSpec[]
  onProgress?: (line: string) => void
}): PersonaReport[] {
  const specs = options?.personas ?? PERSONAS
  const log = options?.onProgress ?? (() => {})
  return specs.map((spec) => {
    log(`${spec.label}: ${spec.days} sim days at ${T.maxSpeed}x`)
    const report = runPersona(spec, log)
    log(
      `${spec.label} done day ${report.daysRan} cash ${Math.round(report.cashEnd)} landing ${report.timeToFirstLandingSec ?? 'none'}`,
    )
    return report
  })
}

function runPersona(spec: PersonaSpec, log: (line: string) => void): PersonaReport {
  const api = createPlayer()
  const rng = mulberry32(spec.seed)
  const notes: string[] = []
  const consoleErrors: string[] = []
  const softlocks: string[] = []
  const could = new Map<string, CouldNot>()
  let couldNotTotal = 0
  let heldSpeed = false
  let memory = freshMemory()
  let lastAct = -Infinity
  let idle = 0
  let stalls = 0
  let ticks = 0
  let loggedDay = -1
  const wallStart = performance.now()
  const cashCurve: PersonaReport['cashCurve'] = []
  const satisfaction: PersonaReport['satisfaction'] = []
  const slowest: SlowTick[] = []
  const openStuck = new Map<string, StuckRecord>()
  const pendingClear = new Map<string, number>()
  const recovered: StuckRecord[] = []
  const days: DaySystems[] = []
  const nanFlags: string[] = []
  const researchBuys: ResearchBuy[] = []
  const seenResearch = {
    desk: new Set<string>(),
    wave3: new Set<string>(),
    tree: new Set<string>(),
  }
  const peaks: SystemsPeaks = {
    happiness: null,
    guests: 0,
    checkinWaiting: 0,
    securityWaiting: 0,
    curbPressure: 0,
    curbQueue: 0,
  }
  let landing: { sec: number; day: number; phase: string; flight: string } | null = null
  let sampledDay = -1

  const note = (result: CommandResult) => {
    if (result.ok || result.command === 'wait') return
    couldNotTotal += 1
    const detail = result.detail.slice(0, 180)
    const key = `${result.command}|${detail}`
    const prev = could.get(key)
    if (prev) prev.count += 1
    else could.set(key, { command: result.command, detail, count: 1 })
  }

  api.setSandbox(false)
  note(api.beginNew(spec.difficulty))
  api.setFocus(spec.focus)
  const cashStart = api.view().cash

  const finish = (daysRan: number): PersonaReport => {
    const stillStuck = [...openStuck.values()]
    const view = api.view()
    const withGuests = satisfaction.filter((point) => point.avg != null)
    const satisfactionAvg = withGuests.length
      ? withGuests.reduce((sum, point) => sum + (point.avg ?? 0), 0) / withGuests.length
      : null
    if (heldSpeed) {
      notes.push('Driver put the clock back to 5× after the persona touched the speed buttons.')
    }
    notes.push(`recovery teleports: ${api.probe().teleports}`)
    return {
      persona: spec.id,
      label: spec.label,
      daysRequested: spec.days,
      daysRan,
      difficulty: spec.difficulty,
      focus: spec.focus,
      sandbox: false,
      tickDt: T.tickDt,
      speed: T.maxSpeed,
      wallMs: Math.round(performance.now() - wallStart),
      ticks,
      timeToFirstLandingSec: landing ? round(landing.sec) : null,
      timeToFirstLandingDay: landing ? landing.day : null,
      firstLandingPhase: landing?.phase ?? null,
      firstLandingFlight: landing?.flight ?? null,
      cashStart: Math.round(cashStart),
      cashEnd: Math.round(view.cash),
      cashCurve,
      stuck: stillStuck,
      recovered: recovered.filter((rec) => rec.recoveredClock != null),
      consoleErrors,
      softlocks,
      satisfaction,
      satisfactionAvg: satisfactionAvg == null ? null : round(satisfactionAvg),
      slowestTicks: slowest,
      couldNot: [...could.values()].sort((a, b) => b.count - a.count).slice(0, T.couldNotLimit),
      couldNotTotal,
      built: {
        runway: view.runway,
        stands: view.stands,
        terminals: view.terminals,
        snacks: view.snacks,
        rooms: view.rooms,
        shopUnits: view.shopUnits,
        leasedShops: view.leasedShops,
        signed: view.signed,
        flightsDone: view.flightsDone,
      },
      notes,
      days,
      peaks: {
        ...peaks,
        happiness: peaks.happiness == null ? null : round(peaks.happiness),
        curbPressure: round(peaks.curbPressure),
        curbQueue: round(peaks.curbQueue),
      },
      books: api.books(),
      nanFlags,
      researchBuys,
      research: noteResearch(api.view().day),
    }
  }

  function noteResearch(day: number): ResearchPools {
    const read = api.researchPools()
    collectBuys(seenResearch.desk, read.deskUnlocked, 'desk', day, researchBuys)
    collectBuys(seenResearch.wave3, read.wave3Unlocked, 'wave3', day, researchBuys)
    collectBuys(seenResearch.tree, read.treeUnlocked, 'tree', day, researchBuys)
    for (const [label, value] of [
      ['research desk points', read.deskPoints],
      ['wave 3 points', read.wave3Points],
      ['growth tree points', read.treePoints],
    ] as const) {
      if (Number.isFinite(value)) continue
      const line = `${label} were ${value} on day ${day}`
      if (!nanFlags.includes(line) && nanFlags.length < 12) nanFlags.push(line)
    }
    return read
  }

  while (api.view().day < spec.days) {
    const view = api.view()
    if (!view.hasLand || view.clock - lastAct >= T.actEverySec) {
      let decided: PersonaDecision
      try {
        decided = spec.decide(view, memory, rng)
      } catch (error) {
        consoleErrors.push(`decide: ${message(error)}`)
        softlocks.push('Persona decision threw.')
        break
      }
      memory = decided.memory
      if (decided.intents.some((intent) => intent.do === 'speed')) heldSpeed = true
      for (const intent of decided.intents) {
        try {
          note(execute(api, intent, rng))
        } catch (error) {
          consoleErrors.push(`${intent.do}: ${message(error)}`)
          note({ ok: false, command: intent.do, detail: message(error) })
        }
      }
      lastAct = api.view().clock
      noteResearch(api.view().day)
      if (api.view().hasLand && api.view().speed !== T.maxSpeed) {
        api.setSpeed(T.maxSpeed)
      }
    }

    if (!api.view().hasLand) {
      idle += 1
      if (idle > T.landlessActs) {
        softlocks.push('Clock never started — land was never purchased.')
        break
      }
      continue
    }
    idle = 0

    const before = api.probe()
    const t0 = performance.now()
    try {
      api.tick(T.tickDt)
    } catch (error) {
      consoleErrors.push(`tick: ${message(error)}`)
      softlocks.push(`Sim tick threw: ${message(error)}`)
      break
    }
    ticks += 1
    const ms = performance.now() - t0
    const after = api.probe()
    rememberTick(slowest, {
      ms: round(ms),
      day: after.day,
      clock: round(after.clock),
      flights: after.activeFlights,
      guests: after.guestCount,
    })
    if (!landing && after.landed) {
      landing = {
        sec: after.clock,
        day: after.day,
        phase: after.landed.phase,
        flight: after.landed.flightNo,
      }
    }
    trackStuck(openStuck, pendingClear, recovered, after)
    noteNan(nanFlags, after)
    if (after.day !== sampledDay) {
      sampledDay = after.day
      cashCurve.push({ day: after.day, cash: Math.round(after.cash) })
      satisfaction.push({
        day: after.day,
        guests: after.guestCount,
        avg: after.guestHappiness == null ? null : round(after.guestHappiness),
        fieldRating: after.fieldRating,
      })
      const board = api.view()
      const pools = noteResearch(after.day)
      const relations = api.books().relations
      days.push({
        day: after.day,
        checkinWaiting: board.checkinWaiting,
        securityWaiting: board.securityWaiting,
        curbPressure: round(board.curbPressure),
        curbQueue: round(board.curbQueue),
        lanes: board.lanes,
        busBays: board.busBays,
        treePoints: pools.treePoints,
        treeNodes: pools.treeUnlocked.length,
        deskStaff: board.deskStaff,
        fieldRating: after.fieldRating,
        guests: after.guestCount,
        deskPoints: pools.deskPoints,
        wave3Points: pools.wave3Points,
        deskEarned: pools.deskEarned,
        wave3Earned: pools.wave3Earned,
        treeEarned: pools.treeEarned,
        researchers: pools.researchers,
        labDesks: pools.desks,
        labBoards: pools.boards,
        labMachines: pools.machines,
        deskLabRate: pools.deskLabRate,
        wave3RoomRate: pools.wave3RoomRate,
        treeRoomRate: pools.treeRoomRate,
        relationTier2: relations.filter((row) => row.tier >= 2).length,
        relationTier3: relations.filter((row) => row.tier >= 3).length,
        relationBest: relations[0]?.score ?? 0,
      })
      if (after.guestCount > peaks.guests) peaks.guests = after.guestCount
      if (after.guestHappiness != null && (peaks.happiness == null || after.guestHappiness > peaks.happiness)) {
        peaks.happiness = after.guestHappiness
      }
      if (board.checkinWaiting > peaks.checkinWaiting) peaks.checkinWaiting = board.checkinWaiting
      if (board.securityWaiting > peaks.securityWaiting) peaks.securityWaiting = board.securityWaiting
      if (board.curbPressure > peaks.curbPressure) peaks.curbPressure = board.curbPressure
      if (board.curbQueue > peaks.curbQueue) peaks.curbQueue = board.curbQueue
      if (!Number.isFinite(board.curbPressure)) {
        const line = `curb pressure was ${board.curbPressure} on day ${after.day}`
        if (!nanFlags.includes(line)) nanFlags.push(line)
      }
      if (!Number.isFinite(board.treePoints)) {
        const line = `research tree points were ${board.treePoints} on day ${after.day}`
        if (!nanFlags.includes(line)) nanFlags.push(line)
      }
      if (after.day !== loggedDay && after.day % 5 === 0) {
        loggedDay = after.day
        log(`  ${spec.id} day ${after.day} cash ${Math.round(after.cash)} flights ${after.flightsDone}`)
      }
    }
    for (const rec of openStuck.values()) {
      if (rec.lastClock - rec.firstClock < T.softlockStuckSec) continue
      const line = `${rec.detail} stayed stuck for ${Math.round(rec.lastClock - rec.firstClock)}s`
      if (!softlocks.includes(line) && softlocks.length < 12) softlocks.push(line)
    }
    if (after.hasLand && after.clock - before.clock < T.tickDt * T.maxSpeed * 0.5) {
      stalls += 1
      if (stalls >= T.stallTicks) {
        softlocks.push('Clock stalled while speed was 5×.')
        break
      }
    } else {
      stalls = 0
    }
  }

  const end = api.probe()
  if (!cashCurve.some((point) => point.day === end.day)) {
    cashCurve.push({ day: end.day, cash: Math.round(end.cash) })
  }
  return finish(end.day)
}

function execute(api: PlayerCommands, intent: Intent, rng: () => number): CommandResult {
  switch (intent.do) {
    case 'buyLand':
      return api.buyLand(intent.kind)
    case 'starterKit':
      return api.buildStarterKit()
    case 'freehand':
      return api.chooseFreehand()
    case 'accept':
      return api.acceptContract()
    case 'snooze':
      return api.snoozeContract()
    case 'walk':
      return api.walkContract()
    case 'loan':
      return api.takeLoan(intent.id)
    case 'stamp':
      return tryStamp(api, intent.tool, rng)
    case 'click':
      api.setView('apron')
      api.setTool(intent.tool)
      return api.clickTile(intent.cell)
    case 'room':
      return api.buyRoom(intent.id)
    case 'lease':
      return api.acceptBestShopBid()
    case 'janitor':
      return api.hireJanitor()
    case 'mechanic':
      return api.hireMechanic()
    case 'research':
      return api.buyResearch(intent.id)
    case 'tree':
      return api.buyTree(intent.id)
    case 'desk':
      return api.hireDesk()
    case 'fieldBuild':
      return api.buildFieldAsk()
    case 'fieldDecline':
      return api.declineFieldAsk()
    case 'curb':
      return api.relieveCurb()
    case 'parcel':
      return api.buyParcel()
    case 'speed':
      return api.setSpeed(intent.speed)
    case 'dismissYear':
      return api.dismissYearReport()
    case 'nothing':
      return { ok: true, command: 'wait', detail: 'held' }
    default: {
      const never: never = intent
      return { ok: false, command: 'unknown', detail: String(never) }
    }
  }
}

function recoveryStep(stuckId: string, probe: Probe): string | null {
  const raw = stuckId.startsWith('flight:')
    ? stuckId.slice('flight:'.length)
    : stuckId.startsWith('cond:stuck:')
      ? stuckId.slice('cond:stuck:'.length)
      : stuckId
  return probe.recoveries.find((row) => row.id === raw)?.step ?? null
}

function prevStep(rec: StuckRecord | undefined, step: string) {
  if (!rec || step === 'none') return
  rec.step = step
}

function trackStuck(
  openStuck: Map<string, StuckRecord>,
  pendingClear: Map<string, number>,
  recovered: StuckRecord[],
  probe: Probe,
) {
  const live = new Set(probe.stuck.map((row) => row.id))
  for (const row of probe.stuck) {
    pendingClear.delete(row.id)
    const prev = openStuck.get(row.id)
    if (prev) {
      prev.lastClock = probe.clock
      prev.detail = row.detail
    } else {
      openStuck.set(row.id, {
        id: row.id,
        detail: row.detail,
        step: recoveryStep(row.id, probe) ?? 'none',
        firstClock: probe.clock,
        lastClock: probe.clock,
        recoveredClock: null,
      })
    }
    const step = recoveryStep(row.id, probe)
    if (step) prevStep(openStuck.get(row.id), step)
  }
  for (const [id, rec] of openStuck) {
    if (live.has(id)) continue
    const since = pendingClear.get(id)
    if (since == null) {
      pendingClear.set(id, probe.clock)
      continue
    }
    if (probe.clock - since < T.stuckRecoverSec) continue
    rec.recoveredClock = probe.clock
    rec.lastClock = since
    recovered.push({ ...rec })
    openStuck.delete(id)
    pendingClear.delete(id)
  }
}

function rememberTick(slowest: SlowTick[], tick: SlowTick) {
  if (slowest.length < T.slowestTickCount) {
    slowest.push(tick)
    slowest.sort((a, b) => b.ms - a.ms)
    return
  }
  const last = slowest[slowest.length - 1]
  if (!last || tick.ms <= last.ms) return
  slowest[slowest.length - 1] = tick
  slowest.sort((a, b) => b.ms - a.ms)
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function collectBuys(
  seen: Set<string>,
  nodes: { id: string; name: string; cost: number }[],
  pool: ResearchBuy['pool'],
  day: number,
  buys: ResearchBuy[],
) {
  for (const node of nodes) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    buys.push({ pool, day, id: node.id, name: node.name, cost: node.cost })
  }
}

function noteNan(flags: string[], probe: Probe): void {
  const checks: [string, number | null][] = [
    ['cash', probe.cash],
    ['field rating', probe.fieldRating],
    ['guest happiness', probe.guestHappiness],
  ]
  for (const [label, value] of checks) {
    if (value == null || Number.isFinite(value)) continue
    const line = `${label} was ${value} on day ${probe.day}`
    if (!flags.includes(line) && flags.length < 12) flags.push(line)
  }
}

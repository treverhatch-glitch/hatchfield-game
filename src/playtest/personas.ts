import { ROOMS } from '../game/catalog.ts'
import type { RoomId, Speed, Tool, Vec } from '../game/types.ts'
import { SIZE } from '../game/types.ts'
import { PLAYTEST_TUNING as T } from './tuning.ts'
import type { AirportView, Intent, PersonaDecision, PersonaMemory, PersonaPolicy } from './types.ts'

const CAREFUL_CASH_BUFFER = 8_000
const CURB_CASH_BUFFER = 12_000
const RUNWAY_RESERVE = 30_000
/** Careful's ordinary stand cap, then two more once the field is over. */
const CAREFUL_STANDS = 4
const CAREFUL_PRESSURE_STANDS = 6
/** Greedy already aims at six stands. Pressure adds two more. */
const GREEDY_PRESSURE_STANDS = 8

/** Tip bots: sign Apex Local, leave the second strip, hire no researchers. */
export const TIP_POLICY: PersonaPolicy = { fuel: 'term', expand: false, researcher: false }

/** Live bots: second strip and two stands when the field is over, plus one researcher. */
export const LIVE_POLICY: PersonaPolicy = { fuel: 'term', expand: true, researcher: true }

/** Cart waits outrank the other counts the board already shows. */
function cartIsTop(view: AirportView): boolean {
  if (view.cartWaits <= 0) return false
  const others = [view.runwayDeferred, view.checkinWaiting, view.securityWaiting, view.curbQueue]
  return view.cartWaits > Math.max(0, ...others)
}

/** One depot a day, once cart-wait is the largest bottleneck and the stamp is open. */
function wantsCartDepot(view: AirportView, memory: PersonaMemory): boolean {
  if ((memory.depotOnDay ?? -1) === view.day) return false
  if (!cartIsTop(view) || !view.depotOpen || view.depotBuilding) return false
  return view.cash >= view.depotCost + CAREFUL_CASH_BUFFER
}

/** Second strip once the airfield is deferring demand and the till clears the stamp plus a reserve. */
function wantsSecondStrip(view: AirportView): boolean {
  return (
    view.runwayDeferred > 0 &&
    view.runway < 2 &&
    !view.runwayBuilding &&
    view.cash >= view.runwayCost + RUNWAY_RESERVE
  )
}

function overField(view: AirportView): boolean {
  return view.runwayOver || view.curbPressure > 1 || view.standPressure > 1
}

/** Second strip first, then stands up to the pressure ceiling. Cash has to clear 3× the stamp. */
function expansionStamp(view: AirportView, standCeiling: number): Intent | null {
  if (!overField(view)) return null
  if (view.runway < 2 && !view.runwayBuilding && view.cash > view.runwayCost * 3) return { do: 'stamp', tool: 'runway' }
  if (view.stands < standCeiling && view.cash > view.standCost * 3) return { do: 'stamp', tool: 'stand' }
  return null
}

function labReady(view: AirportView): boolean {
  return (view.rooms.rdesk ?? 0) + (view.rooms.rboard ?? 0) + (view.rooms.rmachine ?? 0) > 0
}

function researcherIntent(view: AirportView, policy: PersonaPolicy): Intent | null {
  if (!policy.researcher || !labReady(view) || view.researchers >= 1) return null
  if (view.cash <= view.researcherCost) return null
  return { do: 'researcher' }
}

function fuelIntent(view: AirportView, policy: PersonaPolicy): Intent | null {
  if (policy.fuel === 'spot-accept') return view.spotOffer ? { do: 'spotAccept' } : null
  if (policy.fuel === 'spot-ignore') return null
  if (!view.fuelTerm && view.cash >= view.fuelSignCost) return { do: 'fuelTerm' }
  return null
}

/** Build when the bonus covers the stamp, or the till still clears the cash floor. Otherwise decline. */
function fieldAskIntent(view: AirportView, cashFloor: number): Intent | null {
  const ask = view.fieldAsk
  if (!ask) return null
  const covered = ask.bonus >= ask.cost
  if (ask.canBuild && (covered || view.cash - ask.cost >= cashFloor)) return { do: 'fieldBuild' }
  return { do: 'fieldDecline' }
}

export function freshMemory(): PersonaMemory {
  return { builtOnDay: -1, stampsToday: 0, treeOnDay: -1 }
}

function memoryOn(view: AirportView, memory: PersonaMemory): PersonaMemory {
  const treeOnDay = memory.treeOnDay ?? -1
  if (view.day === memory.builtOnDay) return { ...memory, treeOnDay }
  return { builtOnDay: memory.builtOnDay, stampsToday: 0, treeOnDay }
}

function withTree(memory: PersonaMemory, view: AirportView, bought: boolean): PersonaMemory {
  return { ...memory, treeOnDay: bought ? view.day : memory.treeOnDay }
}

/** One affordable tree node. Careful waits until the next day before another. */
function takeTree(view: AirportView, memory: PersonaMemory, daily: boolean): { intent: Intent | null; memory: PersonaMemory } {
  if (!view.nextTree) return { intent: null, memory }
  if (daily && memory.treeOnDay === view.day) return { intent: null, memory }
  return {
    intent: { do: 'tree', id: view.nextTree.id },
    memory: withTree(memory, view, true),
  }
}

type PersonaKind = 'careful' | 'greedy' | 'chaotic'

/**
 * A blocked passenger letter buys one desk inside the hall, plus a lane when
 * the queue or a second carrier is already pressing. The starter count stays put.
 */
function hallBuy(view: AirportView, buffer: number): Intent[] {
  const intents: Intent[] = []
  const blocked = view.offer?.checkinOk === false
  if (blocked && view.hall.deskOpen && view.cash >= view.hall.deskCost + view.deskHireCost + buffer) {
    intents.push({ do: 'hallDesk' })
    if (view.deskStaff < 8) intents.push({ do: 'desk' })
  }
  const lanePressure = view.securityWaiting >= 6 || view.signed.length >= 2 || (view.signed.length >= 1 && blocked)
  if (view.hall.extraLanes < 1 && view.hall.laneOpen && lanePressure && view.cash >= view.hall.laneCost + buffer) {
    intents.push({ do: 'hallLane' })
  }
  return intents
}

/** Council vote and Green Pioneer. Neither spends the daily stamp. */
function governanceIntents(view: AirportView, who: PersonaKind): Intent[] {
  const intents: Intent[] = []
  if (view.council.pendingId) {
    const choice = who === 'careful' ? 'compromise' : who === 'greedy' ? 'full' : 'decline'
    const cost = choice === 'full' ? view.council.fullCost : choice === 'compromise' ? view.council.compromiseCost : 0
    if (view.cash >= cost) intents.push({ do: 'council', choice })
  }
  if (!view.pioneerStarted && view.day >= 2 && view.signed.length > 0) intents.push({ do: 'pioneer' })
  return intents
}

/**
 * One late buy: approach commission, Tower III, then the FL8 landmarks and cargo.
 * Night hub waits until field level 8 so day 1 does not spend the till on it.
 */
function lateIntent(view: AirportView, buffer: number): Intent | null {
  if (!view.approach.built && view.fieldLevel >= view.approach.level && view.cash >= view.approach.cost + buffer) {
    return { do: 'commission', id: 'atc_approach' }
  }
  if (view.tower.ready && view.cash >= view.tower.cost + buffer) return { do: 'towerIII' }
  if (!view.late.spotters && view.fieldLevel >= 8 && view.cash >= view.late.spottersCost + buffer) {
    return { do: 'stampLate', tool: 'spotters_deck' }
  }
  if (!view.late.nightHub && view.fieldLevel >= 8 && view.cash >= view.late.nightHubCost + buffer) {
    return { do: 'stamp', tool: 'nighthub' }
  }
  if (
    view.late.nightHub &&
    !view.late.cargoHub &&
    view.fieldLevel >= 8 &&
    view.cash >= view.late.cargoHubCost + buffer
  ) {
    return { do: 'stampLate', tool: 'cargo_hub_ii' }
  }
  return null
}

/** Hire until check-in and security both have a working body, and stop at three. */
function needsDesk(view: AirportView, cashBuffer: number): boolean {
  const posts = (view.rooms.checkin ?? 0) > 0 || (view.rooms.security ?? 0) > 0
  if (!posts || view.terminals < 1 || view.deskStaff >= 3) return false
  if (view.checkinStaffed && view.securityStaffed) return false
  return view.cash > view.deskHireCost + cashBuffer
}

function roomTotal(view: AirportView, id: RoomId): number {
  return view.rooms[id] ?? 0
}

function roomCost(id: RoomId): number {
  return ROOMS.find((room) => room.id === id)?.cost ?? Number.POSITIVE_INFINITY
}

/** Next lab room, once the operations trickle has banked a point and cash covers it. */
function nextLabRoom(view: AirportView): RoomId | null {
  if ((view.researchPoints < 1 && view.wave3Points < 1) || view.terminals < 1) return null
  for (const id of T.labRooms) {
    if (roomTotal(view, id) < 1 && view.cash >= roomCost(id)) return id
  }
  return null
}

/**
 * A helicopter letter without a pad: stamp one, hold the letter while it builds,
 * or decline when the till cannot cover it.
 */
function heliBeforeSign(view: AirportView): Intent | 'wait' | null {
  const offer = view.offer
  if (!offer?.needsHelipad || view.helipads >= 1) return null
  if (view.helipadBuilding) return 'wait'
  if (view.cash >= view.helipadCost) return { do: 'stamp', tool: 'helipad' }
  return { do: 'walk' }
}

/** Keeps a cash buffer, signs letters that already pass, and adds one piece a day. */
export function carefulIntents(
  view: AirportView,
  memory: PersonaMemory,
  policy: PersonaPolicy = LIVE_POLICY,
): PersonaDecision {
  const next = memoryOn(view, memory)
  const intents: Intent[] = []
  const upgrades = hallBuy(view, CAREFUL_CASH_BUFFER)
  const buyingDesk = upgrades.some((intent) => intent.do === 'hallDesk')
  if (view.yearReportPending) intents.push({ do: 'dismissYear' })
  if (!view.hasLand) {
    intents.push({ do: 'buyLand', kind: 'city' })
    return { intents, memory: next }
  }
  if (view.kitAvailable && view.cash >= view.kitCost) {
    intents.push({ do: 'starterKit' })
    return { intents, memory: next }
  }
  const fuel = fuelIntent(view, policy)
  if (fuel) intents.push(fuel)
  const researcher = researcherIntent(view, policy)
  if (researcher) intents.push(researcher)
  const fieldAsk = fieldAskIntent(view, CAREFUL_CASH_BUFFER)
  if (fieldAsk) intents.push(fieldAsk)
  const heli = heliBeforeSign(view)
  if (heli === 'wait') {
    // The pad is already going up. Leave the letter on the desk.
  } else if (heli) {
    intents.push(heli)
    if (heli.do === 'stamp') {
      return {
        intents,
        memory: {
          builtOnDay: view.day,
          stampsToday: next.stampsToday + 1,
          treeOnDay: next.treeOnDay,
          depotOnDay: next.depotOnDay ?? -1,
        },
      }
    }
  } else if (view.offer) {
    if (buyingDesk) {
      // The extra desk has to land before the letter is signed.
    } else if (view.offer.checkinOk === false) intents.push({ do: 'snooze' })
    else if (view.offer.met) intents.push({ do: 'accept' })
    else intents.push({ do: 'snooze' })
  }
  if (view.openShopBids > 0 && view.leasedShops < view.shopUnits) {
    intents.push({ do: 'lease' })
  }
  if (view.satisfaction != null && view.satisfaction < 45 && view.janitors < 2 && view.cash > CAREFUL_CASH_BUFFER) {
    intents.push({ do: 'janitor' })
  }
  const tree = takeTree(view, next, true)
  if (tree.intent) intents.push(tree.intent)
  if (needsDesk(view, CAREFUL_CASH_BUFFER)) intents.push({ do: 'desk' })
  intents.push(...upgrades)
  intents.push(...governanceIntents(view, 'careful'))
  if (wantsCartDepot(view, next)) {
    intents.push({ do: 'stamp', tool: 'depot' })
    return {
      intents,
      memory: {
        builtOnDay: view.day,
        stampsToday: next.stampsToday + 1,
        treeOnDay: tree.memory.treeOnDay,
        depotOnDay: view.day,
      },
    }
  }
  // Deferred demand can show up after the day's other stamp. Read the airfield
  // figure on every decision, including a day that already built something else.
  if (policy.expand && wantsSecondStrip(view)) {
    intents.push({ do: 'stamp', tool: 'runway' })
    return {
      intents,
      memory: {
        builtOnDay: view.day,
        stampsToday: next.stampsToday + 1,
        treeOnDay: tree.memory.treeOnDay,
        depotOnDay: next.depotOnDay ?? -1,
      },
    }
  }
  const lab = nextLabRoom(view)
  if (lab) {
    intents.push({ do: 'room', id: lab })
    return {
      intents,
      memory: withTree(
        { builtOnDay: view.day, stampsToday: next.stampsToday, treeOnDay: tree.memory.treeOnDay, depotOnDay: next.depotOnDay ?? -1 },
        view,
        false,
      ),
    }
  }
  if (view.day === next.builtOnDay) return { intents, memory: tree.memory }
  const built: PersonaMemory = {
    builtOnDay: view.day,
    stampsToday: next.stampsToday,
    treeOnDay: tree.memory.treeOnDay,
    depotOnDay: next.depotOnDay ?? -1,
  }
  if (policy.expand) {
    const expand = expansionStamp(view, CAREFUL_PRESSURE_STANDS)
    if (expand) {
      intents.push(expand)
      built.stampsToday += 1
      return { intents, memory: built }
    }
  }
  if (
    view.curbPressure > 1 &&
    view.cash > CURB_CASH_BUFFER &&
    (view.busBays < 1 || view.taxiRanks < 1 || view.curbLanes < 1)
  ) {
    intents.push({ do: 'curb' })
    built.stampsToday += 1
    return { intents, memory: built }
  }
  if (view.cash < 5_000 && view.loanBalance <= 0) {
    const micro = view.loans.find((loan) => loan.id === 'micro')
    if (micro) intents.push({ do: 'loan', id: micro.id })
    return { intents, memory: built }
  }
  if (view.cash > 22_000 && view.stands < CAREFUL_STANDS && !cartIsTop(view)) {
    intents.push({ do: 'stamp', tool: 'stand' })
    built.stampsToday += 1
    return { intents, memory: built }
  }
  if (view.cash > 18_000 && view.stands > 0 && view.stands < 3) {
    intents.push({ do: 'stamp', tool: 'taxi' })
    built.stampsToday += 1
    return { intents, memory: built }
  }
  if (view.cash > 16_000 && roomTotal(view, 'food') < 2 && view.terminals > 0) {
    intents.push({ do: 'room', id: 'food' })
    return { intents, memory: built }
  }
  if (view.cash > 14_000 && roomTotal(view, 'souvenir') < 2 && view.terminals > 0) {
    intents.push({ do: 'room', id: 'souvenir' })
    return { intents, memory: built }
  }
  if (view.cash > 12_000 && view.snacks < 1) {
    intents.push({ do: 'stamp', tool: 'snack' })
    built.stampsToday += 1
    return { intents, memory: built }
  }
  if (view.cash > 20_000 && roomTotal(view, 'bathroom') < 3 && view.terminals > 0) {
    intents.push({ do: 'room', id: 'bathroom' })
  }
  const late = lateIntent(view, CAREFUL_CASH_BUFFER)
  if (late) {
    intents.push(late)
    if (late.do === 'stamp' || late.do === 'stampLate') built.stampsToday += 1
  }
  return { intents, memory: built }
}

/** Takes loans, signs every letter, and spends cash on stands, rooms, and shops. */
export function greedyIntents(
  view: AirportView,
  memory: PersonaMemory,
  policy: PersonaPolicy = LIVE_POLICY,
): PersonaDecision {
  const next = memoryOn(view, memory)
  const intents: Intent[] = []
  const upgrades = hallBuy(view, 0)
  const buyingDesk = upgrades.some((intent) => intent.do === 'hallDesk')
  if (view.yearReportPending) intents.push({ do: 'dismissYear' })
  if (!view.hasLand) {
    intents.push({ do: 'buyLand', kind: 'city' })
    return { intents, memory: next }
  }
  if (view.kitAvailable && view.cash >= view.kitCost) {
    intents.push({ do: 'starterKit' })
    return { intents, memory: next }
  }
  const fuel = fuelIntent(view, policy)
  if (fuel) intents.push(fuel)
  const researcher = researcherIntent(view, policy)
  if (researcher) intents.push(researcher)
  const fieldAsk = fieldAskIntent(view, 0)
  if (fieldAsk) intents.push(fieldAsk)
  const heli = heliBeforeSign(view)
  if (heli === 'wait') {
    // The pad is already going up. Leave the letter on the desk.
  } else if (heli) intents.push(heli)
  else if (view.offer) {
    if (buyingDesk) {
      // The extra desk has to land before the letter is signed.
    } else if (view.offer.checkinOk === false) intents.push({ do: 'snooze' })
    else intents.push({ do: 'accept' })
  }
  if (view.loanBalance <= 0 && view.loans.length) {
    const richest = [...view.loans].sort((a, b) => b.principal - a.principal)[0]
    if (richest && view.cash < 80_000) intents.push({ do: 'loan', id: richest.id })
  }
  if (view.openShopBids > 0) intents.push({ do: 'lease' })
  const lab = nextLabRoom(view)
  if (lab) intents.push({ do: 'room', id: lab })
  const tree = takeTree(view, next, false)
  if (tree.intent) intents.push(tree.intent)
  if (needsDesk(view, 0)) intents.push({ do: 'desk' })
  intents.push(...upgrades)
  intents.push(...governanceIntents(view, 'greedy'))
  if (view.nextResearch) intents.push({ do: 'research', id: view.nextResearch.id })
  if (policy.expand && wantsSecondStrip(view)) {
    intents.push({ do: 'stamp', tool: 'runway' })
    return {
      intents,
      memory: {
        builtOnDay: view.day,
        stampsToday: (view.day === next.builtOnDay ? next.stampsToday : 0) + 1,
        treeOnDay: tree.memory.treeOnDay,
      },
    }
  }
  if (view.day !== next.builtOnDay || next.stampsToday < 4) {
    const built: PersonaMemory = {
      builtOnDay: view.day,
      stampsToday: view.day === next.builtOnDay ? next.stampsToday : 0,
      treeOnDay: tree.memory.treeOnDay,
    }
    const queue: Intent[] = []
    if (policy.expand) {
      const expand = expansionStamp(view, GREEDY_PRESSURE_STANDS)
      if (expand) queue.push(expand)
    }
    if (view.runway < 1) queue.push({ do: 'stamp', tool: 'runway' })
    if (view.stands < 6) queue.push({ do: 'stamp', tool: 'stand' })
    if (view.stands > 0) queue.push({ do: 'stamp', tool: 'taxi' })
    if (view.snacks < 2) queue.push({ do: 'stamp', tool: 'snack' })
    if (view.terminals > 0 && roomTotal(view, 'food') < 3) queue.push({ do: 'room', id: 'food' })
    if (view.terminals > 0 && roomTotal(view, 'souvenir') < 3) queue.push({ do: 'room', id: 'souvenir' })
    if (view.terminals > 0 && roomTotal(view, 'gate') < 3) queue.push({ do: 'room', id: 'gate' })
    if (view.cash > 30_000) queue.push({ do: 'parcel' })
    if (view.mechanics < 2 && view.cash > 12_000) queue.push({ do: 'mechanic' })
    const late = view.stands >= 6 ? lateIntent(view, 0) : null
    if (late) queue.unshift(late)
    const room = queue.length ? queue[built.stampsToday % queue.length] : undefined
    if (room) {
      intents.push(room)
      if (room.do === 'stamp' || room.do === 'stampLate') built.stampsToday += 1
    }
    return { intents, memory: built }
  }
  return { intents, memory: tree.memory }
}

const CHAOS_TOOLS: Tool[] = [
  'taxi',
  'stand',
  'stand_s',
  'snack',
  'fuel',
  'road',
  'clear',
  'helipad',
  'bags',
  'police',
  'runway',
  'terminal',
  'premade',
  'fire',
  'tower',
]

const CHAOS_ROOMS: RoomId[] = ['food', 'souvenir', 'bathroom', 'gate', 'checkin', 'security', 'lounge', ...T.labRooms]
const CHAOS_SPEEDS: Speed[] = [0, 1, 3, 5]

/** Clicks tools, letters, and rooms without a plan. */
export function chaoticIntents(
  view: AirportView,
  memory: PersonaMemory,
  rng: () => number,
): PersonaDecision {
  const next = memoryOn(view, memory)
  const intents: Intent[] = []
  const roll = rng()
  if (!view.hasLand && roll < 0.45) {
    intents.push({ do: 'buyLand', kind: rng() < 0.7 ? 'city' : 'factory' })
    return { intents, memory: next }
  }
  if (view.kitAvailable && view.cash >= view.kitCost && roll < 0.35) {
    intents.push({ do: 'starterKit' })
    return { intents, memory: next }
  }
  if (!view.fuelTerm && view.cash >= view.fuelSignCost && roll < 0.5) intents.push({ do: 'fuelTerm' })
  const ask = view.fieldAsk
  if (ask) intents.push(ask.canBuild && rng() < 0.55 ? { do: 'fieldBuild' } : { do: 'fieldDecline' })
  if (view.yearReportPending && rng() < 0.5) intents.push({ do: 'dismissYear' })
  const lab = nextLabRoom(view)
  if (lab && rng() < 0.5) {
    intents.push({ do: 'room', id: lab })
    return { intents, memory: { ...next, builtOnDay: view.day } }
  }
  const tree = takeTree(view, next, false)
  if (tree.intent && rng() < 0.45) {
    intents.push(tree.intent)
    return { intents, memory: { ...tree.memory, builtOnDay: view.day } }
  }
  const upgrades = hallBuy(view, 0)
  if (upgrades.length > 0 && rng() < 0.8) {
    intents.push(...upgrades)
    return { intents, memory: { ...next, builtOnDay: view.day } }
  }
  const governance = governanceIntents(view, 'chaotic')
  if (governance.length > 0 && rng() < 0.5) intents.push(...governance)
  if (view.fieldLevel >= 8) {
    const late = lateIntent(view, 0)
    if (late && rng() < 0.35) {
      intents.push(late)
      return { intents, memory: { ...next, builtOnDay: view.day } }
    }
  }
  const kind = Math.floor(rng() * 8)
  if (kind === 0 && view.offer) {
    const heli = heliBeforeSign(view)
    if (heli === 'wait') {
      // The pad is already going up. Leave the letter on the desk.
    } else if (heli) intents.push(heli)
    else {
      const pick = rng()
      intents.push({ do: pick < 0.4 ? 'accept' : pick < 0.7 ? 'walk' : 'snooze' })
    }
  } else if (kind === 1) {
    const tool = CHAOS_TOOLS[Math.floor(rng() * CHAOS_TOOLS.length)] ?? 'taxi'
    const cell: Vec = {
      c: Math.floor(rng() * SIZE),
      r: Math.floor(rng() * SIZE),
    }
    intents.push({ do: 'click', tool, cell })
  } else if (kind === 2 && view.terminals > 0) {
    const id = CHAOS_ROOMS[Math.floor(rng() * CHAOS_ROOMS.length)] ?? 'food'
    intents.push({ do: 'room', id })
  } else if (kind === 3 && view.loans.length && view.loanBalance <= 0 && rng() < 0.5) {
    const loan = view.loans[Math.floor(rng() * view.loans.length)]
    if (loan) intents.push({ do: 'loan', id: loan.id })
  } else if (kind === 4) {
    intents.push({ do: 'speed', speed: CHAOS_SPEEDS[Math.floor(rng() * CHAOS_SPEEDS.length)] ?? 5 })
  } else if (kind === 5 && view.openShopBids > 0 && rng() < 0.6) {
    intents.push({ do: 'lease' })
  } else if (kind === 6) {
    if (rng() < 0.5) intents.push({ do: 'janitor' })
    else intents.push({ do: 'stamp', tool: CHAOS_TOOLS[Math.floor(rng() * 5)] ?? 'taxi' })
  } else if (kind === 7 && needsDesk(view, 0)) {
    intents.push({ do: 'desk' })
  } else if (!view.hasLand) {
    intents.push({ do: 'buyLand', kind: 'city' })
  } else {
    intents.push({ do: 'nothing' })
  }
  return { intents, memory: { ...next, builtOnDay: view.day } }
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

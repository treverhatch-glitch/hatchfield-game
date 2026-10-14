import { ROOMS } from '../game/catalog.ts'
import type { RoomId, Speed, Tool, Vec } from '../game/types.ts'
import { SIZE } from '../game/types.ts'
import { PLAYTEST_TUNING as T } from './tuning.ts'
import type { AirportView, Intent, PersonaDecision, PersonaMemory } from './types.ts'

export function freshMemory(): PersonaMemory {
  return { builtOnDay: -1, stampsToday: 0 }
}

function memoryOn(view: AirportView, memory: PersonaMemory): PersonaMemory {
  if (view.day === memory.builtOnDay) return memory
  return { builtOnDay: memory.builtOnDay, stampsToday: 0 }
}

function roomTotal(view: AirportView, id: RoomId): number {
  return view.rooms[id] ?? 0
}

function roomCost(id: RoomId): number {
  return ROOMS.find((room) => room.id === id)?.cost ?? Number.POSITIVE_INFINITY
}

/** Next lab room, once the operations trickle has banked a point and cash covers it. */
function nextLabRoom(view: AirportView): RoomId | null {
  if (view.wave3Points < 1 || view.terminals < 1) return null
  for (const id of T.labRooms) {
    if (roomTotal(view, id) < 1 && view.cash >= roomCost(id)) return id
  }
  return null
}

/** Keeps a cash buffer, signs letters that already pass, and adds one piece a day. */
export function carefulIntents(view: AirportView, memory: PersonaMemory): PersonaDecision {
  const next = memoryOn(view, memory)
  const intents: Intent[] = []
  if (view.yearReportPending) intents.push({ do: 'dismissYear' })
  if (!view.hasLand) {
    intents.push({ do: 'buyLand', kind: 'city' })
    return { intents, memory: next }
  }
  if (view.kitAvailable && view.cash >= view.kitCost) {
    intents.push({ do: 'starterKit' })
    return { intents, memory: next }
  }
  if (view.offer) {
    if (view.offer.met) intents.push({ do: 'accept' })
    else intents.push({ do: 'snooze' })
  }
  if (view.openShopBids > 0 && view.leasedShops < view.shopUnits) {
    intents.push({ do: 'lease' })
  }
  if (view.satisfaction != null && view.satisfaction < 45 && view.janitors < 2 && view.cash > 8_000) {
    intents.push({ do: 'janitor' })
  }
  const lab = nextLabRoom(view)
  if (lab) {
    intents.push({ do: 'room', id: lab })
    return { intents, memory: { builtOnDay: view.day, stampsToday: next.stampsToday } }
  }
  if (view.day === next.builtOnDay) return { intents, memory: next }
  const built: PersonaMemory = { builtOnDay: view.day, stampsToday: next.stampsToday }
  if (view.cash < 5_000 && view.loanBalance <= 0) {
    const micro = view.loans.find((loan) => loan.id === 'micro')
    if (micro) intents.push({ do: 'loan', id: micro.id })
    return { intents, memory: built }
  }
  if (view.cash > 22_000 && view.stands < 4) {
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
  return { intents, memory: built }
}

/** Takes loans, signs every letter, and spends cash on stands, rooms, and shops. */
export function greedyIntents(view: AirportView, memory: PersonaMemory): PersonaDecision {
  const next = memoryOn(view, memory)
  const intents: Intent[] = []
  if (view.yearReportPending) intents.push({ do: 'dismissYear' })
  if (!view.hasLand) {
    intents.push({ do: 'buyLand', kind: 'city' })
    return { intents, memory: next }
  }
  if (view.kitAvailable && view.cash >= view.kitCost) {
    intents.push({ do: 'starterKit' })
    return { intents, memory: next }
  }
  if (view.offer) intents.push({ do: 'accept' })
  if (view.loanBalance <= 0 && view.loans.length) {
    const richest = [...view.loans].sort((a, b) => b.principal - a.principal)[0]
    if (richest && view.cash < 80_000) intents.push({ do: 'loan', id: richest.id })
  }
  if (view.openShopBids > 0) intents.push({ do: 'lease' })
  const lab = nextLabRoom(view)
  if (lab) intents.push({ do: 'room', id: lab })
  if (view.nextResearch) intents.push({ do: 'research', id: view.nextResearch.id })
  if (view.day !== next.builtOnDay || next.stampsToday < 4) {
    const built: PersonaMemory = {
      builtOnDay: view.day,
      stampsToday: view.day === next.builtOnDay ? next.stampsToday : 0,
    }
    const queue: Intent[] = []
    if (view.runway < 1) queue.push({ do: 'stamp', tool: 'runway' })
    if (view.stands < 6) queue.push({ do: 'stamp', tool: 'stand' })
    if (view.stands > 0) queue.push({ do: 'stamp', tool: 'taxi' })
    if (view.snacks < 2) queue.push({ do: 'stamp', tool: 'snack' })
    if (view.terminals > 0 && roomTotal(view, 'food') < 3) queue.push({ do: 'room', id: 'food' })
    if (view.terminals > 0 && roomTotal(view, 'souvenir') < 3) queue.push({ do: 'room', id: 'souvenir' })
    if (view.terminals > 0 && roomTotal(view, 'gate') < 3) queue.push({ do: 'room', id: 'gate' })
    if (view.cash > 30_000) queue.push({ do: 'parcel' })
    if (view.mechanics < 2 && view.cash > 12_000) queue.push({ do: 'mechanic' })
    const room = queue.length ? queue[built.stampsToday % queue.length] : undefined
    if (room) {
      intents.push(room)
      if (room.do === 'stamp') built.stampsToday += 1
    }
    return { intents, memory: built }
  }
  return { intents, memory: next }
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
  if (view.yearReportPending && rng() < 0.5) intents.push({ do: 'dismissYear' })
  const lab = nextLabRoom(view)
  if (lab && rng() < 0.5) {
    intents.push({ do: 'room', id: lab })
    return { intents, memory: { ...next, builtOnDay: view.day } }
  }
  const kind = Math.floor(rng() * 7)
  if (kind === 0 && view.offer) {
    const pick = rng()
    intents.push({ do: pick < 0.4 ? 'accept' : pick < 0.7 ? 'walk' : 'snooze' })
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

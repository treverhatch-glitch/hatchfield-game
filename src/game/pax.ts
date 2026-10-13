import { simRandom } from '../core/rng.ts'
import { astar, nearestPath, tilesOf } from './path'
import type { PaxStop, Person, TerminalFit, Tile, Vec } from './types'

function uid(): string {
  return `pax-${simRandom().toString(36).slice(2, 8)}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(simRandom() * arr.length)]
}

function stopGoal(
  stop: PaxStop,
  tiles: Tile[][],
  stand: Vec,
  fit: TerminalFit | null,
): Vec | null {
  const hall = tilesOf(tiles, 'terminal')
  const bags = tilesOf(tiles, 'bags')
  const snack = tilesOf(tiles, 'snack')
  const roads = tilesOf(tiles, 'road')
  const hallOrigin = fit?.origin ?? hall[0] ?? null

  switch (stop) {
    case 'plane':
      return stand
    case 'bags':
      return bags[0] ?? null
    case 'claim':
      return hallOrigin
    case 'food':
      return snack[0] ?? hallOrigin
    case 'shop':
      return hallOrigin
    case 'exit':
      return roads[roads.length - 1] ?? roads[0] ?? hallOrigin
    case 'checkin':
    case 'security':
    case 'gate':
      return hallOrigin
    default:
      return null
  }
}

function pathTo(tiles: Tile[][], from: Vec, to: Vec): Vec[] | null {
  return astar(tiles, from, to, 'person')
}

/** Arrival: leave the jet, hit bags/claim, maybe food/shop, then walk out the road. */
export function spawnArrivalPax(
  tiles: Tile[][],
  flightId: string,
  stand: Vec,
  fit: TerminalFit | null,
  count: number,
): Person[] {
  const out: Person[] = []
  for (let i = 0; i < count; i++) {
    const itinerary: PaxStop[] = []
    const hasBags = tilesOf(tiles, 'bags').length > 0
    const hasHall = tilesOf(tiles, 'terminal').length > 0
    if (hasBags) itinerary.push('bags')
    else if (hasHall && fit && fit.rooms.bagclaim > 0) itinerary.push('claim')
    if (simRandom() < 0.55 && (tilesOf(tiles, 'snack').length || hasHall)) itinerary.push('food')
    if (simRandom() < 0.35 && hasHall && fit && fit.rooms.souvenir > 0) itinerary.push('shop')
    itinerary.push('exit')

    const first = itinerary[0]
    const goal = stopGoal(first, tiles, stand, fit) ?? stand
    const path = pathTo(tiles, stand, goal) ?? [stand, goal]
    out.push({
      id: uid(),
      flightId,
      x: stand.c + (simRandom() - 0.5) * 0.35,
      y: stand.r + (simRandom() - 0.5) * 0.35,
      path,
      seg: 0,
      t: -simRandom() * 1.2,
      color: pick(['#d9c7a3', '#c4a574', '#8b6b4a', '#f0d9b5', '#6a4a32']),
      job: 'arrive',
      itinerary: [...itinerary],
      label: `→ ${first}`,
      wantBag: itinerary.includes('bags') || itinerary.includes('claim'),
      wantFood: itinerary.includes('food'),
      wantGift: itinerary.includes('shop'),
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }
  return out
}

/** Departure: come in from the road, through the hall, to the jet. */
export function spawnDeparturePax(
  tiles: Tile[][],
  flightId: string,
  stand: Vec,
  fit: TerminalFit | null,
  count: number,
): Person[] {
  const roads = tilesOf(tiles, 'road')
  const hall = tilesOf(tiles, 'terminal')
  const start =
    roads[0] ??
    hall[0] ??
    nearestPath(tiles, stand, roads.length ? roads : hall, 'person')?.[0] ??
    stand

  const out: Person[] = []
  for (let i = 0; i < count; i++) {
    const itinerary: PaxStop[] = []
    if (hall.length) {
      itinerary.push('checkin')
      if (fit && fit.rooms.security > 0) itinerary.push('security')
      if (simRandom() < 0.4 && fit && fit.rooms.food > 0) itinerary.push('food')
      itinerary.push('gate')
    }
    itinerary.push('plane')

    const first = itinerary[0]
    const goal = stopGoal(first, tiles, stand, fit) ?? stand
    const path = pathTo(tiles, start, goal) ?? [start, goal]
    out.push({
      id: uid(),
      flightId,
      x: start.c + (simRandom() - 0.5) * 0.4,
      y: start.r + (simRandom() - 0.5) * 0.4,
      path,
      seg: 0,
      t: -simRandom() * 2.5,
      color: pick(['#3a5a7a', '#5c4033', '#2d4739', '#7a4e2d', '#1e3a5f']),
      job: 'board',
      itinerary: [...itinerary],
      label: `→ ${first}`,
      wantBag: false,
      wantFood: itinerary.includes('food'),
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }
  return out
}

export function advancePaxItinerary(
  p: Person,
  tiles: Tile[][],
  stand: Vec | null,
  fit: TerminalFit | null,
  onSpend: (amount: number, kind: 'food' | 'gift') => void,
): 'continue' | 'done' {
  const arrivedStop = p.itinerary.shift()
  if (!arrivedStop) return 'done'

  if (arrivedStop === 'food' && !p.paidFood) {
    p.paidFood = true
    onSpend(p.job === 'board' ? 16 : 14, 'food')
  }
  if (arrivedStop === 'shop' && !p.paidGift) {
    p.paidGift = true
    onSpend(22, 'gift')
  }
  if (arrivedStop === 'exit' || (arrivedStop === 'plane' && p.job === 'board')) {
    p.label = arrivedStop === 'exit' ? 'Left airport' : 'Boarded'
    return 'done'
  }

  // Next leg
  while (p.itinerary.length) {
    const next = p.itinerary[0]
    const from = { c: Math.round(p.x), r: Math.round(p.y) }
    const goal = stand ? stopGoal(next, tiles, stand, fit) : null
    if (!goal) {
      p.itinerary.shift()
      continue
    }
    const path = pathTo(tiles, from, goal)
    if (!path || path.length < 2) {
      // Skip unreachable stop (RCT: give up on that desire)
      p.itinerary.shift()
      continue
    }
    p.path = path
    p.seg = 0
    p.t = 0
    p.label = `→ ${next}`
    p.stage += 1
    return 'continue'
  }
  return 'done'
}

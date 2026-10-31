import { simRandom } from './simRng.ts'
import { isPaxEntrance, landsideCurbs, paxPath, tilesOf } from './path'
import { SIZE, type PaxStop, type Person, type TerminalFit, type Tile, type Vec } from './types'

function uid(): string {
  return `pax-${simRandom().toString(36).slice(2, 8)}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(simRandom() * arr.length)]
}

function nearest(points: readonly Vec[], target: Vec): Vec | null {
  let best: Vec | null = null
  let bestD = Infinity
  for (const p of points) {
    const d = Math.abs(p.c - target.c) + Math.abs(p.r - target.r)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/** Door cells only — hall stops are reached by walking in, not across the roof. */
function entrancesNear(tiles: Tile[][], target: Vec): Vec | null {
  const doors = tilesOf(tiles, 'terminal').filter((p) => isPaxEntrance(tiles, p.c, p.r))
  return nearest(doors, target)
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
  const hallOrigin = fit?.origin ?? hall[0] ?? stand
  const door = entrancesNear(tiles, hallOrigin)
  const curb = nearest(landsideCurbs(tiles), hallOrigin)

  switch (stop) {
    case 'plane':
      return stand
    case 'bags':
      return bags[0] ?? null
    case 'food':
      return snack[0] ?? door
    case 'exit':
      return curb
    case 'claim':
    case 'shop':
    case 'checkin':
    case 'security':
    case 'gate':
      return door
    default:
      return null
  }
}

function pathTo(tiles: Tile[][], from: Vec, to: Vec): Vec[] | null {
  const path = paxPath(tiles, { c: Math.round(from.c), r: Math.round(from.r) }, { c: Math.round(to.c), r: Math.round(to.r) })
  if (!path || path.length < 2) return null
  return path
}

/** Stay inside the curb cell. A jitter must not push a walker off the map. */
function onCell(cell: Vec): { x: number; y: number } {
  const x = Math.min(SIZE - 1, Math.max(0, cell.c + (simRandom() - 0.5) * 0.3))
  const y = Math.min(SIZE - 1, Math.max(0, cell.r + (simRandom() - 0.5) * 0.3))
  return { x, y }
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
    const goal = stopGoal(first, tiles, stand, fit)
    const path = goal ? pathTo(tiles, stand, goal) : null
    // No chord across grass or the roof. Hold the walker off the apron if the door is blocked.
    if (!path) continue
    const at = onCell(stand)
    out.push({
      id: uid(),
      flightId,
      x: at.x,
      y: at.y,
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
  const hall = tilesOf(tiles, 'terminal')
  const hallOrigin = fit?.origin ?? hall[0] ?? stand
  const start = nearest(landsideCurbs(tiles), hallOrigin)
  if (!start) return []

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
    const goal = stopGoal(first, tiles, stand, fit)
    const path = goal ? pathTo(tiles, start, goal) : null
    if (!path) continue
    const at = onCell(start)
    out.push({
      id: uid(),
      flightId,
      x: at.x,
      y: at.y,
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

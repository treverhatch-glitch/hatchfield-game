/**
 * Design Advisor — layout notes for a custom hall, plus the prefab
 * capacity prompt when a bank is bigger than the building.
 * Prefab I–III with their scheme signs should return nothing until overloaded.
 */
import {
  AIRSIDE_NODES,
  HALL_EDGES,
  LANDSIDE_NODES,
  hallPath,
  openForGuest,
  type HallNode,
} from './guests.ts'
import {
  lookaheadDepth,
  pathClearsSecurity,
  type ZoneId,
} from './terminal.ts'

export interface AdviceCell {
  c: number
  r: number
}

export interface Advice {
  id: string
  title: string
  detail: string
  fix: string
  cells: AdviceCell[]
  /** Hall highlights use the terminal grid. Apron notes mark fuel, kitchen, or depot tiles. */
  scope?: 'hall' | 'apron'
  /** Set by the hint merge. Notes without one fall back to `advisorData.ts`. */
  severity?: 'blocker' | 'warning' | 'tip'
  /** 'layout' notes come from the Terminal Advisor; the rest are kit, litter, and ops. */
  source?: 'layout'
}

export interface AdviceFit {
  premade?: boolean
  redesigned?: boolean
  tier?: 1 | 2 | 3
  signs?: number
  capGuests?: number
  secPerMin?: number
  zones?: (ZoneId | null)[][]
  rooms: {
    checkin: number
    security: number
    gate: number
    bagclaim: number
    food: number
    souvenir: number
    bathroom: number
  }
}

export interface AdviceScheduleSlot {
  status: string
  cargo?: boolean
}

const NOMINAL_PAX = 36
const BANK_MINUTES = 3

export function bankPax(schedule: AdviceScheduleSlot[]): number {
  const live = schedule.filter(
    (s) => s.status !== 'done' && s.status !== 'cancelled' && !s.cargo,
  )
  if (!live.length) return NOMINAL_PAX
  return live.length * 40
}

function zoneCells(zones: (ZoneId | null)[][] | undefined, zone: ZoneId): AdviceCell[] {
  if (!zones) return []
  const cells: AdviceCell[] = []
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < (zones[r]?.length ?? 0); c++) {
      if (zones[r][c] === zone) cells.push({ c, r })
    }
  }
  return cells
}

function hops(from: HallNode, to: HallNode, open: Set<HallNode>, depth: number): number | null {
  const path = hallPath(from, to, open, depth)
  if (!path) return null
  return Math.max(0, path.length - 1)
}

export function securityBypassEdges(
  open: Set<HallNode>,
  edges: [HallNode, HallNode][] = HALL_EDGES,
): [HallNode, HallNode][] {
  const bad: [HallNode, HallNode][] = []
  for (const [a, b] of edges) {
    if (!open.has(a) || !open.has(b)) continue
    const land = [a, b].find(
      (n) => LANDSIDE_NODES.has(n) && n !== 'security' && n !== 'exit',
    )
    const air = [a, b].find((n) => AIRSIDE_NODES.has(n))
    if (land && air) bad.push([a, b])
  }
  return bad
}

export function adviseHall(
  fit: AdviceFit,
  open: Set<HallNode>,
  schedule: AdviceScheduleSlot[] = [],
  overloaded = false,
): Advice[] {
  const out: Advice[] = []
  const signs = fit.signs ?? 0
  const depth = lookaheadDepth(signs)
  const cleared = openForGuest(open, true)
  const locked = openForGuest(open, false)

  const toGate = hallPath('entrance', 'gate', cleared, 12)
  const unclearedGate = hallPath('entrance', 'gate', locked, 12)
  if (!open.has('gate') || !toGate) {
    out.push({
      id: 'unreachable-gate',
      title: 'Gate cannot be reached',
      detail: 'Passengers have no walk from the doors to a gate.',
      fix: 'Open a gate room and connect it past the security checkpoint.',
      cells: zoneCells(fit.zones, 'gates'),
    })
  } else if (unclearedGate && !pathClearsSecurity(unclearedGate, 'gate')) {
    out.push({
      id: 'security-bypass',
      title: 'A path skips security',
      detail: 'Someone can walk from the curb to a gate without the checkpoint.',
      fix: 'Keep the only way onto the concourse through the security lane.',
      cells: zoneCells(fit.zones, 'security'),
    })
  }

  const bypass = securityBypassEdges(open)
  if (bypass.length && !out.some((a) => a.id === 'security-bypass')) {
    out.push({
      id: 'security-bypass',
      title: 'A path skips security',
      detail: `The hall graph joins ${bypass[0][0]} straight to ${bypass[0][1]}.`,
      fix: 'Remove the shortcut. Departures go through the checkpoint.',
      cells: zoneCells(fit.zones, 'security'),
    })
  }

  const zoneNode: [ZoneId, HallNode, Set<HallNode>][] = [
    ['checkin', 'checkin', locked],
    ['security', 'security', locked],
    ['gates', 'gate', cleared],
    ['arrivals', 'claim', cleared],
    ['retail', 'food', cleared],
    ['toilets', 'bathroom', cleared],
  ]
  for (const [zone, node, view] of zoneNode) {
    const painted = zoneCells(fit.zones, zone)
    if (!painted.length) continue
    const start: HallNode = zone === 'gates' || zone === 'retail' || zone === 'arrivals' ? 'security' : 'entrance'
    const alt = zone === 'retail' && !open.has('food') ? 'shop' : node
    const reachable =
      open.has(alt) && hallPath(start, alt, view.has(start) ? view : cleared, 12)
    if (!reachable) {
      out.push({
        id: `zone-${zone}`,
        title: `${zone === 'gates' ? 'Gate side' : zone === 'arrivals' ? 'Arrivals' : zone === 'retail' ? 'Shops' : zone === 'toilets' ? 'Toilets' : zone === 'security' ? 'Security' : 'Check-in'} is unreachable`,
        detail: 'That paint has no open room a passenger can walk to.',
        fix: 'Furnish the room, or repaint the cell to match a room that exists.',
        cells: painted,
      })
    }
  }

  for (const node of open) {
    const home =
      hallPath(node, 'entrance', cleared, 12) ||
      hallPath(node, 'exit', cleared, 12) ||
      hallPath(node, 'gate', cleared, 12)
    if (!home) {
      out.push({
        id: `dead-${node}`,
        title: 'Dead end',
        detail: `Once a passenger reaches ${node}, they cannot get back to the doors, the exit, or a gate.`,
        fix: 'Reconnect that room to the concourse.',
        cells: [],
      })
      break
    }
  }

  const trips: [HallNode, HallNode, Set<HallNode>][] = [
    ['entrance', 'security', locked],
    ['security', 'gate', cleared],
    ['gate', 'claim', cleared],
    ['claim', 'exit', cleared],
    ['security', 'bathroom', cleared],
    ['security', 'food', cleared],
  ]
  if (open.has('lab_bench') && open.has('pool')) {
    trips.push(['lab_bench', 'pool', cleared])
  }
  for (const [from, to, view] of trips) {
    if (!view.has(from) || !view.has(to)) continue
    const short = hallPath(from, to, view, depth)
    const long = hallPath(from, to, view, 12)
    if (!short && long) {
      out.push({
        id: 'missing-signs',
        title: 'Not enough signs',
        detail:
          'A required walk is longer than passengers will search. They stop at the fifth junction.',
        fix: 'Add wayfinding signs. Each sign lets them look two junctions further.',
        cells: zoneCells(fit.zones, 'checkin').slice(0, 1),
      })
      break
    }
  }

  const pax = bankPax(schedule)
  const secPerMin = fit.secPerMin ?? 0
  const checkinPerMin = Math.max(0, fit.rooms.checkin) * 15
  if (secPerMin * BANK_MINUTES < pax) {
    out.push({
      id: 'undersized-security',
      title: 'Security is too small for the bank',
      detail: `About ${pax} passengers need to clear, and this checkpoint handles about ${Math.round(secPerMin)} a minute.`,
      fix: 'Add a bigger lane, or upgrade the prefab.',
      cells: zoneCells(fit.zones, 'security'),
    })
  }
  if (checkinPerMin * BANK_MINUTES < pax) {
    out.push({
      id: 'undersized-checkin',
      title: 'Check-in is too small for the bank',
      detail: `The desks clear about ${Math.round(checkinPerMin)} people a minute. The bank is about ${pax}.`,
      fix: 'Add a desk or a kiosk belt before the next wave.',
      cells: zoneCells(fit.zones, 'checkin'),
    })
  }

  const claim = hops('gate', 'claim', cleared, 12)
  if (!open.has('claim') || claim == null || claim > 4) {
    out.push({
      id: 'claim-far',
      title: 'Bag claim is too far',
      detail: 'Arrivals cannot reach claim in a short walk from the gate.',
      fix: 'Open bag claim beside the concourse, with a way out to the curb.',
      cells: zoneCells(fit.zones, 'arrivals'),
    })
  }

  const fromGate = hops('gate', 'bathroom', cleared, 12)
  const fromSec = hops('security', 'bathroom', cleared, 12)
  // Stock concourse is 4 hops from the gate and 5 from security. Warn past that.
  const tooFar =
    (fromGate != null && fromGate > 6) || (fromSec != null && fromSec > 6)
  if (!open.has('bathroom') || (fromGate == null && fromSec == null) || tooFar) {
    out.push({
      id: 'toilets-far',
      title: 'No toilets in range',
      detail: 'Passengers cannot reach a toilet within a short walk of security or the gate.',
      fix: 'Place toilets on the concourse and before security.',
      cells: zoneCells(fit.zones, 'toilets'),
    })
  }

  if (overloaded) {
    const tier = fit.tier ?? 1
    const next =
      fit.premade && !fit.redesigned && tier < 3
        ? 'Upgrade the prefab to the next tier'
        : 'Expand with a bigger security lane'
    out.unshift({
      id: 'over-capacity',
      title: 'This terminal is over capacity',
      detail:
        'Queues are longer than this building can clear. Passengers wait, flights slip, some miss the gate, and ratings fall. The paths still hold — nobody is lost.',
      fix: `${next}, expand the checkpoint, or design your own terminal.`,
      cells: zoneCells(fit.zones, 'security'),
    })
  }

  return out
}

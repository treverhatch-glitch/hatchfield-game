import { BRANCHES, DEPTH_COST, DEPTH_FIELD_LEVEL, OPS_TRICKLE_PER_SEC, ROOM_RP_PER_SEC, type ResearchBranch } from './config.ts'
import type { ResearchState, RoomCounts, TechNode } from './types.ts'

const NODE_NAMES: Record<ResearchBranch, readonly string[]> = {
  passenger: [
    'Clearer wayfinding',
    'Family corner',
    'Gate seating',
    'Self-service row',
    'Premium lane',
    'Transfer desk',
    'Quiet lounge',
    'Landmark hall',
  ],
  cargo: [
    'Belly pallet',
    'Shed lighting',
    'Night window',
    'Cold room',
    'Freighter bay',
    'Rail spur desk',
    'Express sort',
    'Cargo village',
  ],
  efficiency: [
    'Stand board',
    'Shorter turns',
    'Fuel timing',
    'Power balance',
    'Crew roster',
    'Shared ramp',
    'Predictive holds',
    'Quiet night ops',
  ],
  prestige: [
    'Livery wall',
    'Award case',
    'Ceremony pier',
    'Brand lounge',
    'Skyline lights',
    'Museum bay',
    'Flagship gate',
    'World hub mark',
  ],
}

const NODE_BLURBS: Record<ResearchBranch, readonly string[]> = {
  passenger: [
    'Passengers find the gate with fewer wrong turns.',
    'A play corner for family banks.',
    'More seats in the holdroom.',
    'Kiosks beside the staffed desks.',
    'A faster lane for premium tickets.',
    'Connections get a staffed desk.',
    'A quieter room off the pier.',
    'The late hall people photograph.',
  ],
  cargo: [
    'Passenger flights can carry a pallet.',
    'The shed can be worked after dusk.',
    'A published night window for freighters.',
    'Temperature-held freight gets a room.',
    'A bay sized for the freighter fleet.',
    'Rail intake has a desk of its own.',
    'Express sort for the night bank.',
    'The late cargo campus.',
  ],
  efficiency: [
    'The stand plan is visible to the ramp.',
    'Turns lose a little idle time.',
    'Fuel trucks leave when the jet does.',
    'Power is scheduled instead of tripped.',
    'The roster matches the bank.',
    'Airlines share a ramp window.',
    'Holds are called before they stack.',
    'Night ops without a second crew.',
  ],
  prestige: [
    'Liveries on a landside wall.',
    'A case for the yearly awards.',
    'A pier that can host a signing.',
    'A lounge with the carrier’s name.',
    'The skyline reads the field at night.',
    'A small bay for the airport’s own history.',
    'One gate dressed for the flagship.',
    'The mark of a finished hub.',
  ],
}

export function emptyResearch(): ResearchState {
  return { points: 0, carry: 0, unlocked: [], animSeconds: 0 }
}

export const TECH_NODES: readonly TechNode[] = BRANCHES.flatMap((branch) =>
  DEPTH_COST.map((cost, index): TechNode => {
    const depth = index + 1
    const id = `${branch}.${depth}`
    return {
      id,
      branch,
      depth,
      name: NODE_NAMES[branch][index]!,
      blurb: NODE_BLURBS[branch][index]!,
      cost,
      fieldLevel: DEPTH_FIELD_LEVEL[index]!,
      requires: depth === 1 ? [] : [`${branch}.${depth - 1}`],
    }
  }),
)

const NODE_BY_ID = new Map(TECH_NODES.map((node) => [node.id, node]))

export function techNode(id: string): TechNode | undefined {
  return NODE_BY_ID.get(id)
}

export function branchCost(branch: ResearchBranch): number {
  return TECH_NODES.filter((node) => node.branch === branch).reduce((sum, node) => sum + node.cost, 0)
}

export function roomRate(rooms: RoomCounts): number {
  const desk = Math.max(0, rooms.desk) * ROOM_RP_PER_SEC.desk
  const board = Math.max(0, rooms.board) * ROOM_RP_PER_SEC.board
  const machine = Math.max(0, rooms.machine) * ROOM_RP_PER_SEC.machine
  return desk + board + machine
}

/**
 * Points earned over `seconds` with no randomness.
 * The operations trickle is included even when rooms and staff are zero.
 */
export function projectResearch(input: { seconds: number; desk: number; board: number; machine: number }): {
  total: number
  ops: number
  rooms: number
} {
  const seconds = Math.max(0, input.seconds)
  const ops = OPS_TRICKLE_PER_SEC * seconds
  const rooms = roomRate(input) * seconds
  return { total: ops + rooms, ops, rooms }
}

export function accrue(
  state: ResearchState,
  seconds: number,
  rooms: RoomCounts,
  operating: boolean,
): ResearchState {
  if (!(seconds > 0) || !operating) {
    return { ...state, animSeconds: state.animSeconds + Math.max(0, seconds) }
  }
  const gained = (OPS_TRICKLE_PER_SEC + roomRate(rooms)) * seconds
  const sum = state.carry + gained
  const whole = Math.floor(sum)
  return {
    ...state,
    points: state.points + whole,
    carry: sum - whole,
    animSeconds: state.animSeconds + seconds,
  }
}

export interface BuyResult {
  ok: boolean
  why: string
  state: ResearchState
}

export function buyNode(state: ResearchState, id: string, fieldLevel: number): BuyResult {
  const node = techNode(id)
  if (!node) return { ok: false, why: 'Unknown research.', state }
  if (state.unlocked.includes(id)) return { ok: false, why: 'Already researched.', state }
  if (fieldLevel < node.fieldLevel) {
    return { ok: false, why: `Needs Field Level ${node.fieldLevel}.`, state }
  }
  for (const req of node.requires) {
    if (!state.unlocked.includes(req)) return { ok: false, why: 'Buy the previous step first.', state }
  }
  if (state.points < node.cost) return { ok: false, why: `Need ${node.cost} research points.`, state }
  return {
    ok: true,
    why: node.name,
    state: { ...state, points: state.points - node.cost, unlocked: [...state.unlocked, id] },
  }
}

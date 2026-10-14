/** Tunables for passenger movement inside a built terminal. Logic reads these, never literals. */
import { BUILD_TUNING } from '../terminalbuild/config.ts'
import type { EquipKind } from '../terminalbuild/types.ts'

export const PAXNAV_TUNING = {
  /** Nav cells per build tile edge. 4 m tiles / 4 = 1 m cells. */
  cellsPerTile: 4,
  /** Build tiles of ground kept around the plot so the curb outside a border door is on the grid. */
  marginTiles: 1,
  /** Nav cells a door opens across, centred on the tile edge (2 m door in a 4 m bay). */
  doorCells: 2,
  /** Average walk speed, m/s, and the +/- share each passenger varies by. */
  walkMps: BUILD_TUNING.walkMps,
  walkSpread: 0.10,
  /** Each walker keeps a fixed sideways offset so a crowd does not walk single file. Must stay under half a cell. */
  lateralM: 0.3,
  /** Gap between people standing in a queue line, metres. */
  queueSpacingM: 0.7,
  /** Longest marked queue line, in cells. Longer queues spill back along the approach. */
  maxLineCells: 12,
  /** Extra walk cost to step into the cells either side of a queue line (the rope). More than walking round the line, so people join at the tail. */
  ropeCost: 30,
  /** Extra walk cost to cross someone else's queue line. */
  foreignLineCost: 3,
  /** Security lanes are a stop, not a corridor: walking through someone else's lane costs this much. */
  laneCorridorCost: 200,
  /** Share of departures with a bag to drop (they visit check-in; the rest go straight to security). */
  checkinShare: 0.7,
  /** Chance a departure wants each stop after security. */
  needShare: { toilet: 0.35, food: 0.4, shop: 0.25 },
  /** Boarding opens this long before departure. */
  boardLeadSec: 30 * 60,
  /** Gate closes this long before departure. */
  gateCloseSec: BUILD_TUNING.gateCloseSec,
  /** Skip a shop/food/toilet stop when boarding opens sooner than this. */
  needSlackSec: 10 * 60,
  /** Recent waits averaged into a facility's wait time. */
  waitWindow: 20,
  /** Seconds before a passenger with nowhere to go tries again. */
  retrySec: 10,
  /** Cap on cell hops one passenger makes in one tick (guards huge dt). */
  maxHopsPerTick: 12,
  /** Wear and slow service: worn kit serves slower, same curve as the flow model. */
  wornSlowdown: BUILD_TUNING.wornSlowdown,
} as const

/** Stops a passenger can make, and the kit that serves each. */
export type StopKind = 'checkin' | 'security' | 'toilet' | 'food' | 'shop' | 'gate' | 'rebook'

export const STOP_KIT: Record<StopKind, EquipKind> = {
  checkin: 'checkin_desk',
  security: 'security_lane',
  toilet: 'toilet',
  food: 'shop_counter',
  shop: 'shop_counter',
  gate: 'gate_desk',
  // After a missed flight: an airline desk on their side of security (check-in before, any boarding desk after).
  rebook: 'checkin_desk',
}

/** Desks that can rebook a missed flight, by side of security. */
export const REBOOK_KIT: Record<'pre' | 'air', EquipKind> = { pre: 'checkin_desk', air: 'gate_desk' }

/** Optional stops after security, in the order they are tried. */
export const NEED_STOPS = ['toilet', 'food', 'shop'] as const satisfies readonly StopKind[]

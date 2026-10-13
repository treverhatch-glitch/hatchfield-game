/** Hatchfield flow system: shared types. Pure data, no runtime deps. See FLOW_SYSTEM.md. */

export const UNIT_TYPES = [
  'passenger',
  'bag',
  'cargo',
  'fuel',
  'meal',
  'supply',
  'staff',
  'vehicle',
  'power',
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

/** Info views exposed to players (CS1/CS2 style). */
export const INFO_VIEWS = ['passengers', 'bags', 'cargo', 'fuel', 'catering', 'staff', 'vehicles'] as const;
export type InfoViewId = (typeof INFO_VIEWS)[number];

export const VIEW_UNITS: Record<InfoViewId, readonly UnitType[]> = {
  passengers: ['passenger'],
  bags: ['bag'],
  cargo: ['cargo'],
  fuel: ['fuel'],
  catering: ['meal', 'supply'],
  staff: ['staff'],
  vehicles: ['vehicle'],
};

export type ChainId =
  | 'passenger'
  | 'baggage'
  | 'cargo'
  | 'fuel'
  | 'catering'
  | 'retail'
  | 'staff'
  | 'ground'
  | 'power';

export type NodeKind =
  | 'source'
  | 'sink'
  | 'entry'
  | 'checkin'
  | 'security'
  | 'bagScreen'
  | 'bagSort'
  | 'gate'
  | 'retail'
  | 'food'
  | 'toilet'
  | 'claim'
  | 'exit'
  | 'kitchen'
  | 'fuelFarm'
  | 'hydrant'
  | 'cargoShed'
  | 'stand'
  | 'staffPool'
  | 'vehiclePool'
  | 'power'
  | 'generic';

export type LinkMode = 'walk' | 'belt' | 'pipe' | 'vehicle' | 'conveyor' | 'virtual';

export type NodeState = 'ok' | 'idle' | 'starved' | 'blocked' | 'understaffed' | 'overloaded';

export interface Vec2 {
  x: number;
  y: number;
}

/** Converts one input unit into outputs (e.g. kitchen: 1 supply -> 4 meals). */
export interface Recipe {
  input: UnitType;
  output: UnitType;
  ratio: number;
}

export interface NodeDef {
  id: string;
  kind: NodeKind;
  label?: string;
  chain: ChainId;
  position?: Vec2;
  /** Units this node accepts, with buffer (queue/store) capacity. */
  accepts: Partial<Record<UnitType, number>>;
  /** Processing rate in input units per game-minute at full staff and efficiency. */
  ratePerMin: number;
  /** Optional unit conversion. Without one, units pass through unchanged. */
  recipes?: Recipe[];
  /** Output buffer capacity per output unit (default = 2x rate). */
  outCapacity?: number;
  staffRequired?: number;
  staffAssigned?: number;
  /** Multiplier from tier, research, morale, power, wear. Default 1. */
  efficiency?: number;
  /** Source nodes generate units per minute. */
  generates?: Partial<Record<UnitType, number>>;
  /** Sink nodes consume everything they process. */
  sink?: boolean;
  /** Target max wait in minutes for hotspot detection (default 10). */
  targetWaitMin?: number;
}

export interface LinkDef {
  id?: string;
  from: string;
  to: string;
  unit: UnitType;
  /** Units per game-minute the link can carry. */
  capacityPerMin: number;
  distance?: number;
  mode?: LinkMode;
  /** Travel time in game-minutes (default 0 = instant). */
  travelTimeMin?: number;
  /** Relative share when a node splits output across several links (default 1). */
  weight?: number;
}

/** Vehicle-backed link capacity: pool x payload / round trip. */
export function vehicleLinkCapacity(vehicles: number, payload: number, distance: number, speedPerMin: number, serviceMin: number): number {
  const roundTrip = (2 * distance) / Math.max(speedPerMin, 1e-9) + serviceMin;
  return roundTrip <= 0 ? 0 : (vehicles * payload) / roundTrip;
}

export interface NodeMetrics {
  id: string;
  state: NodeState;
  inRate: number;
  outRate: number;
  queue: number;
  stored: number;
  waitMin: number;
  utilization: number;
  staffing: number;
  effectiveRate: number;
  processed: number;
  lost: number;
  starvedMin: number;
  blockedMin: number;
}

export interface LinkMetrics {
  id: string;
  from: string;
  to: string;
  unit: UnitType;
  load: number;
  capacity: number;
  congestion: number;
  inTransit: number;
  moved: number;
}

export type HotspotSeverity = 'low' | 'medium' | 'high';

export interface Hotspot {
  kind: 'node' | 'link';
  id: string;
  unit?: UnitType;
  severity: HotspotSeverity;
  score: number;
  reason: string;
  rootCause?: string;
  position?: Vec2;
}

export interface ChainReport {
  chain: ChainId;
  throughput: number;
  weakestId: string | null;
  weakestKind: 'node' | 'link' | null;
  weakestScore: number;
  fix: FixSuggestion | null;
}

export interface FixSuggestion {
  build: string;
  upgrade: string;
  research: string;
}

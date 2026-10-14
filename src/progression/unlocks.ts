/**
 * Field-level gate for every buildable id.
 * FL1 and FL2 match the stamps that were already open. Later rows are the
 * milestone batches. Numbers live here so the tray, the click, and tests
 * share one table.
 */

export type BuildMenuId = 'pavement' | 'stands' | 'terminal' | 'ops' | 'landside'

export const UNLOCK_LEVEL: Readonly<Record<string, number>> = {
  // FL1 — starter apron and hall kit
  road: 1,
  taxi: 1,
  stand_s: 1,
  stand: 1,
  stand_l: 5,
  term_bus: 1,
  deice: 1,
  terminal: 1,
  premade: 1,
  snack: 1,
  bags: 1,
  belt: 1,
  fuel: 1,
  fire: 1,
  police: 1,
  cargo: 1,
  guard: 1,
  tower: 1,
  hangar: 1,
  helipad: 1,
  hotel_inn: 1,
  park_s: 1,
  park_l: 1,
  park_u: 1,
  bus: 1,
  curb_lane: 1,
  taxi_rank: 1,
  runway_short: 1,
  runway: 1,
  checkin: 1,
  security: 1,
  gate: 1,
  bagclaim: 1,
  food: 1,
  souvenir: 1,
  bagdrop: 1,
  lounge: 1,
  bathroom: 1,
  golf: 1,
  waterfall: 1,
  gaming: 1,
  dayhotel: 1,
  spa: 1,
  pool: 1,
  rdesk: 1,
  rboard: 1,
  rmachine: 1,
  entrance: 1,
  queue_rail: 1,
  checkin_belt: 1,
  kiosk: 1,
  security_small: 1,
  secure_exit: 1,
  seat_row: 1,
  boarding_desk: 1,
  claim_carousel: 1,
  bag_system: 1,
  toilet: 1,
  cafe: 1,
  wayfinding: 1,
  fast_food: 1,
  bench: 1,
  plant: 1,
  art: 1,
  info_screen: 1,
  departures_wall: 2,
  gate_pylon: 1,
  info_kiosk: 1,
  fountain: 1,
  trash_can: 1,
  bag_drop: 1,
  scanner: 1,
  wall: 1,
  newsagent: 1,

  // FL2 — already gated before this ladder
  kitchen: 2,
  depot: 2,
  checkin_express: 2,
  security_medium: 2,
  toilet_plus: 2,

  // FL3
  prefab_ii: 3,
  checkin_hall: 3,
  security_hall: 3,
  security_large: 3,
  restaurant: 3,
  travelator: 3,

  // FL4
  concourse: 4,
  substation: 4,
  jet_bridge: 4,
  stand_w: 4,
  hangar_w: 4,
  skywalk: 4,
  walkway: 4,
  mro: 4,
  nighthub: 4,

  // FL5
  runway_heavy: 5,
  code_e: 5,
  hydrant: 5,
  hangar_j: 5,
  fuel_rail: 5,
  oil: 5,
  mover: 5,
  hub_skywalk: 5,

  // FL6
  pier_ii: 6,
  tilt_tray: 6,
  hotel_biz: 6,
  xfer_bus: 6,

  // FL7
  fuel_farm_iii: 7,
  atc_approach: 7,
  park_g: 7,
  people_mover: 7,

  // FL8
  code_f: 8,
  jet_bridge_3: 8,
  satellite: 8,
  hotel_resort: 8,

  // FL9
  remote_screening: 9,
  rail: 9,

  // FL10
  prestige_landmark: 10,
}

/** Tray rows that are not already an apron tool. Costs and upkeep are $/day for upkeep. */
export interface ProgressionBuildable {
  id: string
  name: string
  menu: BuildMenuId
  /** Purchase price. Capstone mix premium is applied at buy time. */
  cost: number
  /** Operating cost per game day. */
  upkeepPerDay: number
  blurb: string
}

export const PROGRESSION_BUILDABLES: readonly ProgressionBuildable[] = [
  {
    id: 'prefab_ii',
    name: 'Prefab II',
    menu: 'terminal',
    cost: 22_000,
    upkeepPerDay: 0,
    blurb: 'Pier prefab. Raises the hall ceilings. Upkeep is on the hall bill.',
  },
  {
    id: 'checkin_hall',
    name: 'Check-in hall',
    menu: 'terminal',
    cost: 36_000,
    upkeepPerDay: 720,
    blurb: 'A dedicated check-in hall in front of the processors.',
  },
  {
    id: 'security_hall',
    name: 'Security hall',
    menu: 'terminal',
    cost: 44_000,
    upkeepPerDay: 900,
    blurb: 'A screening hall with room for more lanes.',
  },
  {
    id: 'concourse',
    name: 'Concourse',
    menu: 'terminal',
    cost: 68_000,
    upkeepPerDay: 1_080,
    blurb: 'Airside concourse between the checkpoint and the gates.',
  },
  {
    id: 'substation',
    name: 'Substation',
    menu: 'ops',
    cost: 32_000,
    upkeepPerDay: 540,
    blurb: 'Field substation for concourse and bridge power.',
  },
  {
    id: 'jet_bridge',
    name: 'Jet bridge',
    menu: 'stands',
    cost: 0,
    upkeepPerDay: 0,
    blurb: 'Arms a single jet bridge on the next stand. The stand stamp carries the price.',
  },
  {
    id: 'code_e',
    name: 'Code E stand',
    menu: 'stands',
    cost: 54_000,
    upkeepPerDay: 660,
    blurb: 'Code E hardstand for small widebodies.',
  },
  {
    id: 'hydrant',
    name: 'Hydrant pit',
    menu: 'ops',
    cost: 40_000,
    upkeepPerDay: 480,
    blurb: 'Fuel hydrant at the stand. Trucks stay on the farm.',
  },
  {
    id: 'pier_ii',
    name: 'Pier II',
    menu: 'terminal',
    cost: 96_000,
    upkeepPerDay: 1_200,
    blurb: 'Second pier. Low-cost capstone.',
  },
  {
    id: 'tilt_tray',
    name: 'Tilt-tray sort',
    menu: 'ops',
    cost: 88_000,
    upkeepPerDay: 1_080,
    blurb: 'Tilt-tray bag and cargo sort. Cargo capstone.',
  },
  {
    id: 'fuel_farm_iii',
    name: 'Fuel farm III',
    menu: 'ops',
    cost: 120_000,
    upkeepPerDay: 1_800,
    blurb: 'Third fuel farm. Holds a heavy bank.',
  },
  {
    id: 'atc_approach',
    name: 'ATC approach',
    menu: 'ops',
    cost: 75_000,
    upkeepPerDay: 900,
    blurb: 'Approach control on top of the tower.',
  },
  {
    id: 'code_f',
    name: 'Code F stand',
    menu: 'stands',
    cost: 160_000,
    upkeepPerDay: 2_100,
    blurb: 'Code F stand for the largest metal.',
  },
  {
    id: 'jet_bridge_3',
    name: 'Triple jet bridge',
    menu: 'stands',
    cost: 140_000,
    upkeepPerDay: 1_500,
    blurb: 'Three bridges on one widebody gate.',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    menu: 'terminal',
    cost: 48_000,
    upkeepPerDay: 0,
    blurb: 'Satellite prefab. Hub capstone. Hall upkeep rises with the tier.',
  },
  {
    id: 'remote_screening',
    name: 'Remote screening',
    menu: 'ops',
    cost: 110_000,
    upkeepPerDay: 1_320,
    blurb: 'Screen passengers at a remote stand before the bus.',
  },
  {
    id: 'prestige_landmark',
    name: 'Prestige landmark',
    menu: 'landside',
    cost: 220_000,
    upkeepPerDay: 2_400,
    blurb: 'Landmark hall. Luxury capstone.',
  },
]

export function unlockLevel(id: string): number {
  return UNLOCK_LEVEL[id] ?? 1
}

export function canBuild(id: string, fieldLevel: number): boolean {
  return fieldLevel >= unlockLevel(id)
}

export function progressionBuildable(id: string): ProgressionBuildable | undefined {
  return PROGRESSION_BUILDABLES.find((row) => row.id === id)
}

export function lockTip(name: string, level: number, blurb?: string): string {
  const gate = `${name} needs Field level ${level}.`
  return blurb ? `${gate} ${blurb}` : gate
}

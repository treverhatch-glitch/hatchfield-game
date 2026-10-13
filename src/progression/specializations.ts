/**
 * Specialization paths and their trees.
 *
 * Path points still arrive at Field Levels 6, 8, and 10. Paths mix: the
 * first capstone is list price, each later path's capstone costs more, and
 * each path after the first adds site-wide upkeep.
 *
 * Tree points are separate. They drip from FL6 through FL10 and then one
 * per prestige star, so a focused late-game field can buy nearly one tree
 * and cannot buy two.
 */

export const SPEC_POINT_LEVELS = [6, 8, 10] as const

/** Added to a capstone's price when its path was not the first one chosen. */
export const EXTRA_PATH_CAPSTONE_PREMIUM = 0.5

/** Site-wide upkeep added for each path after the first. */
export const EXTRA_PATH_UPKEEP = 0.1

export type SpecPath = 'hub' | 'low-cost' | 'cargo' | 'luxury'

export interface SpecPathDef {
  id: SpecPath
  label: string
  blurb: string
  /** Buildable id whose price takes the mix premium. */
  capstoneId: string
}

export const SPEC_PATHS: readonly SpecPathDef[] = [
  {
    id: 'hub',
    label: 'Hub',
    blurb: 'Transfer banks and a satellite pier.',
    capstoneId: 'satellite',
  },
  {
    id: 'low-cost',
    label: 'Low-cost',
    blurb: 'Fast turns on a second pier.',
    capstoneId: 'pier_ii',
  },
  {
    id: 'cargo',
    label: 'Cargo',
    blurb: 'Night sort with a tilt-tray.',
    capstoneId: 'tilt_tray',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'A landmark and a quieter landside.',
    capstoneId: 'prestige_landmark',
  },
]

const PATH_IDS = new Set<string>(SPEC_PATHS.map((p) => p.id))

export function isSpecPath(id: string): id is SpecPath {
  return PATH_IDS.has(id)
}

export function specPath(id: string): SpecPathDef | undefined {
  return SPEC_PATHS.find((p) => p.id === id)
}

/** Points earned at this field level (0–3). */
export function specPointsForLevel(level: number): number {
  return SPEC_POINT_LEVELS.filter((lv) => level >= lv).length
}

/**
 * Capstone cash. The first chosen path pays `base`. Each path chosen after
 * that pays base × (1 + EXTRA_PATH_CAPSTONE_PREMIUM). An unchosen path stays
 * at `base` until it is selected.
 */
export function capstoneCost(base: number, paths: readonly string[], capstoneId: string): number {
  const path = SPEC_PATHS.find((p) => p.capstoneId === capstoneId)
  if (!path) return Math.round(base)
  return specCashCost(base, paths, path.id)
}

/**
 * Cash for a tree capstone. Same rule as building capstones: the first
 * chosen path pays list price, every later path pays the mix premium.
 */
export function specCashCost(base: number, paths: readonly string[], pathId: string): number {
  if (base <= 0) return 0
  const index = paths.indexOf(pathId)
  if (index <= 0) return Math.round(base)
  return Math.round(base * (1 + EXTRA_PATH_CAPSTONE_PREMIUM))
}

/** 1 path = 1. Each path after the first adds EXTRA_PATH_UPKEEP. */
export function siteUpkeepMultiplier(pathCount: number): number {
  const extra = Math.max(0, pathCount - 1)
  return 1 + extra * EXTRA_PATH_UPKEEP
}

/**
 * Tree points. FL6–FL9 grant one each, FL10 grants two, and each prestige
 * star grants one more. FL10 is 6. P5 is 11. One tree costs 12.
 */
export function treePointsForProgress(level: number, stars: number): number {
  let n = 0
  if (level >= 6) n += 1
  if (level >= 7) n += 1
  if (level >= 8) n += 1
  if (level >= 9) n += 1
  if (level >= 10) n += 2
  n += Math.max(0, stars)
  return n
}

/** Numeric perk. Multipliers stack. Missing fields mean "no change". */
export interface SpecEffect {
  hubSpacing?: number
  hubExtraSlots?: number
  otherSpacing?: number
  interline?: boolean
  connectSlackSec?: number
  missHeat?: number
  scheduleCap?: number
  inboundBonus?: number
  satelliteFeed?: boolean
  satelliteInbound?: number
  hubHeatNeedDelta?: number
  hubBanDelta?: number
  hubBeltHeat?: number
  otherBeltHeat?: number
  lowCostFee?: number
  lccExtraSlots?: number
  premiumFee?: number
  paxLanding?: number
  turnaround?: number
  nightTurn?: number
  dayTurn?: number
  nightCargoFee?: number
  dayCargoFee?: number
  cargoCap?: number
  cargoTonnage?: number
  cargoVolumeFee?: number
  nightHubBias?: number
  nightSlots?: number
  nightHub?: boolean
  railCap?: number
  premiumScreen?: number
  standardScreen?: number
  loungeYield?: number
  tenantYield?: number
  tenantPref?: number
  budgetRetail?: number
}

export interface SpecNode {
  id: string
  path: SpecPath
  name: string
  /** Tree points. */
  cost: number
  upkeepPerDay: number
  /** Cash at buy. Capstone nodes take the mix premium. */
  cash: number
  capstone: boolean
  requires: readonly string[]
  /** Column in the slim tree, left to right. */
  col: number
  perk: string
  tradeoff: string
  effect: SpecEffect
}

export const SPEC_NODES: readonly SpecNode[] = [
  // Hub — connections and belt connectivity.
  {
    id: 'hub_bank',
    path: 'hub',
    name: 'Wave clock',
    cost: 1,
    upkeepPerDay: 420,
    cash: 0,
    capstone: false,
    requires: [],
    col: 0,
    perk: 'Hub banks sit closer and add a departure.',
    tradeoff: 'Other carriers are pushed apart. Coordinator $420/day.',
    effect: { hubSpacing: 0.86, hubExtraSlots: 1, otherSpacing: 1.1 },
  },
  {
    id: 'hub_mct',
    path: 'hub',
    name: 'Short connect',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['hub_bank'],
    col: 1,
    perk: 'A connection still holds through pushback.',
    tradeoff: 'A missed connection hits Standing harder.',
    effect: { connectSlackSec: 8, missHeat: 1.4 },
  },
  {
    id: 'hub_feed',
    path: 'hub',
    name: 'Spoke feed',
    cost: 1,
    upkeepPerDay: 640,
    cash: 0,
    capstone: false,
    requires: ['hub_bank'],
    col: 1,
    perk: 'Each hub bank gains another departure.',
    tradeoff: 'The timetable loses a slot. Feed desk $640/day.',
    effect: { hubExtraSlots: 1, scheduleCap: -1 },
  },
  {
    id: 'hub_interline',
    path: 'hub',
    name: 'Interline desk',
    cost: 1,
    upkeepPerDay: 980,
    cash: 0,
    capstone: false,
    requires: ['hub_mct'],
    col: 2,
    perk: 'Bags can connect onto any signed passenger airline.',
    tradeoff: 'The interline desk costs $980/day.',
    effect: { interline: true },
  },
  {
    id: 'hub_dual',
    path: 'hub',
    name: 'Dual wave',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['hub_feed'],
    col: 2,
    perk: 'The second wave tightens hub spacing again.',
    tradeoff: 'Passenger landing fees fall 7% between the peaks.',
    effect: { hubSpacing: 0.9, paxLanding: 0.93 },
  },
  {
    id: 'hub_belt',
    path: 'hub',
    name: 'Belt priority',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['hub_interline'],
    col: 3,
    perk: 'Hub flights shrug off a broken belt, and the tower takes one more inbound.',
    tradeoff: 'A broken belt hits non-hub carriers harder.',
    effect: { hubBeltHeat: 0.5, otherBeltHeat: 1.5, inboundBonus: 1 },
  },
  {
    id: 'hub_recovery',
    path: 'hub',
    name: 'Wave recovery',
    cost: 2,
    upkeepPerDay: 1500,
    cash: 0,
    capstone: false,
    requires: ['hub_dual'],
    col: 3,
    perk: 'A flight still on the taxiway counts as a made connection.',
    tradeoff: 'The recovery crew costs $1,500/day.',
    effect: { connectSlackSec: 16 },
  },
  {
    id: 'hub_satellite',
    path: 'hub',
    name: 'Satellite feed',
    cost: 2,
    upkeepPerDay: 2100,
    cash: 18_000,
    capstone: true,
    requires: ['hub_belt', 'hub_recovery'],
    col: 4,
    perk: 'A live satellite adds one more approach.',
    tradeoff: 'Feed crew $2,100/day. Later paths pay the capstone premium. No satellite, no approach.',
    effect: { satelliteFeed: true, satelliteInbound: 1 },
  },
  {
    id: 'hub_plaque',
    path: 'hub',
    name: 'Plaque standard',
    cost: 2,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['hub_recovery'],
    col: 4,
    perk: 'Hub plaque letters arrive at a lower Standing.',
    tradeoff: 'Hub carriers ban you sooner when Standing slips.',
    effect: { hubHeatNeedDelta: -8, hubBanDelta: 6 },
  },

  // Low-cost — fees and turnaround speed.
  {
    id: 'lcc_quick',
    path: 'low-cost',
    name: 'Quick turn',
    cost: 1,
    upkeepPerDay: 780,
    cash: 0,
    capstone: false,
    requires: [],
    col: 0,
    perk: 'Turns run 12% shorter.',
    tradeoff: 'The ramp crew costs $780/day.',
    effect: { turnaround: 0.88 },
  },
  {
    id: 'lcc_fee',
    path: 'low-cost',
    name: 'Fee waiver',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lcc_quick'],
    col: 1,
    perk: 'Low-cost carriers add a slot to every bank.',
    tradeoff: 'Their landing fee is 15% lower.',
    effect: { lowCostFee: 0.85, lccExtraSlots: 1 },
  },
  {
    id: 'lcc_remote',
    path: 'low-cost',
    name: 'Remote stand',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lcc_quick'],
    col: 1,
    perk: 'Remote turns shed another 6%.',
    tradeoff: 'The day bank is 8% slower — the crew is on the night shift.',
    effect: { turnaround: 0.94, dayTurn: 1.08 },
  },
  {
    id: 'lcc_bus',
    path: 'low-cost',
    name: 'Bus turn',
    cost: 1,
    upkeepPerDay: 460,
    cash: 0,
    capstone: false,
    requires: ['lcc_fee'],
    col: 2,
    perk: 'Night turns are 15% faster.',
    tradeoff: 'Night shift $460/day, and budget passengers spend 20% less in the hall.',
    effect: { nightTurn: 0.85, budgetRetail: 0.8 },
  },
  {
    id: 'lcc_yield',
    path: 'low-cost',
    name: 'Thin yield',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lcc_remote'],
    col: 2,
    perk: 'Another low-cost slot joins the bank.',
    tradeoff: 'Full-service landing fees drop 8% — they dislike the product.',
    effect: { lccExtraSlots: 1, premiumFee: 0.92 },
  },
  {
    id: 'lcc_bundle',
    path: 'low-cost',
    name: 'Bare bundle',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lcc_bus'],
    col: 3,
    perk: 'Low-cost landing fees drop another 8%.',
    tradeoff: 'Tenant counters earn 12% less.',
    effect: { lowCostFee: 0.92, tenantYield: 0.88 },
  },
  {
    id: 'lcc_tight',
    path: 'low-cost',
    name: '25-minute turn',
    cost: 2,
    upkeepPerDay: 1600,
    cash: 0,
    capstone: false,
    requires: ['lcc_yield'],
    col: 3,
    perk: 'Turns shed another 14%.',
    tradeoff: 'Tight turns miss more connections. Crew $1,600/day.',
    effect: { turnaround: 0.86, missHeat: 1.35 },
  },
  {
    id: 'lcc_pier',
    path: 'low-cost',
    name: 'Second pier',
    cost: 2,
    upkeepPerDay: 1900,
    cash: 14_000,
    capstone: true,
    requires: ['lcc_bundle', 'lcc_tight'],
    col: 4,
    perk: 'The second pier adds a low-cost slot.',
    tradeoff: 'Pier crew $1,900/day. Later paths pay the capstone premium. Passenger landings pay 5% less.',
    effect: { lccExtraSlots: 1, paxLanding: 0.95 },
  },
  {
    id: 'lcc_walk',
    path: 'low-cost',
    name: 'Walk-on',
    cost: 2,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lcc_tight'],
    col: 4,
    perk: 'Stairs boarding cuts another 8% off the turn.',
    tradeoff: 'Standard security is 15% slower — the bodies are on the ramp.',
    effect: { turnaround: 0.92, standardScreen: 1.15 },
  },

  // Cargo — night hub and tonnage.
  {
    id: 'cargo_apron',
    path: 'cargo',
    name: 'Freight apron',
    cost: 1,
    upkeepPerDay: 520,
    cash: 0,
    capstone: false,
    requires: [],
    col: 0,
    perk: 'The warehouse holds 18% more tonnes.',
    tradeoff: 'Shed crew $520/day.',
    effect: { cargoCap: 1.18 },
  },
  {
    id: 'cargo_night',
    path: 'cargo',
    name: 'Night waiver',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['cargo_apron'],
    col: 1,
    perk: 'Night freighter handling pays 25% more, and a night slot opens.',
    tradeoff: 'Day freighters pay 12% less.',
    effect: { nightCargoFee: 1.25, dayCargoFee: 0.88, nightSlots: 1, nightHub: true },
  },
  {
    id: 'cargo_sort',
    path: 'cargo',
    name: 'Sort window',
    cost: 1,
    upkeepPerDay: 740,
    cash: 0,
    capstone: false,
    requires: ['cargo_apron'],
    col: 1,
    perk: 'Volume windows pay 18% more.',
    tradeoff: 'They ask for 22% more tonnes. Sort crew $740/day.',
    effect: { cargoVolumeFee: 1.18, cargoTonnage: 1.22 },
  },
  {
    id: 'cargo_uld',
    path: 'cargo',
    name: 'ULD dock',
    cost: 1,
    upkeepPerDay: 880,
    cash: 0,
    capstone: false,
    requires: ['cargo_night'],
    col: 2,
    perk: 'The warehouse takes another 12% tonnes.',
    tradeoff: 'ULD crew $880/day.',
    effect: { cargoCap: 1.12 },
  },
  {
    id: 'cargo_cold',
    path: 'cargo',
    name: 'Cold chain',
    cost: 1,
    upkeepPerDay: 1200,
    cash: 0,
    capstone: false,
    requires: ['cargo_sort'],
    col: 2,
    perk: 'Night handling rises, and the night bank is called more often.',
    tradeoff: 'Cold rooms cost $1,200/day.',
    effect: { nightCargoFee: 1.12, nightHubBias: 0.2, nightSlots: 1 },
  },
  {
    id: 'cargo_quiet',
    path: 'cargo',
    name: 'Quiet hours',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['cargo_uld'],
    col: 3,
    perk: 'After dark the tower prefers a freighter.',
    tradeoff: 'Day handling falls another 10%.',
    effect: { nightHubBias: 0.22, dayCargoFee: 0.9, nightHub: true },
  },
  {
    id: 'cargo_heavy',
    path: 'cargo',
    name: 'Heavy tonnes',
    cost: 2,
    upkeepPerDay: 1500,
    cash: 0,
    capstone: false,
    requires: ['cargo_cold'],
    col: 3,
    perk: 'Warehouse tonnes rise again.',
    tradeoff: 'Day freighters pay 15% less. Heavy crew $1,500/day.',
    effect: { cargoCap: 1.16, dayCargoFee: 0.85 },
  },
  {
    id: 'cargo_bank',
    path: 'cargo',
    name: 'Night hub',
    cost: 2,
    upkeepPerDay: 2000,
    cash: 16_000,
    capstone: true,
    requires: ['cargo_quiet', 'cargo_heavy'],
    col: 4,
    perk: 'The night hub pays 30% more and opens another night slot.',
    tradeoff: 'Day yield drops again. Bank crew $2,000/day. Later paths pay the capstone premium.',
    effect: { nightCargoFee: 1.3, nightSlots: 1, dayCargoFee: 0.86, nightHub: true },
  },
  {
    id: 'cargo_rail',
    path: 'cargo',
    name: 'Rail tonnes',
    cost: 2,
    upkeepPerDay: 1100,
    cash: 0,
    capstone: false,
    requires: ['cargo_heavy'],
    col: 4,
    perk: 'A live rail link adds warehouse tonnes.',
    tradeoff: 'The timetable loses a slot. Rail crew $1,100/day. No rail, no tonnes.',
    effect: { railCap: 1.15, scheduleCap: -1 },
  },

  // Luxury — premium screening, lounges, tenant quality.
  {
    id: 'lux_lane',
    path: 'luxury',
    name: 'Premium lane',
    cost: 1,
    upkeepPerDay: 720,
    cash: 0,
    capstone: false,
    requires: [],
    col: 0,
    perk: 'Premium screening is 25% faster.',
    tradeoff: 'The standard lane is 12% slower. Lane crew $720/day.',
    effect: { premiumScreen: 0.75, standardScreen: 1.12 },
  },
  {
    id: 'lux_lounge',
    path: 'luxury',
    name: 'Lounge check',
    cost: 1,
    upkeepPerDay: 860,
    cash: 0,
    capstone: false,
    requires: ['lux_lane'],
    col: 1,
    perk: 'Lounge checks are 30% richer.',
    tradeoff: 'Guests get pickier at every counter. Lounge $860/day.',
    effect: { loungeYield: 1.3, tenantPref: 0.06 },
  },
  {
    id: 'lux_tenant',
    path: 'luxury',
    name: 'Tenant grade',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lux_lane'],
    col: 1,
    perk: 'Food and shop prices rise 18%.',
    tradeoff: 'More guests walk past — the preference bar is higher.',
    effect: { tenantYield: 1.18, tenantPref: 0.08 },
  },
  {
    id: 'lux_screen',
    path: 'luxury',
    name: 'Second screen',
    cost: 1,
    upkeepPerDay: 640,
    cash: 0,
    capstone: false,
    requires: ['lux_lounge'],
    col: 2,
    perk: 'Premium screening sheds another 15%.',
    tradeoff: 'Standard screening slows again. Screeners $640/day.',
    effect: { premiumScreen: 0.85, standardScreen: 1.1 },
  },
  {
    id: 'lux_quiet',
    path: 'luxury',
    name: 'Quiet hall',
    cost: 1,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lux_tenant'],
    col: 2,
    perk: 'Lounges charge more for the calm.',
    tradeoff: 'Budget passengers spend 25% less.',
    effect: { loungeYield: 1.18, budgetRetail: 0.75 },
  },
  {
    id: 'lux_brand',
    path: 'luxury',
    name: 'House brand',
    cost: 1,
    upkeepPerDay: 1100,
    cash: 0,
    capstone: false,
    requires: ['lux_screen'],
    col: 3,
    perk: 'Branded lounges and tenants both earn more.',
    tradeoff: 'The host crew costs $1,100/day.',
    effect: { loungeYield: 1.2, tenantYield: 1.12 },
  },
  {
    id: 'lux_host',
    path: 'luxury',
    name: 'Host standard',
    cost: 2,
    upkeepPerDay: 0,
    cash: 0,
    capstone: false,
    requires: ['lux_quiet'],
    col: 3,
    perk: 'Full-service landings pay 8% more.',
    tradeoff: 'Low-cost landings pay 10% less — they avoid the product.',
    effect: { premiumFee: 1.08, lowCostFee: 0.9 },
  },
  {
    id: 'lux_landmark',
    path: 'luxury',
    name: 'Landmark hall',
    cost: 2,
    upkeepPerDay: 2400,
    cash: 22_000,
    capstone: true,
    requires: ['lux_brand', 'lux_host'],
    col: 4,
    perk: 'The landmark lifts lounges, tenants, and premium screening.',
    tradeoff: 'Standard screening slows. Crew $2,400/day. Later paths pay the capstone premium.',
    effect: { loungeYield: 1.15, tenantYield: 1.12, premiumScreen: 0.9, standardScreen: 1.08 },
  },
  {
    id: 'lux_suite',
    path: 'luxury',
    name: 'Suite lounge',
    cost: 2,
    upkeepPerDay: 1700,
    cash: 0,
    capstone: false,
    requires: ['lux_host'],
    col: 4,
    perk: 'Suite lounges charge 25% more.',
    tradeoff: 'The preference bar rises again. The suite costs $1,700/day.',
    effect: { loungeYield: 1.25, tenantPref: 0.05 },
  },
]

const NODE_IDS = new Set<string>(SPEC_NODES.map((n) => n.id))

export function isSpecNode(id: string): boolean {
  return NODE_IDS.has(id)
}

export function specNode(id: string): SpecNode | undefined {
  return SPEC_NODES.find((n) => n.id === id)
}

export function nodesForPath(path: SpecPath): SpecNode[] {
  return SPEC_NODES.filter((n) => n.path === path)
}

export function specColumns(path: SpecPath): SpecNode[][] {
  const nodes = nodesForPath(path)
  const cols = new Map<number, SpecNode[]>()
  for (const node of nodes) {
    const list = cols.get(node.col) ?? []
    list.push(node)
    cols.set(node.col, list)
  }
  return [...cols.keys()]
    .sort((a, b) => a - b)
    .map((col) => cols.get(col) ?? [])
}

export interface SpecMods {
  hubSpacing: number
  hubExtraSlots: number
  otherSpacing: number
  interline: boolean
  connectSlackSec: number
  missHeat: number
  scheduleCap: number
  inboundBonus: number
  satelliteFeed: boolean
  satelliteInbound: number
  hubHeatNeedDelta: number
  hubBanDelta: number
  hubBeltHeat: number
  otherBeltHeat: number
  lowCostFee: number
  lccExtraSlots: number
  premiumFee: number
  paxLanding: number
  turnaround: number
  nightTurn: number
  dayTurn: number
  nightCargoFee: number
  dayCargoFee: number
  cargoCap: number
  cargoTonnage: number
  cargoVolumeFee: number
  nightHubBias: number
  nightSlots: number
  nightHub: boolean
  railCap: number
  premiumScreen: number
  standardScreen: number
  loungeYield: number
  tenantYield: number
  tenantPref: number
  budgetRetail: number
  upkeepPerDay: number
}

export const BASE_SPEC_MODS: SpecMods = {
  hubSpacing: 1,
  hubExtraSlots: 0,
  otherSpacing: 1,
  interline: false,
  connectSlackSec: 0,
  missHeat: 1,
  scheduleCap: 0,
  inboundBonus: 0,
  satelliteFeed: false,
  satelliteInbound: 0,
  hubHeatNeedDelta: 0,
  hubBanDelta: 0,
  hubBeltHeat: 1,
  otherBeltHeat: 1,
  lowCostFee: 1,
  lccExtraSlots: 0,
  premiumFee: 1,
  paxLanding: 1,
  turnaround: 1,
  nightTurn: 1,
  dayTurn: 1,
  nightCargoFee: 1,
  dayCargoFee: 1,
  cargoCap: 1,
  cargoTonnage: 1,
  cargoVolumeFee: 1,
  nightHubBias: 0,
  nightSlots: 0,
  nightHub: false,
  railCap: 1,
  premiumScreen: 1,
  standardScreen: 1,
  loungeYield: 1,
  tenantYield: 1,
  tenantPref: 0,
  budgetRetail: 1,
  upkeepPerDay: 0,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Fold owned nodes into one modifier block. Unknown ids are ignored. */
export function foldSpecMods(owned: readonly string[]): SpecMods {
  const mods: SpecMods = { ...BASE_SPEC_MODS }
  for (const id of owned) {
    const node = specNode(id)
    if (!node) continue
    const e = node.effect
    if (e.hubSpacing) mods.hubSpacing *= e.hubSpacing
    if (e.hubExtraSlots) mods.hubExtraSlots += e.hubExtraSlots
    if (e.otherSpacing) mods.otherSpacing *= e.otherSpacing
    if (e.interline) mods.interline = true
    if (e.connectSlackSec) mods.connectSlackSec += e.connectSlackSec
    if (e.missHeat) mods.missHeat *= e.missHeat
    if (e.scheduleCap) mods.scheduleCap += e.scheduleCap
    if (e.inboundBonus) mods.inboundBonus += e.inboundBonus
    if (e.satelliteFeed) mods.satelliteFeed = true
    if (e.satelliteInbound) mods.satelliteInbound += e.satelliteInbound
    if (e.hubHeatNeedDelta) mods.hubHeatNeedDelta += e.hubHeatNeedDelta
    if (e.hubBanDelta) mods.hubBanDelta += e.hubBanDelta
    if (e.hubBeltHeat) mods.hubBeltHeat *= e.hubBeltHeat
    if (e.otherBeltHeat) mods.otherBeltHeat *= e.otherBeltHeat
    if (e.lowCostFee) mods.lowCostFee *= e.lowCostFee
    if (e.lccExtraSlots) mods.lccExtraSlots += e.lccExtraSlots
    if (e.premiumFee) mods.premiumFee *= e.premiumFee
    if (e.paxLanding) mods.paxLanding *= e.paxLanding
    if (e.turnaround) mods.turnaround *= e.turnaround
    if (e.nightTurn) mods.nightTurn *= e.nightTurn
    if (e.dayTurn) mods.dayTurn *= e.dayTurn
    if (e.nightCargoFee) mods.nightCargoFee *= e.nightCargoFee
    if (e.dayCargoFee) mods.dayCargoFee *= e.dayCargoFee
    if (e.cargoCap) mods.cargoCap *= e.cargoCap
    if (e.cargoTonnage) mods.cargoTonnage *= e.cargoTonnage
    if (e.cargoVolumeFee) mods.cargoVolumeFee *= e.cargoVolumeFee
    if (e.nightHubBias) mods.nightHubBias += e.nightHubBias
    if (e.nightSlots) mods.nightSlots += e.nightSlots
    if (e.nightHub) mods.nightHub = true
    if (e.railCap) mods.railCap *= e.railCap
    if (e.premiumScreen) mods.premiumScreen *= e.premiumScreen
    if (e.standardScreen) mods.standardScreen *= e.standardScreen
    if (e.loungeYield) mods.loungeYield *= e.loungeYield
    if (e.tenantYield) mods.tenantYield *= e.tenantYield
    if (e.tenantPref) mods.tenantPref += e.tenantPref
    if (e.budgetRetail) mods.budgetRetail *= e.budgetRetail
    mods.upkeepPerDay += node.upkeepPerDay
  }
  mods.hubSpacing = clamp(mods.hubSpacing, 0.55, 1.4)
  mods.otherSpacing = clamp(mods.otherSpacing, 0.8, 1.5)
  mods.hubExtraSlots = clamp(mods.hubExtraSlots, 0, 4)
  mods.lccExtraSlots = clamp(mods.lccExtraSlots, 0, 4)
  mods.connectSlackSec = clamp(mods.connectSlackSec, 0, 40)
  mods.missHeat = clamp(mods.missHeat, 1, 2.2)
  mods.scheduleCap = clamp(mods.scheduleCap, -4, 4)
  mods.inboundBonus = clamp(mods.inboundBonus, 0, 3)
  mods.satelliteInbound = clamp(mods.satelliteInbound, 0, 2)
  mods.hubHeatNeedDelta = clamp(mods.hubHeatNeedDelta, -20, 0)
  mods.hubBanDelta = clamp(mods.hubBanDelta, 0, 12)
  mods.hubBeltHeat = clamp(mods.hubBeltHeat, 0.4, 1.8)
  mods.otherBeltHeat = clamp(mods.otherBeltHeat, 0.4, 1.8)
  mods.lowCostFee = clamp(mods.lowCostFee, 0.55, 1.45)
  mods.premiumFee = clamp(mods.premiumFee, 0.55, 1.45)
  mods.paxLanding = clamp(mods.paxLanding, 0.55, 1.45)
  mods.turnaround = clamp(mods.turnaround, 0.6, 1.2)
  mods.nightTurn = clamp(mods.nightTurn, 0.75, 1.2)
  mods.dayTurn = clamp(mods.dayTurn, 0.75, 1.2)
  mods.nightCargoFee = clamp(mods.nightCargoFee, 0.55, 2.2)
  mods.dayCargoFee = clamp(mods.dayCargoFee, 0.55, 1.45)
  mods.cargoCap = clamp(mods.cargoCap, 1, 2.4)
  mods.cargoTonnage = clamp(mods.cargoTonnage, 1, 2)
  mods.cargoVolumeFee = clamp(mods.cargoVolumeFee, 1, 1.8)
  mods.nightHubBias = clamp(mods.nightHubBias, 0, 0.5)
  mods.nightSlots = clamp(mods.nightSlots, 0, 4)
  mods.railCap = clamp(mods.railCap, 1, 1.5)
  mods.premiumScreen = clamp(mods.premiumScreen, 0.5, 1.5)
  mods.standardScreen = clamp(mods.standardScreen, 0.5, 1.5)
  mods.loungeYield = clamp(mods.loungeYield, 1, 2.4)
  mods.tenantYield = clamp(mods.tenantYield, 0.7, 2.2)
  mods.tenantPref = clamp(mods.tenantPref, 0, 0.25)
  mods.budgetRetail = clamp(mods.budgetRetail, 0.5, 1)
  return mods
}

export function bankSlotCount(
  count: number,
  opts: { hub: boolean; lcc: boolean; capacity?: number; mods: SpecMods },
): number {
  const scaled = Math.max(1, Math.round(count * (opts.capacity ?? 1)))
  if (opts.hub) return scaled + 1 + opts.mods.hubExtraSlots
  if (opts.lcc) return scaled + opts.mods.lccExtraSlots
  return scaled
}

/** Seconds between seeded slots. `roll` is 0–1. */
export function bankSpacing(
  kind: 'cargo' | 'pax',
  hub: boolean,
  mods: SpecMods,
  roll: number,
): number {
  const wobble = Math.max(0, Math.min(1, roll))
  if (kind === 'cargo') return 22 + wobble * 12
  const base = hub ? 12 + wobble * 8 : 18 + wobble * 10
  return base * (hub ? mods.hubSpacing : mods.otherSpacing)
}

export function turnMinutes(base: number, mods: SpecMods, night: boolean): number {
  const shift = night ? mods.nightTurn : mods.dayTurn
  return Math.max(18, Math.round(base * mods.turnaround * shift))
}

export function screenMultiplier(mods: SpecMods, premium: boolean): number {
  return premium ? mods.premiumScreen : mods.standardScreen
}

export function warehouseCapacity(base: number, mods: SpecMods, railLinked: boolean): number {
  let cap = base * mods.cargoCap
  if (railLinked && mods.railCap > 1) cap *= mods.railCap
  return Math.round(cap)
}

/** Retail price after tenant quality. Budget passengers take the extra cut. */
export function retailPrice(pay: number, mods: SpecMods, kind: 'tenant' | 'lounge', budget: boolean): number {
  let m = kind === 'lounge' ? mods.loungeYield : mods.tenantYield
  if (budget) m *= mods.budgetRetail
  return Math.max(0, Math.round(pay * m))
}

/** True when the node is not free: it has upkeep, cash, or a numeric penalty. */
export function nodeHasTradeoff(node: SpecNode): boolean {
  if (node.upkeepPerDay > 0 || node.cash > 0) return true
  const e = node.effect
  return (
    (e.missHeat ?? 1) > 1 ||
    (e.otherSpacing ?? 1) > 1 ||
    (e.scheduleCap ?? 0) < 0 ||
    (e.hubBanDelta ?? 0) > 0 ||
    (e.otherBeltHeat ?? 1) > 1 ||
    (e.lowCostFee ?? 1) < 1 ||
    (e.premiumFee ?? 1) < 1 ||
    (e.paxLanding ?? 1) < 1 ||
    (e.dayTurn ?? 1) > 1 ||
    (e.dayCargoFee ?? 1) < 1 ||
    (e.cargoTonnage ?? 1) > 1 ||
    (e.standardScreen ?? 1) > 1 ||
    (e.tenantPref ?? 0) > 0 ||
    (e.budgetRetail ?? 1) < 1 ||
    (e.tenantYield ?? 1) < 1
  )
}

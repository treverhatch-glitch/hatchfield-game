import { DEFAULT_HOLD, DEFAULT_PAX, DEFAULT_VEHICLE_SPECS } from '../logistics/defaults.ts'
import type { DelayCause, LogisticsConfig, StandAccess as RampAccess, VehicleType } from '../logistics/types.ts'
import { DEPOT_GRANT } from '../scale/data.ts'
import { neighbors, tilesOf, walkableFor } from './path.ts'
import type { StandAccess, Tile } from './types.ts'

/**
 * Sim-seconds an empty farm may hold a departure.
 * One game hour is 7.5 seconds, so this is a bit over an hour and a half.
 * Past it, the departure slot is missed and the flight is cancelled.
 */
export const FUEL_OUTAGE_SLOT_SEC = 12

/**
 * Metres along one apron cell.
 * One game hour is 7.5 sim-seconds, so a cell is long enough that a truck's
 * drive along the service road is visible, while a turnaround still finishes
 * in the same few seconds the old fuel dwell used.
 */
export const METRES_PER_CELL = 900

const FLEET: Partial<Record<VehicleType, number>> = { ...DEPOT_GRANT }

export interface LogisticsBuildOptions {
  /** Vehicles the player bought on top of the depot grant. */
  fleet?: Partial<Record<VehicleType, number>>
  capacityLitres?: number
  initialLitres?: number
  /** Hydrant pits on stands once that research is owned. */
  hydrant?: boolean
  /** Big jets refuse trucks below their tier. */
  strict?: boolean
}

export const CAUSE_LINE: Record<DelayCause, string> = {
  no_vehicle: 'No service vehicle was free',
  no_loader: 'No belt or container loader was free',
  no_fuel: 'The fuel farm was empty',
  no_meals: 'The catering kitchen was out of meals',
  no_bridge: 'Passengers used stairs or a bus instead of a bridge',
  boarding_slow: 'Boarding ran long',
  late_pax: 'Passengers reached the gate late',
  late_bags: 'Bags reached the make-up area late',
  bag_offload: 'A late passenger bag had to come off the aircraft',
  vehicle_breakdown: 'A service vehicle broke down on the job',
  undersized_vehicle: 'The truck was too small for that aircraft',
}

export function groundCauseLine(cause: DelayCause): string {
  return CAUSE_LINE[cause] ?? ''
}

export function delayFix(causes: DelayCause[]): string {
  const safeCauses = causes ?? []
  if (safeCauses.includes('no_fuel')) return 'Wait for the tanker, or keep more fuel in the farm before the next bank.'
  if (safeCauses.includes('no_meals')) return 'Place a catering kitchen beside the service road.'
  if (safeCauses.includes('no_loader') || safeCauses.includes('no_vehicle')) {
    return 'Add another vehicle depot. Each depot brings another fleet.'
  }
  if (safeCauses.includes('no_bridge')) return 'A jetway stand boards faster than stairs or a bus.'
  if (safeCauses.includes('late_pax') || safeCauses.includes('boarding_slow')) {
    return 'The gate closed on the tail of the queue. A bigger hall keeps the next bank on time.'
  }
  if (safeCauses.includes('late_bags') || safeCauses.includes('bag_offload')) {
    return 'Keep the bag belt linked so make-up is ready before the door closes.'
  }
  if (safeCauses.includes('vehicle_breakdown')) return 'The truck is in the shop. The next free vehicle will pick up the job.'
  if (safeCauses.includes('undersized_vehicle')) return 'That aircraft needs the heavy kit. The basic trucks will finish, slowly.'
  return 'Give the ramp another minute, or add a vehicle depot if the stands are stacked.'
}

/**
 * Service-road graph from the apron. Null until a fuel farm and a vehicle depot
 * both exist. The starter kit has a farm and no depot, so the first hour keeps
 * the old fuel and catering trucks.
 */
export function buildLogisticsConfig(
  tiles: Tile[][],
  standAccess: Record<string, StandAccess>,
  hasTermBus: boolean,
  options: LogisticsBuildOptions = {},
): LogisticsConfig | null {
  if (!tiles || !Array.isArray(tiles) || tiles.length === 0 || !tiles[0] || tiles.length < 32) return null
  const depots = tilesOf(tiles, 'depot')
  const farms = tilesOf(tiles, 'fuel')
  if (!depots.length || !farms.length) return null

  const nodes: { id: string; x: number; y: number }[] = []
  const onRoad = new Set<string>()
  for (let r = 0; r < tiles.length; r++) {
    for (let c = 0; c < (tiles[r]?.length ?? 0); c++) {
      if (!walkableFor('truck', tiles[r][c])) continue
      const id = `${c},${r}`
      onRoad.add(id)
      nodes.push({ id, x: c, y: r })
    }
  }

  const edges: { a: string; b: string; length: number }[] = []
  const seen = new Set<string>()
  for (const n of nodes) {
    const [c, r] = n.id.split(',').map(Number)
    for (const nb of neighbors(c, r)) {
      const bid = `${nb.c},${nb.r}`
      if (!onRoad.has(bid)) continue
      const key = n.id < bid ? `${n.id}|${bid}` : `${bid}|${n.id}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        a: n.id,
        b: bid,
        length: Math.hypot(nb.c - c, nb.r - r) * METRES_PER_CELL,
      })
    }
  }

  const depotId = `${depots[0].c},${depots[0].r}`
  const farmId = `${farms[0].c},${farms[0].r}`
  if (!onRoad.has(depotId) || !onRoad.has(farmId)) return null

  const reach = reachable(depotId, edges)
  if (!reach.has(farmId)) return null

  const kitchens = tilesOf(tiles, 'kitchen')
  const kitchenId = kitchens.length ? `${kitchens[0].c},${kitchens[0].r}` : depotId
  const terminals = tilesOf(tiles, 'terminal')
  const terminalId = terminals.length ? `${terminals[0].c},${terminals[0].r}` : depotId
  const bags = tilesOf(tiles, 'bags')
  const makeupId = bags.length ? `${bags[0].c},${bags[0].r}` : terminalId
  const sheds = tilesOf(tiles, 'cargo')
  const cargoId = sheds.length ? `${sheds[0].c},${sheds[0].r}` : depotId

  const kitchenNode = reach.has(kitchenId) ? kitchenId : depotId
  const terminalNode = reach.has(terminalId) ? terminalId : depotId
  const makeupNode = reach.has(makeupId) ? makeupId : terminalNode
  const cargoNode = reach.has(cargoId) ? cargoId : depotId
  const kitchenLive = kitchens.length > 0 && kitchenNode === `${kitchens[0].c},${kitchens[0].r}`

  const stands = tilesOf(tiles, 'stand')
    .filter((s) => reach.has(`${s.c},${s.r}`))
    .map((s) => {
      const id = `${s.c},${s.r}`
      const link = standAccess[id]
      const access: RampAccess = link === 'jetway' ? 'bridge' : hasTermBus ? 'remote' : 'stairs'
      return { id, node: id, hydrant: Boolean(options.hydrant), access }
    })

  const vehicles: Partial<Record<VehicleType, number>> = {}
  for (const type of Object.keys(FLEET) as VehicleType[]) {
    vehicles[type] = (FLEET[type] ?? 0) * depots.length
  }
  for (const [type, count] of Object.entries(options.fleet ?? {}) as [VehicleType, number][]) {
    const validCount = Number.isFinite(count) ? Math.max(0, count) : 0
    if (validCount > 0) vehicles[type] = (vehicles[type] ?? 0) + validCount
  }
  const capacityLitres = Number.isFinite(options.capacityLitres) ? Math.max(0, options.capacityLitres!) : 400_000
  const rawInitial = options.initialLitres ?? 240_000
  const initialLitres = Math.min(capacityLitres, Number.isFinite(rawInitial) ? Math.max(0, rawInitial) : 240_000)

  return {
    // Apron traffic: reserved parking slots + yield/wait so service vehicles never overlap.
    traffic: true,
    // One farm bay and one kitchen bay, so a busy bank queues tankers and galley trucks.
    docks: { fuelBays: 1, kitchenBays: 1, makeupBays: 2, cargoBays: 1, terminalBays: 2 },
    nodes,
    edges,
    depotNode: depotId,
    terminalNode,
    makeupNode,
    cargoNode,
    stands,
    fuelFarm: {
      node: farmId,
      capacityLitres,
      initialLitres,
      lowStockLitres: Math.min(60_000, Math.round(capacityLitres * 0.15)),
      purchasePricePerLitre: 0.7,
      throughputFeePerLitre: 0.012,
      tankerLitres: 36_000,
      deliveryLeadMinutes: 90,
      autoReorder: options.strict ? false : true,
    },
    kitchen: kitchenLive
      ? {
          node: kitchenNode,
          capacityMeals: 2000,
          initialMeals: 800,
          mealsPerHour: 240,
          lowStockMeals: 160,
          costPerMeal: 4.5,
          feePerMeal: 6,
        }
      : {
          node: kitchenNode,
          capacityMeals: 100,
          initialMeals: 0,
          mealsPerHour: 0,
          lowStockMeals: 20,
          costPerMeal: 4.5,
          feePerMeal: 6,
        },
    vehicles,
    vehicleSpecs: DEFAULT_VEHICLE_SPECS,
    truckPumpLpm: 1000,
    hydrantPumpLpm: 2500,
    pax: DEFAULT_PAX,
    hold: DEFAULT_HOLD,
    strictSizeTiers: options.strict,
  }
}

function reachable(start: string, edges: { a: string; b: string }[]): Set<string> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const a = adj.get(e.a) ?? []
    a.push(e.b)
    adj.set(e.a, a)
    const b = adj.get(e.b) ?? []
    b.push(e.a)
    adj.set(e.b, b)
  }
  const reach = new Set<string>([start])
  const queue = [start]
  while (queue.length) {
    const cur = queue.pop()!
    for (const n of adj.get(cur) ?? []) {
      if (reach.has(n)) continue
      reach.add(n)
      queue.push(n)
    }
  }
  return reach
}

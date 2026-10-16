import type { BuildingCard, Reading } from '../../buildinginfo/card.ts'
import { buildingCard } from '../../buildinginfo/card.ts'
import type { Game } from '../../game/sim.ts'
import type { FacilityMetrics } from '../../paxnav/paxnav.ts'
import type { EquipKind } from '../../terminalbuild/types.ts'

const KIND_NAME: Record<EquipKind, string> = {
  checkin_desk: 'Check-in desk',
  security_lane: 'Security lane',
  gate_desk: 'Gate desk',
  bag_belt: 'Bag belt',
  makeup_carousel: 'Makeup carousel',
  seat: 'Seats',
  shop_counter: 'Shop counter',
  toilet: 'Toilet',
  office_desk: 'Office desk',
}

const VEHICLE_NAME: Record<string, string> = {
  fuel_truck: 'Fuel truck',
  heavy_fuel_truck: 'Heavy fuel truck',
  hydrant_dispenser: 'Hydrant dispenser',
  catering_truck: 'Catering truck',
  highlift_catering: 'High-lift catering',
  baggage_tug: 'Baggage tug',
  heavy_baggage_tug: 'Heavy baggage tug',
  belt_loader: 'Belt loader',
  uld_loader: 'ULD loader',
  main_deck_loader: 'Main-deck loader',
  gpu: 'GPU',
  pushback_tug: 'Pushback tug',
  pax_bus: 'Passenger bus',
}

const PHASE_LABEL: Record<string, string> = {
  idle: 'Idle',
  to_source: 'To source',
  loading: 'Loading',
  waiting_stock: 'Waiting on stock',
  to_stand: 'To the stand',
  servicing: 'Servicing',
  to_dropoff: 'To drop-off',
  unloading: 'Unloading',
  broken: 'Broken',
  towed: 'Towed',
  to_maintenance: 'To maintenance',
  in_bay: 'In the bay',
  queued: 'Queued',
  docking: 'Docking',
  departing: 'Departing',
}

export function vehiclePhaseLabel(phase: string): string {
  return PHASE_LABEL[phase] ?? phase
}

export function vehicleTypeName(type: string): string {
  return VEHICLE_NAME[type] ?? type.replaceAll('_', ' ')
}

/** One headline on the card. Queue, served, and wait stay in the click-open sections. */
export function cardForMetric(metric: FacilityMetrics): BuildingCard {
  const name = KIND_NAME[metric.kind] ?? 'Facility'
  const headline =
    metric.queueLength > 0 ? `${metric.queueLength} waiting` : metric.serving ? 'Serving' : metric.staffed ? 'Clear' : 'Unstaffed'
  const reading: Reading = {
    id: metric.id,
    name,
    plan: metric.kind === 'security_lane' ? 'security' : metric.kind === 'checkin_desk' ? 'checkin' : undefined,
    upkeepPerDay: 0,
    staffAssigned: metric.staffed ? 1 : 0,
    staffNeeded: 1,
    demand: metric.inUse || metric.queueLength > 0 ? 1 : 0,
    throughputPerMin: metric.serviceSec > 0 && metric.staffed ? 60 / metric.serviceSec : 0,
    unit: 'pax/min',
    queueLength: metric.queueLength,
    queueKind: 'passengers',
    bays: [
      {
        label: `Served ${metric.served}`,
        inUse: metric.inUse,
        limit: metric.staffed ? undefined : 'unstaffed',
        icon: metric.staffed ? undefined : 'staff',
        badge: 'staff',
      },
    ],
    note: headline,
  }
  return buildingCard(reading)
}

export function cardForVehicle(input: {
  id: string
  type: string
  phase: string
  /** 0..1 progress through the current phase. */
  u: number
  waiting: boolean
}): BuildingCard {
  const phase = vehiclePhaseLabel(input.phase)
  const reading: Reading = {
    id: `vehicle:${input.id}`,
    name: vehicleTypeName(input.type),
    upkeepPerDay: 0,
    demand: input.phase === 'idle' ? 0 : 1,
    staffAssigned: null,
    bays: [{ label: phase, inUse: input.phase !== 'idle' && input.phase !== 'queued' && input.phase !== 'broken' }],
    queueLength: input.waiting ? 1 : 0,
    queueKind: input.waiting ? 'vehicles' : 'none',
    note: `${phase} · ${Math.round(input.u * 100)}%`,
    unit: 'task',
  }
  return buildingCard(reading)
}

/**
 * Card for whatever is selected. A hall lane uses that lane's live metrics.
 * A service vehicle uses its pose. Everything else keeps the building reading.
 */
export function inspectorCard(game: Game): BuildingCard | null {
  if (game.view === 'hall' && game.selectedFacility && game.hallNav.live) {
    const metric = game.hallNav.metrics().find((row) => row.id === game.selectedFacility)
    if (metric) return cardForMetric(metric)
  }
  const pick = game.assignPick
  if (game.view === 'apron' && pick?.kind === 'vehicle' && pick.id) {
    const pose = game.servicePoses().find((row) => row.id === pick.id)
    return cardForVehicle({
      id: pick.id,
      type: pose?.type ?? 'vehicle',
      phase: pose?.phase ?? 'idle',
      u: pose?.u ?? 0,
      waiting: Boolean(pose?.waiting),
    })
  }
  return game.buildingCard()
}

/** Nearest marked service point, in hall-world metres. Null outside `maxM`. */
export function nearestFacilityId(
  metrics: readonly Pick<FacilityMetrics, 'id' | 'line'>[],
  x: number,
  z: number,
  originX: number,
  originZ: number,
  maxM: number,
): string | null {
  let best: string | null = null
  let bestD = maxM * maxM
  for (const metric of metrics) {
    const point = metric.line[0]
    if (!point) continue
    const dx = point.x + originX - x
    const dz = point.z + originZ - z
    const d = dx * dx + dz * dz
    if (d <= bestD) {
      bestD = d
      best = metric.id
    }
  }
  return best
}

/**
 * Click-open building card. Pure: the same reading always prints the same lines.
 * The panel shows the name, status, and why immediately. Counts stay on the
 * card so the view can hide them until a subsection is opened.
 */
import { SERVICE_KITS, fleetHas, planFor, type BayPlan, type SizeTier } from './config.ts'

export type BuildingStatus = 'working' | 'limited' | 'idle' | 'closed'

export interface BayInput {
  label?: string
  inUse: boolean
  /** Phrase after the colon. Empty when the bay can work. */
  limit?: string
  icon?: string
  badge?: string
}

export interface BayView {
  index: number
  label: string
  state: 'in_use' | 'idle'
  limit: string
  line: string
}

export interface BottleneckIcon {
  id: string
  badge: string
  why: string
}

export interface BuildingCard {
  id: string
  name: string
  status: BuildingStatus
  statusLabel: string
  why: string
  throughputPerMin: number
  throughputText: string
  baysInUse: number
  baysTotal: number
  baysText: string
  bays: BayView[]
  upkeepPerDay: number
  upkeepText: string
  upkeepWhy: string
  staffAssigned: number
  staffNeeded: number
  staffText: string
  staffWhy: string
  queueLength: number
  queueText: string
  queueWhy: string
  throughputWhy: string
  baysWhy: string
  bottleneckText: string
  bottleneckWhy: string
  icons: BottleneckIcon[]
}

export interface Reading {
  id: string
  name: string
  /** Plan key in BUILDING_PLANS. Ignored when `bays` is set. */
  plan?: string
  tier?: SizeTier
  fleet?: Readonly<Record<string, number>>
  /** Something is asking the bays to work. */
  demand?: number
  /**
   * Bodies on the building. Null means the plan's staff count is filled
   * (a building whose upkeep already includes the crew).
   */
  staffAssigned?: number | null
  staffNeeded?: number
  upkeepPerDay: number
  closed?: boolean
  bays?: readonly BayInput[]
  /** Replaces in-use × rate when the sim already measured throughput. */
  throughputPerMin?: number
  unit?: string
  /** People or vehicles waiting on this building. Omitted means there is no line. */
  queueLength?: number
  queueKind?: 'passengers' | 'vehicles' | 'none'
}

const STATUS_LABEL: Record<BuildingStatus, string> = {
  working: 'Working',
  limited: 'Limited',
  idle: 'Idle',
  closed: 'Closed',
}

function finite(n: number | undefined, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function amount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function dollars(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`
}

function baysFromPlan(
  planned: readonly BayPlan[],
  fleet: Readonly<Record<string, number>>,
  tier: SizeTier,
  staffAssigned: number,
  staffNeeded: number,
  demand: number,
): BayInput[] {
  // One crew covers the building. Zero bodies idle every bay the kit could run.
  // A shortfall above zero still leaves those bays open and is reported on the staff icon.
  const unstaffed = staffNeeded > 0 && staffAssigned <= 0
  return planned.map((bay) => {
    if (bay.kit) {
      const kit = SERVICE_KITS[bay.kit]
      if (!fleetHas(fleet, kit.vehicles[tier])) {
        return { inUse: false, limit: kit.missing, icon: kit.id, badge: kit.badge }
      }
    }
    if (unstaffed) return { inUse: false, limit: 'short of staff', icon: 'staff', badge: 'staff' }
    return { inUse: demand > 0 }
  })
}

function resolveBays(reading: Reading, staffAssigned: number, staffNeeded: number, demand: number): BayInput[] {
  if (reading.bays) return reading.bays.map((bay) => ({ ...bay }))
  const plan = planFor(reading.plan)
  return baysFromPlan(plan.bays, reading.fleet ?? {}, reading.tier ?? 'small', staffAssigned, staffNeeded, demand)
}

function bayViews(inputs: readonly BayInput[]): BayView[] {
  return inputs.map((bay, i) => {
    const index = i + 1
    const label = bay.label?.trim() || `Bay ${index}`
    const limit = bay.limit?.trim() || ''
    const state: BayView['state'] = bay.inUse && !limit ? 'in_use' : 'idle'
    const line = limit ? `${label} · idle · ${limit}` : state === 'in_use' ? `${label} · in use` : `${label} · idle`
    return { index, label, state, limit, line }
  })
}

function iconsFor(
  bays: readonly BayView[],
  inputs: readonly BayInput[],
  staffAssigned: number,
  staffNeeded: number,
): BottleneckIcon[] {
  const icons: BottleneckIcon[] = []
  const seen = new Set<string>()
  inputs.forEach((bay, i) => {
    const view = bays[i]
    if (!view?.limit || !bay.icon || seen.has(bay.icon)) return
    seen.add(bay.icon)
    icons.push({
      id: bay.icon,
      badge: bay.badge?.trim() || bay.icon,
      why: `${view.label} idle: ${view.limit}`,
    })
  })
  if (staffNeeded > staffAssigned && !seen.has('staff')) {
    icons.push({
      id: 'staff',
      badge: 'staff',
      why: `Short ${staffNeeded - staffAssigned} staff`,
    })
  }
  return icons
}

export function buildingCard(reading: Reading): BuildingCard {
  const plan = planFor(reading.plan)
  const staffNeeded = Math.max(0, Math.floor(finite(reading.staffNeeded, plan.staff)))
  const staffAssigned = Math.max(0, Math.floor(reading.staffAssigned == null ? staffNeeded : finite(reading.staffAssigned)))
  const demand = Math.max(0, finite(reading.demand, plan.alwaysOn && !reading.closed ? 1 : 0))
  const inputs = reading.closed ? [] : resolveBays(reading, staffAssigned, staffNeeded, demand)
  const bays = bayViews(inputs)
  const baysInUse = bays.filter((bay) => bay.state === 'in_use').length
  const baysTotal = reading.closed ? (reading.bays?.length || plan.bays.length) : bays.length
  const unit = reading.unit?.trim() || plan.unit
  let throughput = finite(reading.throughputPerMin, NaN)
  if (!Number.isFinite(throughput)) {
    throughput = 0
    if (reading.bays) throughput = baysInUse
    else {
      inputs.forEach((_bay, i) => {
        if (bays[i]?.state === 'in_use') throughput += plan.bays[i]?.rate ?? 0
      })
    }
  }
  if (reading.closed) throughput = 0
  const measured = Number.isFinite(finite(reading.throughputPerMin, NaN))

  const equipment = bays.find((bay) => bay.limit && bay.limit !== 'short of staff')
  const staffBay = bays.find((bay) => bay.limit === 'short of staff')
  const short = Math.max(0, staffNeeded - staffAssigned)
  let why = 'Clear'
  let status: BuildingStatus = baysInUse > 0 ? 'working' : 'idle'
  if (reading.closed) {
    status = 'closed'
    why = 'Still building'
  } else if (equipment) {
    status = 'limited'
    why = `${equipment.label} idle: ${equipment.limit}`
  } else if (staffBay) {
    status = 'limited'
    why = `${staffBay.label} idle: ${staffBay.limit}`
  } else if (short > 0) {
    status = 'limited'
    why = `Short ${short} staff`
  } else if (baysInUse === 0) {
    status = 'idle'
    why = 'Idle — nothing is using a bay'
  }

  const queueKind = reading.queueKind ?? 'none'
  const queueLength = reading.closed ? 0 : Math.max(0, Math.floor(finite(reading.queueLength)))
  const queueWhy = queueExplanation(queueKind, reading.closed)
  const bottleneckWhy = bottleneckExplanation(status, why, equipment, short, staffAssigned, staffNeeded)

  return {
    id: reading.id,
    name: reading.name,
    status,
    statusLabel: STATUS_LABEL[status],
    why,
    throughputPerMin: throughput,
    throughputText: `${amount(throughput)} ${unit}`,
    throughputWhy: reading.closed
      ? 'Inputs: the building is still going up, so throughput is zero.'
      : measured
        ? 'Inputs: the clear rate of the points that are staffed and actually in use.'
        : 'Inputs: each in-use bay times its plan rate. An idle or closed bay adds nothing.',
    baysInUse,
    baysTotal,
    baysText: `${baysInUse} / ${baysTotal}`,
    baysWhy:
      'Inputs: bays in use against this building\'s bay count. A bay is in use only when its kit is present, the crew is not zero, and something is asking for it.',
    bays,
    queueLength,
    queueText: `${queueLength} waiting`,
    queueWhy,
    upkeepPerDay: finite(reading.upkeepPerDay),
    upkeepText: `${dollars(reading.upkeepPerDay)} / day`,
    upkeepWhy: 'Inputs: the catalog daily upkeep for this building. It bills whether or not a bay is in use.',
    staffAssigned,
    staffNeeded,
    staffText: `${staffAssigned} / ${staffNeeded}`,
    staffWhy: 'Inputs: bodies assigned on this building against the crew the plan calls for. Zero bodies idle every bay.',
    bottleneckText: why,
    bottleneckWhy,
    icons: reading.closed ? [] : iconsFor(bays, inputs, staffAssigned, staffNeeded),
  }
}

function queueExplanation(kind: 'passengers' | 'vehicles' | 'none', closed: boolean | undefined): string {
  if (closed) return 'Inputs: the building is still going up, so the line is empty.'
  if (kind === 'passengers') return 'Inputs: people waiting at these desks, not counting the passenger being served.'
  if (kind === 'vehicles') return 'Inputs: vehicles waiting because a bay on this building is already taken.'
  return 'Inputs: this building has no passenger line and no vehicle bay-queue.'
}

function bottleneckExplanation(
  status: BuildingStatus,
  why: string,
  equipment: BayView | undefined,
  short: number,
  staffAssigned: number,
  staffNeeded: number,
): string {
  if (status === 'closed') return 'Inputs: construction is not finished, so the building is closed.'
  if (equipment) return `Inputs: ${why}. That is the first bay whose kit or crew is missing.`
  if (short > 0) return `Inputs: ${staffAssigned} assigned against ${staffNeeded} needed. The shortfall is the bottleneck.`
  if (status === 'idle') return 'Inputs: no bay is in use. Nothing is asking this building to work.'
  return 'Inputs: every open bay can run, and at least one is in use. There is no bottleneck.'
}

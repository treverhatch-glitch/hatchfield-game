import type {
  HousingTier,
  ResearcherRenderState,
  StaffAllocation,
  StaffBuildingInput,
  StaffPoolInput,
  StaffRole,
  StaffSnapshot,
  TransitTier,
  VisibleWorker,
  WorkerActivity,
} from './types'
import { STAFF_ROLES } from './types'
import { simMinutesToRealMinutes, type SimMinutes } from '../core/clock'

export const COMMUTER_CAP: Readonly<Record<TransitTier, number>> = {
  road: 45,
  bus: 110,
  rail: 240,
}

export const HOUSING_CAP: Readonly<Record<HousingTier, number>> = {
  0: 0,
  1: 20,
  2: 60,
  3: 140,
}

export interface StaffModelInput {
  pools: Readonly<Partial<Record<StaffRole, StaffPoolInput>>>
  buildings: readonly StaffBuildingInput[]
  transitTier: TransitTier
  housingTier: HousingTier
  visibleWorkerSample: number
  elapsedSimMinutes: SimMinutes
  morale?: number
  commuteDistance?: number
}

function emptyPools(): Record<StaffRole, number> {
  return {
    ground_crew: 0,
    terminal_staff: 0,
    security_officer: 0,
    ops_atc: 0,
    maintenance_tech: 0,
    retail_worker: 0,
    researcher: 0,
  }
}

function stableNumber(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function workerActivity(id: string, elapsedSimMinutes: SimMinutes, staffed: boolean): WorkerActivity {
  if (!staffed) return 'off_shift'
  const elapsedRealMinutes = simMinutesToRealMinutes(elapsedSimMinutes)
  const phase = (stableNumber(id) + Math.floor(elapsedRealMinutes * 2)) % 20
  if (phase < 14) return 'working'
  if (phase < 17) return 'walking'
  return 'break'
}

/**
 * Pools are assigned by role and building priority. Commute capacity is explicit;
 * exceeding it scales every role evenly instead of silently deleting one role.
 */
export function calculateStaff(input: StaffModelInput): StaffSnapshot {
  const commuterCap = COMMUTER_CAP[input.transitTier]
  const housingCap = HOUSING_CAP[input.housingTier]
  const totalCap = commuterCap + housingCap
  const requested = STAFF_ROLES.reduce((sum, role) => sum + Math.max(0, input.pools[role]?.hired ?? 0), 0)
  const capRatio = requested > 0 ? Math.min(1, totalCap / requested) : 1
  const pools = emptyPools()
  let dailyWages = 0
  for (const role of STAFF_ROLES) {
    const pool = input.pools[role]
    pools[role] = Math.floor(Math.max(0, pool?.hired ?? 0) * capRatio)
    dailyWages += pools[role] * Math.max(0, pool?.wagePerDay ?? 0)
  }

  const morale = Math.min(1, Math.max(0.5, input.morale ?? 1))
  const distance = Math.max(0, input.commuteDistance ?? 0)
  const lateChance = Math.min(0.2, distance * 0.0025) * (housingCap > 0 ? 0.65 : 1)
  const available = { ...pools }
  const allocations: StaffAllocation[] = []
  const ordered = [...input.buildings].sort(
    (left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id),
  )
  for (const building of ordered) {
    const required = Math.max(0, Math.floor(building.required))
    const assigned = Math.min(required, available[building.role])
    available[building.role] -= assigned
    const staffingRatio = required === 0 ? 1 : assigned / required
    allocations.push({
      buildingId: building.id,
      role: building.role,
      required,
      assigned,
      staffingRatio,
      throughputMultiplier: staffingRatio * morale * (1 - lateChance),
    })
  }

  const visibleWorkers = visibleSample(
    pools,
    allocations,
    Math.max(0, Math.floor(input.visibleWorkerSample)),
    input.elapsedSimMinutes,
  )
  const researchers = researcherState(allocations, visibleWorkers)
  const employed = STAFF_ROLES.reduce((sum, role) => sum + pools[role], 0)
  return {
    commuterCap,
    housingCap,
    totalCap,
    employed,
    pools,
    allocations,
    visibleWorkers,
    researchers,
    dailyWages,
  }
}

function visibleSample(
  pools: Readonly<Record<StaffRole, number>>,
  allocations: readonly StaffAllocation[],
  sampleLimit: number,
  elapsedSimMinutes: SimMinutes,
): VisibleWorker[] {
  const result: VisibleWorker[] = []
  const assignedByRole = new Map<StaffRole, { buildingId: string; remaining: number }[]>()
  for (const role of STAFF_ROLES) assignedByRole.set(role, [])
  for (const allocation of allocations) {
    assignedByRole.get(allocation.role)?.push({ buildingId: allocation.buildingId, remaining: allocation.assigned })
  }
  const employed = STAFF_ROLES.reduce((sum, role) => sum + pools[role], 0)
  const target = Math.min(sampleLimit, employed)
  let cursor = 0
  while (result.length < target && employed > 0) {
    const role = STAFF_ROLES[cursor % STAFF_ROLES.length]
    const indexInRole = Math.floor(cursor / STAFF_ROLES.length)
    cursor++
    if (indexInRole >= pools[role]) continue
    const assignments = assignedByRole.get(role) ?? []
    const assignment = assignments.find((candidate) => candidate.remaining > 0)
    if (assignment) assignment.remaining--
    const id = `${role}-${indexInRole + 1}`
    result.push({
      id,
      role,
      buildingId: assignment?.buildingId ?? null,
      activity: workerActivity(id, elapsedSimMinutes, Boolean(assignment)),
    })
  }
  return result
}

function researcherState(
  allocations: readonly StaffAllocation[],
  visibleWorkers: readonly VisibleWorker[],
): ResearcherRenderState {
  const roomActivity: Record<string, 'active' | 'understaffed' | 'idle'> = {}
  let total = 0
  let active = 0
  for (const allocation of allocations) {
    if (allocation.role !== 'researcher') continue
    total += allocation.assigned
    active += allocation.assigned
    roomActivity[allocation.buildingId] =
      allocation.assigned === 0
        ? 'idle'
        : allocation.assigned < allocation.required
          ? 'understaffed'
          : 'active'
  }
  return {
    total,
    active,
    visible: visibleWorkers.filter((worker) => worker.role === 'researcher'),
    roomActivity,
  }
}

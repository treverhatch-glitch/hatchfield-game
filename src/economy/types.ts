/** Public contracts for the economy module. Time passed to the core is real minutes. */

export type StaffRole =
  | 'ground_crew'
  | 'terminal_staff'
  | 'security_officer'
  | 'ops_atc'
  | 'maintenance_tech'
  | 'retail_worker'
  | 'researcher'

export const STAFF_ROLES: readonly StaffRole[] = [
  'ground_crew',
  'terminal_staff',
  'security_officer',
  'ops_atc',
  'maintenance_tech',
  'retail_worker',
  'researcher',
]

export type TransitTier = 'road' | 'bus' | 'rail'
export type HousingTier = 0 | 1 | 2 | 3
export type PowerPlantTier = 1 | 2 | 3
export type TechTier = 1 | 2 | 3 | 4

export type TechBranchId =
  | 'terminal_ops'
  | 'airside_ops'
  | 'ground_logistics'
  | 'commercial'
  | 'safety_security'
  | 'cargo'
  | 'staff_hr'
  | 'sustainability'
  | 'maintenance'

export interface TechNode {
  id: string
  branch: TechBranchId
  tier: TechTier
  name: string
  description: string
  costRp: number
  fieldLevel: number
  requires: string[]
  modifiers: Readonly<Record<string, number>>
}

export interface TechBranch {
  id: TechBranchId
  name: string
  nodes: readonly TechNode[]
}

export interface StaffPoolInput {
  hired: number
  wagePerDay: number
}

export interface StaffBuildingInput {
  id: string
  role: StaffRole
  required: number
  priority?: number
}

export interface StaffAllocation {
  buildingId: string
  role: StaffRole
  required: number
  assigned: number
  staffingRatio: number
  throughputMultiplier: number
}

export type WorkerActivity = 'working' | 'walking' | 'break' | 'off_shift'

export interface VisibleWorker {
  id: string
  role: StaffRole
  buildingId: string | null
  activity: WorkerActivity
}

export interface ResearcherRenderState {
  total: number
  active: number
  visible: VisibleWorker[]
  roomActivity: Readonly<Record<string, 'active' | 'understaffed' | 'idle'>>
}

export interface StaffSnapshot {
  commuterCap: number
  housingCap: number
  totalCap: number
  employed: number
  pools: Readonly<Record<StaffRole, number>>
  allocations: StaffAllocation[]
  visibleWorkers: VisibleWorker[]
  researchers: ResearcherRenderState
  dailyWages: number
}

export interface ResearchRoomInput {
  id: string
  desks: number
  powerDemand: number
  active?: boolean
}

export interface PowerLoad {
  id: string
  demand: number
  critical?: boolean
}

export interface PowerSnapshot {
  tier: PowerPlantTier
  capacity: number
  demand: number
  supplied: number
  brownout: boolean
  throughputMultiplier: number
}

export type EconomyChain =
  | 'staff'
  | 'fuel'
  | 'catering'
  | 'baggage'
  | 'security'
  | 'gates'
  | 'ground_handling'
  | 'power'
  | 'maintenance'
  | 'retail'

export interface ChainLinkInput {
  id: string
  label: string
  capacity: number
  demand: number
  buildingId?: string
  fixHints?: readonly string[]
}

export interface ChainHealthInput {
  chain: EconomyChain
  links: readonly ChainLinkInput[]
}

export interface Bottleneck {
  chain: EconomyChain
  linkId: string
  label: string
  utilization: number
  shortfall: number
  severity: 'watch' | 'strained' | 'blocked'
  fixes: string[]
}

export type FailureKind =
  | 'fuel_outage'
  | 'staff_shortage'
  | 'power_brownout'
  | 'storage_empty'
  | 'equipment_failure'
  | 'capacity_overload'

export interface FailureEvent {
  kind: FailureKind
  sourceId: string
  chain: EconomyChain
  grounded: boolean
  delayMinutes: number
  ratingHit: number
  message: string
}

export interface DemandPoint {
  day: number
  multiplier: number
}

export interface SeasonDefinition {
  id: string
  name: string
  startDay: number
  endDay: number
  demandCurve: readonly DemandPoint[]
  modifiers?: Readonly<Record<string, number>>
}

export interface HolidayDefinition {
  id: string
  name: string
  startDay: number
  endDay: number
  demandMultiplier: number
  modifiers?: Readonly<Record<string, number>>
}

export interface MapDemandCalendar {
  mapId: string
  yearLengthDays: number
  seasons: readonly SeasonDefinition[]
  holidays: readonly HolidayDefinition[]
}

export interface DemandSnapshot {
  mapId: string
  dayOfYear: number
  seasonId: string | null
  activeHolidayIds: string[]
  multiplier: number
  modifiers: Readonly<Record<string, number>>
}

export interface EconomyState {
  elapsedRealMinutes: number
  fieldLevel: number
  researchPoints: number
  researchProgress: number
  unlockedTech: string[]
  claimedMilestones: string[]
  clearedBottlenecks: string[]
  transitTier: TransitTier
  housingTier: HousingTier
  powerPlantTier: PowerPlantTier
}

export interface EconomyConfig {
  operationRpPerRealMinute: number
  researcherRpPerRealMinute: number
  fieldLevelRp: number
  bottleneckClearRp: number
  milestoneRp: Readonly<Record<string, number>>
  visibleWorkerSample: number
}

export interface EconomySnapshot {
  state: EconomyState
  staff: StaffSnapshot
  power: PowerSnapshot
  demand: DemandSnapshot
  bottlenecks: Bottleneck[]
  modifiers: Readonly<Record<string, number>>
}

export type EconomyEvent =
  | { type: 'research_earned'; amount: number; source: 'operations' | 'research_rooms' | 'field_level' | 'milestone' | 'bottleneck' }
  | { type: 'tech_unlocked'; techId: string; costRp: number }
  | { type: 'bottleneck'; bottleneck: Bottleneck }
  | { type: 'bottleneck_cleared'; key: string; rewardRp: number }
  | { type: 'failure'; failure: FailureEvent }
  | { type: 'field_level'; level: number }

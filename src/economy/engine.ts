import { analyzeChains, createFailure } from './bottlenecks'
import { simMinutesToRealMinutes, type SimMinutes } from '../core/clock'
import { calculatePower } from './power'
import { DEFAULT_DEMAND_CALENDAR, demandAtDay } from './seasons'
import { calculateStaff } from './staff'
import { availableTech, techModifiers, techNode } from './techTree'
import type {
  ChainHealthInput,
  EconomyConfig,
  EconomyEvent,
  EconomySnapshot,
  EconomyState,
  FailureEvent,
  FailureKind,
  MapDemandCalendar,
  PowerLoad,
  ResearchRoomInput,
  StaffBuildingInput,
  StaffPoolInput,
  StaffRole,
} from './types'

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  operationRpPerRealMinute: 0.015,
  researcherRpPerRealMinute: 0.0125,
  fieldLevelRp: 1,
  bottleneckClearRp: 0.5,
  milestoneRp: {
    first_jet: 1,
    thousand_daily_passengers: 2,
    first_long_haul: 2,
  },
  visibleWorkerSample: 24,
}

export function createInitialEconomyState(): EconomyState {
  return {
    elapsedSimMinutes: 0,
    fieldLevel: 1,
    researchPoints: 0,
    researchProgress: 0,
    unlockedTech: [],
    claimedMilestones: [],
    clearedBottlenecks: [],
    transitTier: 'road',
    housingTier: 0,
    powerPlantTier: 1,
  }
}

export type EconomyListener = (event: EconomyEvent) => void

/**
 * Standalone economy state machine. It accepts capacity facts from other
 * systems; it never mutates flights, buildings, cash, or the terminal sim.
 */
export class EconomyEngine {
  readonly state: EconomyState
  readonly config: EconomyConfig
  private operational = false
  private absoluteDay = 0
  private calendar: MapDemandCalendar
  private staffPools: Partial<Record<StaffRole, StaffPoolInput>> = {}
  private staffBuildings: StaffBuildingInput[] = []
  private researchRooms: ResearchRoomInput[] = []
  private powerLoads: PowerLoad[] = []
  private chains: ChainHealthInput[] = []
  private bottlenecks = analyzeChains([])
  private readonly activeBottleneckKeys = new Set<string>()
  private readonly listeners: EconomyListener[] = []

  constructor(
    state: EconomyState = createInitialEconomyState(),
    config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
    calendar: MapDemandCalendar = DEFAULT_DEMAND_CALENDAR,
  ) {
    this.state = structuredClone(state)
    this.config = {
      ...config,
      milestoneRp: { ...config.milestoneRp },
    }
    this.calendar = calendar
  }

  on(listener: EconomyListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) this.listeners.splice(index, 1)
    }
  }

  setOperational(operational: boolean): void {
    this.operational = operational
  }

  setDay(absoluteDay: number): void {
    this.absoluteDay = absoluteDay
  }

  setCalendar(calendar: MapDemandCalendar): void {
    this.calendar = calendar
  }

  setStaffPools(pools: Readonly<Partial<Record<StaffRole, StaffPoolInput>>>): void {
    this.staffPools = { ...pools }
  }

  setStaffBuildings(buildings: readonly StaffBuildingInput[]): void {
    this.staffBuildings = buildings.map((building) => ({ ...building }))
  }

  setResearchRooms(rooms: readonly ResearchRoomInput[]): void {
    this.researchRooms = rooms.map((room) => ({ ...room }))
  }

  setPowerLoads(loads: readonly PowerLoad[]): void {
    this.powerLoads = loads.map((load) => ({ ...load }))
  }

  setTransitTier(tier: EconomyState['transitTier']): void {
    this.state.transitTier = tier
  }

  setHousingTier(tier: EconomyState['housingTier']): void {
    this.state.housingTier = tier
  }

  setPowerPlantTier(tier: EconomyState['powerPlantTier']): void {
    this.state.powerPlantTier = tier
  }

  setFieldLevel(level: number): void {
    const next = Math.max(1, Math.floor(level))
    if (next <= this.state.fieldLevel) return
    const gained = (next - this.state.fieldLevel) * this.config.fieldLevelRp
    this.state.fieldLevel = next
    this.addResearch(gained, 'field_level')
    this.emit({ type: 'field_level', level: next })
  }

  claimMilestone(id: string): boolean {
    if (this.state.claimedMilestones.includes(id)) return false
    const reward = this.config.milestoneRp[id]
    if (reward === undefined) return false
    this.state.claimedMilestones.push(id)
    this.addResearch(reward, 'milestone')
    return true
  }

  setChains(chains: readonly ChainHealthInput[]): void {
    this.chains = chains.map((chain) => ({ ...chain, links: chain.links.map((link) => ({ ...link })) }))
    const next = analyzeChains(this.chains)
    const nextKeys = new Set(next.map((bottleneck) => this.bottleneckKey(bottleneck.chain, bottleneck.linkId)))
    for (const key of this.activeBottleneckKeys) {
      if (nextKeys.has(key) || this.state.clearedBottlenecks.includes(key)) continue
      this.state.clearedBottlenecks.push(key)
      this.addResearch(this.config.bottleneckClearRp, 'bottleneck')
      this.emit({ type: 'bottleneck_cleared', key, rewardRp: this.config.bottleneckClearRp })
    }
    this.activeBottleneckKeys.clear()
    for (const bottleneck of next) {
      this.activeBottleneckKeys.add(this.bottleneckKey(bottleneck.chain, bottleneck.linkId))
      this.emit({ type: 'bottleneck', bottleneck })
    }
    this.bottlenecks = next
  }

  tick(dt: SimMinutes): void {
    if (!(dt > 0)) return
    const elapsedRealMinutes = simMinutesToRealMinutes(dt)
    this.state.elapsedSimMinutes += dt
    const snapshot = this.snapshot()
    const operationRate = this.operational ? this.config.operationRpPerRealMinute : 0
    const roomRate =
      snapshot.staff.researchers.active *
      this.config.researcherRpPerRealMinute *
      snapshot.power.throughputMultiplier
    if (operationRate > 0) this.addResearch(operationRate * elapsedRealMinutes, 'operations')
    if (roomRate > 0) this.addResearch(roomRate * elapsedRealMinutes, 'research_rooms')
  }

  canUnlock(id: string): boolean {
    const unlocked = new Set(this.state.unlockedTech)
    return availableTech(this.state.fieldLevel, unlocked).some(
      (node) => node.id === id && this.state.researchPoints >= node.costRp,
    )
  }

  unlockTech(id: string): boolean {
    const node = techNode(id)
    if (!node || !this.canUnlock(id)) return false
    this.state.researchPoints -= node.costRp
    this.state.unlockedTech.push(id)
    this.emit({ type: 'tech_unlocked', techId: id, costRp: node.costRp })
    return true
  }

  getModifier(key: string, fallback = 1): number {
    return this.modifiers()[key] ?? fallback
  }

  reportFailure(
    kind: FailureKind,
    sourceId: string,
    chain: FailureEvent['chain'],
    message: string,
    overrides?: Partial<Pick<FailureEvent, 'delayMinutes' | 'ratingHit'>>,
  ): FailureEvent {
    const failure = createFailure(kind, sourceId, chain, message, overrides)
    this.emit({ type: 'failure', failure })
    return failure
  }

  snapshot(): EconomySnapshot {
    const modifiers = this.modifiers()
    const researchBuildings: StaffBuildingInput[] = this.researchRooms.map((room) => ({
      id: room.id,
      role: 'researcher',
      required: room.active === false ? 0 : room.desks,
      priority: 100,
    }))
    const staff = calculateStaff({
      pools: this.staffPools,
      buildings: [...researchBuildings, ...this.staffBuildings],
      transitTier: this.state.transitTier,
      housingTier: this.state.housingTier,
      visibleWorkerSample: this.config.visibleWorkerSample,
      elapsedSimMinutes: this.state.elapsedSimMinutes,
      morale: modifiers['staff.moraleThroughput'] ?? 1,
    })
    const roomLoads: PowerLoad[] = this.researchRooms
      .filter((room) => room.active !== false)
      .map((room) => ({ id: `research:${room.id}`, demand: room.powerDemand }))
    const power = calculatePower(
      this.state.powerPlantTier,
      [...this.powerLoads, ...roomLoads],
      modifiers['power.capacity'] ?? 1,
      modifiers['power.demand'] ?? 1,
      modifiers['power.batteryCapacity'] ?? 0,
    )
    return {
      state: structuredClone(this.state),
      staff,
      power,
      demand: demandAtDay(this.calendar, this.absoluteDay),
      bottlenecks: this.bottlenecks.map((bottleneck) => ({ ...bottleneck, fixes: [...bottleneck.fixes] })),
      modifiers,
    }
  }

  private modifiers(): Readonly<Record<string, number>> {
    return techModifiers(new Set(this.state.unlockedTech))
  }

  private addResearch(
    amount: number,
    source: Extract<EconomyEvent, { type: 'research_earned' }>['source'],
  ): void {
    if (!(amount > 0)) return
    this.state.researchProgress += amount
    const whole = Math.floor(this.state.researchProgress + 1e-9)
    if (whole <= 0) return
    this.state.researchProgress -= whole
    this.state.researchPoints += whole
    this.emit({ type: 'research_earned', amount: whole, source })
  }

  private bottleneckKey(chain: string, linkId: string): string {
    return `${chain}:${linkId}`
  }

  private emit(event: EconomyEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

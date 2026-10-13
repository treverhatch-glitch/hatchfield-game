import { EconomyEngine } from './engine'
import type {
  ChainHealthInput,
  EconomyEvent,
  EconomySnapshot,
  EconomyState,
  FailureEvent,
  FailureKind,
  HousingTier,
  PowerLoad,
  PowerPlantTier,
  ResearchRoomInput,
  StaffBuildingInput,
  StaffPoolInput,
  StaffRole,
  TransitTier,
} from './types'

/**
 * Narrow integration surface for the terminal agent. The host owns all game
 * objects; the economy module only reads facts and emits commands/hooks.
 */
export interface EconomyHost {
  getFieldLevel(): number
  isAirportOperational(): boolean
  getAbsoluteDay(): number
  getStaffPools(): Readonly<Partial<Record<StaffRole, StaffPoolInput>>>
  getStaffBuildings(): readonly StaffBuildingInput[]
  getResearchRooms(): readonly ResearchRoomInput[]
  getPowerLoads(): readonly PowerLoad[]
  getChains(): readonly ChainHealthInput[]
  getTransitTier(): TransitTier
  getHousingTier(): HousingTier
  getPowerPlantTier(): PowerPlantTier
  onEconomyEvent?(event: EconomyEvent): void
  onEconomySnapshot?(snapshot: EconomySnapshot): void
  /** Persist this object under a host-owned save key/version. */
  saveEconomyState?(state: EconomyState): void
  /** Apply soft failures to the schedule/flight system. */
  addFlightDelay?(sourceId: string, minutes: number, reason: string): void
  /** Fuel outage only: hold departures needing fuel until the host reports recovery. */
  setFuelGroundStop?(sourceId: string, grounded: boolean): void
  addRatingHit?(amount: number, reason: string): void
}

export interface EconomyAdapterOptions {
  initialState?: EconomyState
  /**
   * Terminal clock units advanced per real minute at normal speed. The current
   * terminal compression is 480 sim-seconds per real minute.
   */
  normalSimSecondsPerRealMinute?: number
}

export interface EconomyAdapter {
  engine: EconomyEngine
  /** Synchronize host facts, advance RP, publish a render/UI snapshot. */
  tick(dtSimSeconds: number, dtRealSeconds?: number): EconomySnapshot
  unlockTech(id: string): boolean
  claimMilestone(id: string): boolean
  /**
   * Report a subsystem failure. Fuel outage invokes a ground stop; all other
   * defaults invoke delay + rating hooks.
   */
  reportFailure(
    kind: FailureKind,
    sourceId: string,
    chain: FailureEvent['chain'],
    message: string,
    overrides?: Partial<Pick<FailureEvent, 'delayMinutes' | 'ratingHit'>>,
  ): FailureEvent
  clearFuelOutage(sourceId: string): void
  snapshot(): EconomySnapshot
}

export function createEconomyAdapter(host: EconomyHost, options: EconomyAdapterOptions = {}): EconomyAdapter {
  const engine = new EconomyEngine(options.initialState)
  const clockRate = Math.max(1, options.normalSimSecondsPerRealMinute ?? 480)
  engine.on((event) => host.onEconomyEvent?.(event))

  const sync = (): void => {
    engine.setFieldLevel(host.getFieldLevel())
    engine.setOperational(host.isAirportOperational())
    engine.setDay(host.getAbsoluteDay())
    engine.setStaffPools(host.getStaffPools())
    engine.setStaffBuildings(host.getStaffBuildings())
    engine.setResearchRooms(host.getResearchRooms())
    engine.setPowerLoads(host.getPowerLoads())
    engine.setTransitTier(host.getTransitTier())
    engine.setHousingTier(host.getHousingTier())
    engine.setPowerPlantTier(host.getPowerPlantTier())
    engine.setChains(host.getChains())
  }

  const publish = (): EconomySnapshot => {
    const snapshot = engine.snapshot()
    host.onEconomySnapshot?.(snapshot)
    host.saveEconomyState?.(snapshot.state)
    return snapshot
  }

  return {
    engine,
    tick(dtSimSeconds, dtRealSeconds) {
      sync()
      const realMinutes =
        dtRealSeconds === undefined
          ? Math.max(0, dtSimSeconds) / clockRate
          : Math.max(0, dtRealSeconds) / 60
      engine.tick(realMinutes)
      return publish()
    },
    unlockTech(id) {
      sync()
      const unlocked = engine.unlockTech(id)
      if (unlocked) publish()
      return unlocked
    },
    claimMilestone(id) {
      const claimed = engine.claimMilestone(id)
      if (claimed) publish()
      return claimed
    },
    reportFailure(kind, sourceId, chain, message, overrides) {
      const failure = engine.reportFailure(kind, sourceId, chain, message, overrides)
      if (failure.grounded) host.setFuelGroundStop?.(sourceId, true)
      else if (failure.delayMinutes > 0) host.addFlightDelay?.(sourceId, failure.delayMinutes, failure.message)
      if (failure.ratingHit > 0) host.addRatingHit?.(failure.ratingHit, failure.message)
      return failure
    },
    clearFuelOutage(sourceId) {
      host.setFuelGroundStop?.(sourceId, false)
    },
    snapshot: () => engine.snapshot(),
  }
}

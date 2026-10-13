import { calculatePower } from '../economy/power.ts'
import { calculateStaff } from '../economy/staff.ts'
import { techModifiers } from '../economy/techTree.ts'
import type { PowerPlantTier, StaffBuildingInput } from '../economy/types.ts'
import {
  CURFEW_FINE_RELAXED,
  CURFEW_FINE_TIGHT,
  CURFEW_HEAT_RELAXED,
  CURFEW_HEAT_TIGHT,
  MRO_POWER_DEMAND,
  MRO_TECH_BONUS,
  MRO_TECHS_REQUIRED,
  MRO_UPKEEP_PER_DAY,
  NIGHT_HUB_GROUND_CREW,
  NIGHT_HUB_POWER_DEMAND,
  NIGHT_HUB_UPKEEP_PER_DAY,
} from './config.ts'
import { advanceMro, finiteNumber, inductMro, standsTied, taxiwaysTied } from './mro.ts'
import {
  defaultNightSlots,
  nightHandlingTonnes,
  nightHubStorageTonnes,
  planNightBank,
  runNightBank,
} from './nightHub.ts'
import type {
  MroCandidate,
  MroJob,
  Tier3Building,
  Tier3Posting,
  Tier3Save,
  Tier3Snapshot,
  Tier3TickResult,
} from './types.ts'
import { mroUnlock, nightHubUnlock, type UnlockContext } from './unlock.ts'

const DAY_MINUTES = 1_440

export interface Tier3TickContext extends UnlockContext {
  staffPools: Parameters<typeof calculateStaff>[0]['pools']
  powerTier: PowerPlantTier
  powerCapacityMultiplier?: number
  powerDemandMultiplier?: number
  batteryCapacity?: number
  otherPowerDemand?: number
  isNight: boolean
  nightIndex: number
  curfewRelaxed: boolean
  candidates: readonly MroCandidate[]
}

function roundMoney(amount: number): number {
  const n = Math.round(finiteNumber(amount))
  return Number.isFinite(n) ? n : 0
}

/**
 * Owns both buildings. The game syncs placed tiles and posts the returned cash.
 * Time is game minutes, the same unit cargo and the economy use.
 */
export class Tier3Session {
  private minutes = 0
  private lastUpkeepDay = 0
  private nextInductionAt = 0
  private launchedNight: number | null = null
  private mroRevenue = 0
  private nightRevenue = 0
  private nightNoise = 0
  private bankTonnes = 0
  private bankFlights = 0
  private jobs: MroJob[] = []
  private buildings: Tier3Building[] = []
  private techsAssigned = 0
  private crewAssigned = 0
  private powerDemand = 0
  private powerCapacity = 0
  private handlingTonnes = 0
  private curfewRelaxed = false
  private throughput = new Map<string, number>()

  sync(buildings: readonly Tier3Building[]): void {
    const ids = new Set(buildings.map((building) => building.id))
    this.buildings = buildings.map((building) => ({ id: building.id, kind: building.kind }))
    this.jobs = this.jobs.filter((job) => ids.has(job.buildingId))
  }

  tiedStandKeys(): ReadonlySet<string> {
    return new Set(this.jobs.map((job) => job.standKey))
  }

  taxiwayTieCount(): number {
    return taxiwaysTied(this.jobs)
  }

  isBusy(buildingId: string): boolean {
    return this.jobs.some((job) => job.buildingId === buildingId)
  }

  /** Live checks. The apron taxi pose is derived from these, so the bay the player sees is the bay that is occupied. */
  activeJobs(): readonly MroJob[] {
    return this.jobs
  }

  tick(dtMinutes: number, ctx: Tier3TickContext): Tier3TickResult {
    const dt = Math.max(0, finiteNumber(dtMinutes))
    const postings: Tier3Posting[] = []
    const mroOn = mroUnlock(ctx).ok
    const hubOn = nightHubUnlock(ctx).ok
    const mros = this.buildings.filter((building) => building.kind === 'mro')
    const hubs = this.buildings.filter((building) => building.kind === 'night_hub')
    const staffBuildings: StaffBuildingInput[] = [
      ...mros.map((building) => ({ id: building.id, role: 'maintenance_tech' as const, required: MRO_TECHS_REQUIRED })),
      ...hubs.map((building) => ({ id: building.id, role: 'ground_crew' as const, required: NIGHT_HUB_GROUND_CREW })),
    ]
    const staff = calculateStaff({
      pools: ctx.staffPools,
      buildings: staffBuildings,
      transitTier: 'road',
      housingTier: 0,
      visibleWorkerSample: 0,
      elapsedSimMinutes: this.minutes,
    })
    this.throughput = new Map(staff.allocations.map((row) => [row.buildingId, finiteNumber(row.throughputMultiplier)]))
    this.techsAssigned = staff.allocations
      .filter((row) => row.role === 'maintenance_tech')
      .reduce((sum, row) => sum + row.assigned, 0)
    this.crewAssigned = staff.allocations
      .filter((row) => row.role === 'ground_crew')
      .reduce((sum, row) => sum + row.assigned, 0)

    const loads = [{ id: 'site', demand: Math.max(0, finiteNumber(ctx.otherPowerDemand ?? 0)) }]
    for (const building of mros) loads.push({ id: building.id, demand: MRO_POWER_DEMAND })
    for (const building of hubs) loads.push({ id: building.id, demand: NIGHT_HUB_POWER_DEMAND })
    const power = calculatePower(
      ctx.powerTier,
      loads,
      ctx.powerCapacityMultiplier ?? 1,
      ctx.powerDemandMultiplier ?? 1,
      ctx.batteryCapacity ?? 0,
    )
    this.powerDemand = finiteNumber(power.demand)
    this.powerCapacity = finiteNumber(power.capacity)
    const powerRate = finiteNumber(power.throughputMultiplier)
    this.curfewRelaxed = ctx.curfewRelaxed
    this.handlingTonnes = hubs.reduce((sum, hub) => {
      return sum + nightHandlingTonnes(this.throughput.get(hub.id) ?? 0, powerRate)
    }, 0)

    if (mroOn && mros.length) {
      const inducted = inductMro({
        jobs: this.jobs,
        buildings: this.buildings,
        candidates: ctx.candidates,
        now: this.minutes,
        nextInductionAt: this.nextInductionAt,
        enabled: true,
      })
      this.jobs = inducted.jobs
      this.nextInductionAt = inducted.nextInductionAt
      const advanced = advanceMro(this.jobs, dt, (buildingId) => (this.throughput.get(buildingId) ?? 0) * powerRate)
      this.jobs = advanced.jobs
      const bonus = techModifiers(ctx.unlockedTech)['maintenance.mroIncome'] ? MRO_TECH_BONUS : 1
      for (const done of advanced.completed) {
        const rate = (this.throughput.get(done.job.buildingId) ?? 0) * powerRate * bonus
        const pay = roundMoney(done.fee * rate)
        if (pay > 0) {
          this.mroRevenue += pay
          postings.push({ amount: pay, label: `${done.job.airframeId} heavy check` })
        }
      }
    } else if (dt > 0 && this.jobs.length) {
      const advanced = advanceMro(this.jobs, dt, () => 0)
      this.jobs = advanced.jobs
    }

    let paxHeat = 0
    if (hubOn && hubs.length && ctx.isNight && this.launchedNight !== ctx.nightIndex) {
      this.launchedNight = ctx.nightIndex
      let shipped = 0
      let flights = 0
      let noise = 0
      let cash = 0
      for (const hub of hubs) {
        const handling = nightHandlingTonnes(this.throughput.get(hub.id) ?? 0, powerRate)
        const planned = planNightBank(defaultNightSlots(), nightHubStorageTonnes(), handling)
        const wave = runNightBank(hub.id, ctx.nightIndex, planned)
        shipped += wave.shippedTonnes
        flights += wave.flights
        noise += wave.noise
        cash += wave.cash
      }
      this.bankTonnes = finiteNumber(shipped)
      this.bankFlights = flights
      this.nightNoise = finiteNumber(noise)
      const revenue = roundMoney(cash)
      if (revenue > 0) {
        this.nightRevenue += revenue
        postings.push({ amount: revenue, label: 'Night hub freighter wave' })
      }
      const fineRate = ctx.curfewRelaxed ? CURFEW_FINE_RELAXED : CURFEW_FINE_TIGHT
      const fine = roundMoney(this.nightNoise * fineRate)
      if (fine > 0) postings.push({ amount: -fine, label: 'Night hub curfew fine' })
      if (flights > 0) paxHeat = ctx.curfewRelaxed ? CURFEW_HEAT_RELAXED : CURFEW_HEAT_TIGHT
    }

    this.minutes += dt
    const day = Math.floor(this.minutes / DAY_MINUTES)
    if (day > this.lastUpkeepDay) {
      const days = day - this.lastUpkeepDay
      const bill = roundMoney(days * (mros.length * MRO_UPKEEP_PER_DAY + hubs.length * NIGHT_HUB_UPKEEP_PER_DAY))
      if (bill > 0) postings.push({ amount: -bill, label: 'Tier III upkeep' })
      this.lastUpkeepDay = day
    }

    return {
      postings: postings.filter((posting) => Number.isFinite(posting.amount) && posting.amount !== 0),
      paxHeat: Number.isFinite(paxHeat) ? paxHeat : 0,
    }
  }

  snapshot(): Tier3Snapshot {
    const mros = this.buildings.filter((building) => building.kind === 'mro').length
    const hubs = this.buildings.filter((building) => building.kind === 'night_hub').length
    return {
      mro: {
        built: mros,
        bays: mros * 4,
        occupied: this.jobs.length,
        standsTied: standsTied(this.jobs),
        taxiwaysTied: taxiwaysTied(this.jobs),
        techsAssigned: this.techsAssigned,
        techsRequired: mros * MRO_TECHS_REQUIRED,
        powerDemand: this.powerDemand,
        powerCapacity: this.powerCapacity,
        revenue: this.mroRevenue,
        upkeepPerDay: mros * MRO_UPKEEP_PER_DAY,
        jobs: this.jobs
          .map((job) => ({
            airframeId: job.airframeId,
            bayId: job.bayId,
            phase: job.phase,
            remainingMinutes: job.remaining,
          }))
          .sort((a, b) => a.bayId.localeCompare(b.bayId) || a.airframeId.localeCompare(b.airframeId)),
      },
      nightHub: {
        built: hubs,
        storageTonnes: hubs > 0 ? nightHubStorageTonnes() : 0,
        handlingTonnes: this.handlingTonnes,
        bankTonnes: this.bankTonnes,
        flights: this.bankFlights,
        revenue: this.nightRevenue,
        noise: this.nightNoise,
        upkeepPerDay: hubs * NIGHT_HUB_UPKEEP_PER_DAY,
        groundCrewAssigned: this.crewAssigned,
        groundCrewRequired: hubs * NIGHT_HUB_GROUND_CREW,
        curfewRelaxed: this.curfewRelaxed,
      },
    }
  }

  save(): Tier3Save {
    return {
      minutes: this.minutes,
      lastUpkeepDay: this.lastUpkeepDay,
      nextInductionAt: this.nextInductionAt,
      launchedNight: this.launchedNight,
      mroRevenue: this.mroRevenue,
      nightRevenue: this.nightRevenue,
      nightNoise: this.nightNoise,
      bankTonnes: this.bankTonnes,
      bankFlights: this.bankFlights,
      jobs: this.jobs.map((job) => ({ ...job })),
    }
  }

  static restore(saved: Tier3Save | null | undefined): Tier3Session {
    const session = new Tier3Session()
    if (!saved) return session
    session.minutes = finiteNumber(saved.minutes)
    session.lastUpkeepDay = finiteNumber(saved.lastUpkeepDay)
    session.nextInductionAt = finiteNumber(saved.nextInductionAt)
    session.launchedNight = saved.launchedNight
    session.mroRevenue = finiteNumber(saved.mroRevenue)
    session.nightRevenue = finiteNumber(saved.nightRevenue)
    session.nightNoise = finiteNumber(saved.nightNoise)
    session.bankTonnes = finiteNumber(saved.bankTonnes)
    session.bankFlights = finiteNumber(saved.bankFlights)
    session.jobs = (saved.jobs ?? []).map((job) => ({ ...job }))
    return session
  }
}

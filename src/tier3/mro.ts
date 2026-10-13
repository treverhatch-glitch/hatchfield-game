import {
  JUMBO_AIRFRAMES,
  MRO_BAYS,
  MRO_INDUCTION_GAP,
  MRO_TAXI_MINUTES,
  WIDE_AIRFRAMES,
  type BaySize,
  type MroBayDef,
} from './config.ts'
import type { MroCandidate, MroJob, Tier3Building } from './types.ts'

const RANK: Record<BaySize, number> = { narrow: 1, wide: 2, jumbo: 3 }

export function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function baySizeForAirframe(airframeId: string): BaySize {
  const id = airframeId.toLowerCase()
  if (JUMBO_AIRFRAMES.includes(id)) return 'jumbo'
  if (WIDE_AIRFRAMES.includes(id)) return 'wide'
  return 'narrow'
}

/** A bay fits its own size and anything smaller. A narrow bay refuses a widebody. */
export function bayAccepts(bay: BaySize, aircraft: BaySize): boolean {
  return RANK[bay] >= RANK[aircraft]
}

export function bayDef(id: string): MroBayDef | undefined {
  return MRO_BAYS.find((bay) => bay.id === id)
}

export function pickBay(jobs: readonly MroJob[], buildingId: string, aircraft: BaySize): MroBayDef | null {
  const taken = new Set(jobs.filter((job) => job.buildingId === buildingId).map((job) => job.bayId))
  for (const bay of MRO_BAYS) {
    if (taken.has(bay.id)) continue
    // Wide and jumbo bays stay free for those tiers. A narrowbody does not borrow them.
    if (bay.size === aircraft) return bay
  }
  return null
}

export interface InductInput {
  jobs: readonly MroJob[]
  buildings: readonly Tier3Building[]
  candidates: readonly MroCandidate[]
  now: number
  nextInductionAt: number
  enabled: boolean
}

export interface InductResult {
  jobs: MroJob[]
  nextInductionAt: number
  started: MroJob | null
}

/** One induction per gap. Stable: lowest aircraft id, then lowest hangar id. */
export function inductMro(input: InductInput): InductResult {
  const jobs = input.jobs.map((job) => ({ ...job }))
  if (!input.enabled || input.now < input.nextInductionAt) {
    return { jobs, nextInductionAt: input.nextInductionAt, started: null }
  }
  const busyAircraft = new Set(jobs.map((job) => job.aircraftId))
  const busyStands = new Set(jobs.map((job) => job.standKey))
  const hangars = input.buildings
    .filter((building) => building.kind === 'mro')
    .map((building) => building.id)
    .sort((a, b) => a.localeCompare(b))
  const candidates = [...input.candidates].sort((a, b) => a.id.localeCompare(b.id) || a.standKey.localeCompare(b.standKey))
  for (const candidate of candidates) {
    if (busyAircraft.has(candidate.id) || busyStands.has(candidate.standKey)) continue
    const size = baySizeForAirframe(candidate.airframeId)
    for (const hangarId of hangars) {
      const bay = pickBay(jobs, hangarId, size)
      if (!bay) continue
      const started: MroJob = {
        id: `${candidate.id}@${hangarId}`,
        aircraftId: candidate.id,
        buildingId: hangarId,
        bayId: bay.id,
        airframeId: candidate.airframeId,
        size,
        standKey: candidate.standKey,
        phase: 'taxi_in',
        remaining: MRO_TAXI_MINUTES,
      }
      jobs.push(started)
      return { jobs, nextInductionAt: input.now + MRO_INDUCTION_GAP, started }
    }
  }
  return { jobs, nextInductionAt: input.nextInductionAt, started: null }
}

export interface AdvanceResult {
  jobs: MroJob[]
  /** Fees before staff and power. The session scales them. */
  completed: { job: MroJob; fee: number }[]
}

/**
 * Taxi in and out always move. The bay check only moves when that hangar's
 * rate is above zero, so an empty tech pool holds the stand until the player hires.
 */
export function advanceMro(
  jobs: readonly MroJob[],
  dtMinutes: number,
  bayRateFor: (buildingId: string) => number,
): AdvanceResult {
  const dt = Math.max(0, finiteNumber(dtMinutes))
  const next: MroJob[] = []
  const completed: { job: MroJob; fee: number }[] = []
  for (const job of jobs) {
    const rate = Math.max(0, finiteNumber(bayRateFor(job.buildingId)))
    let phase = job.phase
    let remaining = finiteNumber(job.remaining)
    let left = dt
    let done = false
    while (left > 0 && !done) {
      const speed = phase === 'in_bay' ? rate : 1
      if (speed <= 0) break
      const step = Math.min(left, remaining / speed)
      remaining -= step * speed
      left -= step
      if (remaining > 1e-6) break
      if (phase === 'taxi_in') {
        phase = 'in_bay'
        remaining = bayDef(job.bayId)?.checkMinutes ?? 0
      } else if (phase === 'in_bay') {
        phase = 'taxi_out'
        remaining = MRO_TAXI_MINUTES
      } else {
        done = true
      }
    }
    if (done) {
      completed.push({ job: { ...job, phase, remaining: 0 }, fee: finiteNumber(bayDef(job.bayId)?.fee ?? 0) })
    } else {
      next.push({ ...job, phase, remaining: Math.max(0, remaining) })
    }
  }
  return { jobs: next, completed }
}

export function standsTied(jobs: readonly MroJob[]): number {
  return new Set(jobs.map((job) => job.standKey)).size
}

export function taxiwaysTied(jobs: readonly MroJob[]): number {
  return jobs.filter((job) => job.phase === 'taxi_in' || job.phase === 'taxi_out').length
}

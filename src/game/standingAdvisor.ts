import type { AirlineId } from './types.ts'
import { HEAT_ABANDON_THRESHOLD } from './catalog.ts'

export const SIM_DAY_SECONDS = 180
export const WARNING_WINDOW_DAYS = 3.0
export const RECOVERY_DAYS_THRESHOLD = 4.5

export interface IDiplomacyAdapter {
  getStanding(airlineId: AirlineId): number
  getAbandonThreshold(airlineId: AirlineId): number
  getSignedAirlines(): AirlineId[]
}

/** Default adapter wrapper around GameSim standing methods without changing diplomacy draft logic. */
export class GameDiplomacyAdapter implements IDiplomacyAdapter {
  private readonly standingFn: (id: AirlineId) => number
  private readonly signedFn: () => AirlineId[]
  private readonly banThresholdFn?: (id: AirlineId) => number

  constructor(
    standingFn: (id: AirlineId) => number,
    signedFn: () => AirlineId[],
    banThresholdFn?: (id: AirlineId) => number,
  ) {
    this.standingFn = standingFn
    this.signedFn = signedFn
    this.banThresholdFn = banThresholdFn
  }

  getStanding(airlineId: AirlineId): number {
    return this.standingFn(airlineId)
  }

  getAbandonThreshold(airlineId: AirlineId): number {
    return this.banThresholdFn ? this.banThresholdFn(airlineId) : HEAT_ABANDON_THRESHOLD
  }

  getSignedAirlines(): AirlineId[] {
    return this.signedFn()
  }
}

export type StandingCauseCategory =
  | 'baggage'
  | 'hall_amenities'
  | 'schedule'
  | 'security'
  | 'transfers'
  | 'emergencies'
  | 'cargo'

export interface CauseFix {
  category: StandingCauseCategory
  label: string
  fix: string
}

export const CAUSE_FIXES: Record<StandingCauseCategory, CauseFix> = {
  hall_amenities: {
    category: 'hall_amenities',
    label: 'Low passenger hall satisfaction & missing amenities',
    fix: 'Furnish terminal hall with food, WCs, seating, and lounges',
  },
  baggage: {
    category: 'baggage',
    label: 'Baggage delays between the bag room and the stand',
    fix: 'Keep a bag room on the terminal so tugs can reach the stand',
  },
  schedule: {
    category: 'schedule',
    label: 'Flight cancellations, slot bumps, and schedule delays',
    fix: 'Add stand/runway capacity and reduce timetable slot conflicts',
  },
  security: {
    category: 'security',
    label: 'Security screening chokes and airside incidents',
    fix: 'Add security lanes/desks and maintain security staffing',
  },
  transfers: {
    category: 'transfers',
    label: 'Poor layover transfer experience and missed connections',
    fix: 'Expand airside transfer routes and amenities',
  },
  emergencies: {
    category: 'emergencies',
    label: 'Refused diverts or failed emergency responses',
    fix: 'Accept emergency diverts and keep emergency capacity open',
  },
  cargo: {
    category: 'cargo',
    label: 'Late cargo uplift and freight handling delays',
    fix: 'Connect cargo gates to loading zones and maintain freight trucks',
  },
}

export interface StandingAdvisorCard {
  id: string
  airlineId: AirlineId
  standing: number
  daysToLeave: number
  topCauses: CauseFix[]
  createdAtClock: number
  dismissed?: boolean
}

export interface StandingSnapshot {
  clock: number
  standing: number
}

interface AirlineAdvisorEpisode {
  episodeFired: boolean
  activeCard: StandingAdvisorCard | null
  snapshots: StandingSnapshot[]
  causeImpacts: Record<StandingCauseCategory, number>
}

/**
 * Calculates estimated days until an airline leaves based on Standing trend.
 * @param currentStanding Current Standing (0-100)
 * @param ratePerSecond Rate of Standing change per sim-second (+ or -)
 * @param abandonThreshold Standing threshold where airline leaves (default 20)
 * @param simDaySec Sim-seconds in 1 game day (default 180)
 */
export function estimateDaysToLeave(
  currentStanding: number,
  ratePerSecond: number,
  abandonThreshold: number = HEAT_ABANDON_THRESHOLD,
  simDaySec: number = SIM_DAY_SECONDS,
): number {
  if (currentStanding <= abandonThreshold) {
    return 0
  }
  if (ratePerSecond >= 0) {
    return Infinity
  }
  const dropPerDay = -ratePerSecond * simDaySec
  if (dropPerDay <= 0.0001) {
    return Infinity
  }
  return (currentStanding - abandonThreshold) / dropPerDay
}

export class StandingAdvisor {
  private episodes: Map<AirlineId, AirlineAdvisorEpisode> = new Map()
  public activeCards: StandingAdvisorCard[] = []
  private adapter: IDiplomacyAdapter

  constructor(adapter: IDiplomacyAdapter) {
    this.adapter = adapter
  }

  public setAdapter(adapter: IDiplomacyAdapter) {
    this.adapter = adapter
  }

  private getEpisode(id: AirlineId): AirlineAdvisorEpisode {
    let ep = this.episodes.get(id)
    if (!ep) {
      ep = {
        episodeFired: false,
        activeCard: null,
        snapshots: [],
        causeImpacts: {
          baggage: 0,
          hall_amenities: 0,
          schedule: 0,
          security: 0,
          transfers: 0,
          emergencies: 0,
          cargo: 0,
        },
      }
      this.episodes.set(id, ep)
    }
    return ep
  }

  /**
   * Record a Standing drop cause for an airline.
   */
  public recordCauseImpact(id: AirlineId, category: StandingCauseCategory, impact: number) {
    const ep = this.getEpisode(id)
    ep.causeImpacts[category] = (ep.causeImpacts[category] ?? 0) + Math.abs(impact)
  }

  /**
   * Get top 2 causes for an airline based on recorded impact, falling back to defaults if empty.
   */
  public getTopCauses(id: AirlineId, isCargo: boolean = false): CauseFix[] {
    const ep = this.getEpisode(id)
    const sorted = (Object.keys(ep.causeImpacts) as StandingCauseCategory[])
      .map((cat) => ({ category: cat, impact: ep.causeImpacts[cat] ?? 0 }))
      .filter((x) => x.impact > 0)
      .sort((a, b) => b.impact - a.impact)

    const causes: CauseFix[] = []
    for (const item of sorted) {
      if (causes.length >= 2) break
      causes.push(CAUSE_FIXES[item.category])
    }

    // Fill defaults if less than 2
    const defaults: StandingCauseCategory[] = isCargo
      ? ['cargo', 'schedule', 'hall_amenities', 'baggage']
      : ['hall_amenities', 'baggage', 'schedule', 'security']

    for (const defCat of defaults) {
      if (causes.length >= 2) break
      if (!causes.some((c) => c.category === defCat)) {
        causes.push(CAUSE_FIXES[defCat])
      }
    }

    return causes.slice(0, 2)
  }

  /**
   * Sample Standing and update advisor warning cards.
   */
  public tick(clock: number, _dt: number, isCargoFn?: (id: AirlineId) => boolean) {
    const signed = this.adapter.getSignedAirlines()

    // Clean up unsigned airlines
    for (const id of Array.from(this.episodes.keys())) {
      if (!signed.includes(id)) {
        this.episodes.delete(id)
        this.activeCards = this.activeCards.filter((c) => c.airlineId !== id)
      }
    }

    for (const id of new Set(signed)) {
      const ep = this.getEpisode(id)
      const currentStanding = this.adapter.getStanding(id)
      const abandonThreshold = this.adapter.getAbandonThreshold(id)

      // Add snapshot
      ep.snapshots.push({ clock, standing: currentStanding })
      // Keep last 360 seconds of snapshots
      const cutoff = clock - 360
      ep.snapshots = ep.snapshots.filter((s) => s.clock >= cutoff)

      // Calculate trend (rate per second)
      let ratePerSecond = 0
      if (ep.snapshots.length >= 2) {
        const oldest = ep.snapshots[0]
        const newest = ep.snapshots[ep.snapshots.length - 1]
        const timeDiff = newest.clock - oldest.clock
        if (timeDiff >= 1) {
          ratePerSecond = (newest.standing - oldest.standing) / timeDiff
        }
      }

      const daysToLeave = estimateDaysToLeave(currentStanding, ratePerSecond, abandonThreshold)

      // Early warning condition: predicted leaving within ~3 game days
      const isRisk = daysToLeave <= WARNING_WINDOW_DAYS && daysToLeave >= 0

      if (isRisk) {
        if (!ep.episodeFired) {
          // Fire card once per episode!
          ep.episodeFired = true
          const isCargo = isCargoFn ? isCargoFn(id) : false
          const topCauses = this.getTopCauses(id, isCargo)
          const card: StandingAdvisorCard = {
            id: `advisor-standing-${id}-${Math.floor(clock)}`,
            airlineId: id,
            standing: Math.round(currentStanding),
            daysToLeave: Math.max(0, Math.round(daysToLeave * 10) / 10),
            topCauses,
            createdAtClock: clock,
          }
          ep.activeCard = card
          this.activeCards.push(card)
        } else if (ep.activeCard) {
          // Update live metrics on the existing episode card
          ep.activeCard.standing = Math.round(currentStanding)
          ep.activeCard.daysToLeave = Math.max(0, Math.round(daysToLeave * 10) / 10)
        }
      } else {
        // Recovery check: reset episode if daysToLeave > 4.5 or Standing >= 55
        const isRecovered = daysToLeave > RECOVERY_DAYS_THRESHOLD || currentStanding >= 55
        if (isRecovered) {
          ep.episodeFired = false
          if (ep.activeCard) {
            this.dismissCard(ep.activeCard.id)
            ep.activeCard = null
          }
        }
      }
    }
  }

  public dismissCard(cardId: string) {
    this.activeCards = this.activeCards.filter((c) => c.id !== cardId)
  }
}

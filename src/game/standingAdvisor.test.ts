import { describe, expect, it } from 'vitest'
import {
  estimateDaysToLeave,
  StandingAdvisor,
  CAUSE_FIXES,
  type IDiplomacyAdapter,
} from './standingAdvisor.ts'
import type { AirlineId } from './types.ts'

describe('estimateDaysToLeave', () => {
  it('correctly calculates days to leave when Standing is dropping', () => {
    // Current standing = 35, threshold = 20, drop needed = 15 points.
    // Drop rate = 15 points per game day = 15/180 points per sim-second.
    const days = estimateDaysToLeave(35, -15 / 180, 20, 180)
    expect(days).toBeCloseTo(1.0, 5)
  })

  it('predicts exactly 3 game days when drop rate matches 5 points per day for 15 point drop', () => {
    // Current standing = 35, threshold = 20, drop needed = 15 points.
    // Drop rate = 5 points per day = 5/180 pts/sec.
    const days = estimateDaysToLeave(35, -5 / 180, 20, 180)
    expect(days).toBeCloseTo(3.0, 5)
  })

  it('returns Infinity when Standing is stable or rising', () => {
    expect(estimateDaysToLeave(50, 0, 20, 180)).toBe(Infinity)
    expect(estimateDaysToLeave(50, 0.1, 20, 180)).toBe(Infinity)
  })

  it('returns 0 if current Standing is already at or below abandon threshold', () => {
    expect(estimateDaysToLeave(20, -0.05, 20, 180)).toBe(0)
    expect(estimateDaysToLeave(15, -0.05, 20, 180)).toBe(0)
  })

  it('supports custom abandon threshold and sim day length', () => {
    // Threshold = 25, current = 40, drop needed = 15. Drop rate = 15/100 per sec, simDay = 100s.
    const days = estimateDaysToLeave(40, -15 / 100, 25, 100)
    expect(days).toBeCloseTo(1.0, 5)
  })
})

describe('StandingAdvisor top causes and suggested fixes', () => {
  class MockAdapter implements IDiplomacyAdapter {
    public standing: number = 70
    getStanding(): number {
      return this.standing
    }
    getAbandonThreshold(): number {
      return 20
    }
    getSignedAirlines(): AirlineId[] {
      return ['sky']
    }
  }

  it('ranks recorded cause impacts and provides top 2 causes with fixes', () => {
    const adapter = new MockAdapter()
    const advisor = new StandingAdvisor(adapter)

    advisor.recordCauseImpact('sky', 'hall_amenities', 12)
    advisor.recordCauseImpact('sky', 'baggage', 25)
    advisor.recordCauseImpact('sky', 'schedule', 5)

    const top = advisor.getTopCauses('sky', false)
    expect(top).toHaveLength(2)
    expect(top[0]).toEqual(CAUSE_FIXES.baggage)
    expect(top[1]).toEqual(CAUSE_FIXES.hall_amenities)
    expect(top[0].fix).toContain('bag room')
    expect(top[1].fix).toContain('food, WCs')
  })

  it('returns default causes if no impacts were recorded', () => {
    const adapter = new MockAdapter()
    const advisor = new StandingAdvisor(adapter)

    const topPax = advisor.getTopCauses('sky', false)
    expect(topPax).toHaveLength(2)
    expect(topPax[0]).toEqual(CAUSE_FIXES.hall_amenities)
    expect(topPax[1]).toEqual(CAUSE_FIXES.baggage)

    const topCargo = advisor.getTopCauses('sky', true)
    expect(topCargo).toHaveLength(2)
    expect(topCargo[0]).toEqual(CAUSE_FIXES.cargo)
    expect(topCargo[1]).toEqual(CAUSE_FIXES.schedule)
  })
})

describe('StandingAdvisor card episode lifecycle', () => {
  class MutableAdapter implements IDiplomacyAdapter {
    public standingMap: Record<string, number> = { sky: 50 }
    public signed: AirlineId[] = ['sky']

    getStanding(id: AirlineId): number {
      return this.standingMap[id] ?? 70
    }
    getAbandonThreshold(): number {
      return 20
    }
    getSignedAirlines(): AirlineId[] {
      return this.signed
    }
  }

  it('fires advisor card ONCE per episode when trend predicts leaving <= 3 game days', () => {
    const adapter = new MutableAdapter()
    const advisor = new StandingAdvisor(adapter)

    // Tick 0: Standing = 50
    adapter.standingMap['sky'] = 50
    advisor.tick(0, 1)
    expect(advisor.activeCards).toHaveLength(0)

    // Tick 60: Standing drops to 35
    // Trend = (35 - 50) / 60 = -0.25 pts/sec = -45 pts/day (180s/day).
    // Days to leave = (35 - 20) / 45 = 0.33 days <= 3.0 days.
    adapter.standingMap['sky'] = 35
    advisor.tick(60, 1)

    // Early warning card should fire!
    expect(advisor.activeCards).toHaveLength(1)
    const card1 = advisor.activeCards[0]
    expect(card1.airlineId).toBe('sky')
    expect(card1.daysToLeave).toBeLessThanOrEqual(3.0)
    expect(card1.topCauses).toHaveLength(2)

    // Ticks 70, 80, 90: Standing continues dropping to 30, 25, 22
    adapter.standingMap['sky'] = 30
    advisor.tick(70, 1)
    adapter.standingMap['sky'] = 25
    advisor.tick(80, 1)
    adapter.standingMap['sky'] = 22
    advisor.tick(90, 1)

    // MUST STILL FIRE ONCE PER EPISODE: Active cards count stays 1!
    expect(advisor.activeCards).toHaveLength(1)

    // Recovery: Standing recovers above 55 (e.g. 60)
    adapter.standingMap['sky'] = 60
    advisor.tick(150, 1)

    // Card dismissed on recovery and episode reset
    expect(advisor.activeCards).toHaveLength(0)

    // New collapse episode: Standing drops to 32 over 60 seconds
    adapter.standingMap['sky'] = 32
    advisor.tick(210, 1)

    // Card fires ONCE again for the new episode
    expect(advisor.activeCards).toHaveLength(1)
  })

  it('reads Standing strictly via DiplomacyAdapter', () => {
    let adapterCalled = false
    const customAdapter: IDiplomacyAdapter = {
      getStanding: () => {
        adapterCalled = true
        return 40
      },
      getAbandonThreshold: () => 20,
      getSignedAirlines: () => ['sky'],
    }

    const advisor = new StandingAdvisor(customAdapter)
    advisor.tick(0, 1)
    expect(adapterCalled).toBe(true)
  })
})

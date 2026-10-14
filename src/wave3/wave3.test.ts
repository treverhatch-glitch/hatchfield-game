import { describe, expect, it } from 'vitest'
import { generateContractOffers } from '../airlines/logic.ts'
import { DEFAULT_AIRLINES } from '../airlines/data.ts'
import type { AirlineState, AirportCapabilities } from '../airlines/types.ts'
import { Wave3Engine } from './engine.ts'
import { fleetHasMainlineNarrowbody, fleetIdsFor, metalAllowed } from './fleet.ts'
import { shapeAirlineOffer } from './contracts.ts'
import { labFrame } from './animation.ts'
import { shiftScore } from './relations.ts'
import { emptyRelations } from './relations.ts'

describe('wave 3 research points', () => {
  it('keeps lab animation and does not bank a second research wallet', () => {
    const engine = new Wave3Engine()
    expect(engine.points()).toBe(0)
    engine.tick(120, true, { desk: 8, board: 4, machine: 4 })
    expect(engine.points()).toBe(0)
    expect(engine.state.research.carry).toBe(0)
    expect(engine.state.research.animSeconds).toBeCloseTo(120, 5)
  })

  it('changes the HUD key when a relationship moves, so the letter repaints', () => {
    const engine = new Wave3Engine()
    const before = engine.chromeKey()
    engine.noteLetter('bushline', 'accept')
    expect(engine.chromeKey()).not.toBe(before)
    expect(engine.chromeKey()).toContain('bushline:2:')
  })

  it('does not earn while the airport clock is not running', () => {
    const engine = new Wave3Engine()
    engine.tick(600, false, { desk: 0, board: 0, machine: 0 })
    expect(engine.points()).toBe(0)
    expect(engine.state.research.carry).toBe(0)
  })

  it('does not pay research points when a turnaround is graded', () => {
    const engine = new Wave3Engine()
    engine.noteTurnaround('harbor', 'success')
    expect(engine.points()).toBe(0)
    expect(engine.relation('harbor').score).toBeGreaterThan(0)
  })
})

describe('wave 3 airline fleets', () => {
  it('keeps Bushline on the commuter fleet at every contract tier', () => {
    const fleet = fleetIdsFor('bushline')
    expect(fleet).toEqual(['bn2', 'dhc6'])
    expect(fleetHasMainlineNarrowbody(fleet)).toBe(false)
    for (const score of [0, 20, 45, 70, 100]) {
      const relations = shiftScore(emptyRelations(), 'bushline', score)
      const shaped = shapeAirlineOffer(
        { id: 'bushline', name: 'Bushline Local', fleet: [...fleet] },
        {
          slotsPerWeek: 14,
          feePerPassenger: 5,
          feePerLanding: 150,
          penaltyPerCancellation: 500,
          penaltyPerDelayMinute: 5,
        },
        relations,
      )
      expect(shaped.airframes).toEqual(['bn2', 'dhc6'])
      expect(metalAllowed(shaped.airframes, 'b738')).toBe(false)
      expect(metalAllowed(shaped.airframes, 'a321')).toBe(false)
      expect(shaped.line).toContain('BN-2 Islander')
    }
  })

  it('improves fees without swapping a regional fleet for a 737', () => {
    const airline = DEFAULT_AIRLINES.find((row) => row.id === 'air_regional_1')!
    const base: AirlineState = {
      availableAirlines: DEFAULT_AIRLINES,
      unlockedAirlines: [airline.id],
      contractOffers: [],
      activeContracts: [],
      cooldowns: {},
      penaltyTiers: {},
      elapsedMinutes: 1440,
      events: [],
    }
    const airport: AirportCapabilities = {
      runwayLengthMeters: 2000,
      hasSmallStands: true,
      hasMediumStands: false,
      hasHeavyStands: false,
      terminalRating: 2,
      hasFuelService: false,
      hasCateringService: false,
      hasMaintenanceService: false,
      hasHeavyVehicles: false,
      onTimePercentage: 100,
      totalFlightsHandled: 0,
    }
    const random = Math.random
    Math.random = () => 0
    const plain = generateContractOffers(base, airport, 1440)
    const promoted = generateContractOffers(
      {
        ...base,
        relations: shiftScore(emptyRelations(), airline.id, 95),
      },
      airport,
      1440,
    )
    Math.random = random
    expect(plain.contractOffers[0]?.airframes).toEqual(['crj700', 'e175', 'atr72'])
    expect(promoted.contractOffers[0]?.airframes).toEqual(['crj700', 'e175', 'atr72'])
    expect(promoted.contractOffers[0]?.airframes).not.toContain('b738')
    expect(promoted.contractOffers[0]?.airframes).not.toContain('a321')
    expect(promoted.contractOffers[0]?.contractTier).toBe(5)
    expect(promoted.contractOffers[0]!.terms.feePerLanding).toBeGreaterThan(plain.contractOffers[0]!.terms.feePerLanding)
  })
})

describe('research room placeholder', () => {
  it('stays empty until a room is placed, then cycles', () => {
    expect(labFrame(10, { desk: 0, board: 0, machine: 0 }).phase).toBe('empty')
    const working = labFrame(0.4, { desk: 1, board: 0, machine: 0 })
    expect(working.phase).toBe('scan')
    expect(working.rooms).toBe(1)
    expect(working.bob).toBeGreaterThanOrEqual(0)
    expect(working.bob).toBeLessThanOrEqual(1)
  })
})

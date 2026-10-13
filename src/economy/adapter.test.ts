import { describe, expect, it, vi } from 'vitest'
import { createEconomyAdapter, type EconomyHost } from './adapter.ts'
import { runHeadlessBalance } from './balance.ts'

function host(overrides: Partial<EconomyHost> = {}): EconomyHost {
  return {
    getFieldLevel: () => 1,
    isAirportOperational: () => true,
    getAbsoluteDay: () => 120,
    getStaffPools: () => ({ researcher: { hired: 4, wagePerDay: 180 } }),
    getStaffBuildings: () => [],
    getResearchRooms: () => [{ id: 'rd', desks: 4, powerDemand: 30 }],
    getPowerLoads: () => [],
    getChains: () => [],
    getTransitTier: () => 'road',
    getHousingTier: () => 0,
    getPowerPlantTier: () => 1,
    ...overrides,
  }
}

describe('terminal economy adapter', () => {
  it('converts the compressed terminal clock or accepts real elapsed time', () => {
    const adapter = createEconomyAdapter(host())
    adapter.tick(480)
    expect(adapter.snapshot().state.elapsedRealMinutes).toBe(1)
    adapter.tick(0, 60)
    expect(adapter.snapshot().state.elapsedRealMinutes).toBe(2)
  })

  it('routes fuel ground stops separately from soft failure hooks', () => {
    const setFuelGroundStop = vi.fn()
    const addFlightDelay = vi.fn()
    const addRatingHit = vi.fn()
    const adapter = createEconomyAdapter(host({ setFuelGroundStop, addFlightDelay, addRatingHit }))
    adapter.reportFailure('fuel_outage', 'farm', 'fuel', 'Fuel farm empty')
    expect(setFuelGroundStop).toHaveBeenCalledWith('farm', true)
    expect(addFlightDelay).not.toHaveBeenCalled()
    adapter.reportFailure('equipment_failure', 'belt-1', 'baggage', 'Sorter stopped')
    expect(addFlightDelay).toHaveBeenCalledWith('belt-1', 18, 'Sorter stopped')
    expect(addRatingHit).toHaveBeenCalled()
    adapter.clearFuelOutage('farm')
    expect(setFuelGroundStop).toHaveBeenLastCalledWith('farm', false)
  })
})

describe('headless economy balance', () => {
  it('meets early specialization and late-game breadth targets', () => {
    const report = runHeadlessBalance()
    expect(report.early.researchPointsEarned).toBeGreaterThanOrEqual(10)
    expect(report.early.researchPointsEarned).toBeLessThanOrEqual(12)
    expect(report.early.canAffordOneBranchThroughTier3).toBe(true)
    expect(report.late.affordableTreeShare).toBeGreaterThanOrEqual(0.75)
    expect(report.late.affordableTreeShare).toBeLessThan(1)
  })
})

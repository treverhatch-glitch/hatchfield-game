import { describe, expect, it } from 'vitest'
import { LAND_PLOT } from '../game/catalog.ts'
import { commitPlot, nextPlotOffer, plotPrice, starterHolding, starterPlotId } from './plots.ts'
import { dailySinks, loanInterestPerDay } from './sinks.ts'
import type { DailySinkInput } from './types.ts'

const config = LAND_PLOT

describe('land.edge: purchase gating', () => {
  it('rejects purchasing non-existent plots', () => {
    const owned = [starterHolding(config)]
    const result = commitPlot(owned, '999,999', 5, config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('That plot is not on this map.')
    }
  })

  it('rejects purchasing already owned plots', () => {
    const starter = starterHolding(config)
    const owned = [starter]
    const result = commitPlot(owned, starter.id, 5, config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('Already owned.')
    }
  })

  it('rejects purchasing non-adjacent plots even at high field level', () => {
    const owned = [starterHolding(config)]
    // (col 0, row 0) or far corner
    const result = commitPlot(owned, '0,0', 5, config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('That plot does not touch land you own.')
    }
  })

  it('gates adjacent plot purchases strictly behind field level thresholds', () => {
    let owned = [starterHolding(config)]
    const offer1 = nextPlotOffer(owned, 1, config)
    expect(offer1).not.toBeNull()
    if (!offer1) return

    // Level 1 is too low for expansion when starting
    expect(offer1.locked).toBe(true)
    const tryLowLevel = commitPlot(owned, offer1.id, 1, config)
    expect(tryLowLevel.ok).toBe(false)

    // Level 2 allows buying
    const buyLevel2 = commitPlot(owned, offer1.id, 2, config)
    expect(buyLevel2.ok).toBe(true)
    if (!buyLevel2.ok) return
    owned = buyLevel2.owned

    // Test capping logic as owned plot count increases
    const offer2 = nextPlotOffer(owned, 2, config)
    expect(offer2).not.toBeNull()
    if (offer2) {
      // Need higher level after buying parcel
      expect(offer2.needLevel).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('land.edge: plot tax and daily sinks calculation', () => {
  it('prorates property tax daily based on assessed plot values', () => {
    const input: DailySinkInput = {
      plots: [
        { assessed: 100_000 },
        { assessed: 200_000 },
      ],
      incidents: 0,
      assetValue: 0,
      powerLoad: 0,
      waterLoad: 0,
      operational: false,
      fieldLevel: 1,
      fireStations: 0,
      intl: false,
      maintenanceContract: false,
      loanBalance: 0,
      loanRate: 0,
      loanFloor: 0,
      loanEverySeconds: 0,
      sandbox: false,
    }

    const result = dailySinks(input, config)
    const taxLine = result.lines.find((l) => l.id === 'property_tax')
    expect(taxLine).toBeDefined()
    const expectedTax = Math.round(300_000 * config.propertyTaxRate)
    expect(taxLine?.amount).toBe(expectedTax)
    expect(result.chargedTotal).toBeGreaterThan(0)
  })

  it('charges zero in sandbox mode', () => {
    const input: DailySinkInput = {
      plots: [{ assessed: 100_000 }],
      incidents: 0,
      assetValue: 50_000,
      powerLoad: 10,
      waterLoad: 10,
      operational: true,
      fieldLevel: 1,
      fireStations: 1,
      intl: true,
      maintenanceContract: true,
      loanBalance: 0,
      loanRate: 0,
      loanFloor: 0,
      loanEverySeconds: 0,
      sandbox: true,
    }

    const result = dailySinks(input, config)
    expect(result.chargedTotal).toBe(0)
    expect(result.quotedTotal).toBe(0)
    for (const line of result.lines) {
      if (line.charged) {
        expect(line.amount).toBe(0)
      }
    }
  })
})

describe('land.edge: no NaN at zero or invalid values', () => {
  it('returns valid numbers without NaN when asset values, loads, or balances are zero', () => {
    const input: DailySinkInput = {
      plots: [],
      incidents: 0,
      assetValue: 0,
      powerLoad: 0,
      waterLoad: 0,
      operational: false,
      fieldLevel: 0,
      fireStations: 0,
      intl: false,
      maintenanceContract: false,
      loanBalance: 0,
      loanRate: 0,
      loanFloor: 0,
      loanEverySeconds: 0,
      sandbox: false,
    }

    const sinks = dailySinks(input, config)
    expect(Number.isNaN(sinks.chargedTotal)).toBe(false)
    expect(Number.isNaN(sinks.quotedTotal)).toBe(false)
    expect(sinks.chargedTotal).toBe(0)
    expect(sinks.quotedTotal).toBe(0)
  })

  it('handles negative, NaN, or Infinity input values gracefully in dailySinks', () => {
    const input: DailySinkInput = {
      plots: [{ assessed: NaN }],
      incidents: -5,
      assetValue: -100,
      powerLoad: NaN,
      waterLoad: Infinity,
      operational: true,
      fieldLevel: -2,
      fireStations: -1,
      intl: false,
      maintenanceContract: false,
      loanBalance: NaN,
      loanRate: -0.05,
      loanFloor: NaN,
      loanEverySeconds: -10,
      sandbox: false,
    }

    const sinks = dailySinks(input, config)
    expect(Number.isNaN(sinks.chargedTotal)).toBe(false)
    expect(Number.isNaN(sinks.quotedTotal)).toBe(false)
    for (const line of sinks.lines) {
      expect(Number.isNaN(line.amount)).toBe(false)
      expect(Number.isFinite(line.amount)).toBe(true)
      expect(line.amount).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles zero and NaN inputs gracefully in loanInterestPerDay', () => {
    expect(loanInterestPerDay({ loanBalance: 0, loanRate: 0.05, loanFloor: 10, loanEverySeconds: 3600 })).toBe(0)
    expect(loanInterestPerDay({ loanBalance: 1000, loanRate: NaN, loanFloor: 0, loanEverySeconds: 3600 })).toBe(0)
    expect(loanInterestPerDay({ loanBalance: 1000, loanRate: 0.05, loanFloor: 0, loanEverySeconds: 0 })).toBe(0)
    expect(loanInterestPerDay({ loanBalance: -500, loanRate: 0.05, loanFloor: 10, loanEverySeconds: 3600 })).toBe(0)
  })

  it('handles zero and invalid parameters in plotPrice without returning NaN', () => {
    const starter = { id: starterPlotId(config), col: 0, row: 0, zone: 'core' as const, distance: 0 }
    const priceZeroOwned = plotPrice(starter, 0, config)
    expect(Number.isNaN(priceZeroOwned)).toBe(false)
    expect(priceZeroOwned).toBeGreaterThanOrEqual(0)

    const negativeDistPlot = { id: '0,0', col: 0, row: 0, zone: 'core' as const, distance: -5 }
    const priceNegDist = plotPrice(negativeDistPlot, 1, config)
    expect(Number.isNaN(priceNegDist)).toBe(false)
    expect(priceNegDist).toBeGreaterThanOrEqual(0)
  })
})

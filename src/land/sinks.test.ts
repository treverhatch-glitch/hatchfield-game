import { describe, expect, it } from 'vitest'
import { LAND_PLOT } from '../game/catalog.ts'
import { starterHolding } from './plots.ts'
import { dailySinks, loanInterestPerDay } from './sinks.ts'
import type { DailySinkInput } from './types.ts'

const config = LAND_PLOT

function input(patch: Partial<DailySinkInput> = {}): DailySinkInput {
  return {
    plots: [starterHolding(config)],
    assetValue: 0,
    incidents: 0,
    fieldLevel: 1,
    operational: false,
    powerLoad: 0,
    waterLoad: 0,
    fireStations: 0,
    intl: false,
    maintenanceContract: false,
    loanBalance: 0,
    loanRate: 0,
    loanFloor: 0,
    loanEverySeconds: 55,
    sandbox: false,
    ...patch,
  }
}

describe('recurring sinks', () => {
  it('bills every operating sink and only quotes loan interest', () => {
    const report = dailySinks(
      input({
        assetValue: 500_000,
        incidents: 2,
        fieldLevel: 4,
        operational: true,
        powerLoad: 10,
        waterLoad: 4,
        fireStations: 2,
        intl: true,
        maintenanceContract: true,
        loanBalance: 80_000,
        loanRate: 0.012,
        loanFloor: 1_250,
        loanEverySeconds: 60,
      }),
      config,
    )
    const ids = report.lines.map((line) => line.id)
    expect(ids).toEqual([
      'plot_upkeep',
      'property_tax',
      'insurance',
      'utilities',
      'licence_operating',
      'licence_arff',
      'licence_intl',
      'maintenance_contract',
      'loan_interest',
    ])
    const interest = report.lines.find((line) => line.id === 'loan_interest')!
    expect(interest.charged).toBe(false)
    expect(interest.amount).toBe(loanInterestPerDay(input({
      loanBalance: 80_000,
      loanRate: 0.012,
      loanFloor: 1_250,
      loanEverySeconds: 60,
    })))
    const charged = report.lines.filter((line) => line.charged).reduce((sum, line) => sum + line.amount, 0)
    expect(report.chargedTotal).toBe(charged)
    expect(report.quotedTotal).toBe(charged + interest.amount)
    expect(report.lines.find((line) => line.id === 'insurance')!.amount).toBeGreaterThan(
      dailySinks(input({ assetValue: 500_000, operational: true }), config).lines.find((line) => line.id === 'insurance')!
        .amount,
    )
  })

  it('drops a sink when its driver is off, waives sandbox charges, and stays finite', () => {
    const quiet = dailySinks(input(), config)
    expect(quiet.lines.map((line) => line.id)).toEqual(['plot_upkeep', 'property_tax', 'insurance'])
    expect(quiet.chargedTotal).toBeGreaterThan(0)

    const sandbox = dailySinks(input({ sandbox: true, maintenanceContract: true, operational: true }), config)
    expect(sandbox.chargedTotal).toBe(0)
    expect(sandbox.lines.filter((line) => line.charged).every((line) => line.amount === 0)).toBe(true)

    const broken = dailySinks(
      input({
        plots: [{ assessed: Number.NaN }],
        assetValue: Number.POSITIVE_INFINITY,
        incidents: Number.NaN,
        powerLoad: -4,
        waterLoad: Number.NaN,
        fieldLevel: Number.NaN,
        loanBalance: Number.NaN,
        loanEverySeconds: 0,
      }),
      config,
    )
    expect(Number.isFinite(broken.chargedTotal)).toBe(true)
    expect(Number.isFinite(broken.quotedTotal)).toBe(true)
    expect(broken.lines.every((line) => Number.isFinite(line.amount))).toBe(true)
  })
})

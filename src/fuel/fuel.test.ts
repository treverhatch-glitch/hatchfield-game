import { describe, expect, it } from 'vitest'
import { measure } from '../landside/engine.ts'
import type { LandsideField } from '../landside/types.ts'
import { FUEL } from './config.ts'
import { FuelChain } from './engine.ts'
import type { Cell, FuelOrder } from './types.ts'

function roads(): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r <= 8; r++) cells.push({ c: 7, r })
  return cells
}

function order(patch: Partial<FuelOrder> = {}): FuelOrder {
  return {
    capacityLitres: 80_000,
    litres: 4_000,
    mode: 'tanker',
    tankerLitres: 36_000,
    leadMinutes: 30,
    wholesalePerLitre: 0.02,
    cash: 100_000,
    truckDrawPerMin: 0,
    hydrantDrawPerMin: 0,
    pipelinePerMin: 0,
    roads: roads(),
    farms: [{ c: 7, r: 8 }],
    flights: [
      { id: 'early', litres: 6_000, departAt: 1 },
      { id: 'late', litres: 6_000, departAt: 2 },
    ],
    ...patch,
  }
}

describe('fuel farm supply', () => {
  it('grounds flights when the farm runs dry and releases them after the tanker docks', () => {
    const chain = new FuelChain()
    let litres = 4_000
    let view = chain.tick(1, order({ litres, truckDrawPerMin: 2_000 }))
    litres = view.litres
    expect(litres).toBe(2_000)
    expect(view.groundedIds).toEqual(['early', 'late'])
    expect(view.roadVehPerMin).toBe(FUEL.tankerVehPerMin)
    expect(view.queue[0]?.state).toBe('road')
    expect(view.path.length).toBeGreaterThan(1)

    let docked = false
    let paid = 0
    for (let minute = 0; minute < 90; minute++) {
      view = chain.tick(1, order({ litres, truckDrawPerMin: 0 }))
      litres = view.litres
      paid += view.paid
      if (view.dock?.farm === 'farm_fill' && view.dock.truck === 'truck_fill') docked = true
    }
    expect(docked).toBe(true)
    expect(paid).toBeCloseTo(36_000 * 0.02)
    expect(litres).toBeGreaterThan(30_000)
    expect(view.groundedIds).toEqual([])
  })

  it('a hydrant draw takes litres out of the same tank', () => {
    const chain = new FuelChain()
    const view = chain.tick(2, order({
      litres: 1_000,
      truckDrawPerMin: 0,
      hydrantDrawPerMin: 400,
      flights: [],
    }))
    expect(view.litres).toBe(200)
    expect(view.hydrantDrawPerMin).toBe(400)
    expect(view.truckDrawPerMin).toBe(0)
  })

  it('a pipeline on the road refills the farm and releases the grounded flight', () => {
    const chain = new FuelChain()
    const flights = [{ id: 'A', litres: 5_000, departAt: 1 }]
    let view = chain.tick(0, order({
      litres: 0,
      mode: 'pipeline',
      pipelinePerMin: 1_000,
      flights,
    }))
    expect(view.groundedIds).toEqual(['A'])
    expect(view.roadVehPerMin).toBe(FUEL.pipelineVehPerMin)
    expect(view.queue[0]?.mode).toBe('pipeline')
    view = chain.tick(6, order({
      litres: view.litres,
      mode: 'pipeline',
      pipelinePerMin: 1_000,
      flights,
    }))
    expect(view.litres).toBe(6_000)
    expect(view.paid).toBeCloseTo(6_000 * 0.02)
    expect(view.groundedIds).toEqual([])
    expect(view.dock).toEqual({ farm: 'farm_fill', truck: 'truck_fill' })
  })

  it('puts the tanker on the landside road flow', () => {
    const base: LandsideField = {
      roads: roads(),
      terminals: [{ c: 6, r: 6 }],
      busBays: [],
      parks: [],
      rail: false,
      paxPerDay: 0,
      departures: 1,
    }
    const quiet = measure(base)
    const loaded = measure({ ...base, extraVehPerMin: FUEL.tankerVehPerMin })
    expect(loaded.roadVehPerMin).toBeCloseTo(quiet.roadVehPerMin + FUEL.tankerVehPerMin)
    expect(loaded.curbVehPerMin).toBeCloseTo(quiet.curbVehPerMin)
  })
})

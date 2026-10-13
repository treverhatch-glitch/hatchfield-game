import { describe, expect, it } from 'vitest'
import { createRng, usingSimRng } from '../core/rng.ts'
import {
  AIRLINES,
  BUILDINGS,
  FIELD_LEVEL_XP,
  HEAVY_RUNWAY_COST,
  HOTEL_BIZ_COST,
  HOTEL_CLASS_EXPENSE,
  HOTEL_CLASS_INCOME,
  HOTEL_TILE_COST,
  PARK_EXPENSE,
  PARK_INCOME,
  START_CASH,
  fieldLevelFromXp,
  createProcAirline,
} from './catalog.ts'
import { loadCatalog } from './catalogData.ts'
import airlinesJson from '../data/airlines.json' with { type: 'json' }
import buildingsJson from '../data/buildings.json' with { type: 'json' }
import costsJson from '../data/costs.json' with { type: 'json' }
import terminalJson from '../data/terminal.json' with { type: 'json' }

describe('catalog JSON', () => {
  it('loads the shipped balance numbers', () => {
    expect(START_CASH.easy).toBe(220_000)
    expect(START_CASH.standard).toBe(150_000)
    expect(AIRLINES.northline.id).toBe('northline')
    expect(AIRLINES.northline.name).toBe('Northline')
    expect(BUILDINGS.length).toBeGreaterThan(0)
    expect(FIELD_LEVEL_XP).toEqual([0, 0, 90, 220, 420, 700])
    expect(HEAVY_RUNWAY_COST).toBe(72_000)
    expect(fieldLevelFromXp(90)).toBe(2)
    expect(fieldLevelFromXp(89)).toBe(1)
  })

  it('keeps the income aliases on the same records', () => {
    expect(PARK_INCOME).toBe(PARK_EXPENSE)
    expect(HOTEL_CLASS_INCOME).toBe(HOTEL_CLASS_EXPENSE)
    expect(HOTEL_TILE_COST).toBe(HOTEL_BIZ_COST)
  })

  it('rejects a catalog that drops northline', () => {
    expect(() =>
      loadCatalog({
        costs: costsJson,
        airlines: { ...airlinesJson, AIRLINES: { bushline: airlinesJson.AIRLINES.bushline } },
        buildings: buildingsJson,
        terminal: terminalJson,
      }),
    ).toThrow(/northline/)
  })

  it('rejects a non-finite start cash', () => {
    expect(() =>
      loadCatalog({
        costs: { ...costsJson, START_CASH: { easy: Number.NaN, standard: 150_000 } },
        airlines: airlinesJson,
        buildings: buildingsJson,
        terminal: terminalJson,
      }),
    ).toThrow(/START_CASH.easy/)
  })

  it('builds the same procedural carrier from one seed', () => {
    const roll = () => usingSimRng(createRng(7), () => createProcAirline())
    expect(roll()).toEqual(roll())
  })
})

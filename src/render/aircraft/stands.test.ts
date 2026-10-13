import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../../game/airframes'
import { getAircraftSpec, MODEL_SPECS, WORLD_PER_METER } from './specs'
import { bridgeStops, doorBoxes, standAccepts, type IcaoCode } from './stands'

const LETTERS: IcaoCode[] = ['A', 'B', 'C', 'D', 'E', 'F']

describe('stand class compatibility', () => {
  it('gives every catalog airframe the pack ICAO code', () => {
    for (const id of Object.keys(AIRFRAMES)) {
      expect(MODEL_SPECS[id].icao, id).toBeTruthy()
      expect(getAircraftSpec(id).icao).toBe(MODEL_SPECS[id].icao)
    }
    expect(getAircraftSpec('b738').icao).toBe('C')
    expect(getAircraftSpec('b789').icao).toBe('E')
    expect(getAircraftSpec('a380').icao).toBe('F')
    expect(getAircraftSpec('aw139').icao).toBe('H')
    expect(getAircraftSpec('f15').icao).toBe('A')
  })

  it('lets a stand accept its own code and every smaller fixed-wing code', () => {
    for (const stand of LETTERS) {
      for (const aircraft of LETTERS) {
        const fits = LETTERS.indexOf(aircraft) <= LETTERS.indexOf(stand)
        expect(standAccepts(stand, aircraft), `${stand} vs ${aircraft}`).toBe(fits)
      }
    }
    expect(standAccepts('C', 'B')).toBe(true)
    expect(standAccepts('C', 'C')).toBe(true)
    expect(standAccepts('B', 'C')).toBe(false)
    expect(standAccepts('E', 'F')).toBe(false)
    expect(standAccepts('F', 'E')).toBe(true)
  })

  it('keeps helicopters on a helipad', () => {
    expect(standAccepts('H', 'H')).toBe(true)
    for (const stand of LETTERS) {
      expect(standAccepts(stand, 'H')).toBe(false)
      expect(standAccepts('H', stand)).toBe(false)
    }
    expect(standAccepts('F', getAircraftSpec('s76').icao)).toBe(false)
    expect(standAccepts('C', getAircraftSpec('crj700').icao)).toBe(true)
    expect(standAccepts('C', getAircraftSpec('b789').icao)).toBe(false)
    expect(standAccepts('F', getAircraftSpec('a380').icao)).toBe(true)
  })

  it('sizes bridges by class and sets the cab floor from the door sill', () => {
    expect(bridgeStops(getAircraftSpec('crj700'))).toHaveLength(1)
    expect(bridgeStops(getAircraftSpec('b738'))).toHaveLength(1)
    expect(bridgeStops(getAircraftSpec('a321'))).toHaveLength(1)
    expect(bridgeStops(getAircraftSpec('b789'))).toHaveLength(2)
    expect(bridgeStops(getAircraftSpec('a359'))).toHaveLength(2)
    const heavy = bridgeStops(getAircraftSpec('a380'))
    expect(heavy).toHaveLength(3)
    const upper = heavy.find((stop) => stop.upper)
    const main = heavy.find((stop) => !stop.upper)
    expect(upper).toBeTruthy()
    expect(main).toBeTruthy()
    expect(upper!.sillM).toBeGreaterThan(main!.sillM)
    expect(upper!.cabY - upper!.cabH / 2).toBeCloseTo(upper!.sillM, 5)

    const narrow = bridgeStops(getAircraftSpec('b738'))[0]
    expect(narrow.sillM).toBeGreaterThan(2)
    expect(narrow.sillM).toBeLessThan(4)
    expect(narrow.cabH).toBeGreaterThan(1.5)
    expect(narrow.tunnelM).toBe(12)
    expect(heavy[0].tunnelM).toBeGreaterThan(narrow.tunnelM)

    expect(bridgeStops(getAircraftSpec('b748f'))).toHaveLength(0)
    expect(bridgeStops(getAircraftSpec('f15'))).toHaveLength(0)
    expect(bridgeStops(getAircraftSpec('aw139'))).toHaveLength(0)

    for (const spec of Object.values(MODEL_SPECS)) {
      for (const box of doorBoxes(spec)) {
        expect(box.sillM).toBeLessThan(spec.heightM)
        expect(box.y).toBeGreaterThan(box.sillM)
      }
    }
  })

  it('scales the airframe to a 1.75 m person and dwarfs a tug', () => {
    const personWu = 0.42 + 0.18 * 2
    expect(WORLD_PER_METER * 1.75).toBeCloseTo(personWu, 1)
    const tugLengthM = 1.05 / WORLD_PER_METER
    expect(tugLengthM).toBeGreaterThan(1.5)
    expect(tugLengthM).toBeLessThan(4)
    const jet = getAircraftSpec('b738').lengthM * WORLD_PER_METER
    expect(jet).toBeGreaterThan(1.05 * 10)
  })
})
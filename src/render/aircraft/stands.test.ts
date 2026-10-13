import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../../game/airframes'
import {
  AIRCRAFT_VISUAL_SCALE,
  CELL,
  METERS_PER_CELL,
  MODEL_SPECS,
  STAND_ENVELOPE,
  WORLD_PER_METER,
  aircraftWorldPerMeter,
  getAircraftSpec,
} from './specs'
import {
  bridgeDockMeters,
  bridgeMirror,
  bridgeStops,
  bridgeYawToward,
  doorBoxes,
  envelopeLetter,
  envelopeWorld,
  gatePreviewId,
  standAccepts,
  standLetter,
  wingDiscsClash,
  type IcaoCode,
} from './stands'

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

  it('uses one meter scale and exaggerates only the aircraft', () => {
    expect(AIRCRAFT_VISUAL_SCALE).toBeGreaterThanOrEqual(1.15)
    expect(AIRCRAFT_VISUAL_SCALE).toBeLessThanOrEqual(1.25)
    expect(METERS_PER_CELL).toBe(22)
    expect(CELL).toBeCloseTo(METERS_PER_CELL * WORLD_PER_METER)
    expect(WORLD_PER_METER * 1.75).toBeCloseTo(0.7875, 3)
    const tugWu = 4.5 * WORLD_PER_METER
    const jet = getAircraftSpec('b738').lengthM * aircraftWorldPerMeter()
    expect(jet).toBeGreaterThan(tugWu * 8)
  })

  it('maps S/M/L onto B/C/F and previews a bridge that class can dock', () => {
    expect(standLetter('S')).toBe('B')
    expect(standLetter('M')).toBe('C')
    expect(standLetter('L')).toBe('F')
    expect(gatePreviewId('S')).toBe('crj700')
    expect(gatePreviewId('M')).toBe('b738')
    expect(gatePreviewId('L')).toBe('a380')
    expect(standAccepts(standLetter('M'), getAircraftSpec('b738').icao)).toBe(true)
    expect(standAccepts(standLetter('M'), getAircraftSpec('a380').icao)).toBe(false)
    expect(standAccepts(standLetter('S'), 'H')).toBe(false)
    expect(standAccepts(standLetter('L'), getAircraftSpec('a380').icao)).toBe(true)
  })

  it('keeps starter stands, the hall, and the runway clear at the visual scale', () => {
    const hall = [
      [15, 19],
      [16, 19],
      [17, 19],
      [15, 20],
      [16, 20],
      [17, 20],
      [15, 21],
      [16, 21],
      [17, 21],
    ].map(([c, r]) => ({ c, r }))
    const west = { c: 12, r: 21 }
    const east = { c: 20, r: 21 }
    const narrow = getAircraftSpec('b738').spanM
    const heavy = getAircraftSpec('a380').spanM
    expect(wingDiscsClash(west, narrow, [], hall)).toBe(false)
    expect(wingDiscsClash(east, narrow, [{ ...west, spanM: narrow }], hall)).toBe(false)
    expect(wingDiscsClash(west, heavy, [], hall)).toBe(false)
    expect(wingDiscsClash(east, heavy, [{ ...west, spanM: heavy }], hall)).toBe(false)
    // The next cell is inside a 737 wing. Five cells south is the runway row, clear of an A380.
    expect(wingDiscsClash({ c: 13, r: 21 }, narrow, [{ ...west, spanM: narrow }], [])).toBe(true)
    expect(wingDiscsClash({ c: 12, r: 22 }, narrow, [{ ...west, spanM: narrow }], [])).toBe(true)
    expect(wingDiscsClash({ c: 12, r: 26 }, heavy, [{ ...west, spanM: heavy }], [])).toBe(false)
  })

  it('sizes each stand to the code limit plus wingtip clearance', () => {
    expect(STAND_ENVELOPE.C).toMatchObject({ widthM: 45, depthM: 52, clearanceM: 4.5 })
    expect(STAND_ENVELOPE.E.widthM).toBe(80)
    expect(STAND_ENVELOPE.E.depthM).toBe(82)
    expect(STAND_ENVELOPE.F.widthM).toBe(95)
    expect(STAND_ENVELOPE.F.depthM).toBe(88)
    expect(envelopeLetter('M')).toBe('C')
    expect(envelopeLetter('S')).toBe('B')
    expect(envelopeLetter('L', 'wide')).toBe('E')
    expect(envelopeLetter('L', 'jumbo')).toBe('F')
    expect(envelopeLetter('L')).toBe('F')
    const visual = WORLD_PER_METER * AIRCRAFT_VISUAL_SCALE
    expect(envelopeWorld('C').width).toBeCloseTo(45 * visual)
    const fits = (id: string, letter: IcaoCode) => {
      const spec = getAircraftSpec(id)
      const box = STAND_ENVELOPE[letter]
      expect(spec.spanM + box.clearanceM * 2, id).toBeLessThanOrEqual(box.widthM + 0.3)
      expect(spec.lengthM, id).toBeLessThan(box.depthM)
    }
    fits('a320neo', 'C')
    fits('b738', 'C')
    fits('a321', 'C')
    fits('crj700', 'B')
    fits('a359', 'E')
    fits('b77w', 'E')
    fits('b789', 'E')
    fits('a380', 'F')
    fits('b748f', 'F')
  })

  it('meets the forward door and flips a bridge that would face away from the terminal', () => {
    const dock = bridgeDockMeters(getAircraftSpec('b738'))
    expect(dock).toBeTruthy()
    expect(dock!.x).toBeGreaterThan(5)
    expect(dock!.z).toBeGreaterThan(getAircraftSpec('b738').rx + 8)
    expect(dock!.y).toBeGreaterThan(2)
    const heavy = bridgeDockMeters(getAircraftSpec('a380'))
    expect(heavy!.z).toBeGreaterThan(dock!.z)
    expect(bridgeMirror(-Math.PI / 2, { c: 12, r: 21 }, { c: 15, r: 21 })).toBe(1)
    expect(bridgeMirror(-Math.PI / 2, { c: 20, r: 21 }, { c: 17, r: 21 })).toBe(-1)
  })

  it('aims an empty-gate bridge at the nearest terminal, east or west', () => {
    expect(bridgeYawToward({ c: 12, r: 21 }, { c: 15, r: 21 })).toBeCloseTo(Math.PI / 2)
    expect(bridgeYawToward({ c: 20, r: 21 }, { c: 17, r: 21 })).toBeCloseTo(-Math.PI / 2)
  })
})
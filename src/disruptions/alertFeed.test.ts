import { describe, expect, it } from 'vitest'
import { DisruptionEngine } from './engine.ts'
import { disruptionAlertKey, disruptionToAlert } from './alertFeed.ts'
import { disruptionLocus, type DisruptionLocusField } from './locus.ts'
import type { DisruptionHost, DisruptionWorld } from './types.ts'

function world(): DisruptionWorld {
  return {
    fieldLevel: 5,
    goalsComplete: false,
    endless: false,
    standsFree: 4,
    hotelRooms: 40,
    banks: [],
    staffPools: ['desk'],
    clock: 10,
  }
}

const host: DisruptionHost = {
  acceptWeatherDivert: () => ({ hosted: false }),
  postCash: () => {},
  delayBank: () => {},
  rebookBank: () => {},
  news: () => {},
}

function field(over: Partial<DisruptionLocusField> = {}): DisruptionLocusField {
  return {
    stands: [{ c: 12, r: 21 }],
    runways: [{ c: 8, r: 26 }],
    fuel: [{ c: 8, r: 21 }],
    terminal: [{ c: 15, r: 19 }],
    fire: [{ c: 8, r: 20 }],
    hangar: [],
    tower: [{ c: 11, r: 17 }],
    police: [],
    guard: [],
    checkin: [{ c: 0, r: 0 }],
    security: [{ c: 0, r: 2 }],
    hallKey: '15,19',
    ...over,
  }
}

describe('disruption alerts', () => {
  it('builds one alert per event, with a pan cell and the fix in the detail', () => {
    const engine = new DisruptionEngine(1)
    const ev = engine.trigger('software-outage', world(), host)!
    const row = disruptionToAlert(ev, disruptionLocus(ev, field()))
    expect(row.key).toBe(disruptionAlertKey(ev.id))
    expect(row.title).toBe('Software outage')
    expect(row.detail).toContain('manual')
    expect(row.detail).toContain('Fix:')
    expect(row.at.view).toBe('hall')
    expect(row.at.cells).toEqual([{ c: 0, r: 0 }])
    expect(row.at.hall).toBe('15,19')
    const again = disruptionToAlert(ev, disruptionLocus(ev, field()))
    expect(again.key).toBe(row.key)
  })

  it('pans a state visit to the runway, ash to a gate, and a dry apron to the fuel farm', () => {
    const engine = new DisruptionEngine(2)
    const visit = engine.trigger('state-visit', world(), host)!
    const runway = disruptionLocus(visit, field())
    expect(runway.view).toBe('apron')
    expect(runway.cells).toEqual([{ c: 8, r: 26 }])

    const ash = new DisruptionEngine(3).trigger('volcanic-ash', world(), host)!
    expect(disruptionLocus(ash, field()).cells).toEqual([{ c: 12, r: 21 }])
    expect(disruptionLocus(ash, field({ stands: [] })).cells).toEqual([{ c: 8, r: 21 }])

    const scare = new DisruptionEngine(4).trigger('health-screening', world(), host)!
    const lane = disruptionLocus(scare, field())
    expect(lane.view).toBe('hall')
    expect(lane.cells).toEqual([{ c: 0, r: 2 }])

    const war = new DisruptionEngine(6).trigger('rival-price-war', world(), host)!
    expect(disruptionLocus(war, field()).cells).toEqual([{ c: 15, r: 19 }])
  })
})

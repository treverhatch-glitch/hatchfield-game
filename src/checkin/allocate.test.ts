import { describe, expect, it } from 'vitest'
import { gameMinToSim } from '../pax/showup.ts'
import { CHECKIN_ALLOC, allocate, desksNeeded, windowBounds, type CheckinDesk, type CheckinFlight } from './index.ts'

const STD = 100

function flight(partial: Partial<CheckinFlight> & Pick<CheckinFlight, 'id' | 'airlineId'>): CheckinFlight {
  return {
    std: STD,
    pax: 40,
    longHaul: false,
    ...partial,
  }
}

function desk(id: string, staffed = true, kiosk = false): CheckinDesk {
  return { id, staffed, kiosk }
}

describe('check-in windows', () => {
  it('opens a long-haul flight three hours out and a short-haul flight two hours out', () => {
    const long = windowBounds({ std: STD, longHaul: true })
    const short = windowBounds({ std: STD, longHaul: false })
    expect(long.openAt).toBeCloseTo(STD - gameMinToSim(CHECKIN_ALLOC.openLongHaulGameMin), 5)
    expect(short.openAt).toBeCloseTo(STD - gameMinToSim(CHECKIN_ALLOC.openShortHaulGameMin), 5)
    expect(long.closeAt).toBeCloseTo(STD - gameMinToSim(CHECKIN_ALLOC.closeGameMin), 5)
    expect(short.closeAt).toBeCloseTo(long.closeAt, 5)
    expect(CHECKIN_ALLOC.openLongHaulGameMin).toBe(180)
    expect(CHECKIN_ALLOC.openShortHaulGameMin).toBe(120)
    expect(CHECKIN_ALLOC.closeGameMin).toBe(45)
  })

  it('a flight inside the window takes desks, and a closed window gives them back', () => {
    const desks = [desk('d1'), desk('d2')]
    const openNow = STD - gameMinToSim(60)
    const open = allocate({
      now: openNow,
      flights: [flight({ id: 'a', airlineId: 'harbor' })],
      desks,
      locks: [],
    })
    expect(open.flights[0]?.open).toBe(true)
    expect(open.desks.map((row) => row.airlineId)).toEqual(['harbor', null])
    expect(open.desks[0]?.mode).toBe('common')
    expect(open.desks[1]?.mode).toBe('general')
    expect(open.reason).toBeNull()

    const closed = allocate({
      now: STD - gameMinToSim(CHECKIN_ALLOC.closeGameMin),
      flights: [flight({ id: 'a', airlineId: 'harbor' })],
      desks,
      locks: [],
    })
    expect(closed.flights[0]?.open).toBe(false)
    expect(closed.desks.every((row) => row.airlineId == null)).toBe(true)
    expect(closed.reason).toBeNull()
  })

  it('uses the long-haul open and ignores a short-haul flight that has not opened', () => {
    const now = STD - gameMinToSim(150)
    const rows = allocate({
      now,
      flights: [
        flight({ id: 'long', airlineId: 'harbor', longHaul: true }),
        flight({ id: 'short', airlineId: 'northline', longHaul: false }),
      ],
      desks: [desk('d1'), desk('d2')],
      locks: [],
    })
    expect(rows.flights.find((row) => row.flightId === 'long')?.open).toBe(true)
    expect(rows.flights.find((row) => row.flightId === 'short')?.open).toBe(false)
    expect(rows.desks[0]).toMatchObject({ airlineId: 'harbor', mode: 'common' })
    expect(rows.desks[1]).toMatchObject({ airlineId: null, mode: 'general' })
  })
})

describe('common-use allocation', () => {
  it('gives the earlier flight the desks and reports a shortage when they overlap', () => {
    const now = STD - gameMinToSim(60)
    const rows = allocate({
      now,
      flights: [
        flight({ id: 'late', airlineId: 'northline', std: STD + 5, pax: 80 }),
        flight({ id: 'early', airlineId: 'harbor', std: STD, pax: 80 }),
      ],
      desks: [desk('d1'), desk('d2'), desk('k', true, true)],
      locks: [],
    })
    expect(desksNeeded(80)).toBe(2)
    expect(rows.desks.find((row) => row.deskId === 'd1')).toMatchObject({ airlineId: 'harbor', mode: 'common' })
    expect(rows.desks.find((row) => row.deskId === 'd2')).toMatchObject({ airlineId: 'harbor', mode: 'common' })
    expect(rows.desks.find((row) => row.deskId === 'k')).toMatchObject({ airlineId: null, mode: 'kiosk' })
    expect(rows.flights.find((row) => row.flightId === 'northline' || row.flightId === 'late')?.short).toBe(2)
    expect(rows.shortOfDesks).toBe(2)
    expect(rows.reason).toBe('short of desks')
  })

  it('splits desks across airlines once the earlier one is covered', () => {
    const now = STD - gameMinToSim(60)
    const rows = allocate({
      now,
      flights: [
        flight({ id: 'h', airlineId: 'harbor', pax: 10 }),
        flight({ id: 'n', airlineId: 'northline', std: STD + 1, pax: 10 }),
      ],
      desks: [desk('d1'), desk('d2'), desk('d3')],
      locks: [],
    })
    expect(rows.desks.map((row) => [row.deskId, row.airlineId, row.mode])).toEqual([
      ['d1', 'harbor', 'common'],
      ['d2', 'northline', 'common'],
      ['d3', null, 'general'],
    ])
    expect(rows.reason).toBeNull()
  })

  it('does not count an unstaffed desk, and never brands a kiosk', () => {
    const now = STD - gameMinToSim(60)
    const rows = allocate({
      now,
      flights: [flight({ id: 'h', airlineId: 'harbor' })],
      desks: [desk('closed', false), desk('k', true, true)],
      locks: [{ deskId: 'k', airlineId: 'harbor' }, { deskId: 'closed', airlineId: 'harbor' }],
    })
    expect(rows.desks[0]).toMatchObject({ airlineId: 'harbor', mode: 'dedicated' })
    expect(rows.desks[1]).toMatchObject({ airlineId: null, mode: 'kiosk' })
    expect(rows.flights[0]?.desks).toEqual([])
    expect(rows.reason).toBe('short of desks')
  })

  it('keeps a dedicated desk for its airline after the window closes', () => {
    const desks = [desk('d1'), desk('d2')]
    const locks = [{ deskId: 'd1', airlineId: 'harbor', serviceShare: 0.75 }]
    const during = allocate({
      now: STD - gameMinToSim(60),
      flights: [flight({ id: 'n', airlineId: 'northline' }), flight({ id: 'h', airlineId: 'harbor' })],
      desks,
      locks,
    })
    expect(during.desks[0]).toMatchObject({ airlineId: 'harbor', mode: 'dedicated', serviceShare: 0.75 })
    expect(during.desks[1]).toMatchObject({ airlineId: 'northline', mode: 'common' })
    expect(during.flights.find((row) => row.flightId === 'h')?.desks).toEqual(['d1'])
    expect(during.flights.find((row) => row.flightId === 'n')?.desks).toEqual(['d2'])

    const after = allocate({
      now: STD,
      flights: [flight({ id: 'n', airlineId: 'northline' }), flight({ id: 'h', airlineId: 'harbor' })],
      desks,
      locks,
    })
    expect(after.desks[0]).toMatchObject({ airlineId: 'harbor', mode: 'dedicated' })
    expect(after.desks[1]).toMatchObject({ airlineId: null, mode: 'general' })
    expect(after.reason).toBeNull()
  })
})

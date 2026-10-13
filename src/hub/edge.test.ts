import { describe, expect, it } from 'vitest'
import { BUS_RIDE_MINUTES, CONNECTIVITY_CATALOG, PEOPLE_MOVER_RIDE_MINUTES } from '../connectivity/catalog.ts'
import type { PassengerLink } from '../connectivity/types.ts'
import {
  BAG_BASE_MINUTES,
  DEFAULT_CONNECTION_WINDOW,
  DEPLANE_MINUTES,
  MCT_BASE,
  MCT_RFID,
  MCT_TRANSFER_CENTRE,
  STANDING_HIT_PER_PAX,
  WALK_METRES_PER_MIN,
} from './config.ts'
import { bookOnward, evaluateConnection, linkTravelMinutes } from './connect.ts'
import { missPenalty } from './miss.ts'
import { connectingIndexes, scaledShare } from './share.ts'
import type { HubFacilities, Movement } from './types.ts'

const near = { id: 'A1', x: 0, y: 0 }
const beside = { id: 'A2', x: 40, y: 0 }
/** A gate in a second terminal, 600 m along the apron. */
const otherHall = { id: 'B1', x: 600, y: 0 }

const plain: HubFacilities = { transferCentre: false, rfid: false }
const centre: HubFacilities = { transferCentre: true, rfid: false }
const rfid: HubFacilities = { transferCentre: true, rfid: true }

function at(available: number, facilities: HubFacilities, link?: PassengerLink, to = beside) {
  return evaluateConnection({
    arrivalAt: 1_000,
    departureAt: 1_000 + available,
    from: near,
    to,
    ride: false,
    link,
    facilities,
  })
}

describe('minimum connection time boundary', () => {
  for (const [label, facilities, mct] of [
    ['plain', plain, MCT_BASE],
    ['Transfer Centre', centre, MCT_TRANSFER_CENTRE],
    ['RFID', rfid, MCT_RFID],
  ] as const) {
    it(`${label}: made exactly at MCT and just over, missed just under`, () => {
      const exact = at(mct, facilities)
      expect(exact.mct).toBe(mct)
      expect(exact.made).toBe(true)
      expect(exact.reason).toBe('ok')
      expect(exact.paxMade && exact.bagMade).toBe(true)

      const over = at(mct + 0.01, facilities)
      expect(over.made).toBe(true)

      const under = at(mct - 0.01, facilities)
      expect(under.made).toBe(false)
      expect(under.reason).toBe('below_mct')
      expect(under.paxMade).toBe(false)
      expect(under.bagMade).toBe(false)
    })
  }

  it('never sells a departure under MCT; a late inbound eats the planned slack', () => {
    const moves: Movement[] = [
      { id: 'tight:dep', airlineId: 'harbor', gateId: 'A2', direction: 'dep', at: 1_000 + MCT_BASE - 0.01 },
      { id: 'exact:dep', airlineId: 'harbor', gateId: 'A3', direction: 'dep', at: 1_000 + MCT_BASE },
      { id: 'late:dep', airlineId: 'harbor', gateId: 'A4', direction: 'dep', at: 1_000 + MCT_BASE + 30 },
      { id: 'own:arr', airlineId: 'harbor', gateId: 'A1', direction: 'arr', at: 1_000 + MCT_BASE },
    ]
    expect(bookOnward(moves, 1_000, MCT_BASE)).toEqual({ at: 1_000 + MCT_BASE, gateId: 'A3' })
    expect(bookOnward(moves, 1_000.01, MCT_BASE)).toEqual({ at: 1_000 + MCT_BASE + 30, gateId: 'A4' })
    // Sold from the planned 1000, landed 20 late: only 40 min left on a 60 min MCT.
    const sold = bookOnward(moves, 1_000, MCT_BASE)
    expect(sold.at - 1_020).toBeLessThan(MCT_BASE)
    expect(at(sold.at - 1_020, plain).reason).toBe('below_mct')
  })

  it('falls back to the default window and stays finite on a bad clock', () => {
    expect(bookOnward([], 500, MCT_RFID)).toEqual({ at: 500 + DEFAULT_CONNECTION_WINDOW, gateId: null })
    expect(bookOnward([], 500, 200)).toEqual({ at: 700, gateId: null })
    const bad = bookOnward([], Number.NaN, Number.NaN)
    expect(Number.isFinite(bad.at)).toBe(true)
    const nanMove = bookOnward(
      [{ id: 'x', airlineId: 'harbor', gateId: 'A2', direction: 'dep', at: Number.NaN }],
      0,
      MCT_BASE,
    )
    expect(nanMove.gateId).toBeNull()
  })
})

describe('connections across two terminals', () => {
  const metres = 600
  const cases: { link: PassengerLink; mode: 'walk' | 'ride'; bagsRide: boolean }[] = [
    { link: 'people_mover', mode: 'ride', bagsRide: true },
    { link: 'airside_transfer_bus', mode: 'ride', bagsRide: true },
    { link: 'skywalk', mode: 'ride', bagsRide: false },
    { link: 'walkway', mode: 'walk', bagsRide: false },
    { link: 'walk', mode: 'walk', bagsRide: false },
  ]
  for (const { link, mode, bagsRide } of cases) {
    it(`${link}: pax and bag minutes follow the built link`, () => {
      const verdict = evaluateConnection({
        arrivalAt: 0,
        departureAt: 240,
        from: near,
        to: otherHall,
        ride: false,
        link,
        walkwayMetres: link === 'walkway' ? CONNECTIVITY_CATALOG.moving_walkway.lengthMetres : 0,
        facilities: rfid,
      })
      expect(verdict.link).toBe(link)
      expect(verdict.mode).toBe(mode)
      const travel = linkTravelMinutes(
        link,
        metres,
        link === 'walkway' ? CONNECTIVITY_CATALOG.moving_walkway.lengthMetres : 0,
      )
      expect(verdict.paxMinutes).toBeCloseTo(DEPLANE_MINUTES + travel, 9)
      const bagPace = bagsRide ? 55 : 40
      expect(verdict.bagMinutes).toBeCloseTo(BAG_BASE_MINUTES.rfid + metres / bagPace, 9)
      expect(verdict.made).toBe(true)
      for (const n of [verdict.paxMinutes, verdict.bagMinutes, verdict.available, verdict.walkMinutes]) {
        expect(Number.isFinite(n)).toBe(true)
        expect(n).toBeGreaterThanOrEqual(0)
      }
    })
  }

  it('fixed rides beat the long walk and no link means a plain walk', () => {
    expect(linkTravelMinutes('people_mover', 600, 0)).toBe(PEOPLE_MOVER_RIDE_MINUTES)
    expect(linkTravelMinutes('airside_transfer_bus', 600, 0)).toBe(BUS_RIDE_MINUTES)
    const none = evaluateConnection({
      arrivalAt: 0,
      departureAt: MCT_BASE,
      from: near,
      to: otherHall,
      ride: false,
      facilities: plain,
    })
    expect(none.link).toBe('walk')
    expect(none.rideMinutes).toBeNull()
    expect(none.paxMinutes).toBeCloseTo(DEPLANE_MINUTES + 600 / WALK_METRES_PER_MIN, 9)
    // Plain belts haul 600 m too slowly for a 60 min bank: the bag is late, so the connection is not made.
    expect(none.bagMade).toBe(false)
    expect(none.reason).toBe('bag_late')
    expect(none.made).toBe(false)
  })
})

describe('miss bill and empty loads', () => {
  it('bills one Standing hit per missed passenger and nothing for zero', () => {
    const one = missPenalty({ hasHotel: false, passengers: 1 })
    expect(one.standing).toBeCloseTo(-STANDING_HIT_PER_PAX, 9)
    const five = missPenalty({ hasHotel: true, passengers: 5 })
    expect(five.kind).toBe('hotel')
    expect(five.standing).toBeCloseTo(-STANDING_HIT_PER_PAX * 5, 9)
    for (const passengers of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const bill = missPenalty({ hasHotel: false, passengers })
      expect(bill.amount).toBe(0)
      expect(bill.passengers).toBe(0)
      expect(Object.is(bill.standing, -0) ? 0 : bill.standing).toBe(0)
    }
  })

  it('picks no connectors from an empty or zero-share load', () => {
    expect(connectingIndexes(0, 0.3, 'f')).toEqual([])
    expect(connectingIndexes(120, 0, 'f')).toEqual([])
    expect(connectingIndexes(Number.NaN, 0.3, 'f')).toEqual([])
    expect(connectingIndexes(120, Number.NaN, 'f')).toEqual([])
    expect(scaledShare(0, 1.8)).toBe(0)
  })
})

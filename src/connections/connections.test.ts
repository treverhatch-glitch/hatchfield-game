import { describe, expect, it } from 'vitest'
import { MCT_BASE, MCT_RFID, MCT_TRANSFER_CENTRE } from '../hub/config.ts'
import { evaluateConnection } from '../hub/connect.ts'
import type { CarrierProfile } from '../hub/types.ts'
import {
  ConnectionsLedger,
  LANDSIDE_RECHECK_MINUTES,
  MISCONNECT_BASE,
  MISCONNECT_BASE_RFID,
  MISCONNECT_CAP,
  SORT_BAGS_PER_HOUR_PER_BELT,
  SortLoad,
  TRANSFER_SECURITY_MINUTES,
  bagMisconnects,
  chooseOvernight,
  classifyLayover,
  isNightHour,
  layoutMct,
  layoverDrain,
  layoverNeeds,
  layoverTrait,
  misconnectRate,
  paxMix,
  planTransfer,
  rebookStranded,
  sortCapacityPerHour,
  splitLoad,
  voucherPayer,
  withScreening,
} from './index.ts'

const PLAIN = { transferCentre: false, rfid: false }
const CENTRE = { transferCentre: true, rfid: false }
const RFID = { transferCentre: true, rfid: true }

function carrier(bizModel: CarrierProfile['bizModel'], hub: boolean): CarrierProfile {
  return { kind: bizModel === 'cargo' ? 'cargo' : 'pax', bizModel, tier: 3, hub, likesLayovers: false }
}

describe('O&D vs transfer mix', () => {
  it('hub full-service carriers connect the most, cargo never', () => {
    const fs = paxMix(5, carrier('full_service', true))
    const lcc = paxMix(5, carrier('lcc', true))
    const charter = paxMix(5, carrier('charter', false))
    const cargo = paxMix(5, carrier('cargo', true))
    expect(fs.transfer).toBeGreaterThan(lcc.transfer)
    expect(lcc.transfer).toBeGreaterThan(charter.transfer)
    expect(cargo.transfer).toBe(0)
    expect(cargo.screen).toBe(0)
    expect(fs.transfer + fs.od).toBeCloseTo(1, 9)
  })

  it('a hub contract adds connecting traffic over the same airline type', () => {
    expect(paxMix(4, carrier('full_service', true)).transfer).toBeGreaterThan(
      paxMix(4, carrier('full_service', false)).transfer,
    )
  })

  it('splits a load into whole passengers', () => {
    const split = splitLoad(180, { transfer: 0.4, od: 0.6, screen: 0.3 })
    expect(split).toEqual({ od: 108, transfer: 72, screened: 22 })
    expect(splitLoad(Number.NaN, { transfer: 0.4, od: 0.6, screen: 0.3 })).toEqual({ od: 0, transfer: 0, screened: 0 })
  })
})

describe('airside transfer routing', () => {
  it('goes gate to gate without landside when no screening is needed', () => {
    const route = planTransfer({ metres: 400, link: 'walk', screened: false, transferLane: false })
    expect(route.steps).toEqual(['deplane', 'walk', 'departure_gate'])
    expect(route.airsideOnly).toBe(true)
    expect(route.screenMinutes).toBe(0)
  })

  it('uses the transfer security lane when one exists', () => {
    const route = planTransfer({ metres: 400, link: 'walk', screened: true, transferLane: true })
    expect(route.steps).toEqual(['deplane', 'transfer_security', 'walk', 'departure_gate'])
    expect(route.airsideOnly).toBe(true)
    expect(route.screenMinutes).toBe(TRANSFER_SECURITY_MINUTES)
  })

  it('without a lane, a re-screen goes landside and takes much longer', () => {
    const lane = planTransfer({ metres: 400, link: 'walk', screened: true, transferLane: true })
    const none = planTransfer({ metres: 400, link: 'walk', screened: true, transferLane: false })
    expect(none.steps).toContain('landside_recheck')
    expect(none.airsideOnly).toBe(false)
    expect(none.minutes - lane.minutes).toBeCloseTo(LANDSIDE_RECHECK_MINUTES - TRANSFER_SECURITY_MINUTES, 9)
  })

  it('rides when a people mover links the gates', () => {
    const route = planTransfer({ metres: 1500, link: 'people_mover', screened: false, transferLane: true })
    expect(route.steps).toContain('ride')
  })
})

describe('minimum connection time from layout', () => {
  it('never drops under the facility floor', () => {
    for (const [facilities, floor] of [
      [PLAIN, MCT_BASE],
      [CENTRE, MCT_TRANSFER_CENTRE],
      [RFID, MCT_RFID],
    ] as const) {
      const mct = layoutMct({ facilities, pairMetres: [40], link: 'walk', transferLane: true, screenShare: 0 })
      expect(mct.total).toBe(floor)
    }
  })

  it('grows with walking distance and rounds up to 5 minutes', () => {
    const near = layoutMct({ facilities: RFID, pairMetres: [100, 200], link: 'walk', transferLane: true, screenShare: 0 })
    const far = layoutMct({ facilities: RFID, pairMetres: [100, 2400], link: 'walk', transferLane: true, screenShare: 0 })
    expect(far.total).toBeGreaterThan(near.total)
    expect(far.total % 5).toBe(0)
    expect(far.walkMinutes).toBeCloseTo(30, 9)
  })

  it('a missing transfer lane pushes MCT up when transfers are re-screened', () => {
    const lane = layoutMct({ facilities: RFID, pairMetres: [800], link: 'walk', transferLane: true, screenShare: 0.3 })
    const none = layoutMct({ facilities: RFID, pairMetres: [800], link: 'walk', transferLane: false, screenShare: 0.3 })
    expect(none.total - lane.total).toBeGreaterThanOrEqual(LANDSIDE_RECHECK_MINUTES - TRANSFER_SECURITY_MINUTES - 5)
  })

  it('screening turns a just-made connection into a pax-late miss', () => {
    const gate = { id: 'a', x: 0, y: 0 }
    const verdict = evaluateConnection({
      arrivalAt: 0,
      departureAt: MCT_RFID,
      from: gate,
      to: gate,
      ride: false,
      facilities: RFID,
    })
    expect(verdict.made).toBe(true)
    const screened = withScreening(verdict, LANDSIDE_RECHECK_MINUTES)
    expect(screened.made).toBe(false)
    expect(screened.reason).toBe('pax_late')
    expect(withScreening(verdict, 0)).toBe(verdict)
  })
})

describe('transfer bag misconnects', () => {
  it('capacity scales with belts, the Transfer Centre and RFID', () => {
    expect(sortCapacityPerHour({ belts: 0, ...PLAIN })).toBe(0)
    const one = sortCapacityPerHour({ belts: 1, ...PLAIN })
    expect(one).toBe(SORT_BAGS_PER_HOUR_PER_BELT)
    expect(sortCapacityPerHour({ belts: 2, ...PLAIN })).toBe(2 * one)
    expect(sortCapacityPerHour({ belts: 1, ...CENTRE })).toBeGreaterThan(one)
    expect(sortCapacityPerHour({ belts: 1, ...RFID })).toBeGreaterThan(sortCapacityPerHour({ belts: 1, ...CENTRE }))
  })

  it('sits at the floor with spare capacity and climbs once the sort chokes', () => {
    expect(misconnectRate(100, 1000, false)).toBe(MISCONNECT_BASE)
    expect(misconnectRate(100, 1000, true)).toBe(MISCONNECT_BASE_RFID)
    const busy = misconnectRate(900, 1000, false)
    const choked = misconnectRate(1600, 1000, false)
    expect(busy).toBeGreaterThan(MISCONNECT_BASE)
    expect(choked).toBeGreaterThan(busy)
    expect(misconnectRate(5000, 100, false)).toBe(MISCONNECT_CAP)
    expect(misconnectRate(10, 0, false)).toBe(MISCONNECT_CAP)
  })

  it('rolls per bag deterministically and close to the rate', () => {
    expect(bagMisconnects('bag-1', 0.3)).toBe(bagMisconnects('bag-1', 0.3))
    let hits = 0
    for (let i = 0; i < 4000; i++) if (bagMisconnects(`bag-${i}`, 0.1)) hits += 1
    expect(hits / 4000).toBeGreaterThan(0.08)
    expect(hits / 4000).toBeLessThan(0.12)
    expect(bagMisconnects('bag-1', 0)).toBe(false)
  })

  it('sort load counts only the last hour', () => {
    const load = new SortLoad()
    load.add(0, 10)
    load.add(50, 5)
    expect(load.perHour(55)).toBe(15)
    expect(load.perHour(100)).toBe(5)
  })
})

describe('layovers', () => {
  it('classifies by wait and night', () => {
    expect(classifyLayover(40, 25, false)).toBe('tight')
    expect(classifyLayover(120, 25, false)).toBe('short')
    expect(classifyLayover(300, 25, false)).toBe('long')
    expect(classifyLayover(300, 25, true)).toBe('overnight')
    expect(isNightHour(23.5)).toBe(true)
    expect(isNightHour(3)).toBe(true)
    expect(isNightHour(12)).toBe(false)
  })

  it('needs drain faster on long waits', () => {
    expect(layoverDrain(45)).toBe(1)
    expect(layoverDrain(180)).toBeGreaterThan(1)
    expect(layoverDrain(10_000)).toBeLessThanOrEqual(2.4)
  })

  it('short layovers seed food, shop and lounge visits by trait', () => {
    const family = layoverNeeds(150, 'family')
    const business = layoverNeeds(150, 'business')
    expect(family.hunger).toBeGreaterThan(0)
    expect(family.play).toBeGreaterThan(business.play)
    expect(business.energy).toBeGreaterThan(family.energy)
    expect(layoverTrait('premium')).toBe('business')
  })

  it('picks hotel, lounge or terminal sleep by trait', () => {
    const all = { transitRooms: 20, landsideRooms: 40, landsideLinked: true, lounge: true, voucher: false }
    const none = { transitRooms: 0, landsideRooms: 0, landsideLinked: false, lounge: true, voucher: false }
    expect(chooseOvernight('business', all)).toBe('transit_hotel')
    expect(chooseOvernight('business', none)).toBe('lounge')
    expect(chooseOvernight('family', { ...all, transitRooms: 0 })).toBe('landside_hotel')
    expect(chooseOvernight('family', none)).toBe('terminal_sleep')
    expect(chooseOvernight('budget', all)).toBe('terminal_sleep')
    expect(chooseOvernight('budget', { ...all, voucher: true })).toBe('landside_hotel')
    // An unlinked landside hotel is out of reach from airside.
    expect(chooseOvernight('family', { ...all, transitRooms: 0, landsideLinked: false })).toBe('terminal_sleep')
  })
})

describe('stranded passengers', () => {
  const departures = [
    { id: 'd1', airlineId: 'harbor', at: 200, seatsFree: 10 },
    { id: 'd2', airlineId: 'harbor', at: 400, seatsFree: 10 },
    { id: 'x1', airlineId: 'other', at: 210, seatsFree: 50 },
    { id: 'late', airlineId: 'harbor', at: 2000, seatsFree: 50 },
  ]

  it('rebooks onto later same-airline departures until seats run out, rest overnight', () => {
    const [r] = rebookStranded([{ id: 'g', airlineId: 'harbor', pax: 25, cause: 'cancel', at: 100 }], departures, {
      cutoff: 1000,
    })
    expect(r.sameDay).toBe(20)
    expect(r.overnight).toBe(5)
    expect(r.flights).toEqual(['d1', 'd2'])
    expect(r.taken).toEqual({ d1: 10, d2: 10 })
    expect(r.payer).toBe('airline')
  })

  it('never double-sells a seat across groups', () => {
    const results = rebookStranded(
      [
        { id: 'a', airlineId: 'harbor', pax: 15, cause: 'delay', at: 100 },
        { id: 'b', airlineId: 'harbor', pax: 15, cause: 'misconnect', at: 120 },
      ],
      departures,
      { cutoff: 1000 },
    )
    expect(results[0].sameDay + results[1].sameDay).toBe(20)
    expect(results[1].overnight).toBe(10)
  })

  it('voucher payer follows the contract, defaulting by cause', () => {
    expect(voucherPayer('cancel')).toBe('airline')
    expect(voucherPayer('misconnect')).toBe('airport')
    expect(voucherPayer('cancel', { cancel: 'airport' })).toBe('airport')
    const [r] = rebookStranded([{ id: 'g', airlineId: 'harbor', pax: 3, cause: 'cancel', at: 100 }], [], {
      cutoff: 1000,
      terms: () => ({ cancel: 'airport' }),
    })
    expect(r.payer).toBe('airport')
    expect(r.overnight).toBe(3)
  })
})

describe('connections ledger', () => {
  it('closes days into history and keeps one alert per kind', () => {
    const ledger = new ConnectionsLedger()
    ledger.add('transfers', 10)
    ledger.add('missed', 2)
    ledger.alert({ kind: 'mct_miss', text: 'one' })
    ledger.alert({ kind: 'mct_miss', text: 'two' })
    expect(ledger.alerts).toHaveLength(1)
    expect(ledger.alerts[0].text).toBe('two')
    const done = ledger.closeDay(1)
    expect(done.transfers).toBe(10)
    expect(ledger.today.transfers).toBe(0)
    ledger.add('transfers', 5)
    expect(ledger.totals().transfers).toBe(15)
    const copy = new ConnectionsLedger()
    copy.load(JSON.parse(JSON.stringify(ledger.save())))
    expect(copy.totals()).toEqual(ledger.totals())
  })
})

import { describe, expect, it } from 'vitest'
import { TECH_NODES } from '../economy/techTree.ts'
import {
  HOTEL_NIGHT_COST,
  MCT_BASE,
  MCT_RFID,
  MCT_TRANSFER_CENTRE,
  REBOOK_FEE,
  bagTransferMinutes,
  bankCrowd,
  bankDemand,
  buildBanks,
  connectingIndexes,
  connectionMap,
  evaluateConnection,
  minimumConnectionTime,
  missPenalty,
  scaledShare,
  transferShare,
  type CarrierProfile,
  type GatePoint,
  type Movement,
} from './index.ts'

const none = { transferCentre: false, rfid: false }
const centre = { transferCentre: true, rfid: false }
const rfid = { transferCentre: true, rfid: true }

function carrier(over: Partial<CarrierProfile> = {}): CarrierProfile {
  return {
    kind: 'pax',
    bizModel: 'full_service',
    tier: 3,
    hub: false,
    likesLayovers: false,
    ...over,
  }
}

const nearA: GatePoint = { id: 'A', x: 0, y: 0 }
const nearB: GatePoint = { id: 'B', x: 160, y: 0 }
const farB: GatePoint = { id: 'B', x: 400, y: 0 }

describe('tech tree hooks', () => {
  it('puts the Transfer Centre and RFID bag line on the ground-logistics branch', () => {
    const centre = TECH_NODES.find((node) => node.id === 'ground_logistics.t3')
    const line = TECH_NODES.find((node) => node.id === 'ground_logistics.t4')
    expect(centre?.modifiers['hub.transferCentre']).toBe(45)
    expect(line?.modifiers['hub.rfidBagLine']).toBe(25)
    expect(centre?.description).toMatch(/Transfer Centre/)
    expect(line?.description).toMatch(/RFID bag line/)
  })
})

describe('minimum connection time', () => {
  it('is 60, 45 with a Transfer Centre, and 25 with the RFID bag line', () => {
    expect(minimumConnectionTime(none)).toBe(MCT_BASE)
    expect(minimumConnectionTime(none)).toBe(60)
    expect(minimumConnectionTime(centre)).toBe(MCT_TRANSFER_CENTRE)
    expect(minimumConnectionTime(centre)).toBe(45)
    expect(minimumConnectionTime(rfid)).toBe(MCT_RFID)
    expect(minimumConnectionTime({ transferCentre: false, rfid: true })).toBe(25)
  })
})

describe('transfer share', () => {
  it('stays at zero before mid-game for every carrier', () => {
    const profiles = [
      carrier(),
      carrier({ hub: true, tier: 5, likesLayovers: true }),
      carrier({ bizModel: 'lcc', likesLayovers: true }),
      carrier({ bizModel: 'charter', tier: 1 }),
      carrier({ kind: 'cargo', bizModel: 'cargo', tier: 5, hub: true }),
    ]
    for (const level of [1, 2]) {
      for (const profile of profiles) {
        expect(transferShare(level, profile)).toBe(0)
        expect(scaledShare(transferShare(level, profile), 1.8)).toBe(0)
      }
    }
  })

  it('grows with field level and is highest for hub carriers', () => {
    const hub = carrier({ hub: true, tier: 5, likesLayovers: true })
    const full = carrier({ likesLayovers: true })
    const lcc = carrier({ bizModel: 'lcc', likesLayovers: true, tier: 2 })
    const charter = carrier({ bizModel: 'charter', tier: 1 })
    const cargo = carrier({ kind: 'cargo', bizModel: 'cargo', tier: 5, hub: true })
    expect(transferShare(3, hub)).toBeGreaterThan(transferShare(3, full))
    expect(transferShare(3, full)).toBeGreaterThan(transferShare(3, lcc))
    expect(transferShare(3, lcc)).toBeGreaterThan(transferShare(3, charter))
    expect(transferShare(5, hub)).toBeGreaterThan(transferShare(3, hub))
    expect(transferShare(5, cargo)).toBe(0)
    expect(transferShare(3, hub)).toBeCloseTo(0.25)
    expect(transferShare(5, hub)).toBeCloseTo(0.45)
  })

  it('picks the same connecting passengers for the same seed', () => {
    expect(connectingIndexes(12, 0, 'NL1')).toEqual([])
    const once = connectingIndexes(12, 0.25, 'NL1')
    const twice = connectingIndexes(12, 0.25, 'NL1')
    expect(once).toEqual(twice)
    expect(once.length).toBe(3)
    expect(new Set(once).size).toBe(once.length)
  })
})

describe('missed connections', () => {
  it('fails when the window is under MCT and posts a finite hotel or rebook cost', () => {
    const missed = evaluateConnection({
      arrivalAt: 0,
      departureAt: 40,
      from: nearA,
      to: nearB,
      ride: false,
      facilities: none,
    })
    expect(missed.made).toBe(false)
    expect(missed.reason).toBe('below_mct')
    expect(missed.mct).toBe(60)

    const made = evaluateConnection({
      arrivalAt: 100,
      departureAt: 180,
      from: nearA,
      to: nearB,
      ride: false,
      facilities: none,
    })
    expect(made.available).toBe(80)
    expect(made.made).toBe(true)
    expect(made.reason).toBe('ok')

    const hotel = missPenalty({ hasHotel: true, passengers: 2 })
    const rebook = missPenalty({ hasHotel: false, passengers: 2 })
    expect(hotel.kind).toBe('hotel')
    expect(hotel.amount).toBe(HOTEL_NIGHT_COST * 2)
    expect(rebook.kind).toBe('rebook')
    expect(rebook.amount).toBe(REBOOK_FEE * 2)
    expect(hotel.standing).toBeLessThan(0)
    expect(rebook.standing).toBe(hotel.standing)
    expect(Number.isFinite(hotel.amount)).toBe(true)
    expect(Number.isFinite(rebook.amount)).toBe(true)
    expect(missPenalty({ hasHotel: false, passengers: Number.NaN }).amount).toBe(0)
  })

  it('lets the Transfer Centre and RFID line save a tighter window', () => {
    const tight = {
      arrivalAt: 0,
      departureAt: 50,
      from: nearA,
      to: nearB,
      ride: true,
    }
    expect(evaluateConnection({ ...tight, facilities: none }).reason).toBe('below_mct')
    expect(evaluateConnection({ ...tight, facilities: centre }).made).toBe(true)
    const veryTight = { ...tight, departureAt: 30 }
    expect(evaluateConnection({ ...veryTight, facilities: centre }).reason).toBe('below_mct')
    expect(evaluateConnection({ ...veryTight, facilities: rfid }).made).toBe(true)
  })
})

describe('bag transfer', () => {
  it('misses a long belt haul and makes it when RFID and a ride are in', () => {
    const plain = bagTransferMinutes(400, none, false)
    const tagged = bagTransferMinutes(400, rfid, true)
    expect(plain).toBeGreaterThan(60)
    expect(tagged).toBeLessThan(25)

    const missed = evaluateConnection({
      arrivalAt: 0,
      departureAt: 70,
      from: nearA,
      to: farB,
      ride: false,
      facilities: none,
    })
    expect(missed.paxMade).toBe(true)
    expect(missed.bagMade).toBe(false)
    expect(missed.reason).toBe('bag_late')
    expect(missed.made).toBe(false)

    const made = evaluateConnection({
      arrivalAt: 0,
      departureAt: 70,
      from: nearA,
      to: farB,
      ride: true,
      facilities: rfid,
    })
    expect(made.bagMade).toBe(true)
    expect(made.paxMade).toBe(true)
    expect(made.made).toBe(true)
    expect(made.mode).toBe('ride')
  })

  it('keeps bag times finite for a broken distance', () => {
    const broken = evaluateConnection({
      arrivalAt: 0,
      departureAt: 80,
      from: { id: 'A', x: Number.NaN, y: 0 },
      to: farB,
      ride: false,
      facilities: none,
    })
    expect(Number.isFinite(broken.bagMinutes)).toBe(true)
    expect(Number.isFinite(broken.paxMinutes)).toBe(true)
    expect(Number.isFinite(broken.available)).toBe(true)
  })
})

describe('banks', () => {
  function wave(gap: number): Movement[] {
    return [
      { id: 'a1', airlineId: 'harbor', gateId: 'A', direction: 'arr', at: 0 },
      { id: 'a2', airlineId: 'harbor', gateId: 'B', direction: 'arr', at: 10 },
      { id: 'd1', airlineId: 'harbor', gateId: 'A', direction: 'dep', at: 10 + gap },
      { id: 'd2', airlineId: 'harbor', gateId: 'B', direction: 'dep', at: 10 + gap + 8 },
    ]
  }

  it('raises transfer demand and crowd as the bank gets tighter', () => {
    const loose = buildBanks(wave(120))
    const mid = buildBanks(wave(60))
    const tight = buildBanks(wave(20))
    expect(loose).toHaveLength(1)
    expect(loose[0].tightness).toBe(0)
    expect(loose[0].transferDemand).toBe(1)
    expect(loose[0].crowdPeak).toBe(1)
    expect(mid[0].transferDemand).toBeGreaterThan(1)
    expect(mid[0].crowdPeak).toBeGreaterThan(1)
    expect(tight[0].tightness).toBe(1)
    expect(tight[0].transferDemand).toBeGreaterThan(mid[0].transferDemand)
    expect(tight[0].crowdPeak).toBeGreaterThan(mid[0].crowdPeak)
    expect(bankDemand(tight)).toBe(tight[0].transferDemand)
    expect(bankCrowd(tight)).toBe(tight[0].crowdPeak)
    expect(bankDemand([])).toBe(1)
    expect(bankCrowd([])).toBe(1)
  })

  it('is deterministic for the same timetable', () => {
    const moves = wave(20).reverse()
    expect(buildBanks(moves)).toEqual(buildBanks([...moves].reverse()))
  })
})

describe('connection map', () => {
  it('lists walk and ride times for each gate pair and the missed count', () => {
    const map = connectionMap({
      gates: [nearA, { id: 'C', x: 0, y: 80 }, nearB],
      ride: true,
      missed: 4,
      facilities: centre,
      banks: buildBanks([
        { id: 'a', airlineId: 'harbor', gateId: 'A', direction: 'arr', at: 0 },
        { id: 'd', airlineId: 'harbor', gateId: 'B', direction: 'dep', at: 30 },
      ]),
    })
    expect(map.mct).toBe(45)
    expect(map.missed).toBe(4)
    expect(map.pairs).toHaveLength(6)
    expect(map.pairs.every((p) => p.walkMinutes > 0 && p.rideMinutes != null && p.rideMinutes < p.walkMinutes)).toBe(
      true,
    )
    expect(map.lines[0]).toBe('Connection time 45 min')
    expect(map.lines[1]).toBe('Missed connections 4')
    expect(map.lines.some((line) => line.startsWith('A → B'))).toBe(true)
    expect(map.crowdPeak).toBeGreaterThan(1)
  })
})

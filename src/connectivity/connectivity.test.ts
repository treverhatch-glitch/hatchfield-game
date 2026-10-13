import { describe, expect, it } from 'vitest'
import { MCT_BASE, MCT_RFID, MCT_TRANSFER_CENTRE } from '../hub/config.ts'
import {
  BUS_APRON_TRAFFIC_PER_HOUR,
  BUS_PAX_PER_HOUR,
  CONNECTIVITY_CATALOG,
  PEOPLE_MOVER_PAX_PER_HOUR,
  STANDING_HIT_CAP,
  breakdown,
  choosePassengerLink,
  connectionStandingDelta,
  dailyUpkeep,
  isUnlocked,
  linkTerminals,
  minimumConnectionMinutes,
  missedConnectionStandingDelta,
  throughput,
} from './index.ts'

const north = { id: 'north', gateIds: ['N1', 'N2'] }
const south = { id: 'south', gateIds: ['S1'] }

function mover(id = 'pm-1') {
  const attempt = linkTerminals('north', 'south', 'people_mover', id)
  if (!attempt.ok) throw new Error(attempt.reason)
  return attempt.link
}

function bus(id = 'bus-1') {
  const attempt = linkTerminals('north', 'south', 'airside_transfer_bus', id)
  if (!attempt.ok) throw new Error(attempt.reason)
  return attempt.link
}

describe('connectivity catalog', () => {
  it('matches the late-game people mover, bus depot, walkway, and skywalk', () => {
    expect(CONNECTIVITY_CATALOG.people_mover).toMatchObject({
      fieldLevel: 7,
      cost: 420_000,
      upkeepPerDay: 9_600,
      paxPerHour: 3_000,
      apronTrafficPerHour: 0,
      linksTerminals: true,
      breakdownStrandsGates: true,
    })
    expect(CONNECTIVITY_CATALOG.airside_transfer_bus_depot).toMatchObject({
      fieldLevel: 6,
      cost: 90_000,
      upkeepPerDay: 2_600,
      paxPerHour: BUS_PAX_PER_HOUR,
      apronTrafficPerHour: BUS_APRON_TRAFFIC_PER_HOUR,
      linksTerminals: true,
      breakdownStrandsGates: false,
    })
    expect(BUS_PAX_PER_HOUR).toBe(800)
    expect(BUS_PAX_PER_HOUR).toBeLessThan(PEOPLE_MOVER_PAX_PER_HOUR)
    expect(BUS_APRON_TRAFFIC_PER_HOUR).toBeGreaterThan(0)
    expect(CONNECTIVITY_CATALOG.airside_transfer_bus_depot.rideMinutes).toBeGreaterThan(
      CONNECTIVITY_CATALOG.people_mover.rideMinutes,
    )
    expect(CONNECTIVITY_CATALOG.moving_walkway).toMatchObject({
      fieldLevel: 4,
      cost: 2_400,
      upkeepPerDay: 160,
      lengthMetres: 6,
      speedMult: 1.85,
      linksTerminals: false,
    })
    expect(CONNECTIVITY_CATALOG.skywalk).toMatchObject({
      fieldLevel: 5,
      cost: 54_000,
      upkeepPerDay: 1_200,
      metresPerMin: 140,
      linksTerminals: true,
    })
    expect(CONNECTIVITY_CATALOG.moving_walkway.cost).toBeLessThan(CONNECTIVITY_CATALOG.skywalk.cost)
    expect('transfer_centre' in CONNECTIVITY_CATALOG).toBe(false)
    expect(
      dailyUpkeep(['people_mover', 'airside_transfer_bus_depot', 'moving_walkway', 'skywalk']),
    ).toBe(9_600 + 2_600 + 160 + 1_200)
    expect(isUnlocked('airside_transfer_bus_depot', 6)).toBe(true)
    expect(isUnlocked('people_mover', 6)).toBe(false)
    expect(isUnlocked('people_mover', 7)).toBe(true)
    expect(isUnlocked('moving_walkway', 4)).toBe(true)
    expect(isUnlocked('moving_walkway', 3)).toBe(false)
    expect(isUnlocked('skywalk', 5)).toBe(true)
  })
})

describe('throughput', () => {
  it('moves people up to the open link rate and queues the rest', () => {
    const flow = throughput({ links: [mover()], demandPerHour: 4_000 })
    expect(flow.capacityPerHour).toBe(3_000)
    expect(flow.movedPerHour).toBe(3_000)
    expect(flow.queuedPerHour).toBe(1_000)
    expect(flow.apronTrafficPerHour).toBe(0)

    const slow = throughput({ links: [bus()], demandPerHour: 4_000 })
    expect(slow.capacityPerHour).toBe(800)
    expect(slow.movedPerHour).toBe(800)
    expect(slow.apronTrafficPerHour).toBe(BUS_APRON_TRAFFIC_PER_HOUR)

    const both = throughput({ links: [mover(), bus()], demandPerHour: 10_000, between: ['south', 'north'] })
    expect(both.capacityPerHour).toBe(3_800)
    expect(both.movedPerHour).toBe(3_800)
    expect(both.apronTrafficPerHour).toBe(BUS_APRON_TRAFFIC_PER_HOUR)
  })

  it('ignores a link that does not join the asked pair', () => {
    const elsewhere = linkTerminals('east', 'west', 'people_mover')
    if (!elsewhere.ok) throw new Error(elsewhere.reason)
    const flow = throughput({ links: [mover(), elsewhere.link], demandPerHour: 500, between: ['north', 'south'] })
    expect(flow.capacityPerHour).toBe(3_000)
    expect(flow.movedPerHour).toBe(500)
    expect(flow.queuedPerHour).toBe(0)
  })

  it('refuses a link from a terminal to itself', () => {
    expect(linkTerminals('north', 'north', 'people_mover')).toEqual({ ok: false, reason: 'same_terminal' })
    expect(linkTerminals('  ', 'south', 'airside_transfer_bus')).toEqual({ ok: false, reason: 'missing_terminal' })
  })
})

describe('minimum connection time', () => {
  it('uses the hub times: 60, 45 with a Transfer Centre, and 25 with RFID', () => {
    expect(MCT_BASE).toBe(60)
    expect(MCT_TRANSFER_CENTRE).toBe(45)
    expect(MCT_RFID).toBe(25)
    expect(minimumConnectionMinutes({ hasTransferCentre: false })).toBe(60)
    expect(minimumConnectionMinutes({ hasTransferCentre: true })).toBe(45)
    expect(minimumConnectionMinutes({ hasTransferCentre: true, rfid: false })).toBe(45)
    expect(minimumConnectionMinutes({ hasTransferCentre: true, rfid: true })).toBe(25)
    expect(minimumConnectionMinutes({ hasTransferCentre: false, rfid: true })).toBe(25)
  })

  it('scores the unassisted walk at 60 game-minutes', () => {
    expect(connectionStandingDelta(45, 4, { hasTransferCentre: false })).toBe(-1)
    expect(connectionStandingDelta(60, 4, { hasTransferCentre: false })).toBe(0)
  })

  it('scores a miss only when the gap is shorter than the published connection time', () => {
    expect(connectionStandingDelta(45, 4, { hasTransferCentre: true })).toBe(0)
    expect(connectionStandingDelta(44, 4, { hasTransferCentre: true })).toBe(-1)
    expect(connectionStandingDelta(25, 4, { hasTransferCentre: true, rfid: true })).toBe(0)
    expect(connectionStandingDelta(24, 4, { hasTransferCentre: true, rfid: true })).toBe(-1)
  })
})

describe('breakdown', () => {
  it('strands the people-mover gates and drops that link out of the flow', () => {
    const stopped = breakdown(mover(), [north, south])
    expect(stopped.event).toMatchObject({
      type: 'connectivity_breakdown',
      linkId: 'pm-1',
      mode: 'people_mover',
      reason: 'people_mover_stopped',
      strandsGates: true,
      strandedGateIds: ['N1', 'N2', 'S1'],
      suggestedFix: 'Repair the people mover',
    })
    expect(stopped.event.explanation.length).toBeGreaterThan(0)
    expect(stopped.link.open).toBe(false)

    const flow = throughput({ links: [stopped.link, bus()], demandPerHour: 4_000 })
    expect(flow.capacityPerHour).toBe(800)
    expect(flow.movedPerHour).toBe(800)
    expect(flow.apronTrafficPerHour).toBe(BUS_APRON_TRAFFIC_PER_HOUR)
  })

  it('stops the buses without stranding gates', () => {
    const stopped = breakdown(bus(), [north, south])
    expect(stopped.event.strandsGates).toBe(false)
    expect(stopped.event.strandedGateIds).toEqual([])
    expect(stopped.event.reason).toBe('transfer_bus_stopped')
    expect(stopped.event.suggestedFix).toBe('Repair the transfer bus depot')
    expect(stopped.link.open).toBe(false)
    const flow = throughput({ links: [stopped.link], demandPerHour: 100 })
    expect(flow.capacityPerHour).toBe(0)
    expect(flow.apronTrafficPerHour).toBe(0)
    expect(flow.queuedPerHour).toBe(100)
  })
})

describe('NaN safety', () => {
  it('keeps throughput, connection time, and Standing finite', () => {
    const flow = throughput({ links: [mover(), bus()], demandPerHour: Number.NaN })
    expect(flow).toEqual({
      movedPerHour: 0,
      capacityPerHour: 3_800,
      queuedPerHour: 0,
      apronTrafficPerHour: BUS_APRON_TRAFFIC_PER_HOUR,
    })
    const overflow = throughput({
      links: [mover()],
      demandPerHour: Number.POSITIVE_INFINITY,
    })
    expect(overflow.movedPerHour).toBe(0)
    expect(overflow.capacityPerHour).toBe(3_000)
    expect(Number.isFinite(overflow.queuedPerHour)).toBe(true)

    expect(missedConnectionStandingDelta(Number.NaN)).toBe(0)
    expect(missedConnectionStandingDelta(Number.POSITIVE_INFINITY)).toBe(0)
    expect(missedConnectionStandingDelta(-4)).toBe(0)
    expect(missedConnectionStandingDelta(0)).toBe(0)
    expect(missedConnectionStandingDelta(Number.MAX_VALUE)).toBe(-STANDING_HIT_CAP)
    expect(Number.isFinite(missedConnectionStandingDelta(3))).toBe(true)
    expect(missedConnectionStandingDelta(3)).toBe(-0.75)

    expect(connectionStandingDelta(Number.NaN, 20, { hasTransferCentre: true })).toBe(0)
    expect(connectionStandingDelta(10, Number.NaN, { hasTransferCentre: true, rfid: true })).toBe(0)
    expect(isUnlocked('people_mover', Number.NaN)).toBe(false)
    expect(minimumConnectionMinutes({ hasTransferCentre: true, rfid: true })).toBe(25)
    expect(typeof connectionStandingDelta(10, 4, { hasTransferCentre: true })).toBe('number')
  })
})

describe('passenger link choice', () => {
  const closed = {
    peopleMoverOpen: false,
    transferBusOpen: false,
    terminalBusOpen: false,
    skywalkOpen: false,
    walkwayMetres: 0,
  }

  it('prefers the people mover and falls back to the buses', () => {
    expect(choosePassengerLink({ ...closed, peopleMoverOpen: true, terminalBusOpen: true })).toBe('people_mover')
    expect(
      choosePassengerLink({
        ...closed,
        peopleMoverOpen: false,
        transferBusOpen: true,
        terminalBusOpen: true,
      }),
    ).toBe('airside_transfer_bus')
    expect(choosePassengerLink({ ...closed, terminalBusOpen: true, skywalkOpen: true })).toBe('terminal_bus')
    expect(choosePassengerLink({ ...closed, skywalkOpen: true, walkwayMetres: 12 })).toBe('skywalk')
    expect(choosePassengerLink({ ...closed, walkwayMetres: 6 })).toBe('walkway')
    expect(choosePassengerLink(closed)).toBe('walk')
    expect(choosePassengerLink({ ...closed, walkwayMetres: Number.NaN })).toBe('walk')
  })
})

import { describe, expect, it } from 'vitest'
import {
  SIM_DAY_SEC,
  activeVisits,
  botChoice,
  createInboundState,
  respond,
  spawnOffer,
  tick,
  type FieldCapabilities,
  type InboundState,
  type InboundWorld,
} from './index.ts'

function world(partial: Partial<InboundWorld> = {}, caps: Partial<FieldCapabilities> = {}): InboundWorld {
  return {
    fieldLevel: 5,
    feeMultiplier: 1,
    weather: 'clear',
    ...partial,
    capabilities: {
      stands: 8,
      remoteStands: 4,
      grassPads: 2,
      heliPads: 1,
      guardPads: 2,
      arff: true,
      ambulance: true,
      fuelLitres: 500_000,
      hotelRooms: 40,
      securityCorridor: true,
      hangarBays: 2,
      gpu: true,
      catering: true,
      cleaning: true,
      customs: true,
      runwayMetres: 3000,
      ...caps,
    },
  }
}

const copy = (state: InboundState): InboundState => JSON.parse(JSON.stringify(state)) as InboundState

describe('inbound request edges', () => {
  it('ignores a zero, negative, NaN or infinite tick without moving the clock', () => {
    const state = createInboundState(3)
    tick(state, world(), SIM_DAY_SEC / 2, botChoice)
    const before = copy(state)
    for (const dt of [0, -5, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(tick(state, world(), dt, botChoice)).toEqual([])
    }
    expect(state).toEqual(before)
  })

  it('answers nothing for an unknown id or a card that was already answered', () => {
    const state = createInboundState(5)
    const field = world()
    expect(respond(state, field, 'req-404', 'accept')).toEqual([])

    const request = spawnOffer(state, 'fuel_low')
    expect(respond(state, field, request.id, 'accept').map((e) => e.type)).toContain('accepted')
    const afterAccept = copy(state)
    expect(respond(state, field, request.id, 'accept')).toEqual([])
    expect(respond(state, field, request.id, 'refuse')).toEqual([])
    expect(state).toEqual(afterAccept)

    const refused = spawnOffer(state, 'medical')
    respond(state, field, refused.id, 'refuse')
    const afterRefuse = copy(state)
    expect(respond(state, field, refused.id, 'accept')).toEqual([])
    expect(state).toEqual(afterRefuse)
  })

  it('does not let a failed emergency be retried into an accept', () => {
    const state = createInboundState(8)
    const field = world({}, { arff: false })
    const request = spawnOffer(state, 'medical')
    const events = respond(state, field, request.id, 'accept')
    expect(events.map((e) => e.type)).toEqual(['failed_host'])
    expect(request.status).toBe('failed')
    expect(respond(state, world(), request.id, 'accept')).toEqual([])
    expect(state.visits).toHaveLength(0)
    expect(state.burnedFuel).toBe(0)
  })

  it('clamps reputation to 0..100 under long runs of refusals or accepts', () => {
    const state = createInboundState(11)
    const field = world()
    for (let i = 0; i < 60; i++) respond(state, field, spawnOffer(state, 'medical').id, 'refuse')
    expect(state.reputation).toBe(0)
    expect(state.stats.refused).toBe(60)

    const bad = createInboundState(11)
    const blind = world({}, { arff: false })
    for (let i = 0; i < 60; i++) respond(bad, blind, spawnOffer(bad, 'medical').id, 'accept')
    expect(bad.reputation).toBe(0)
    expect(bad.stats.failed).toBe(60)

    const good = createInboundState(12)
    const huge = world({}, { stands: 500, remoteStands: 500, hotelRooms: 5_000, hangarBays: 500, fuelLitres: 1e9 })
    for (let i = 0; i < 120; i++) respond(good, huge, spawnOffer(good, 'technical').id, 'accept')
    expect(good.stats.accepted).toBe(120)
    expect(good.reputation).toBe(100)
  })

  it('bills storage for exactly the days it stays, then frees the pad', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = createInboundState(seed)
      const field = world({}, { remoteStands: 1, stands: 0 })
      const request = spawnOffer(state, 'storage')
      respond(state, field, request.id, 'accept')
      const visit = state.visits[0]!
      expect(visit.pad).toBe('remote')
      for (let day = 0; day <= request.stayDays + 1; day++) tick(state, field, SIM_DAY_SEC)
      expect(visit.status).toBe('departed')
      expect(visit.paidDays).toBe(request.stayDays)
      const parking = state.ledger
        .filter((row) => row.visitId === visit.id && row.reason === 'Aircraft parking day-rate')
        .reduce((sum, row) => sum + row.amount, 0)
      expect(parking).toBe(request.dailyFee * request.stayDays)
      expect(state.held.remoteStands).toBe(0)
      expect(activeVisits(state)).toHaveLength(0)
    }
  })

  it('declines general traffic once the only pad is taken, then hosts again after departure', () => {
    const state = createInboundState(21)
    const field = world({}, { stands: 0, remoteStands: 1, grassPads: 0 })
    const first = spawnOffer(state, 'storage')
    respond(state, field, first.id, 'accept')
    const second = spawnOffer(state, 'storage')
    const blocked = respond(state, field, second.id, 'accept')
    expect(blocked).toEqual([{ type: 'declined', requestId: second.id, gaps: ['stand'] }])
    expect(state.held.remoteStands).toBe(1)

    for (let day = 0; day <= first.stayDays; day++) tick(state, field, SIM_DAY_SEC)
    const third = spawnOffer(state, 'storage')
    expect(respond(state, field, third.id, 'accept').map((e) => e.type)).toContain('accepted')
    expect(state.held.remoteStands).toBe(1)
  })

  it('lands the same field whether a week is played in one call, by day, or by the minute', () => {
    const field = world({ fieldLevel: 8 }, { stands: 3, remoteStands: 1, hotelRooms: 12, hangarBays: 1 })
    const days = 7
    const whole = createInboundState(77)
    tick(whole, field, SIM_DAY_SEC * days, botChoice)

    const daily = createInboundState(77)
    for (let d = 0; d < days; d++) tick(daily, field, SIM_DAY_SEC, botChoice)

    const fine = createInboundState(77)
    const step = SIM_DAY_SEC / 30
    for (let i = 0; i < days * 30; i++) tick(fine, field, step, botChoice)

    for (const other of [daily, fine]) {
      expect(other.requests.map((r) => [r.id, r.kind, r.status])).toEqual(whole.requests.map((r) => [r.id, r.kind, r.status]))
      expect(other.visits).toEqual(whole.visits)
      expect(other.held).toEqual(whole.held)
      expect(other.stats).toEqual(whole.stats)
      expect(other.reputation).toBe(whole.reputation)
      expect(other.ledger.reduce((s, r) => s + r.amount, 0)).toBe(whole.ledger.reduce((s, r) => s + r.amount, 0))
    }
    expect(whole.requests.length).toBeGreaterThan(0)
  })

  it('expires every ignored card in turn and fines only the priority ones', () => {
    const field = world({ fieldLevel: 8 })
    const state = createInboundState(31)
    tick(state, field, SIM_DAY_SEC * 3)
    const today = Math.floor(state.clock / SIM_DAY_SEC)
    const closed = state.requests.filter((r) => r.day < today)
    expect(closed.length).toBeGreaterThan(0)
    // A card can only close by expiring when nobody answers; nothing is hosted.
    for (const r of closed) expect(['expired', 'pending', 'queued']).toContain(r.status)
    expect(state.visits).toHaveLength(0)
    const fines = state.ledger.filter((row) => row.reason === 'Unanswered inbound request')
    const expiredPriority = state.requests.filter((r) => r.status === 'expired' && r.priority)
    expect(fines).toHaveLength(expiredPriority.length)
    expect(fines.every((row) => row.amount < 0)).toBe(true)
    expect(state.stats.expired).toBe(state.requests.filter((r) => r.status === 'expired').length)
    // Never more than one card open at a time.
    expect(state.requests.filter((r) => r.status === 'pending').length).toBeLessThanOrEqual(1)
  })
})

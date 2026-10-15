import { describe, expect, it } from 'vitest'
import { CART_TUNING, CartYard, type CartTuning } from './index.ts'

function tuning(over: Partial<CartTuning> = {}): CartTuning {
  return {
    ...CART_TUNING,
    ...over,
    bays: { ...CART_TUNING.bays, ...over.bays },
    offsets: { ...CART_TUNING.offsets, ...over.offsets },
  }
}

function yard(over: Partial<CartTuning> = {}): CartYard {
  const sim = new CartYard(
    tuning({
      speedMps: 20,
      dockSec: 0.5,
      bagUnitsPerCart: 10,
      cateringLoadsPerTruck: 2,
      ...over,
      bays: { drop: 1, sort: 1, loader: 1, claim: 1, kitchen: 1, door: 1, ...over.bays },
    }),
  )
  sim.setSites([
    { id: 'checkin', role: 'checkin', x: 0, y: 0 },
    { id: 'sort', role: 'sort', x: 40, y: 0 },
    { id: 'claim', role: 'claim', x: 40, y: 36 },
    { id: 'kitchen', role: 'kitchen', x: 0, y: 40 },
    { id: '11,6', role: 'stand', x: 90, y: 0 },
  ])
  return sim
}

function until(sim: CartYard, done: () => boolean, limit = 400): number {
  let t = 0
  while (t < limit && !done()) {
    sim.tick(0.25)
    t += 0.25
  }
  return t
}

describe('socket cart handoffs', () => {
  it('walks bags from the check-in drop to the belt loader and back to claim', () => {
    const sim = yard()
    sim.setFleet(1, 1)
    sim.postOutbound('HB1', 10, '11,6')
    until(sim, () => sim.delivered('outbound') === 10)
    expect(sim.socketsOf('HB1')).toEqual(['desk_drop', 'makeup_stop', 'makeup_stop', 'belt_low'])
    expect(sim.snapshot().every((pose) => pose.vehicleSocket === 'cart_bed' || pose.kind === 'catering_truck')).toBe(true)

    sim.postInbound('HB1-in', 10, '11,6')
    until(sim, () => sim.delivered('inbound') === 10)
    expect(sim.socketsOf('HB1-in')).toEqual(['belt_low', 'claim_stop'])
  })

  it('docks a catering truck from the kitchen socket to the aircraft door', () => {
    const sim = yard()
    sim.setFleet(1, 1)
    sim.postCatering('HB1', 2, '11,6')
    let locked = false
    until(sim, () => {
      const pose = sim.snapshot().find((row) => row.kind === 'catering_truck' && row.phase === 'dock')
      if (pose?.lockedTo === 'catering_door' && pose.vehicleSocket === 'catering_lip') locked = true
      return sim.delivered('catering') === 2
    })
    expect(locked).toBe(true)
    expect(sim.socketsOf('HB1')).toEqual(['cart_slot', 'catering_door'])
  })

  it('queues a cart when the bay is taken and moves more when carts and bays are free', () => {
    const queued = yard({ bays: { drop: 1, sort: 1, loader: 1, claim: 1, kitchen: 1, door: 1 } })
    queued.setFleet(2, 0)
    queued.postOutbound('bank', 20, '11,6')
    let sawQueue = false
    until(queued, () => {
      const poses = queued.snapshot()
      if (poses.some((pose) => pose.phase === 'queue' && pose.queueIndex >= 1) && poses.some((pose) => pose.phase === 'dock')) {
        sawQueue = true
      }
      return queued.delivered('outbound') === 20
    })
    expect(sawQueue).toBe(true)

    const oneCart = yard({ bays: { drop: 2, sort: 2, loader: 1, claim: 1, kitchen: 1, door: 1 } })
    oneCart.setFleet(1, 0)
    oneCart.postOutbound('solo', 20, '11,6')
    const solo = until(oneCart, () => oneCart.delivered('outbound') === 20)

    const open = yard({ bays: { drop: 2, sort: 2, loader: 2, claim: 2, kitchen: 1, door: 1 } })
    open.setFleet(2, 0)
    open.postOutbound('pair', 20, '11,6')
    const pair = until(open, () => open.delivered('outbound') === 20)

    const choked = yard({ bays: { drop: 2, sort: 2, loader: 1, claim: 1, kitchen: 1, door: 1 } })
    choked.setFleet(2, 0)
    choked.postOutbound('wait', 20, '11,6')
    const waited = until(choked, () => choked.delivered('outbound') === 20)

    expect(pair).toBeLessThan(solo)
    expect(waited).toBeGreaterThan(pair)
  })

  it('moves nothing when there is no cart', () => {
    const sim = yard()
    sim.setFleet(0, 0)
    sim.postOutbound('HB1', 10, '11,6')
    sim.postCatering('HB1-c', 2, '11,6')
    sim.tick(30)
    expect(sim.delivered('outbound')).toBe(0)
    expect(sim.delivered('catering')).toBe(0)
    expect(sim.snapshot()).toEqual([])
  })
})

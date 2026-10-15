import { describe, expect, it } from 'vitest'
import { apronCartSockets, vehicleSocketTable } from '../render/socketLayout.ts'
import { CART_TUNING, CartYard, resolveSocket, type CartSocket, type CartTuning } from './index.ts'

function tuning(over: Partial<CartTuning> = {}): CartTuning {
  return {
    ...CART_TUNING,
    ...over,
    bays: { ...CART_TUNING.bays, ...over.bays },
  }
}

const DROP: CartSocket = { name: 'desk_drop', x: 2, y: 4 }
const MAKEUP: CartSocket = { name: 'makeup_stop', x: 50, y: 6 }
const CLAIM: CartSocket = { name: 'claim_stop', x: 48, y: 20 }
const SLOT: CartSocket = { name: 'cart_slot', x: 4, y: 44 }
const BELT: CartSocket = { name: 'belt_low', x: 140, y: 12 }
const DOOR: CartSocket = { name: 'catering_door', x: 155, y: -12 }

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
    { id: 'checkin', role: 'checkin', x: 0, y: 0, sockets: [DROP] },
    { id: 'sort', role: 'sort', x: 40, y: 0, sockets: [MAKEUP] },
    { id: 'claim', role: 'claim', x: 40, y: 36, sockets: [CLAIM] },
    { id: 'kitchen', role: 'kitchen', x: 0, y: 40, sockets: [SLOT] },
    { id: '11,6', role: 'stand', x: 90, y: 0, sockets: [BELT, DOOR] },
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

  it('keeps bag-loaded, bag-delivered and catering-done shut until the cart finishes at the named socket', () => {
    const idle = yard()
    idle.setFleet(0, 0)
    idle.postOutbound('HB1', 10, '11,6')
    idle.postInbound('in:HB1', 10, '11,6')
    idle.postCatering('cat:HB1', 2, '11,6')
    idle.tick(30)
    expect(idle.finishedAt('HB1', 'belt_low')).toBe(false)
    expect(idle.finishedAt('in:HB1', 'claim_stop')).toBe(false)
    expect(idle.finishedAt('cat:HB1', 'catering_door')).toBe(false)

    const sim = yard()
    sim.setFleet(1, 1)
    sim.postOutbound('HB1', 10, '11,6')
    sim.postInbound('in:HB1', 10, '11,6')
    sim.postCatering('cat:HB1', 2, '11,6')
    let dockedAtDoor = false
    let finishedWhileDocking = false
    until(sim, () => {
      const pose = sim.snapshot().find((row) => row.lockedTo === 'catering_door' && row.phase === 'dock')
      if (pose) {
        dockedAtDoor = Math.hypot(pose.x - DOOR.x, pose.y - DOOR.y) < 0.05
        if (pose.u < 0.99 && sim.finishedAt('cat:HB1', 'catering_door')) finishedWhileDocking = true
      }
      const belt = sim.snapshot().find((row) => row.lockedTo === 'belt_low' && row.phase === 'dock' && row.leg === 'sort_to_loader')
      if (belt && belt.u < 0.99) expect(sim.finishedAt('HB1', 'belt_low')).toBe(false)
      return sim.finishedAt('HB1', 'belt_low') && sim.finishedAt('in:HB1', 'claim_stop') && sim.finishedAt('cat:HB1', 'catering_door')
    })
    expect(dockedAtDoor).toBe(true)
    expect(finishedWhileDocking).toBe(false)
    expect(Math.hypot(DOOR.x - (90 + 8), DOOR.y - (0 - 6))).toBeGreaterThan(1)
  })

  it('cancels an undone shipment when the flight is gone and leaves a finished one for retireDone', () => {
    const sim = yard()
    sim.setFleet(1, 0)
    sim.postOutbound('stay', 10, '11,6')
    sim.postOutbound('leave', 10, '11,6')
    sim.tick(0.5)
    expect(sim.openIds()).toContain('leave')
    sim.cancelGone(new Set(['stay']))
    expect(sim.openIds()).not.toContain('leave')
    expect(sim.snapshot().some((pose) => pose.standId === '11,6' && pose.load > 0 && !sim.openIds().includes('stay'))).toBe(false)
    expect(sim.delivered('outbound')).toBe(0)
    until(sim, () => sim.delivered('outbound') === 10)
    expect(sim.openIds()).toContain('stay')
    sim.cancelGone(new Set())
    expect(sim.openIds()).toContain('stay')
    expect(sim.delivered('outbound')).toBe(10)
    sim.tick(0.25)
    sim.tick(0.25)
    expect(sim.openIds()).not.toContain('stay')
    expect(sim.delivered('outbound')).toBe(10)
    sim.tick(5)
    expect(sim.delivered('outbound')).toBe(10)
  })

  it('does not invent a socket from a tile-centre offset when the name is missing', () => {
    const sim = yard()
    sim.setSites([
      { id: 'checkin', role: 'checkin', x: 0, y: 0, sockets: [DROP] },
      { id: 'sort', role: 'sort', x: 40, y: 0, sockets: [MAKEUP] },
      { id: '11,6', role: 'stand', x: 90, y: 0, sockets: [] },
    ])
    sim.setFleet(1, 0)
    expect(sim.canAccept('outbound', '11,6')).toBe(false)
    sim.postOutbound('HB1', 10, '11,6')
    sim.tick(10)
    expect(sim.finishedAt('HB1', 'belt_low')).toBe(false)
    expect(sim.snapshot()).toEqual([])
  })
})

describe('named model sockets', () => {
  it('resolves a mesh socket by name and ignores an unknown name', () => {
    const table = {
      catering_door: [8, 3, -2] as const,
      belt_low: [1, 0.4, 4] as const,
    }
    expect(resolveSocket(table, 'catering_door', { x: 100, y: 40, heading: 0 })).toEqual({
      name: 'catering_door',
      x: 108,
      y: 38,
    })
    expect(resolveSocket(table, 'belt_low', { x: 100, y: 40, heading: Math.PI / 2 })).toEqual({
      name: 'belt_low',
      x: 96,
      y: 41,
    })
    expect(resolveSocket(table, 'cart_slot', { x: 100, y: 40 })).toBeNull()
  })

  it('uses the belt and catering points from the vehicle mesh', () => {
    for (const model of ['belt_loader', 'catering_hilift'] as const) {
      const pure = apronCartSockets(model)
      const mesh = vehicleSocketTable(model)
      for (const name of Object.keys(pure)) expect(mesh[name]).toEqual(pure[name])
    }
  })
})

describe('a bulldozed socket', () => {
  it('drops a shipment no cart can reach and keeps one already on the road', () => {
    const sim = yard()
    sim.setFleet(1, 1)
    sim.postOutbound('HB9', 10, '11,6')
    sim.postCatering('cat:HB9', 2, '11,6')
    expect(sim.isOpen('cat:HB9')).toBe(true)
    sim.setSites([
      { id: 'checkin', role: 'checkin', x: 0, y: 0, sockets: [DROP] },
      { id: 'sort', role: 'sort', x: 40, y: 0, sockets: [MAKEUP] },
      { id: 'claim', role: 'claim', x: 40, y: 36, sockets: [CLAIM] },
      { id: '11,6', role: 'stand', x: 90, y: 0, sockets: [BELT, DOOR] },
    ])
    until(sim, () => !sim.isOpen('cat:HB9') && sim.delivered('outbound') === 10)
    expect(sim.isOpen('cat:HB9')).toBe(false)
    expect(sim.finishedAt('cat:HB9', 'catering_door')).toBe(false)
    expect(sim.delivered('outbound')).toBe(10)
  })
})

import { describe, expect, it } from 'vitest'
import { LandsideTraffic } from './engine.ts'
import { starterField } from './fixtures.test-util.ts'
import { curbHurry, curbKind, groupCurbOrders, type CurbOrder } from './trips.ts'

describe('curb trip kinds', () => {
  it('sends own cars, taxis and buses, and keeps rail and hotel off the road', () => {
    expect(curbKind('car_short')).toBe('car')
    expect(curbKind('car_long')).toBe('car')
    expect(curbKind('dropoff')).toBe('taxi')
    expect(curbKind('bus')).toBe('bus')
    expect(curbKind('rail')).toBeNull()
    expect(curbKind('hotel')).toBeNull()
    expect(curbKind(undefined)).toBeNull()
  })

  it('groups a bus and leaves cars one to a vehicle', () => {
    const guests: {
      id: string
      flightId: string
      kind: 'bus' | 'taxi'
      role: 'drop'
      hurry: boolean
    }[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
      id,
      flightId: 'f1',
      kind: 'bus',
      role: 'drop',
      hurry: false,
    }))
    guests.push({ id: 't', flightId: 'f1', kind: 'taxi', role: 'drop', hurry: true })
    const orders = groupCurbOrders(guests, 3)
    const buses = orders.filter((order) => order.kind === 'bus')
    expect(buses.map((order) => order.guests)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
    expect(orders.find((order) => order.kind === 'taxi')?.guests).toEqual(['t'])
    expect(orders.find((order) => order.kind === 'taxi')?.hurry).toBe(true)
  })

  it('hurries only when the door is close', () => {
    expect(curbHurry(100, 50)).toBe(false)
    expect(curbHurry(100, 80)).toBe(true)
    expect(curbHurry(undefined, 0)).toBe(true)
  })
})

describe('scheduled curb fleet', () => {
  const drop: CurbOrder = {
    id: 'drop:g1',
    kind: 'taxi',
    role: 'drop',
    guests: ['g1'],
    flightId: 'f1',
  }

  it('carries the named passenger to the door and spawns no background traffic', () => {
    const sim = new LandsideTraffic()
    const field = starterField()
    sim.offer([])
    for (let t = 0; t < 40; t++) {
      const view = sim.tick(0.25, { ...field, departures: 14, paxPerDay: 2400 })
      expect(view.vehicles).toHaveLength(0)
    }
    sim.offer([drop])
    let sawGuest = false
    let boarded = false
    let stopped = false
    for (let t = 0; t < 500; t++) {
      const view = sim.tick(0.25, field)
      expect(view.vehicles.length).toBeLessThanOrEqual(1)
      for (const car of view.vehicles) {
        expect(car.r).toBeGreaterThanOrEqual(-1e-4)
        expect(car.orderId).toBe(drop.id)
        expect(car.role).toBe('drop')
        if (car.state === 'stop') stopped = true
      }
      if (view.passengers.some((p) => p.guestId === 'g1' && p.dir === 'in')) sawGuest = true
      if (sim.takeNotices().some((note) => note.kind === 'boarded' && note.guests.includes('g1'))) boarded = true
    }
    expect(stopped).toBe(true)
    expect(sawGuest).toBe(true)
    expect(boarded).toBe(true)
  })

  it('picks an arrival up from the kerb and drives away', () => {
    const sim = new LandsideTraffic()
    const field = starterField()
    const pick: CurbOrder = { id: 'pick:a1', kind: 'car', role: 'pick', guests: ['a1'], flightId: 'f1' }
    sim.offer([pick])
    let sawWalk = false
    let picked = false
    let left = false
    for (let t = 0; t < 500; t++) {
      const view = sim.tick(0.25, field)
      for (const car of view.vehicles) expect(car.r).toBeGreaterThanOrEqual(-1e-4)
      if (view.passengers.some((p) => p.guestId === 'a1' && p.dir === 'out')) sawWalk = true
      if (view.vehicles.some((car) => car.role === 'pick' && car.state === 'leave')) left = true
      if (sim.takeNotices().some((note) => note.kind === 'picked' && note.guests.includes('a1'))) picked = true
    }
    expect(sawWalk).toBe(true)
    expect(picked).toBe(true)
    expect(left).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import type { Flight } from './types.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.clock = 100
  return game
}

describe('passengers ride their own curb trip', () => {
  it('drops a departing passenger at the layby and walks them into check-in on their flight', () => {
    const game = starter()
    game.seedHallForFlight(
      { id: 'f-out', cargo: false, pax: 40, airline: 'northline', stand: null } as Flight,
      'depart',
    )
    const guest = game.hallGuests.find((g) => g.flightId === 'f-out')
    expect(guest).toBeTruthy()
    guest!.arriveMode = 'dropoff'
    guest!.curbHold = 'ride'
    guest!.curbOrder = undefined
    guest!.releaseAt = game.clock + 80
    guest!.path = []
    guest!.thought = 'On the way to the doors'
    game.hallGuests = [guest!]

    let sawAlight = false
    let sawWalk = false
    for (let i = 0; i < 420; i++) {
      game.tick(0.25)
      const view = game.landsideView()
      for (const car of view.vehicles) {
        expect(car.r).toBeGreaterThanOrEqual(-1e-4)
        expect(car.orderId).toBeTruthy()
      }
      if (view.passengers.some((p) => p.guestId === guest!.id && p.dir === 'in')) sawWalk = true
      if (view.vehicles.some((car) => car.role === 'drop' && car.state === 'stop')) sawAlight = true
      if (guest!.curbHold == null && guest!.path.length > 1) break
    }
    expect(sawAlight).toBe(true)
    expect(sawWalk).toBe(true)
    expect(guest!.curbHold).toBeUndefined()
    expect(guest!.flightId).toBe('f-out')
    expect(guest!.path.length).toBeGreaterThan(1)
    expect(guest!.node === 'checkin' || guest!.path.includes('checkin')).toBe(true)
    expect(guest!.dead).toBe(false)
  }, 60_000)

  it('picks an arriving passenger up at the curb and sends the car away', () => {
    const game = starter()
    game.seedHallForFlight(
      { id: 'f-in', cargo: false, pax: 40, airline: 'northline', stand: null } as Flight,
      'arrive',
    )
    const guest = game.hallGuests.find((g) => g.flightId === 'f-in')
    expect(guest).toBeTruthy()
    guest!.node = 'claim'
    guest!.path = ['claim', 'exit']
    guest!.seg = 0
    guest!.t = 0.99
    guest!.clearedSec = true
    guest!.needs.bags = 0
    guest!.needs.hunger = 0
    guest!.needs.bladder = 0
    guest!.needs.energy = 0
    guest!.needs.shop = 0
    guest!.needs.play = 0
    guest!.needs.boarding = 0
    game.hallGuests = [guest!]
    const served = game.paxServed

    let sawWalk = false
    let sawLeave = false
    for (let i = 0; i < 500 && game.hallGuests.some((g) => g.id === guest!.id); i++) {
      game.tick(0.25)
      const view = game.landsideView()
      for (const car of view.vehicles) expect(car.r).toBeGreaterThanOrEqual(-1e-4)
      if (view.passengers.some((p) => p.guestId === guest!.id && p.dir === 'out')) sawWalk = true
      if (view.vehicles.some((car) => car.role === 'pick' && car.state === 'leave')) sawLeave = true
    }
    expect(guest!.curbHold == null || guest!.thought === 'Picked up' || !game.hallGuests.some((g) => g.id === guest!.id)).toBe(
      true,
    )
    expect(sawWalk).toBe(true)
    expect(sawLeave).toBe(true)
    expect(game.hallGuests.some((g) => g.id === guest!.id)).toBe(false)
    expect(game.paxServed).toBe(served + 1)
  }, 60_000)
})

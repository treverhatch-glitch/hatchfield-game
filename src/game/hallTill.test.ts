/**
 * The counter draws a unit before it takes the money. A failed charge puts the unit back.
 */
import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.heloCool = 1e9
  return game
}

function shelf(game: Game, kind: 'food' | 'shop', units: number) {
  if (kind === 'food') game.foodShelf = units
  else game.shopShelf = units
  const bridge = game as unknown as {
    pushedFood: number
    pushedShop: number
    catering: { setHallUnits(kind: 'food' | 'shop', units: number): void } | null
  }
  if (kind === 'food') bridge.pushedFood = units
  else bridge.pushedShop = units
  bridge.catering?.setHallUnits(kind, units)
}

describe('hall tills', () => {
  it('draws the food unit before charging, and puts it back when the guest cannot pay', () => {
    const game = field()
    const open = game.hallOpen()
    shelf(game, 'food', 2)
    const cash = game.cash
    const broke = spawnHallGuest('broke-food', 'depart', 'budget')
    broke.node = 'food'
    broke.needs.hunger = 90
    broke.wallet = 1
    broke.prefs.food = 1
    broke.clearedSec = true
    game.serveNode(broke, open)
    expect(game.cash).toBe(cash)
    expect(broke.wallet).toBe(1)
    expect(game.foodShelf).toBe(2)
    expect(broke.thought).toBe('Hungry but broke')

    const buyer = spawnHallGuest('pay-food', 'depart', 'budget')
    buyer.node = 'food'
    buyer.needs.hunger = 90
    buyer.wallet = 80
    buyer.prefs.food = 1
    buyer.clearedSec = true
    game.serveNode(buyer, open)
    expect(game.foodShelf).toBe(1)
    expect(game.cash).toBe(cash + 12)
    expect(buyer.wallet).toBe(68)
    expect(buyer.thought).toBe('Ate (−$12)')
  })

  it('draws the shop unit before charging, and puts it back when the guest cannot pay', () => {
    const game = field()
    const open = game.hallOpen()
    shelf(game, 'shop', 2)
    const cash = game.cash
    const broke = spawnHallGuest('broke-shop', 'depart', 'budget')
    broke.node = 'shop'
    broke.needs.shop = 90
    broke.wallet = 1
    broke.prefs.shop = 1
    broke.clearedSec = true
    game.serveNode(broke, open)
    expect(game.cash).toBe(cash)
    expect(broke.wallet).toBe(1)
    expect(game.shopShelf).toBe(2)
    expect(broke.thought).toBe('Wanted a gift — wallet empty')

    const buyer = spawnHallGuest('pay-shop', 'depart', 'budget')
    buyer.node = 'shop'
    buyer.needs.shop = 90
    buyer.wallet = 80
    buyer.prefs.shop = 1
    buyer.clearedSec = true
    game.serveNode(buyer, open)
    expect(game.shopShelf).toBe(1)
    expect(game.cash).toBe(cash + 14)
    expect(buyer.thought).toBe('Bought a souvenir (−$14)')
  })

  it('does not charge when the engine shelf is already empty', () => {
    const game = field()
    const open = game.hallOpen()
    shelf(game, 'food', 4)
    const bridge = game as unknown as {
      pushedFood: number
      catering: { setHallUnits(kind: 'food' | 'shop', units: number): void }
    }
    bridge.pushedFood = game.foodShelf
    bridge.catering.setHallUnits('food', 0)
    const guest = spawnHallGuest('empty-engine', 'depart', 'budget')
    guest.node = 'food'
    guest.needs.hunger = 90
    guest.wallet = 80
    guest.prefs.food = 1
    guest.clearedSec = true
    const cash = game.cash
    game.serveNode(guest, open)
    expect(game.cash).toBe(cash)
    expect(guest.wallet).toBe(80)
    expect(guest.thought).toBe('wish they had burgers')

    shelf(game, 'shop', 4)
    const shopBridge = game as unknown as {
      pushedShop: number
      catering: { setHallUnits(kind: 'food' | 'shop', units: number): void }
    }
    shopBridge.pushedShop = game.shopShelf
    shopBridge.catering.setHallUnits('shop', 0)
    const shopper = spawnHallGuest('empty-shop', 'depart', 'budget')
    shopper.node = 'shop'
    shopper.needs.shop = 90
    shopper.wallet = 80
    shopper.prefs.shop = 1
    shopper.clearedSec = true
    game.serveNode(shopper, open)
    expect(game.cash).toBe(cash)
    expect(shopper.wallet).toBe(80)
    expect(shopper.thought).toBe('wish they had souvenirs')
  })
})

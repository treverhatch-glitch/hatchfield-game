import { describe, expect, it } from 'vitest'
import {
  claimSeat,
  hasTimeToSit,
  releaseSeat,
  seatsNear,
  sweepSeats,
  type SeatBook,
} from './dining.ts'
import { DINING_TUNING } from './diningData.ts'
import { spawnHallGuest, type HallGuest } from './guests.ts'
import { Game } from './sim.ts'
import type { ItemId, PlacedItem, ZoneId } from './terminal.ts'

let seq = 0
function placed(def: ItemId, c: number, r: number, extra: Partial<PlacedItem> = {}): PlacedItem {
  seq += 1
  return { id: `${def}-${seq}`, def, c, r, wear: 0, ...extra }
}

describe('seat booking', () => {
  it('finds bench places and restaurant tables near the counter, nearest first', () => {
    const near = placed('bench', 1, 1)
    const far = placed('bench', 4, 1)
    const bundle = placed('seat_row', 0, 1, { bundle: true })
    const resto = placed('restaurant', 2, 1)
    const seats = seatsNear([far, resto, near, bundle], 0, 1)
    expect(seats.map((s) => s.itemId)).toEqual([
      near.id,
      near.id,
      near.id,
      resto.id,
      resto.id,
      resto.id,
      resto.id,
    ])
    expect(seats.filter((s) => s.table)).toHaveLength(4)
  })

  it('a claimed seat is reserved: two guests never share one, and leaving frees it', () => {
    const bench = placed('bench', 0, 0)
    const seats = seatsNear([bench], 0, 0)
    const book: SeatBook = new Map()
    const taken = ['a', 'b', 'c'].map((id) => claimSeat(book, seats, id)!.id)
    expect(new Set(taken).size).toBe(3)
    expect(claimSeat(book, seats, 'd')).toBeNull()
    // Claiming again moves the guest; they never hold two seats.
    expect(claimSeat(book, seats, 'a')!.id).toBe(taken[0])
    expect([...book.values()].filter((id) => id === 'a')).toHaveLength(1)

    releaseSeat(book, 'b')
    expect(claimSeat(book, seats, 'd')!.id).toBe(taken[1])
    sweepSeats(book, (id) => id !== 'c')
    expect([...book.values()]).not.toContain('c')
  })

  it('time-pressed departures skip the seat; arrivals and early pax sit', () => {
    const base = { job: 'depart' as const, boardingCall: false, clockRunning: true, mealSec: 18 }
    const need = (18 + DINING_TUNING.boardingMarginSec) * DINING_TUNING.boardingDrainPerSec
    expect(hasTimeToSit({ ...base, boarding: need + 1 })).toBe(true)
    expect(hasTimeToSit({ ...base, boarding: need - 1 })).toBe(false)
    expect(hasTimeToSit({ ...base, boarding: 99, boardingCall: true })).toBe(false)
    expect(hasTimeToSit({ ...base, boarding: 1, clockRunning: false })).toBe(true)
    expect(hasTimeToSit({ ...base, job: 'arrive', boarding: 0 })).toBe(true)
  })
})

/** Fresh custom hall with a food court row (row 3). */
function scratchHall() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 200_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.enqueueBuild({
    kind: 'terminal',
    cells: [{ c: 4, r: 4 }],
    tile: 'terminal',
    cost: 0,
    name: 'Terminal shell',
    origin: { c: 4, r: 4 },
  })
  game.finishSite(game.sites[game.sites.length - 1])
  const fit = game.activeHall()!
  const plan: ZoneId[] = ['checkin', 'security', 'gates', 'retail', 'arrivals']
  for (let r = 0; r < plan.length; r++) {
    for (let c = 0; c < 8; c++) game.paintHallCell(c, r, plan[r])
  }
  game.foodShelf = 50
  return { game, fit, open: game.hallOpen() }
}

function diner(game: Game, id: string, boarding = 90): HallGuest {
  const g = spawnHallGuest(id, 'depart', 'budget')
  g.id = id
  g.node = 'food'
  g.path = []
  g.seg = 0
  g.clearedSec = true
  g.hallId = game.hallKey(game.activeHall()!)
  g.needs.hunger = 95
  g.needs.boarding = boarding
  g.wallet = 500
  g.prefs.food = 1
  g.happiness = 50
  return g
}

/** Run one diner's meal to the end. */
function eat(game: Game, g: HallGuest) {
  for (let t = 0; t < 400 && g.meal; t++) game.tickMeal(g, 0.25)
}

describe('diners in the live sim', () => {
  it('a diner claims a seat near the counter, walks there, and sits for the meal', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 2, 3)).toBe(true)
    const g = diner(game, 'd1')
    game.hallGuests = [g]
    game.serveNode(g, open)
    expect(g.meal).toMatchObject({ c: 2, r: 3, left: 18 })
    expect(g.meal!.walk).toBeGreaterThan(0)
    expect(game.seatBook(fit).get(g.meal!.seatId)).toBe('d1')
    // No wrapper yet — it waits for the end of the meal.
    expect(fit.litter ?? []).toHaveLength(0)

    expect(game.tickMeal(g, g.meal!.walk)).toBe(true)
    expect(game.tickMeal(g, 1)).toBe(true)
    expect(g.seated).toBe(true)
    const shop = g.needs.shop
    const happy = g.happiness
    expect(game.tickMeal(g, 5)).toBe(true)
    expect(g.happiness).toBeGreaterThan(happy)
    expect(g.needs.shop).toBeGreaterThan(shop)
    eat(game, g)
    expect(g.meal).toBeUndefined()
    expect(g.seated).toBe(false)
    expect(game.seatBook(fit).size).toBe(0)
  })

  it('no double-sitting: a full bench sends the next diner to eat standing, and the advisor hints', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 1, 3)).toBe(true)
    const guests = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => diner(game, id))
    game.hallGuests = guests
    for (const g of guests) game.serveNode(g, open)
    const seated = guests.filter((g) => g.meal)
    expect(seated).toHaveLength(3)
    expect(new Set(seated.map((g) => g.meal!.seatId)).size).toBe(3)
    expect(game.seatBook(fit).size).toBe(3)
    const standing = guests.filter((g) => !g.meal)
    // Eating on their feet costs a little happiness against a seated diner.
    for (const g of standing) {
      expect(g.happiness).toBeCloseTo(seated[0].happiness - DINING_TUNING.standJoyHit)
    }
    // Standing diners drop litter right away, by the counter.
    expect(fit.litter).toHaveLength(3)

    game.refreshAdvice()
    const hint = game.advice.find((a) => a.id === 'dining-no-seats')
    expect(hint?.title).toBe('Not enough seating near food court')

    // When one leaves, the seat frees for the next diner.
    const freed = seated[0].meal!.seatId
    eat(game, seated[0])
    const next = diner(game, 'g')
    game.hallGuests.push(next)
    game.serveNode(next, open)
    expect(next.meal?.seatId).toBe(freed)
    expect(game.seatBook(fit).size).toBe(3)
  })

  it('time-pressed passengers skip the seat; coffee buyers drink on the walk', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 1, 3)).toBe(true)
    const rushed = diner(game, 'rush', 5)
    game.serveNode(rushed, open)
    expect(rushed.meal).toBeUndefined()
    // Skipping by choice is not a seating shortfall.
    expect(game.diningStoodRecently(fit)).toBe(0)
    expect(game.seatBook(fit).size).toBe(0)

    const { game: g2, open: open2 } = scratchHall()
    expect(g2.placeHallItemAt('cafe', 0, 3)).toBe(true)
    expect(g2.placeHallItemAt('bench', 1, 3)).toBe(true)
    const coffee = diner(g2, 'cof')
    coffee.tag = 'business'
    g2.serveNode(coffee, open2)
    expect(coffee.meal).toBeUndefined()
  })

  it('a boarding clock running short stands the diner up and frees the seat', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 1, 3)).toBe(true)
    const g = diner(game, 'late')
    game.hallGuests = [g]
    game.serveNode(g, open)
    expect(g.meal).toBeDefined()
    g.needs.boarding = 1
    expect(game.tickMeal(g, 0.25)).toBe(false)
    expect(g.meal).toBeUndefined()
    expect(game.seatBook(fit).size).toBe(0)
  })

  it('litter lands at the seat: the nearest can with room, else the floor there', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 2, 3)).toBe(true)
    const g = diner(game, 'l1')
    game.hallGuests = [g]
    game.serveNode(g, open)
    eat(game, g)
    expect(fit.litter).toHaveLength(1)
    expect(fit.litter![0]).toMatchObject({ c: 2, r: 3 })

    // A can by the seat (out of the counter's reach) catches the next wrapper.
    expect(game.placeHallItemAt('trash_can', 4, 3)).toBe(true)
    const h = diner(game, 'l2')
    game.hallGuests = [h]
    game.serveNode(h, open)
    eat(game, h)
    expect(fit.litter).toHaveLength(1)
    expect(fit.items!.find((i) => i.def === 'trash_can')!.fill).toBe(1)
  })

  it('the hall tick holds a seated diner, then lets them go; dead guests lose their claim', () => {
    const { game, fit, open } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    expect(game.placeHallItemAt('bench', 1, 3)).toBe(true)
    const g = diner(game, 'tick')
    game.hallGuests = [g]
    game.serveNode(g, open)
    expect(g.meal).toBeDefined()
    for (let t = 0; t < 400 && g.meal; t++) game.tickHall(0.25)
    expect(g.meal).toBeUndefined()

    const h = diner(game, 'gone')
    game.hallGuests = [h]
    game.serveNode(h, open)
    expect(game.seatBook(fit).size).toBe(1)
    h.dead = true
    game.tickHall(0.25)
    expect(game.seatBook(fit).size).toBe(0)
  })
})

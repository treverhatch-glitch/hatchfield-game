import { describe, expect, it } from 'vitest'
import { spawnHallGuest, type HallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { itemDef, unclearedReachesGate, type ItemId, type PlacedItem, type ZoneId } from './terminal.ts'
import {
  cellLoad,
  comfortAtCell,
  nodeComfort,
  pickOutlet,
  placementCheck,
  seatCount,
} from './terminalKit.ts'
import { KIT_TUNING } from './terminalKitData.ts'

const ROWS: (ZoneId | null)[][] = [
  ['checkin', 'checkin', 'checkin', null],
  ['security', 'security', 'security', null],
  ['gates', 'gates', 'retail', 'retail'],
]

const ok = { fieldLevel: 1, cash: 1e6 }

function placed(def: ItemId, c: number, r: number, extra: Partial<PlacedItem> = {}): PlacedItem {
  return { id: `${def}-${c}-${r}-${Math.random()}`, def, c, r, wear: 0, ...extra }
}

describe('terminal kit placement', () => {
  it('refuses bare cells, wrong zones, full cells, locked items, and empty wallets', () => {
    const bench = itemDef('bench')!
    expect(placementCheck(ROWS, [], bench, 3, 0, ok)).toMatchObject({ ok: false, reason: 'Paint a zone here first' })
    expect(placementCheck(ROWS, [], bench, 9, 9, ok).ok).toBe(false)
    expect(placementCheck(ROWS, [], bench, 0, 1, ok).reason).toMatch(/^Goes in/)
    expect(placementCheck(ROWS, [], bench, 0, 2, ok)).toEqual({ ok: true, reason: 'Click to place', cost: 350 })

    const four = [0, 1, 2, 3].map(() => placed('bench', 0, 2))
    expect(cellLoad(four, 0, 2)).toBe(4)
    expect(placementCheck(ROWS, four, bench, 0, 2, ok).reason).toBe('Cell is full')

    const restaurant = itemDef('restaurant')!
    const one = [placed('plant', 2, 2)]
    expect(placementCheck(ROWS, one, restaurant, 2, 2, { fieldLevel: 3, cash: 1e6 }).reason).toBe('Cell is full')
    expect(placementCheck(ROWS, [], restaurant, 2, 2, ok).reason).toBe('Needs Field level 3')

    const fast = itemDef('fast_food')!
    expect(placementCheck(ROWS, [], fast, 2, 2, { fieldLevel: 1, cash: 10 }).reason).toBe('Not enough cash')
    expect(placementCheck(ROWS, [], fast, 2, 2, { fieldLevel: 1, cash: 10, sandbox: true }).ok).toBe(true)
    // Two half-cell counters share a cell; a third does not fit.
    const court = [placed('fast_food', 2, 2), placed('cafe', 2, 2)]
    expect(placementCheck(ROWS, court, fast, 2, 2, ok).reason).toBe('Cell is full')
  })

  it('every kit item costs money and upkeep', () => {
    for (const id of ['fast_food', 'bench', 'plant', 'art', 'info_screen', 'info_kiosk', 'fountain'] as const) {
      const def = itemDef(id)!
      expect(def.cost).toBeGreaterThan(0)
      expect(def.upkeep).toBeGreaterThan(0)
      expect(def.category).toBeDefined()
    }
  })

  it('decor comfort fades with distance and stops at the cap', () => {
    const fountain = [placed('fountain', 0, 2)]
    expect(comfortAtCell(fountain, 0, 2)).toBeCloseTo(5)
    expect(comfortAtCell(fountain, 1, 2)).toBeCloseTo(5 * (2 / 3))
    expect(comfortAtCell(fountain, 3, 2)).toBe(0)
    const forest = Array.from({ length: 12 }, () => placed('art', 0, 2))
    expect(comfortAtCell(forest, 0, 2)).toBe(KIT_TUNING.comfortCap)
    expect(nodeComfort(ROWS, fountain, 'gate')).toBeCloseTo(5)
    expect(nodeComfort(ROWS, fountain, 'checkin')).toBeCloseTo(5 / 3)
    expect(nodeComfort(ROWS, fountain, 'security')).toBeCloseTo(5 * (2 / 3))
  })

  it('counts seats and matches outlets to tags, skipping the prefab counter', () => {
    expect(seatCount([placed('bench', 0, 2), placed('seat_row', 0, 2), placed('plant', 0, 2)])).toBe(7)
    expect(seatCount([placed('seat_row', 0, 2, { bundle: true })])).toBe(0)
    const court = [placed('cafe', 2, 2, { bundle: true }), placed('restaurant', 3, 2), placed('fast_food', 2, 2)]
    expect(pickOutlet(court, 'budget')?.item.def).toBe('fast_food')
    expect(pickOutlet(court, 'premium')?.item.def).toBe('restaurant')
    expect(pickOutlet([placed('cafe', 2, 2, { bundle: true })], 'budget')).toBeNull()
  })
})

/** Fresh game, no starter kit: the player stamps an empty shell and builds it out. */
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
  expect(fit.premade).toBe(false)
  const plan: ZoneId[] = ['checkin', 'security', 'gates', 'retail', 'arrivals']
  for (let r = 0; r < plan.length; r++) {
    for (let c = 0; c < 8; c++) game.paintHallCell(c, r, plan[r])
  }
  game.paintHallCell(7, 0, 'toilets')
  return { game, fit }
}

function guestAt(game: Game, id: string, node: HallGuest['node'], tag: HallGuest['tag'] = 'budget') {
  const g = spawnHallGuest(id, 'depart', tag)
  g.node = node
  g.path = []
  g.seg = 0
  g.clearedSec = true
  g.hallId = game.hallKey(game.activeHall()!)
  return g
}

describe('build a terminal from scratch', () => {
  it('a bare shell plus placed rooms gives a working curb-to-gate path', () => {
    const { game, fit } = scratchHall()
    expect(unclearedReachesGate(game.hallOpen())).toBe(false)
    const cash = game.cash
    const build: [ItemId, number, number][] = [
      ['entrance', 0, 0],
      ['checkin_belt', 1, 0],
      ['toilet', 7, 0],
      ['security_small', 0, 1],
      ['secure_exit', 1, 1],
      ['boarding_desk', 0, 2],
      ['bench', 1, 2],
      ['plant', 1, 2],
      ['fast_food', 0, 3],
      ['claim_carousel', 0, 4],
    ]
    let spent = 0
    for (const [id, c, r] of build) {
      expect(game.placeHallItemAt(id, c, r, 1)).toBe(true)
      spent += itemDef(id)!.cost
    }
    expect(game.cash).toBe(cash - spent)
    expect(unclearedReachesGate(game.hallOpen())).toBe(true)
    expect(game.hallOpen().has('food')).toBe(true)
    expect(fit.items!.find((i) => i.def === 'bench')?.rot).toBe(1)

    // Wrong zone: refused and free.
    const before = game.cash
    expect(game.placeHallItemAt('fast_food', 0, 1)).toBe(false)
    expect(game.cash).toBe(before)

    // Bulldoze refunds part of the price and frees the slot.
    const bench = fit.items!.find((i) => i.def === 'bench')!
    expect(game.removeHallItem(bench.id)).toBe(true)
    expect(game.cash).toBe(before + Math.round(350 * KIT_TUNING.refundShare))
    expect(fit.items!.some((i) => i.id === bench.id)).toBe(false)

    // Removing the only food counter closes the food node.
    const food = fit.items!.find((i) => i.def === 'fast_food')!
    expect(game.removeHallItem(food.id)).toBe(true)
    expect(game.hallOpen().has('food')).toBe(false)
  })

  it('prefab bundle pieces cannot be bulldozed', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    const fit = game.activeHall()!
    const bundled = fit.items!.find((i) => i.bundle)!
    expect(game.removeHallItem(bundled.id)).toBe(false)
    expect(fit.items!.some((i) => i.id === bundled.id)).toBe(true)
  })
})

describe('passengers use the kit', () => {
  it('hungry passengers buy at the matching outlet, draw stock, and pay the operator', () => {
    const { game, fit } = scratchHall()
    game.placeHallItemAt('fast_food', 0, 3)
    game.placeHallItemAt('cafe', 0, 3)
    expect(game.shelfCap('food')).toBe(2 * 8 + 6)
    game.foodShelf = 5
    const open = game.hallOpen()

    const budget = guestAt(game, 'eat1', 'food', 'budget')
    budget.needs.hunger = 90
    budget.wallet = 100
    budget.prefs.food = 1
    const cash = game.cash
    game.serveNode(budget, open)
    const price = Math.round(12 * 0.8)
    expect(game.cash).toBe(cash + price)
    expect(game.foodCourtRevenue).toBe(price)
    expect(game.foodShelf).toBe(4)
    expect(budget.spent).toBe(price)
    expect(budget.needs.hunger).toBe(90 - 55)
    expect(budget.thought).toBe(`Fast food (−$${price})`)
    expect(fit.items!.find((i) => i.def === 'fast_food')!.revenue).toBe(price)

    const biz = guestAt(game, 'eat2', 'food', 'business')
    biz.needs.hunger = 90
    biz.wallet = 200
    biz.prefs.food = 1
    game.serveNode(biz, open)
    expect(fit.items!.find((i) => i.def === 'cafe')!.revenue).toBe(24)
    expect(game.foodCourtRevenue).toBe(price + 24)

    // Empty shelf: no sale, no revenue.
    game.foodShelf = 0
    const late = guestAt(game, 'eat3', 'food', 'budget')
    late.needs.hunger = 90
    late.wallet = 100
    late.prefs.food = 1
    game.serveNode(late, open)
    expect(game.foodCourtRevenue).toBe(price + 24)
  })

  it('waiting passengers sit while seats last, and rest faster than standing', () => {
    const { game } = scratchHall()
    game.placeHallItemAt('boarding_desk', 0, 2)
    game.placeHallItemAt('bench', 1, 2)
    const cache = new Map()
    const guests = [0, 1, 2, 3].map((i) => guestAt(game, `sit${i}`, 'gate'))
    for (const g of guests) g.needs.energy = 50
    for (const g of guests) game.applyHallKit(g, 1, cache)
    expect(guests.filter((g) => g.seated)).toHaveLength(3)
    expect(guests[0].needs.energy).toBeCloseTo(50 - KIT_TUNING.seatRestPerSec)
    expect(guests[3].seated).toBe(false)
    expect(guests[3].needs.energy).toBe(50)

    // A walking guest does not take a seat.
    const walker = guestAt(game, 'walk', 'gate')
    walker.path = ['gate', 'food']
    game.applyHallKit(walker, 1, new Map())
    expect(walker.seated).toBe(false)
  })

  it('decorations nearby lift the mood a little', () => {
    const { game } = scratchHall()
    const plain = guestAt(game, 'plain', 'checkin')
    plain.happiness = 50
    game.applyHallKit(plain, 10, new Map())
    expect(plain.happiness).toBe(50)

    game.placeHallItemAt('fountain', 3, 0)
    const happy = guestAt(game, 'happy', 'checkin')
    happy.happiness = 50
    game.applyHallKit(happy, 10, new Map())
    expect(happy.happiness).toBeCloseTo(50 + 10 * 5 * KIT_TUNING.comfortJoyPerSec)
  })
})

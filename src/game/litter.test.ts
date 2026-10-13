import { describe, expect, it } from 'vitest'
import { spawnHallGuest, type HallGuest } from './guests.ts'
import {
  binFull,
  binInRange,
  dropLitter,
  litterAdvice,
  litterInZone,
  litterJoyDrain,
  nextJanitorTask,
  restroomJoyHit,
  stepJanitor,
  type HallJanitor,
  type LitterHall,
} from './litter.ts'
import { LITTER_TUNING } from './litterData.ts'
import { Game } from './sim.ts'
import { itemDef, type ItemId, type PlacedItem, type ZoneId } from './terminal.ts'

const ZONES: (ZoneId | null)[][] = [
  ['checkin', 'checkin', 'checkin', 'toilets'],
  ['retail', 'retail', 'retail', 'retail'],
  ['gates', 'gates', 'gates', 'gates'],
]

let seq = 0
function placed(def: ItemId, c: number, r: number, extra: Partial<PlacedItem> = {}): PlacedItem {
  seq += 1
  return { id: `${def}-${seq}`, def, c, r, wear: 0, ...extra }
}

const fixed = () => 0.5

function janitorAt(c: number, r: number): HallJanitor {
  return { id: 'j1', hallId: 'h', x: c + 0.5, z: r + 0.5, task: null, work: 0 }
}

describe('litter and trash cans', () => {
  it('a can in range takes the rubbish; out of range or full, it hits the floor', () => {
    const can = placed('trash_can', 0, 1)
    const hall: LitterHall = { zones: ZONES, items: [can], litter: [] }
    expect(dropLitter(hall, 2, 1, 'a', fixed)).toBe('bin')
    expect(can.fill).toBe(1)
    expect(hall.litter).toHaveLength(0)

    // Three cells away is out of range.
    expect(LITTER_TUNING.binRadius).toBeLessThan(3)
    const far: LitterHall = { zones: [['retail', 'retail', 'retail', 'retail']], items: [placed('trash_can', 0, 0)] }
    expect(dropLitter(far, 3, 0, 'b', fixed)).toBe('floor')
    expect(far.litter).toHaveLength(1)

    can.fill = LITTER_TUNING.binCap
    expect(binFull(can)).toBe(true)
    expect(binInRange(hall.items!, 1, 1)).toBeNull()
    expect(dropLitter(hall, 1, 1, 'c', fixed)).toBe('floor')
    expect(can.fill).toBe(LITTER_TUNING.binCap)
    expect(litterInZone(hall, 'retail')).toBe(1)
    expect(litterInZone(hall, 'gates')).toBe(0)
  })

  it('trash can is a paid kit item with upkeep', () => {
    const def = itemDef('trash_can')!
    expect(def.cost).toBeGreaterThan(0)
    expect(def.upkeep).toBeGreaterThan(0)
    expect(def.category).toBe('service')
  })

  it('litter and filthy restrooms cost happiness, capped', () => {
    expect(litterJoyDrain(0)).toBe(0)
    expect(litterJoyDrain(2)).toBeCloseTo(2 * LITTER_TUNING.joyPerPiecePerSec)
    expect(litterJoyDrain(10_000)).toBe(LITTER_TUNING.joyDrainCapPerSec)
    expect(restroomJoyHit(LITTER_TUNING.restroomDirtyAt)).toBe(0)
    expect(restroomJoyHit(100)).toBeCloseTo(LITTER_TUNING.restroomJoyHit)
  })
})

describe('janitors', () => {
  it('empty full cans first, then a dirty WC, then sweep the nearest litter', () => {
    const can = placed('trash_can', 3, 2, { fill: LITTER_TUNING.binCap })
    const hall: LitterHall = {
      zones: ZONES,
      items: [can],
      litter: [{ id: 'l1', c: 0, r: 1, ox: 0, oz: 0 }, { id: 'l2', c: 3, r: 1, ox: 0, oz: 0 }],
      restroomDirt: 80,
    }
    const j = janitorAt(0, 1)
    expect(nextJanitorTask(j, hall, new Set())).toMatchObject({ kind: 'bin', id: can.id })
    expect(nextJanitorTask(j, hall, new Set([can.id]))).toMatchObject({ kind: 'wc', c: 3, r: 0 })
    expect(nextJanitorTask(j, hall, new Set([can.id, 'wc']))).toMatchObject({ kind: 'litter', id: 'l1' })
  })

  it('walk to the job at walking pace, work it, and finish it', () => {
    const hall: LitterHall = { zones: ZONES, items: [], litter: [{ id: 'l1', c: 3, r: 2, ox: 0, oz: 0 }] }
    const j = janitorAt(0, 2)
    const cell = 6
    // Three cells at 6 m is 18 m; at walking pace that takes a while.
    const walkSec = (3 * cell) / LITTER_TUNING.janitorSpeedMps
    let t = 0
    while (hall.litter!.length && t < 120) {
      stepJanitor(j, hall, 0.25, cell, new Set())
      t += 0.25
    }
    expect(hall.litter).toHaveLength(0)
    expect(t).toBeGreaterThanOrEqual(walkSec)
    expect(t).toBeLessThan(walkSec + LITTER_TUNING.sweepSec + 1)

    const can = placed('trash_can', 3, 2, { fill: LITTER_TUNING.binCap })
    hall.items = [can]
    hall.restroomDirt = 90
    for (let i = 0; i < 400; i++) stepJanitor(j, hall, 0.25, cell, new Set())
    expect(can.fill).toBe(0)
    expect(hall.restroomDirt).toBeLessThan(LITTER_TUNING.restroomServiceAt)
  })

  it('two janitors split the work instead of chasing the same piece', () => {
    const hall: LitterHall = {
      zones: ZONES,
      items: [],
      litter: [{ id: 'a', c: 0, r: 1, ox: 0, oz: 0 }, { id: 'b', c: 1, r: 1, ox: 0, oz: 0 }],
    }
    const a = janitorAt(0, 1)
    const b = { ...janitorAt(0, 1), id: 'j2' }
    const claimed = new Set<string>()
    stepJanitor(a, hall, 0.1, 6, claimed)
    stepJanitor(b, hall, 0.1, 6, claimed)
    expect(a.task?.id).not.toBe(b.task?.id)
  })
})

describe('advisor hints', () => {
  it('flags food with no can nearby, floor litter, full cans, and dirty restrooms', () => {
    const hall: LitterHall = { zones: ZONES, items: [placed('fast_food', 0, 1)], litter: [] }
    expect(litterAdvice(hall, 1, 1).map((a) => a.title)).toContain('No trash cans near food court')
    hall.items!.push(placed('trash_can', 1, 1))
    expect(litterAdvice(hall, 1, 1).map((a) => a.id)).not.toContain('litter-no-bins')

    hall.restroomDirt = 90
    expect(litterAdvice(hall, 0, 1).map((a) => a.title)).toContain('Restrooms dirty: hire janitors')
    expect(litterAdvice(hall, 2, 1).map((a) => a.title)).toContain('Restrooms dirty')

    hall.items![1].fill = LITTER_TUNING.binCap
    hall.litter = Array.from({ length: LITTER_TUNING.adviseLitterAt }, (_, i) => ({
      id: `x${i}`,
      c: 0,
      r: 1,
      ox: 0,
      oz: 0,
    }))
    const ids = litterAdvice(hall, 0, 1).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['litter-floor', 'litter-bins-full', 'restroom-dirty']))
  })
})

/** Fresh custom hall with a food court row. */
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
  game.paintHallCell(7, 0, 'toilets')
  return { game, fit }
}

function hungry(game: Game, id: string): HallGuest {
  const g = spawnHallGuest(id, 'depart', 'budget')
  g.node = 'food'
  g.path = []
  g.seg = 0
  g.clearedSec = true
  g.hallId = game.hallKey(game.activeHall()!)
  g.needs.hunger = 95
  g.wallet = 200
  g.prefs.food = 1
  return g
}

describe('litter in the live sim', () => {
  it('meals drop litter by the counter; a can nearby catches it instead', () => {
    const { game, fit } = scratchHall()
    expect(game.placeHallItemAt('fast_food', 0, 3)).toBe(true)
    game.foodShelf = 10
    const open = game.hallOpen()
    game.serveNode(hungry(game, 'e1'), open)
    expect(fit.litter).toHaveLength(1)
    expect(fit.litter![0]).toMatchObject({ c: 0, r: 3 })

    expect(game.placeHallItemAt('trash_can', 1, 3)).toBe(true)
    game.serveNode(hungry(game, 'e2'), open)
    expect(fit.litter).toHaveLength(1)
    expect(fit.items!.find((i) => i.def === 'trash_can')!.fill).toBe(1)
  })

  it('litter in the zone drags happiness; restroom visits dirty the WC', () => {
    const { game, fit } = scratchHall()
    const g = hungry(game, 'sad')
    g.happiness = 50
    fit.litter = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, c: i, r: 3, ox: 0, oz: 0 }))
    game.applyHallKit(g, 10, new Map())
    expect(g.happiness).toBeCloseTo(50 - 10 * litterJoyDrain(5))

    expect(game.placeHallItemAt('toilet', 7, 0)).toBe(true)
    const open = game.hallOpen()
    const wc = spawnHallGuest('wc', 'depart', 'budget')
    wc.node = 'bathroom'
    wc.hallId = game.hallKey(fit)
    wc.needs.bladder = 90
    game.serveNode(wc, open)
    expect(fit.restroomDirt).toBeGreaterThan(0)
  })

  it('hired janitors appear in the hall, sweep litter, and are on the cleaning payroll', () => {
    const { game, fit } = scratchHall()
    const payroll = game.payrollPreview()
    fit.litter = [{ id: 'p1', c: 2, r: 3, ox: 0, oz: 0 }]
    game.tickHallJanitors(1)
    expect(game.hallJanitors).toHaveLength(0)
    expect(fit.litter).toHaveLength(1)
    expect(game.advice.map((a) => a.id)).not.toContain('litter-floor')

    game.hireJanitor()
    expect(game.janitors).toBe(1)
    expect(game.payrollPreview()).toBeGreaterThan(payroll)
    for (let t = 0; t < 600 && fit.litter.length; t++) game.tickHallJanitors(0.25)
    expect(game.hallJanitors).toHaveLength(1)
    expect(fit.litter).toHaveLength(0)
  })
})

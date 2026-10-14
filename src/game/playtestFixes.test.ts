import { beforeEach, describe, expect, it } from 'vitest'
import { cateringTurnFee, DEFAULT_FEE_SCHEDULE } from '../commercial/fees.ts'
import { NEUTRAL_CONTEXT, NEGOTIATION } from '../negotiation/data.ts'
import { createNegotiation } from '../negotiation/engine.ts'
import { negotiatedBagTurnFee } from '../negotiation/valuation.ts'
import { loanProductLabel, payrollPreviewLabel, sandboxChoiceLabel } from './economy.ts'
import {
  CONTRACT_FLEET,
  LAND,
  FIELD_TASK_DEFS,
  LOAN_PRODUCTS,
  money,
  POLICE_COST,
  RESEARCH_NODES,
  RP_RATE_OPS,
  RUNWAY_PREFAB_COST,
  START_CASH,
  STARTER_KIT_COST,
} from './catalog.ts'
import { itemDef, itemsForZone, schemeItems, schemeZones } from './terminal.ts'
import { placementCheck } from './terminalKit.ts'
import { contractedAirframes } from './airframes.ts'
import { Game } from './sim.ts'
import type { FieldTask } from './types.ts'

function fresh(difficulty: 'easy' | 'standard' = 'standard'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew(difficulty)
  game.buyLand('city')
  return game
}

beforeEach(() => {
  localStorage.clear()
})

describe('field and info letters', () => {
  it('clears a field ask on Got it, and does not show that same letter again', () => {
    const game = fresh()
    const task: FieldTask = {
      id: 'ask-1',
      airline: 'northline',
      kind: 'bathroom',
      title: 'Restrooms',
      blurb: 'Add a restroom',
      bonus: 1000,
      deadline: game.clock + 80,
      age: 0,
    }
    game.fieldTask = task
    expect(game.letterAcked('field:ask-1')).toBe(false)
    game.ackLetter('field:ask-1')
    expect(game.letterAcked('field:ask-1')).toBe(true)
    expect(game.fieldTask).toBeNull()
    expect(game.fieldTaskCool).toBeGreaterThan(0)
    expect(game.letterAcked('field:ask-2')).toBe(false)
  })
})

describe('Accept on a prospect letter', () => {
  it('signs Zoomjet when the field can host them', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.presentNegotiation('zoomjet')
    expect(game.offer?.airline).toBe('zoomjet')
    game.acceptNegotiation()
    expect(game.signed).toContain('zoomjet')
    expect(game.offer).toBeNull()
  })

  it('names the missing requirement and leaves the letter up', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.presentNegotiation('harbor')
    game.acceptNegotiation()
    expect(game.signed).not.toContain('harbor')
    expect(game.offer?.airline).toBe('harbor')
    expect(game.news[0]?.text ?? '').toMatch(/will not sign yet/i)
    expect(game.news[0]?.text ?? '').toMatch(/still need/i)
  })

  it('says so when no letter is open', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.offer = null
    game.acceptNegotiation()
    expect(game.news[0]?.text ?? '').toMatch(/no contract letter/i)
  })
})

describe('starter kit on a fresh plot', () => {
  it('will not let a runway spend the kit budget', () => {
    const game = fresh('standard')
    const left = START_CASH.standard - LAND.city.cost
    expect(game.cash).toBe(left)
    expect(left - RUNWAY_PREFAB_COST).toBeLessThan(STARTER_KIT_COST)
    expect(game.spend(RUNWAY_PREFAB_COST, 'runway')).toBe(false)
    expect(game.cash).toBe(left)
    expect(game.news[0]?.text ?? '').toMatch(/starter kit/i)

    game.placeRunway({ c: 2, r: 20 })
    expect(game.cash).toBe(left)
    expect(game.sites.some((s) => s.kind === 'runway')).toBe(false)
  })

  it('still stamps the kit when a stray runway is already on the grass', () => {
    const game = fresh('easy')
    for (let c = 0; c < 8; c++) game.tiles[12][c] = 'runway'
    expect(game.starterFieldUp()).toBe(false)
    game.buildStarterKit()
    expect(game.fits.length).toBe(1)
    expect(game.starterFieldUp()).toBe(true)
  })

  it('releases the budget when the player builds freehand', () => {
    const game = fresh('standard')
    game.chooseFreehand()
    expect(game.starterFreehand).toBe(true)
    expect(game.starterKitProtected()).toBe(false)
    const before = game.cash
    expect(game.spend(1_000, 'taxi')).toBe(true)
    expect(game.cash).toBe(before - 1_000)
  })
})

describe('contracted metal', () => {
  it('sends Bushline a Twin Otter or Islander, not a 737', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    const band = contractedAirframes(CONTRACT_FLEET.bushline, 9, 19).map((af) => af.id)
    expect(band).toEqual(['bn2', 'dhc6'])
    game.signed = ['bushline']
    game.scheduleAuto = false
    game.clock = 30
    game.seedScheduleForAirline('bushline', 1)
    const seen = new Set<string>()
    for (let i = 0; i < 8; i++) {
      game.flights = []
      for (const slot of game.schedule) {
        if (slot.airline === 'bushline') {
          slot.status = 'scheduled'
          slot.eta = game.clock - 1
          slot.flightId = null
        }
      }
      game.spawnCool = 0
      game.trySpawn()
      const live = game.flights.find((f) => f.airline === 'bushline')
      expect(live).toBeTruthy()
      seen.add(live!.airframeId)
      expect(live!.pax).toBeGreaterThanOrEqual(6)
      expect(live!.pax).toBeLessThanOrEqual(19)
      expect(live!.airframeName).toMatch(/Twin Otter|Islander/)
    }
    expect([...seen].every((id) => id === 'bn2' || id === 'dhc6')).toBe(true)
    expect(seen.has('b738')).toBe(false)
    expect(seen.has('a321')).toBe(false)
  })
})

describe('money the player can read', () => {
  it('labels payroll as a daily charge', () => {
    const game = fresh()
    const line = payrollPreviewLabel(game.payrollPreview(), money)
    expect(line).toMatch(/\/ day$/)
    expect(line).not.toMatch(/30s/)
    expect(game.payrollPreview()).toBeGreaterThan(0)
  })

  it('bills SkyBite on a commuter that posts no galley fee', () => {
    const bill = cateringTurnFee(0, 1, 12, DEFAULT_FEE_SCHEDULE.cateringPerCart)
    expect(bill).toBeGreaterThan(0)
    expect(bill).toBeLessThan(DEFAULT_FEE_SCHEDULE.cateringPerCart)
    const full = cateringTurnFee(1600, 1, 12, DEFAULT_FEE_SCHEDULE.cateringPerCart)
    expect(full).toBe(1600)
  })

  it('turns Zoomjet’s per-passenger bag rate into a turn fee', () => {
    const game = fresh('easy')
    const bags = game.airline('zoomjet').bags
    const expected = negotiatedBagTurnFee(1.1, 180, NEGOTIATION.economics.loadFactor)
    expect(bags).toBe(expected)
    expect(bags).toBeGreaterThan(50)
  })
})

describe('title cash and a second stamp', () => {
  it('starts sandbox off on the standard bank', () => {
    const game = new Game()
    expect(game.sandbox).toBe(false)
    game.beginNew('standard')
    expect(game.cash).toBe(150_000)
    expect(sandboxChoiceLabel(false)).toMatch(/standard/)
    expect(sandboxChoiceLabel(false)).toContain(money(START_CASH.standard))
    expect(sandboxChoiceLabel(true)).not.toMatch(/standard/)
  })

  it('hides the starter kit once it is stamped', () => {
    const game = fresh()
    expect(game.showStarterKit()).toBe(true)
    game.buildStarterKit()
    expect(game.starterKitStamped).toBe(true)
    expect(game.showStarterKit()).toBe(false)
  })

  it('refuses a second stamp of the same tool while the contractor is driving in', () => {
    const game = fresh('easy')
    game.chooseFreehand()
    const before = game.cash
    game.placeRunway({ c: 1, r: 10 })
    expect(game.sites.filter((s) => s.kind === 'runway')).toHaveLength(1)
    const mid = game.cash
    expect(mid).toBe(before - RUNWAY_PREFAB_COST)
    game.placeRunway({ c: 1, r: 20 })
    expect(game.cash).toBe(mid)
    expect(game.sites.filter((s) => s.kind === 'runway')).toHaveLength(1)
    expect(game.news[0]?.text ?? '').toMatch(/contractor is driving in/i)

    game.buildStarterKit()
    game.setTool('police')
    const cell = openGrass(game)
    const policeBefore = game.cash
    game.placeSingle(cell)
    expect(game.sites.filter((s) => s.tool === 'police')).toHaveLength(1)
    const policeMid = game.cash
    expect(policeMid).toBe(policeBefore - POLICE_COST)
    game.placeSingle(openGrass(game))
    expect(game.cash).toBe(policeMid)
    expect(game.sites.filter((s) => s.tool === 'police')).toHaveLength(1)
  })

  it('prints the loan fee on the product and owes principal plus fee', () => {
    const micro = LOAN_PRODUCTS.find((p) => p.id === 'micro')!
    expect(micro.principal + micro.fee).toBe(26_400)
    const label = loanProductLabel(micro)
    expect(label).toContain(money(micro.fee))
    expect(label).toContain(money(micro.principal + micro.fee))
    const game = fresh('easy')
    game.buildStarterKit()
    game.takeLoanProduct('micro')
    expect(game.loanBalance).toBe(micro.principal + micro.fee)
  })
})

describe('negotiation term and a hall shop', () => {
  it('changes the daily quote when the term changes', () => {
    const desk = createNegotiation(4)
    desk.open('northline', NEUTRAL_CONTEXT)
    const margins = NEGOTIATION.terms.map((months) => {
      desk.setTerm(months)
      return desk.panel()?.margin ?? 0
    })
    expect(margins[0]).toBeGreaterThan(margins[1])
    expect(margins[1]).toBeGreaterThan(margins[2])
  })

  it('lists a shop for Shops / Food and places it on an empty retail cell', () => {
    const ids = itemsForZone('retail').map((item) => item.id)
    expect(ids).toContain('cafe')
    expect(ids).toContain('fast_food')
    const food = itemDef('fast_food')!
    const check = placementCheck(schemeZones(1), schemeItems(1), food, 3, 4, {
      fieldLevel: 1,
      cash: 50_000,
    })
    expect(check.ok).toBe(true)
    const game = fresh('easy')
    game.buildStarterKit()
    expect(game.placeHallItemAt('fast_food', 3, 4, 0)).toBe(true)
    expect(game.activeHall()?.items?.some((it) => it.def === 'fast_food')).toBe(true)
    const standard = fresh()
    standard.buildStarterKit()
    const cafe = itemDef('cafe')!
    expect(cafe.cost).toBeLessThan(food.cost)
    expect(food.cost).toBeLessThanOrEqual(6_000)
    expect(standard.cash).toBeGreaterThanOrEqual(food.cost)
    expect(standard.placeHallItemAt('fast_food', 3, 4, 0)).toBe(true)
    const other = fresh()
    other.buildStarterKit()
    expect(other.placeHallItemAt('cafe', 3, 4, 0)).toBe(true)
  })
})

describe('field ask build', () => {
  it('shows police cost against the bonus and will not stamp a second post', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.fieldTask = {
      id: 'ask-police',
      airline: 'northline',
      kind: 'police',
      title: 'Police post',
      blurb: 'Stamp police on the field',
      bonus: 5200,
      deadline: game.clock + 80,
      age: 0,
    }
    const ask = game.fieldAskOffer()
    expect(ask?.cost).toBe(POLICE_COST)
    expect(ask?.text).toBe('Build · $11,000 cost / $5,200 bonus')
    expect(ask?.enabled).toBe(true)
    game.cash = 500
    expect(game.fieldAskOffer()?.enabled).toBe(false)
    game.cash = 80_000
    game.buildFieldTask()
    expect(game.sites.filter((s) => s.tool === 'police')).toHaveLength(1)
    const cash = game.cash
    expect(game.fieldAskOffer()?.enabled).toBe(false)
    game.buildFieldTask()
    expect(game.cash).toBe(cash)
    expect(game.sites.filter((s) => s.tool === 'police')).toHaveLength(1)
  })

  it('pays a police bonus that covers the post', () => {
    const def = FIELD_TASK_DEFS.find((d) => d.kind === 'police')!
    expect(def.bonus).toBe(12_500)
    expect(def.bonus).toBeGreaterThan(POLICE_COST)
  })
})

function openGrass(game: Game): { c: number; r: number } {
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) {
      if (game.tile({ c, r }) === 'grass' && !game.siteAt({ c, r })) return { c, r }
    }
  }
  throw new Error('no grass')
}

describe('operations research trickle', () => {
  it('banks Night bank from the field before a researcher is hired', () => {
    const game = fresh('easy')
    expect(game.researchRate()).toBe(0)
    game.buildStarterKit()
    expect(game.researchers).toBe(0)
    expect(game.opsResearchRate()).toBe(RP_RATE_OPS)
    expect(game.researchRate()).toBe(RP_RATE_OPS)
    const night = RESEARCH_NODES.find((n) => n.id === 'night_bank')
    expect(night?.cost).toBe(28)
    expect(RP_RATE_OPS * 600).toBeGreaterThanOrEqual(night!.cost)
    game.speed = 1
    const before = game.researchPoints
    game.tick(20)
    expect(game.researchPoints).toBeGreaterThan(before)
    expect(game.researchers).toBe(0)
  })
})

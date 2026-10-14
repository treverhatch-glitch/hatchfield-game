import { describe, expect, it } from 'vitest'
import { EMERGENCY_REFUSE_FINE } from './catalog.ts'
import { CLEARANCE_LICENCE_COST } from '../inbound/data.ts'
import { levelReward } from '../research/config.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.emergencyCool = 1e9
  game.offerCool = 1e9
  game.parkingCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  return game
}

const SERVED = new Set([
  'deboard',
  'servicing',
  'parked',
  'board',
  'pushback',
  'taxi_out',
  'takeoff',
  'gone',
])

describe('inbound on the live field', () => {
  it('lands an accepted arrival, posts the fee and the refuse fine, and lists Guard contracts', () => {
    const game = field()
    const offer = game.injectInbound('fuel_low')
    expect(offer?.title).toBe('Fuel-low divert')
    expect(offer?.priority).toBe(true)
    expect(game.inboundOffer()?.id).toBe(offer?.id)

    const cash = game.cash
    const revenue = game.revenue
    expect(game.acceptInbound(offer!.id)).toBe(true)
    const flight = game.flights.find((item) => item.inboundVisitId)
    expect(flight?.phase).toBe('approach')
    expect(flight?.posted.landing).toBe(true)
    expect(game.revenue).toBe(revenue + (offer?.reward ?? 0))
    expect(game.cash).toBe(cash + (offer?.reward ?? 0))
    expect(game.inboundOffer()).toBeNull()

    const refused = game.injectInbound('weather_divert')
    expect(refused?.fine).toBe(EMERGENCY_REFUSE_FINE)
    const afterFee = game.cash
    expect(game.refuseInbound(refused!.id)).toBe(true)
    expect(game.cash).toBe(afterFee - EMERGENCY_REFUSE_FINE)

    const booked = game.cash
    game.milAgreement = true
    game.speed = 1
    game.tick(0.2)
    expect(game.cash).toBe(booked)
    const deals = game.inboundContracts()
    expect(deals.some((deal) => deal.status === 'offered')).toBe(true)
    const offered = deals.find((deal) => deal.status === 'offered')
    expect(offered).toBeTruthy()
    expect(game.signInboundContract(offered!.id)).toBe(true)
    expect(game.inboundContracts().find((deal) => deal.id === offered!.id)?.status).toBe('active')
    expect(game.cash).toBe(booked)

    expect(game.buyInboundClearance()).toBe(true)
    expect(game.cash).toBe(booked - CLEARANCE_LICENCE_COST)
    expect(game.inboundHasClearance()).toBe(true)
    expect(game.buyInboundClearance()).toBe(false)
    expect(game.cash).toBe(booked - CLEARANCE_LICENCE_COST)

    game.speed = 5
    let ticks = 0
    while (ticks < 4000) {
      const live = game.flights.find((item) => item.inboundVisitId === flight?.inboundVisitId)
      if (live && SERVED.has(live.phase)) break
      game.tick(0.05)
      ticks += 1
    }
    const served = game.flights.find((item) => item.id === flight?.id)
    expect(served && SERVED.has(served.phase)).toBe(true)
    expect(served?.ledger.some((row) => /landing/i.test(row.label))).toBe(false)
  })

  it('refuses security clearance when the desk cannot pay, and does not mark it owned', () => {
    const game = field()
    game.cash = CLEARANCE_LICENCE_COST - 1
    expect(game.buyInboundClearance()).toBe(false)
    expect(game.inboundHasClearance()).toBe(false)
    expect(game.cash).toBe(CLEARANCE_LICENCE_COST - 1)
    game.cash = CLEARANCE_LICENCE_COST
    expect(game.buyInboundClearance()).toBe(true)
    expect(game.inboundHasClearance()).toBe(true)
    expect(game.buyInboundClearance()).toBe(false)
    expect(game.cash).toBe(0)
  })

  it('posts the level reward and the news when inbound XP crosses a level', () => {
    const game = field()
    game.fieldXp = 89
    const offer = game.injectInbound('fuel_low')
    expect(offer?.priority).toBe(true)
    const cash = game.cash
    const revenue = game.revenue
    const points = game.researchTree.points()
    expect(game.acceptInbound(offer!.id)).toBe(true)
    expect(game.fieldLevel()).toBe(2)
    expect(game.bank.ledger().byCategory.level_reward).toBe(levelReward(2).cash)
    expect(game.cash).toBe(cash + (offer?.reward ?? 0) + levelReward(2).cash)
    expect(game.revenue).toBe(revenue + (offer?.reward ?? 0))
    expect(game.cash).toBeCloseTo(game.bank.balance, 5)
    expect(game.researchTree.points()).toBe(points + levelReward(2).rp)
    expect(game.news.some((item) => /Field Level 2/.test(item.text))).toBe(true)
    game.grantFieldXp(1)
    expect(game.bank.ledger().byCategory.level_reward).toBe(levelReward(2).cash)
    expect(game.cash).toBe(cash + (offer?.reward ?? 0) + levelReward(2).cash)
  })
})

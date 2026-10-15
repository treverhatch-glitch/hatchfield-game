import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { PIPELINE } from '../fuel/pipeline.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.cash += 400_000
  game.fieldXp = 700
  game.researchUnlocked.push('pipeline_fuel', 'hydrant_fuel', 'rail_fuel', 'heavy_pack', 'widebody_ops')
  game.contractId = 'mega_jumbo'
  game.fuelBrand = 'kiln'
  game.tankTier = 3
  game.tankLitres = 10_000
  return game
}

function paintPipe(game: Game) {
  game.tiles[5][6] = 'manifold'
  game.tiles[5][5] = 'fuel'
  for (let r = 6; r < 32; r++) game.tiles[r][6] = 'fuel_pipe'
}

describe('pipeline fuel', () => {
  it('flows only while the pipe reaches the edge and the manifold is open', () => {
    const game = field()
    game.fuelSupply = 'pipeline'
    game.pipelineCoolMinutes = 10_000
    const dry = game.tankLitres
    game.tick(2)
    expect(game.tankLitres).toBe(dry)
    paintPipe(game)
    game.tick(2)
    expect(game.tankLitres).toBeGreaterThan(dry + 1_000)
    expect(game.termUnitPrice('mega_jumbo')).toBeCloseTo(0.012 + PIPELINE.differential, 3)
    expect(game.news.some((n) => n.text.includes('Pipeline is flowing'))).toBe(true)
  })

  it('holds the batch, then lets one spot truck land while the term stays signed', () => {
    const game = field()
    paintPipe(game)
    game.fuelSupply = 'pipeline'
    game.pipelineCoolMinutes = 0
    const stock = game.tankLitres
    game.tick(2)
    expect(game.pipelineHoldMinutes).toBeGreaterThan(0)
    expect(game.tankLitres).toBe(stock)
    expect(game.news.some((n) => n.text.includes('Pipeline batch held'))).toBe(true)
    expect(game.termUnitPrice('mega_jumbo')).toBeCloseTo(0.012, 3)
    game.orderPipelineSpot()
    expect(game.contractId).toBe('mega_jumbo')
    expect(game.spotInbound?.outage).toBe(true)
    game.spotInbound!.minutesLeft = 1
    game.cash += 5_000
    game.tick(2)
    expect(game.tankLitres).toBeGreaterThan(stock)
    expect(game.spotInbound).toBeNull()
  })

  it('retires the listed Jet-A cash spike', () => {
    const game = new Game()
    game.beginNew('easy')
    game.public = true
    game.analystCool = 0
    game.fuelLoads = 1
    game.fuelBrand = 'apex'
    game.reputation = 80
    game.cash = 100_000
    const cash = game.cash
    const random = Math.random
    Math.random = () => 0
    try {
      game.tickAnalyst(0)
    } finally {
      Math.random = random
    }
    expect(game.news.some((n) => n.text.includes('Jet-A'))).toBe(false)
    expect(game.cash).toBe(cash)
    expect(game.news.some((n) => n.text.includes('Short seller'))).toBe(true)
  })
})

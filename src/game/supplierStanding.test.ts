import { describe, expect, it } from 'vitest'
import { SPOT_OFFER, termBandLitres } from '../fuel/offerData.ts'
import { SUPPLIER_STANDING } from '../fuel/standing.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.schedule = []
  game.flights = []
  game.spawnCool = 10_000
  game.offerCool = 10_000
  game.cash = 200_000
  return game
}

describe('supplier standing', () => {
  it('drops standing when a term is broken and prices the next term from that meter', () => {
    const game = field()
    game.signScaleContract('apex_local')
    game.dropFuelTerm()
    expect(game.supplierStanding.apex_local).toBe(SUPPLIER_STANDING.brokeTerm)
    expect(game.termUnitPrice('apex_local')).toBeCloseTo(0.022, 5)
    expect(game.contractId).toBeNull()
  })

  it('raises standing for a filled band and keeps the index off the term price', () => {
    const game = field()
    game.signScaleContract('apex_local')
    game.termUpliftLitres = termBandLitres('apex_local')
    game.fuelIndex = 0.1
    game.clock = 179
    game.tick(2)
    expect(game.supplierStanding.apex_local).toBe(SUPPLIER_STANDING.tookBand)
    expect(game.termUnitPrice('apex_local')).toBeCloseTo(0.019, 5)
    expect(game.fuelIndex).toBeCloseTo(-0.1, 5)
    expect(game.bank.ledger().entries.some((entry) => entry.meta.label === 'Term shortfall')).toBe(false)
  })

  it('freezes the swung spot price and lets the highest standing call', () => {
    const game = field()
    game.supplierStanding.kiln_regional = 40
    game.fuelIndex = 0.1
    game.tankLitres = 0
    game.fuelLoads = 0
    game.tick(0.1)
    expect(game.spotOffer?.supplierId).toBe('kiln_regional')
    expect(game.spotOffer?.supplier).toMatch(/Kiln/)
    expect(game.spotOffer?.perLitre).toBeCloseTo(0.031, 5)
    game.fuelIndex = -0.1
    expect(game.spotOffer?.perLitre).toBeCloseTo(0.031, 5)
    game.declineSpot()
    expect(game.supplierStanding.kiln_regional).toBe(40 + SUPPLIER_STANDING.ignoredShortage)
    expect(game.tankLitres).toBe(0)
  })

  it('keeps a zero meter on the Apex rack price', () => {
    const game = field()
    game.tankLitres = 0
    game.fuelLoads = 0
    game.tick(0.1)
    expect(game.spotOffer?.supplier).toBe(SPOT_OFFER.supplier)
    expect(game.spotOffer?.perLitre).toBeCloseTo(SPOT_OFFER.perLitre, 5)
  })
})

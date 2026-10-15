import { describe, expect, it } from 'vitest'
import { SPOT_OFFER, termBandLitres } from '../fuel/offerData.ts'
import { dispatchPhoneAction, phoneHost } from '../phone/commands.ts'
import { readPhoneCards } from '../phone/readGame.ts'
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
  return game
}

function labelled(game: Game, label: string) {
  return game.bank.ledger().entries.filter((entry) => entry.meta.label === label)
}

describe('spot tankers and term bands', () => {
  it('delivers an accepted spot tanker into tankLitres only', () => {
    const game = field()
    game.cash = 50_000
    game.tankLitres = 0
    game.fuelLoads = 0
    game.tick(0.1)
    const cards = readPhoneCards(game)
    expect(cards.some((card) => card.id === 'fuel-spot' && card.kind === 'fuel-spot')).toBe(true)
    expect(cards.find((card) => card.id === 'fuel-spot')?.tab).toBe('messages')

    dispatchPhoneAction(phoneHost(game), { type: 'accept-fuel-spot' })
    expect(game.tankLitres).toBe(0)
    expect(game.spotInbound?.litres).toBe(SPOT_OFFER.tankerLitres)
    const rolling = game.fuelView()
    expect(rolling.queue.some((row) => row.id === 'spot-tanker' && row.state === 'road')).toBe(true)
    expect(rolling.litres).toBe(game.tankLitres)

    game.tick(11)
    expect(game.tankLitres).toBe(0)
    game.tick(2)
    expect(game.tankLitres).toBe(SPOT_OFFER.tankerLitres)
    expect(game.fuelView().litres).toBe(game.tankLitres)
    expect(game.spotInbound).toBeNull()
    const bill = labelled(game, 'Spot tanker')
    expect(bill).toHaveLength(1)
    expect(bill[0]?.amount).toBeCloseTo(-(SPOT_OFFER.tankerLitres * SPOT_OFFER.perLitre), 5)
    const snap = game.groundSnapshot()
    if (snap) expect(snap.fuelLitres).toBe(game.tankLitres)
  })

  it('does not add litres when the spot card is declined', () => {
    const game = field()
    game.cash = 50_000
    game.tankLitres = 0
    game.fuelLoads = 0
    game.tick(0.1)
    expect(game.spotOffer?.flightNo).toBe('the next departure')
    dispatchPhoneAction(phoneHost(game), { type: 'decline-fuel-spot' })
    game.tick(12)
    expect(game.tankLitres).toBe(0)
    expect(labelled(game, 'Spot tanker')).toHaveLength(0)
    expect(game.news.some((n) => n.text.includes('stays grounded'))).toBe(true)
  })

  it('bills the untaken band at midnight and names the supplier', () => {
    const game = field()
    game.cash = 80_000
    game.signScaleContract('apex_local')
    expect(game.fuelBrand).toBe('apex')
    game.termUpliftLitres = 0
    game.clock = 179
    game.tick(2)
    const band = termBandLitres('apex_local')
    const expected = band * 0.02 * SPOT_OFFER.shortfallFraction
    const line = labelled(game, 'Term shortfall')
    expect(line).toHaveLength(1)
    expect(line[0]?.amount).toBeCloseTo(-expected, 5)
    expect(game.news.some((n) => n.text.includes('Term shortfall — Apex Local') && n.text.includes('drop back to spot'))).toBe(true)
    expect(game.termUpliftLitres).toBe(0)
  })

  it('sets the wing brand for Trunk and Mega and can drop back to spot', () => {
    const game = field()
    game.cash = 200_000
    game.fieldXp = 700
    game.researchUnlocked.push('hydrant_fuel', 'widebody_ops', 'heavy_pack')
    const tank = game.tankLitres
    game.signScaleContract('trunk_wide')
    expect(game.contractId).toBe('trunk_wide')
    expect(game.fuelBrand).toBe('kiln')
    const signed = readPhoneCards(game).find((card) => card.kind === 'fuel-signed')
    expect(signed?.tab).toBe('contracts')
    expect(signed?.title).toContain('Trunk Widebody')
    game.signScaleContract('mega_jumbo')
    expect(game.fuelBrand).toBe('kiln')
    game.dropFuelTerm()
    expect(game.contractId).toBeNull()
    expect(game.fuelBrand).toBe('kiln')
    expect(game.tankLitres).toBe(tank)
  })
})

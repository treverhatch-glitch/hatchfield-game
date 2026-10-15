import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { hostKey, jetBridgeCost } from '../stands/catalog.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  return game
}

function attachments(game: Game, c: number, r: number) {
  game.tool = 'pan'
  game.clickTile({ c, r })
  return game.buildingCard()?.sections?.find((section) => section.id === 'attachments')
}

describe('building card review fixes', () => {
  it('buys and removes a fitting from the card row the panel sends', () => {
    const game = field()
    const host = hostKey('stand', 11, 6)
    expect(game.fittings[host]).toBeUndefined()
    const buy = attachments(game, 11, 6)?.rows.find((row) => row.id === `fitbuy:${host}:jet_bridge`)
    expect(buy?.disabled).toBeFalsy()
    const cash = game.cash
    game.buildingCardAction(buy!.id)
    expect(game.cash).toBe(cash - jetBridgeCost('narrow'))
    expect(game.fittings[host]).toEqual([{ id: 'jet_bridge' }])
    const drop = attachments(game, 11, 6)?.rows.find((row) => row.id.startsWith('fitdrop:'))
    game.buildingCardAction(drop!.id)
    expect(game.fittings[host]).toBeUndefined()
  })

  it('books no negotiated deal when the check-in desks refuse the carrier', () => {
    const game = field()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toEqual(['northline'])
    ;(game as unknown as { missingReq(id: string): string[] }).missingReq = () => []
    // A second small carrier fits the starter. A widebody still does not.
    game.presentNegotiation('summit')
    expect(game.checkinSignReport('summit').ok).toBe(false)
    const cash = game.cash
    game.acceptNegotiation()
    game.acceptNegotiation()
    expect(game.signed).not.toContain('summit')
    expect(game.offer?.airline).toBe('summit')
    const desk = (game as unknown as { negotiationBridge?: { desk: { dealFor(id: string): unknown } } }).negotiationBridge
    expect(desk?.desk.dealFor('summit')).toBeUndefined()
    expect(game.cash).toBe(cash)
  })

  it('adds a bought kiosk on top of the hall kiosk', () => {
    const game = field()
    for (let i = 0; i < 200; i += 1) game.tick(0.5)
    const host = game as unknown as { checkinCapacityFor(id: string): { desks: number; kiosks: number } }
    const before = host.checkinCapacityFor('northline').kiosks
    expect(before).toBeGreaterThan(0)
    game.paxKiosks += 1
    expect(host.checkinCapacityFor('northline').kiosks).toBe(before + 1)
  })
})

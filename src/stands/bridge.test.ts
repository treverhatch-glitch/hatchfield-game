import { describe, expect, it } from 'vitest'
import { BULLDOZE_REFUND } from '../game/catalog.ts'
import { Game } from '../game/sim.ts'
import { hostKey, jetBridgeCost, jetBridgeUpkeep } from './catalog.ts'

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

function card(game: Game, c: number, r: number) {
  game.tool = 'pan'
  game.clickTile({ c, r })
  return game.buildingCard()?.sections?.find((section) => section.id === 'attachments')
}

describe('jet bridge attachment', () => {
  it('counts the starter bridge and refunds nothing when that grant is removed', () => {
    const game = field()
    const section = card(game, 11, 6)
    const buy = section?.rows.find((row) => row.id.startsWith('fitbuy:'))
    const drop = section?.rows.find((row) => row.id.startsWith('fitdrop:'))
    expect(buy?.label).toBe('This stand already has a bridge.')
    expect(buy?.disabled).toBe(true)
    expect(drop?.label).toBe('Remove jet bridge')
    const before = game.cash
    expect(game.standCardAction(drop!.id)).toBeUndefined()
    expect(game.cash).toBe(before)
    expect(game.standAccess['11,6']).toBe('remote')
    expect(game.standPaxMode({ c: 11, r: 6 })).not.toBe('jetway')
    expect(game.fittings[hostKey('stand', 11, 6)]).toBeUndefined()
    expect(game.standCardAction(`fitbuy:${hostKey('stand', 11, 6)}:jet_bridge`)).toBeUndefined()
    expect(game.cash).toBe(before - jetBridgeCost('narrow'))
    expect(game.standAccess['11,6']).toBe('jetway')
    expect(game.standPaxMode({ c: 11, r: 6 })).toBe('jetway')
    expect(game.fittings[hostKey('stand', 11, 6)]).toEqual([{ id: 'jet_bridge' }])
  })

  it('refuses a grass pad before it asks for a hall', () => {
    const game = field()
    game.tiles[2]![2] = 'stand'
    game.standClass['2,2'] = 'S'
    game.standSize['2,2'] = 'light'
    game.standRung['2,2'] = 0
    const buy = card(game, 2, 2)?.rows[0]
    expect(buy?.label).toBe('Pave this stand first.')
    expect(buy?.disabled).toBe(true)
    expect(game.buyFitting(hostKey('stand', 2, 2), 'jet_bridge')).toBe(false)
    expect(game.cash).toBe(200_000)
  })

  it('bills a bought bridge and refunds forty percent of that price', () => {
    const game = field()
    const host = hostKey('stand', 11, 6)
    game.removeFitting(host, 'jet_bridge')
    const billed = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    expect(game.buyFitting(host, 'jet_bridge')).toBe(true)
    const withBridge = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    expect(withBridge - billed).toBe(jetBridgeUpkeep('narrow'))
    const cash = game.cash
    game.removeFitting(host, 'jet_bridge')
    expect(game.cash - cash).toBe(Math.round(jetBridgeCost('narrow') * BULLDOZE_REFUND))
    expect(game.standAccess['11,6']).toBe('remote')
  })
})

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
  it('starts with a walk-out stand and sells a bridge on the card', () => {
    const game = field()
    const host = hostKey('stand', 11, 6)
    expect(game.fittings[host]).toBeUndefined()
    expect(game.standPaxMode({ c: 11, r: 6 })).toBe('walk')
    const section = card(game, 11, 6)
    const buy = section?.rows.find((row) => row.id.startsWith('fitbuy:'))
    expect(buy?.label).toBe('Jet bridge · bridge_cab · $5,000')
    expect(buy?.disabled).toBe(false)
    expect(section?.rows.some((row) => row.id.startsWith('fitdrop:'))).toBe(false)
    const before = game.cash
    expect(game.standCardAction(`fitbuy:${host}:jet_bridge`)).toBeUndefined()
    expect(game.cash).toBe(before - jetBridgeCost('narrow'))
    expect(game.standAccess['11,6']).toBe('jetway')
    expect(game.standPaxMode({ c: 11, r: 6 })).toBe('jetway')
    expect(game.fittings[host]).toEqual([{ id: 'jet_bridge' }])
    const drop = card(game, 11, 6)?.rows.find((row) => row.id.startsWith('fitdrop:'))
    expect(drop?.label).toBe('Remove jet bridge · bridge_cab')
  })

  it('boards a new game on the walk-out path', () => {
    const game = field()
    const stand = { c: 11, r: 6 }
    const flight = {
      id: 'walk-out',
      airline: 'northline',
      flightNo: 'NL1',
      airframeId: 'b738',
      airframeName: '737-800',
      pax: 48,
      cargo: false,
      craft: 'jet' as const,
      kind: 'narrowbody' as const,
      phase: 'board' as const,
      stand,
      x: stand.c,
      y: stand.r,
      z: 0,
      heading: 0,
      path: [stand],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {
        landing: false,
        bags: false,
        bagsLoad: false,
        fuel: false,
        catering: false,
        bagDrop: false,
        mx: false,
        deiced: false,
      },
      waitingOn: {
        bags: false,
        bagsLoad: false,
        fuel: false,
        catering: false,
        mx: false,
        deice: false,
        paxOut: 0,
        paxIn: 0,
      },
      phaseTime: 0,
      ledger: [],
    }
    game.flights.push(flight)
    const people = game.people.length
    game.beginBoarding(flight)
    expect(game.standPaxMode(stand)).toBe('walk')
    expect(flight.waitingOn.paxIn).toBeGreaterThan(0)
    expect(game.people.length).toBeGreaterThan(people)
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

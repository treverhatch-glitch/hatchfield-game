import { describe, expect, it } from 'vitest'
import { BULLDOZE_REFUND } from '../game/catalog.ts'
import { Game } from '../game/sim.ts'
import { dockedJetBridge, jetBridges, stands } from '../render/world/layout.ts'
import { cellX, cellZ } from '../render/world/view.ts'
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

  it('roots a bought bridge on the terminal and leaves a fresh stand bridgeless', () => {
    const game = field()
    const stand = { c: 11, r: 6 }
    expect(jetBridges(game, stands(game))).toHaveLength(0)
    expect(game.bridgeExtendAt(stand)).toBe(0)
    expect(game.buyFitting(hostKey('stand', 11, 6), 'jet_bridge')).toBe(true)
    const bridges = jetBridges(game, stands(game))
    expect(bridges).toHaveLength(1)
    const bridge = bridges[0]
    expect(bridge).toBeTruthy()
    const rootToTerm = Math.hypot(bridge!.root.x - cellX(bridge!.terminal.c), bridge!.root.z - cellZ(bridge!.terminal.r))
    const rootToStand = Math.hypot(bridge!.root.x - cellX(bridge!.stand.c), bridge!.root.z - cellZ(bridge!.stand.r))
    expect(rootToTerm).toBeLessThan(rootToStand)
    expect(game.bridgeExtendAt(stand)).toBe(0)
    const shut = dockedJetBridge(bridge!, 0)
    const open = dockedJetBridge(bridge!, 1)
    expect(shut.root.x).toBeCloseTo(bridge!.root.x)
    expect(shut.root.z).toBeCloseTo(bridge!.root.z)
    expect(open.cab.x).toBeCloseTo(bridge!.cab.x)
    expect(open.cab.z).toBeCloseTo(bridge!.cab.z)
    expect(Math.hypot(shut.cab.x - shut.root.x, shut.cab.z - shut.root.z)).toBeLessThan(
      Math.hypot(open.cab.x - open.root.x, open.cab.z - open.root.z),
    )
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

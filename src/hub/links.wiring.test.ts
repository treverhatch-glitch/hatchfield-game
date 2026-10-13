import { describe, expect, it } from 'vitest'
import { CONNECTIVITY_CATALOG } from '../connectivity/catalog.ts'
import { Game } from '../game/sim.ts'
import type { Tile } from '../game/types.ts'
import { assistedWalkMinutes } from './connect.ts'

function field() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 900_000
  game.speed = 1
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.threatCool = 1e9
  game.emergencyCool = 1e9
  return game
}

function grass(game: Game) {
  for (let r = 1; r < 30; r++) {
    for (let c = 1; c < 30; c++) {
      if (game.tile({ c, r }) === 'grass' && !game.siteAt({ c, r })) return { c, r }
    }
  }
  throw new Error('no grass')
}

function paint(game: Game, tile: Tile) {
  const cell = grass(game)
  game.tiles[cell.r][cell.c] = tile
  return cell
}

describe('live hub links', () => {
  it('keeps one connection time and one Transfer Centre', () => {
    const game = field()
    game.fieldXp = 220
    game.toggleInfo('connections')
    expect(game.infoLines('connections')[0]).toBe('Connection time 60 min')
    expect(game.infoHotspots().some((spot) => spot.id === 'links')).toBe(true)
    expect(CONNECTIVITY_CATALOG.people_mover.fieldLevel).toBe(7)
    expect('transfer_centre' in CONNECTIVITY_CATALOG).toBe(false)
    expect(game.connectionLink()).toBe('walk')
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('gates stamps by field level and posts cash and upkeep on the ledger', () => {
    const game = field()
    game.fieldXp = 700
    expect(game.fieldLevel()).toBe(5)
    const cell = grass(game)
    game.setTool('people_mover')
    game.placeSingle(cell)
    expect(game.tile(cell)).toBe('grass')
    expect(game.sites).toHaveLength(0)
    expect(game.cash).toBe(900_000)
    expect(game.news[0]?.text ?? '').toMatch(/Field level 7/)

    game.fieldXp = 1_600
    expect(game.fieldLevel()).toBe(7)
    game.placeSingle(cell)
    expect(game.sites).toHaveLength(1)
    expect(game.cash).toBe(900_000 - CONNECTIVITY_CATALOG.people_mover.cost)
    expect(game.bank.ledger().byCategory.construction).toBe(-CONNECTIVITY_CATALOG.people_mover.cost)

    game.tick(20)
    expect(game.tile(cell)).toBe('mover')
    expect(game.connectionLink()).toBe('people_mover')
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)

    game.clock = 179
    game.tick(2)
    const linkUpkeep = CONNECTIVITY_CATALOG.people_mover.upkeepPerDay
    expect(game.bank.ledger().byCategory.building_upkeep).toBe(-(game.dailyHoldingQuote() + linkUpkeep))
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.bagsLost).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
  })

  it('rides the people mover, then the transfer bus, then the terminal bus', () => {
    const game = field()
    paint(game, 'termbus')
    expect(game.connectionLink()).toBe('terminal_bus')
    paint(game, 'xferbus')
    expect(game.connectionLink()).toBe('airside_transfer_bus')
    paint(game, 'mover')
    expect(game.connectionLink()).toBe('people_mover')

    const before = game.cash
    game.breakLink('people_mover')
    expect(game.connectionLink()).toBe('airside_transfer_bus')
    expect(game.linkStopped('people_mover')).toBe(true)
    expect(game.strandedGates.length).toBeGreaterThan(0)
    expect(game.linkLines().some((line) => line.includes('stranded'))).toBe(true)
    expect(game.bagsLost).toBe(0)

    game.breakLink('airside_transfer_bus')
    expect(game.connectionLink()).toBe('terminal_bus')
    expect(game.linkStopped('airside_transfer_bus')).toBe(true)
    expect(game.linkLines().some((line) => line.includes('link is closed'))).toBe(true)

    const offer = game.linkRepairOffer()
    expect(offer?.mode).toBe('people_mover')
    game.repairLink('people_mover')
    expect(game.linkStopped('people_mover')).toBe(false)
    expect(game.connectionLink()).toBe('people_mover')
    expect(game.cash).toBe(before - CONNECTIVITY_CATALOG.people_mover.repairCost)
    expect(game.bank.ledger().byCategory.construction).toBe(-CONNECTIVITY_CATALOG.people_mover.repairCost)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('speeds a walk along a moving walkway and links halls with a skywalk', () => {
    const plain = assistedWalkMinutes(80, 0)
    const assisted = assistedWalkMinutes(80, CONNECTIVITY_CATALOG.moving_walkway.lengthMetres)
    expect(assisted).toBeLessThan(plain)
    expect(assisted).toBeGreaterThan(0)

    const game = field()
    game.fieldXp = 420
    expect(game.fieldLevel()).toBe(4)
    const cash = game.cash
    expect(game.placeHallItem('walkway')).toBeUndefined()
    expect(game.fits[0].items?.some((item) => item.def === 'walkway')).toBe(true)
    expect(game.cash).toBe(cash - CONNECTIVITY_CATALOG.moving_walkway.cost)
    expect(game.bank.ledger().byCategory.construction).toBe(-CONNECTIVITY_CATALOG.moving_walkway.cost)
    expect(game.connectionLink()).toBe('walkway')
    expect(game.walkwayCoverMetres()).toBe(CONNECTIVITY_CATALOG.moving_walkway.lengthMetres)

    const origin = game.fits[0].origin
    game.fits.push({ ...game.fits[0], origin: { c: origin.c, r: origin.r - 9 }, items: [] })
    for (let r = origin.r - 6; r <= origin.r - 1; r++) game.tiles[r][origin.c] = 'skywalk'
    game.tiles[origin.r - 8][origin.c - 3] = 'stand'
    const near = `${origin.c - 3},${origin.r - 8}`
    const far = '12,21'
    expect(game.connectionLink(near, far)).toBe('skywalk')
    expect(game.linkLines().some((line) => /^\d+ skywalk/.test(line))).toBe(true)

    game.toggleInfo('links')
    expect(game.infoOpen).toBe('links')
    expect(game.infoLines('links').some((line) => line.includes('Moving walkways'))).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('saves a stopped link and restores it', () => {
    const game = field()
    paint(game, 'mover')
    paint(game, 'termbus')
    game.breakLink('people_mover')
    game.persist()
    const next = new Game()
    expect(next.load()).toBe(true)
    expect(next.linkStopped('people_mover')).toBe(true)
    expect(next.connectionLink()).toBe('terminal_bus')
    expect(next.strandedGates.length).toBeGreaterThan(0)
    expect(next.bagsLost).toBe(0)
    expect(next.lostPaxCount()).toBe(0)
  })
})

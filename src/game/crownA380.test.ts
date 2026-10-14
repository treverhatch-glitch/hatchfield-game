import { describe, expect, it } from 'vitest'
import type { ResearchId } from './types.ts'
import { Game } from './sim.ts'

/**
 * Heavy-bot pillar, then Crown Pacific. The stress bot raises reputation and
 * signs Crown once scaleReport('a380') is open; this test checks that a
 * Crown-contracted A380 can then spawn onto a jumbo stand.
 */
function jumboField(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash += 3_000_000
  game.reputation = 90
  game.fieldXp = 700
  game.researchPoints = 4000
  for (let c = 8; c < 28; c++) {
    game.tiles[26][c] = 'runway'
    game.tiles[27][c] = 'runway'
  }
  for (let c = 4; c < 18; c++) game.tiles[7][c] = 'taxi'
  for (let r = 7; r <= 22; r++) game.tiles[r][8] = 'taxi'
  game.tiles[20][10] = 'hangar'
  game.tiles[18][10] = 'cargo'
  game.tiles[21][8] = 'fuel'
  game.tiles[21][7] = 'oil'
  for (let r = 22; r < 32; r++) game.tiles[r][7] = 'fuel_rail'
  const research: ResearchId[] = [
    'night_bank',
    'deice',
    'stand_class',
    'widebody_ops',
    'heavy_pack',
    'mil_ramp',
    'hydrant_fuel',
    'rail_fuel',
    'tank_farm_ii',
    'tank_farm_iii',
    'bag_sorter',
    'bag_bhs',
    'self_service',
    'ct_lanes',
    'egates',
    'travelator',
    'skywalk',
    'people_mover',
  ]
  for (const id of research) {
    if (!game.researchUnlocked.includes(id)) game.researchUnlocked.push(id)
  }
  game.standClass['20,21'] = 'L'
  game.standScale['20,21'] = 'jumbo'
  game.standAccess['20,21'] = 'jetway'
  game.tiles[24][19] = 'stand'
  game.standClass['19,24'] = 'L'
  game.standScale['19,24'] = 'jumbo'
  game.standAccess['19,24'] = 'jetway'
  const paint = (tile: 'travelator' | 'skywalk' | 'mover', cells: [number, number][]) => {
    for (const [c, r] of cells) game.tiles[r][c] = tile
  }
  paint('travelator', [
    [17, 22],
    [18, 22],
    [18, 23],
    [19, 23],
  ])
  paint('skywalk', [
    [16, 22],
    [16, 23],
    [16, 24],
    [17, 24],
    [18, 24],
  ])
  paint('mover', [
    [15, 22],
    [15, 23],
    [15, 24],
    [15, 25],
    [16, 25],
    [17, 25],
    [18, 25],
    [19, 25],
  ])
  game.hangarScale['10,20'] = 'jumbo'
  game.bagSystem = 'bhs'
  game.paxDesks = 4
  game.paxKiosks = 4
  game.paxBagDrops = 2
  game.scannerLanes = 2
  game.eGates = 2
  game.tankTier = 3
  game.contractId = 'mega_jumbo'
  game.fuelSupply = 'rail'
  game.scaleFleet = {
    heavy_fuel_truck: 1,
    uld_loader: 1,
    heavy_baggage_tug: 3,
    hydrant_dispenser: 1,
    heavy_tug: 1,
    highlift_catering: 1,
    main_deck_loader: 1,
  }
  game.bumpMap()
  game.speed = 1
  return game
}

describe('Crown Pacific A380', () => {
  it('spawns a Crown-contracted A380 onto a jumbo stand', () => {
    const game = jumboField()
    const report = game.scaleReport('a380')
    expect(report.hints.map((h) => h.id)).toEqual([])
    game.reputation = Math.max(game.reputation, 90)
    game.offer = { airline: 'crown', age: 0, deadline: 120 }
    game.acceptOffer()
    expect(game.signed).toContain('crown')

    const seen = new Set<string>()
    let hit: { c: number; r: number } | null = null
    for (let n = 0; n < 24 && !hit; n++) {
      // Crown's contract is A380 or 777. Clear the bank so each try rolls again.
      game.flights = []
      for (const slot of game.schedule) {
        if (slot.status === 'scheduled' || slot.status === 'delayed' || slot.status === 'inbound') {
          slot.status = 'cancelled'
        }
      }
      game.spawnCool = 0
      game.addManualSlot('crown', 8)
      for (let i = 0; i < 40 && !hit; i++) {
        game.tick(1)
        for (const f of game.flights) {
          if (f.phase === 'gone' || !f.stand) continue
          seen.add(f.airframeId)
          if (f.airframeId === 'a380') hit = { c: f.stand.c, r: f.stand.r }
        }
      }
    }
    expect(hit, `airframes seen: ${[...seen].join(',') || 'none'}`).not.toBeNull()
    expect(game.standScale[`${hit!.c},${hit!.r}`]).toBe('jumbo')
  }, 30_000)
})

import { describe, expect, it } from 'vitest'
import { JUMBO_RELATION_TIER } from '../wave3/fleetGrowth.ts'
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
  // Oil sits on the starter farm. The rail runs south to the map edge.
  game.tiles[5][6] = 'oil'
  for (let r = 6; r < 32; r++) game.tiles[r][6] = 'fuel_rail'
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
  // Jumbo gate south of the hall, on grass outside the runway shoulder, taxi-linked.
  for (let c = 9; c <= 19; c++) game.tiles[22][c] = 'taxi'
  game.tiles[22][20] = 'stand'
  game.standClass['20,22'] = 'L'
  game.standScale['20,22'] = 'jumbo'
  game.standAccess['20,22'] = 'jetway'
  game.standPits['20,22'] = true
  const paint = (tile: 'travelator' | 'skywalk' | 'mover', cells: [number, number][]) => {
    for (const [c, r] of cells) game.tiles[r][c] = tile
  }
  const line = (c0: number, r0: number, c1: number, r1: number): [number, number][] => {
    const cells: [number, number][] = []
    const dc = Math.sign(c1 - c0)
    const dr = Math.sign(r1 - r0)
    let c = c0
    let r = r0
    cells.push([c, r])
    while (c !== c1) {
      c += dc
      cells.push([c, r])
    }
    while (r !== r1) {
      r += dr
      cells.push([c, r])
    }
    return cells
  }
  // Each link touches the hall and the jumbo stand. The mover runs east of the curb
  // so it does not cut the travelator column or the taxi into the stand.
  paint('travelator', [...line(15, 11, 15, 21), ...line(15, 21, 20, 21)])
  paint('skywalk', [...line(16, 11, 16, 18), ...line(16, 18, 21, 18), ...line(21, 18, 21, 22)])
  paint('mover', [...line(16, 7, 24, 7), ...line(24, 7, 24, 23), ...line(24, 23, 20, 23)])
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
    while (game.wave3.relation('crown').tier < JUMBO_RELATION_TIER) {
      game.wave3.noteTurnaround('crown', 'success')
    }

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

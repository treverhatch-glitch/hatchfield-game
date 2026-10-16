/**
 * Every roster carrier flies the metal on its card. Seats, stand class, and
 * runway follow that airframe. A field that cannot take any listed type gets
 * no letter. The capacity line warns and does not block.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { ROSTER } from '../airlines/roster.ts'
import { buildPhoneFeed } from '../phone/feed.ts'
import { readPhoneWorld } from '../phone/readGame.ts'
import { AIRFRAMES } from './airframes.ts'
import { standClassLabel, standClassRank } from './catalog.ts'
import { carrierTurnsWanted, TURNS_PER_STAND_PER_DAY } from './letterCapacity.ts'
import { rosterFeeSeatBand, rosterGameAirline } from './rosterAirlines.ts'
import {
  airframeStandClass,
  fleetRunwayCells,
  fleetSeatBand,
  fleetStandClass,
  isHeloAirframe,
  resolvedAirframes,
} from './rosterMetal.ts'
import { Game } from './sim.ts'
import type { ResearchId } from './types.ts'
import { SAVE_SCHEMA_VERSION } from '../features/save/schema.ts'

function fresh(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

/** Strip, jumbo stand, pillar, and a pad — every roster type can operate. */
function capableField(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.cash += 3_000_000
  game.reputation = 100
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
  for (let c = 9; c <= 19; c++) game.tiles[22][c] = 'taxi'
  game.tiles[22][20] = 'stand'
  game.standClass['20,22'] = 'L'
  game.standScale['20,22'] = 'jumbo'
  game.standAccess['20,22'] = 'jetway'
  game.standPits['20,22'] = true
  game.tiles[30][2] = 'helipad'
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
  game.clock = 1000
  game.scheduleAuto = false
  game.bumpMap()
  return game
}

beforeEach(() => {
  localStorage.clear()
})

describe('roster fleets', () => {
  it('resolves all 45 fleets onto AIRFRAMES and seats from those airframes', () => {
    expect(ROSTER).toHaveLength(45)
    expect(SAVE_SCHEMA_VERSION).toBe(6)
    let seatMismatch = 0
    for (const r of ROSTER) {
      expect(r.fleet.length).toBeGreaterThan(0)
      for (const id of r.fleet) {
        expect(AIRFRAMES[id], `${r.id} fleet id ${id}`).toBeTruthy()
      }
      const frames = resolvedAirframes(r.fleet)
      expect(frames.map((af) => af.id)).toEqual(r.fleet)
      const band = fleetSeatBand(frames)
      const airline = rosterGameAirline(r.id)!
      expect(airline.paxMin).toBe(band.paxMin)
      expect(airline.paxMax).toBe(band.paxMax)
      for (const af of frames) expect(airline.fleetBlurb).toContain(af.name)
      const fee = rosterFeeSeatBand(r.id)!
      if (fee.paxMin !== band.paxMin || fee.paxMax !== band.paxMax) seatMismatch += 1
    }
    expect(seatMismatch).toBeGreaterThan(0)
  })

  it('spawns each carrier on its own metal, named the same on the card, letter, and planner', () => {
    const game = capableField()
    for (const r of ROSTER) {
      const frames = resolvedAirframes(r.fleet)
      game.flights = []
      game.schedule = []
      game.signed = [r.id]
      game.spawnCool = 0
      game.seedScheduleForAirline(r.id, 1)
      const slot = game.schedule.find((s) => s.airline === r.id)
      expect(slot, r.id).toBeTruthy()
      expect(r.fleet, r.id).toContain(slot!.airframeId)
      const named = AIRFRAMES[slot!.airframeId!]!
      const card = game.airline(r.id).fleetBlurb
      const craft = game.contractCraftNeed(r.id)
      expect(craft?.label, r.id).toBe(card)
      expect(card, r.id).toContain(named.name)
      expect(game.wave3.relation(r.id).fleetLabel, r.id).toContain(named.name)
      const planned = game.plannerStrip(120).slots.find((s) => s.id === slot!.id)
      expect(planned?.model, r.id).toBe(named.name)
      expect(game.slotAircraftName(slot!), r.id).toBe(named.name)
      if (isHeloAirframe(named)) {
        expect(card).toContain('Helipad')
      } else {
        const fleetCls = fleetStandClass(frames)!
        const own = airframeStandClass(named)!
        expect(standClassRank(own)).toBeLessThanOrEqual(standClassRank(fleetCls))
        expect(card).toContain(`${standClassLabel(fleetCls)}+`)
        expect(card).toContain(`${fleetRunwayCells(frames)}c strip`)
        expect(named.minRunway).toBeLessThanOrEqual(fleetRunwayCells(frames))
        expect(craft?.met, r.id).toBe(true)
      }
      slot!.eta = game.clock - 1
      slot!.status = 'scheduled'
      game.spawnCool = 0
      game.trySpawn()
      const live = game.flights.find((f) => f.airline === r.id)
      expect(live, `${r.id} ${game.news[0]?.text ?? 'no news'}`).toBeTruthy()
      expect(live!.airframeId, r.id).toBe(slot!.airframeId)
      expect(r.fleet, r.id).toContain(live!.airframeId)
      expect(live!.airframeName, r.id).toBe(named.name)
      expect(live!.pax, r.id).toBeGreaterThanOrEqual(named.paxMin)
      expect(live!.pax, r.id).toBeLessThanOrEqual(named.paxMax)
    }
  })

  it('does not write a letter when no listed type can operate, and names the gap', () => {
    const game = fresh()
    game.reputation = 100
    game.fieldXp = 700
    expect(game.fleetHasOperable('air_flag_1')).toBe(false)
    const gap = game.fleetOperateGap('air_flag_1')
    expect(gap).toBeTruthy()
    expect(game.missingReq('air_flag_1')).toContain(gap)
    for (let i = 0; i < 12; i++) {
      game.offer = null
      game.offerCool = 0
      game.considerOffers()
      const offered = game.offer as { airline: string } | null
      if (!offered) continue
      expect(game.fleetHasOperable(offered.airline) || game.padOnlyGap(offered.airline)).toBe(true)
      expect(offered.airline).not.toBe('air_flag_1')
    }
  })

  it('warns about stand capacity on the letter and still accepts', () => {
    const game = fresh()
    const pax = ROSTER.filter((r) => r.type !== 'heli' && r.type !== 'cargo').slice(0, 12)
    game.signed = pax.map((r) => r.id)
    const next = ROSTER.find((r) => r.type === 'regional' && !game.signed.includes(r.id))!
    const stands = 2
    const want = game.signed.reduce((sum, id) => sum + carrierTurnsWanted(game.airline(id).tier), 0)
    const adds = carrierTurnsWanted(game.airline(next.id).tier)
    const line = `Your ${stands} stands host ~${stands * TURNS_PER_STAND_PER_DAY} turns/day; signed carriers already want ${want}; this adds ${adds}`
    expect(game.letterCapacity(next.id)).toBe(line)
    expect(want + adds).toBeGreaterThan(stands * TURNS_PER_STAND_PER_DAY)
    expect(game.missingReq(next.id).join(' ')).not.toContain('turns/day')
    game.offer = { airline: next.id, age: 0, deadline: 90 }
    const world = readPhoneWorld(game)
    expect(world.contract?.capacity).toBe(line)
    const phone = buildPhoneFeed(world).find((card) => card.id === 'contract')
    const capacity = phone?.lines?.find((row) => row.label === line)
    expect(capacity).toBeTruthy()
    expect(capacity?.met).toBeUndefined()
    game.paxDesks = 80
    game.paxKiosks = 8
    game.acceptOffer()
    expect(game.signed).toContain(next.id)
  })
})

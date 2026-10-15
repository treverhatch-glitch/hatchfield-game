import { describe, expect, it } from 'vitest'
import { HYDRANT_CARD } from '../fuel/hydrant.ts'
import type { Flight } from '../game/types.ts'
import { Game } from '../game/sim.ts'
import { fittingDef, hostKey } from './catalog.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  game.fieldXp = 700
  return game
}

function flight(stand: { c: number; r: number }): Flight {
  return {
    id: 'fx',
    airline: 'harbor',
    flightNo: 'FX1',
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 140,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
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
    phaseTime: 1,
    ledger: [],
  }
}

function cap(game: Game, f: Flight): number {
  return (game as unknown as { boardCap(flight: Flight): number }).boardCap(f)
}

function paceOf(game: Game, f: Flight): number {
  return (game as unknown as { rampPace(id: string, cargo: boolean, airline: string): number }).rampPace(
    f.airframeId,
    false,
    f.airline,
  )
}

function clocks(game: Game) {
  return (game as unknown as { turnaroundClocks(existing: []): { service: string }[] }).turnaroundClocks([])
}

describe('stand fittings', () => {
  it('stretches the board cap at night and in weather, and the fitting removes that stretch', () => {
    const game = field()
    const f = flight({ c: 11, r: 6 })
    game.flights = [f]
    const day = cap(game, f)
    const clearPace = paceOf(game, f)
    game.clock = 120
    expect(cap(game, f) / day).toBeCloseTo(1.2)
    game.tool = 'pan'
    game.clickTile({ c: 11, r: 6 })
    expect(game.buildingCard()?.note).toContain('Unlit')
    game.buyFitting(hostKey('stand', 11, 6), 'apron_light')
    expect(cap(game, f) / day).toBeCloseTo(1)
    expect(game.buildingCard()?.note ?? '').not.toContain('Unlit')

    game.clock = 0
    game.weather = 'rain'
    expect(cap(game, f) / day).toBeCloseTo(1.15 * (paceOf(game, f) / clearPace))
    expect(game.buildingCard()?.note).toContain('Weather dwell')
    game.buyFitting(hostKey('stand', 11, 6), 'gpu_pca')
    expect(cap(game, f) / day).toBeCloseTo(paceOf(game, f) / clearPace)
    expect(game.buildingCard()?.note ?? '').not.toContain('Weather dwell')
    expect(game.buildingCard()?.note).toBe(HYDRANT_CARD.bowser)
  })

  it('keeps a dark cable on a GPU truck and skips the truck when the cable is live', () => {
    const game = field()
    const f = flight({ c: 11, r: 6 })
    game.flights = [f]
    expect(clocks(game).some((row) => row.service === 'gpu')).toBe(true)
    for (let c = 0; c < 6; c++) game.tiles[1]![c] = 'mro'
    expect(game.powerReport().brownout).toBe(true)
    game.buyFitting(hostKey('stand', 11, 6), 'gpu_pca')
    game.tool = 'pan'
    game.clickTile({ c: 11, r: 6 })
    expect(game.buildingCard()?.note).toContain('Plant is short. A GPU truck is coming.')
    expect(clocks(game).some((row) => row.service === 'gpu')).toBe(true)
    game.progressionBuilt.push('substation')
    expect(game.buildingCard()?.note ?? '').not.toContain('Plant is short')
    expect(clocks(game).some((row) => row.service === 'gpu')).toBe(false)
  })

  it('holds the de-ice truck at the pad unless the stand has an outlet', () => {
    const game = field()
    const f = flight({ c: 11, r: 6 })
    game.spawnTruck('deice', f, [{ c: 1, r: 1 }], 'deice')
    expect(game.trucks.at(-1)?.preDwell).toBeCloseTo(9.1)
    expect(game.buyFitting(hostKey('stand', 11, 6), 'deice_outlet')).toBe(false)
    game.researchUnlocked.push('deice')
    expect(game.buyFitting(hostKey('stand', 11, 6), 'deice_outlet')).toBe(false)
    game.tiles[3]![3] = 'deice'
    const cash = game.cash
    expect(game.buyFitting(hostKey('stand', 11, 6), 'deice_outlet')).toBe(true)
    expect(game.cash).toBe(cash - fittingDef('deice_outlet').cost)
    game.spawnTruck('deice', f, [{ c: 1, r: 1 }], 'deice')
    expect(game.trucks.at(-1)?.preDwell).toBeCloseTo(1.1)
  })

  it('names the flag socket and bills its upkeep', () => {
    const game = field()
    game.tool = 'pan'
    game.clickTile({ c: 11, r: 6 })
    const row = game.buildingCard()?.sections?.find((section) => section.id === 'attachments')?.rows.find((item) =>
      item.id.endsWith(':flag'),
    )
    expect(row?.label).toContain('stand_flag')
    expect(row?.label).toContain('$800')
    const before = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    game.standCardAction(row!.id)
    const after = (game as unknown as { pillarUpkeepBill(): number }).pillarUpkeepBill()
    expect(after - before).toBe(fittingDef('flag').upkeepPerDay)
    const f = flight({ c: 11, r: 6 })
    const day = cap(game, f)
    const clearPace = paceOf(game, f)
    game.clock = 120
    game.weather = 'rain'
    expect(cap(game, f) / day).toBeCloseTo(1.2 * 1.15 * (paceOf(game, f) / clearPace))
  })
})

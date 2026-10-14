import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim'
import { chooseLot, HANGAR_LOT, lotArea, lotCells, lotFrame, lotSize, LOT_SIZE } from './footprints'

describe('real-world lots', () => {
  it('sizes follow real scale: jumbo hangar > wide > small; guard posts and links stay 1×1', () => {
    expect(lotArea(HANGAR_LOT.jumbo)).toBeGreaterThan(lotArea(HANGAR_LOT.wide))
    expect(lotArea(HANGAR_LOT.wide)).toBeGreaterThan(lotArea(HANGAR_LOT.small))
    // A380 span 80 m must fit inside the jumbo bay.
    expect(HANGAR_LOT.jumbo.w * 22).toBeGreaterThan(80)
    for (const t of ['guard', 'snack', 'police', 'tower', 'road', 'taxi', 'belt', 'travelator', 'skywalk', 'mover', 'oil'] as const)
      expect(lotSize(t), t).toBeNull()
    expect(lotSize('fuel')!.w * lotSize('fuel')!.d).toBeGreaterThanOrEqual(9)
    for (const [tile, s] of Object.entries(LOT_SIZE)) expect(s!.why.length, tile).toBeGreaterThan(8)
  })

  it('lot cells extend away from the access side, anchor first', () => {
    const cells = lotCells({ c: 10, r: 10 }, { w: 3, d: 2, dir: { c: 0, r: 1 } })
    expect(cells[0]).toEqual({ c: 10, r: 10 })
    expect(cells).toHaveLength(6)
    expect(cells.every((p) => p.r <= 10)).toBe(true)
    expect(new Set(cells.map((p) => `${p.c},${p.r}`)).size).toBe(6)
    const f = lotFrame({ w: 3, d: 3, dir: { c: 1, r: 0 } })
    expect(f.dc).toBe(-1)
    expect(f.yaw).toBeCloseTo(Math.PI / 2)
  })

  it('chooseLot honours access and blocked cells', () => {
    const blocked = new Set(['10,9'])
    const lot = chooseLot({ c: 10, r: 10 }, { w: 1, d: 2 }, {
      inBounds: () => true,
      free: (p) => !blocked.has(`${p.c},${p.r}`),
      access: (p) => p.c === 11 && p.r === 10,
    })
    expect(lot?.dir).toEqual({ c: 1, r: 0 })
  })

  function road(game: Game) {
    for (let c = 3; c < 29; c++) if (game.tiles[24][c] === 'grass') game.tiles[24][c] = 'road'
  }

  function field() {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.cash = 5e6
    road(game)
    return game
  }

  it('placing a fuel farm reserves its lot; other stamps cannot enter; bulldoze frees it', () => {
    const game = field()
    let spot: { c: number; r: number } | null = null
    for (let r = 4; r < 28 && !spot; r++)
      for (let c = 4; c < 28 && !spot; c++) {
        if (game.tiles[r][c] !== 'grass') continue
        if (game.planLot({ c, r }, 'fuel', 'fuel').lot) spot = { c, r }
      }
    expect(spot).not.toBeNull()
    game.tool = 'fuel'
    game.placeSingle(spot!)
    const lot = game.lots[`${spot!.c},${spot!.r}`]
    expect(lot).toBeDefined()
    const inside = lotCells(spot!, lot!)[1]!
    expect(game.lotOwnerAt(inside)).toEqual(spot)
    expect(game.cellsBlocked([inside])).toBe(true)
    game.tool = 'snack'
    const sites = game.sites.length
    game.placeSingle(inside)
    expect(game.sites.length).toBe(sites)
    // Ghost covers the full lot.
    game.tool = 'fuel'
    expect(game.ghostCells(spot!).length).toBe(9)
    game.tickConstruction(60)
    game.clearTile(inside)
    expect(game.lots[`${spot!.c},${spot!.r}`]).toBeUndefined()
  })

  it('lots survive save/load, and old saves without lots load grandfathered at 1×1', () => {
    localStorage.clear()
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.cash = 5e6
    road(game)
    let spot: { c: number; r: number } | null = null
    for (let r = 4; r < 28 && !spot; r++)
      for (let c = 4; c < 28 && !spot; c++)
        if (game.tiles[r][c] === 'grass' && game.planLot({ c, r }, 'fuel', 'fuel').lot) spot = { c, r }
    game.tool = 'fuel'
    game.placeSingle(spot!)
    game.tickConstruction(60)
    game.persist()
    const again = new Game()
    expect(again.load()).toBe(true)
    expect(again.lots).toEqual(game.lots)
    // Strip lots → legacy save.
    const raw = JSON.parse(localStorage.getItem([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)!).find((k) => localStorage.getItem(k)!.includes('"lots"'))!)!)
    delete raw.lots
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (localStorage.getItem(k)!.includes('"lots"')) localStorage.setItem(k, JSON.stringify(raw))
    }
    const legacy = new Game()
    expect(legacy.load()).toBe(true)
    expect(legacy.lots).toEqual({})
    expect(legacy.tiles[spot!.r][spot!.c]).toBe('fuel')
  })
})

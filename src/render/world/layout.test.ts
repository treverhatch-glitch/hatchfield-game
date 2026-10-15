import { describe, expect, it } from 'vitest'
import { blankView, rect, starterGame } from './fixtures'
import { landsideSide } from './terminal'
import { AIRCRAFT_VISUAL_SCALE, STAND_ENVELOPE, WORLD_PER_METER } from '../aircraft/specs'
import {
  airsideOf,
  apronMasts,
  clusters,
  standFlags,
  exteriorEdges,
  jetBridges,
  runwayDesignators,
  runwayLightSpots,
  runwayPaint,
  runways,
  standBox,
  standPads,
  standPaint,
  stands,
  taxiLightSpots,
  taxiLinkVisible,
  roadPaint,
  taxiPaint,
  terminals,
} from './layout'
import { roadKerbs } from './kerbs'
import { CELL, cellX, cellZ } from './view'
import { CELL as LEGACY_CELL, toWorld } from '../world'

describe('world layout', () => {
  it('mirrors the legacy CELL / toWorld grid', () => {
    expect(CELL).toBe(LEGACY_CELL)
    const p = toWorld(7, 22)
    expect(cellX(7)).toBeCloseTo(p.x)
    expect(cellZ(22)).toBeCloseTo(p.z)
  })

  it('finds 4-connected clusters', () => {
    const v = blankView([...rect(2, 2, 3, 2, 'terminal'), [10, 10, 'terminal'], [11, 11, 'terminal']])
    const cl = clusters(v, 'terminal')
    expect(cl.map((c) => c.cells.length).sort()).toEqual([1, 1, 6])
  })

  it('reads runway axis and designators', () => {
    const h = runways(blankView(rect(4, 10, 14, 2, 'runway')))[0]
    expect(h.axis).toBe('h')
    expect(h.length).toBeCloseTo(14 * CELL)
    expect(h.width).toBeCloseTo(2 * CELL)
    const v = runways(blankView(rect(4, 4, 2, 10, 'runway')))[0]
    expect(v.axis).toBe('v')
    expect(runwayDesignators('h')).toEqual(['09', '27'])
    expect(runwayDesignators('v')).toEqual(['18', '36'])
  })

  it('paints piano keys, designators, and centreline inside the runway', () => {
    const rw = runways(blankView(rect(4, 10, 14, 2, 'runway')))[0]
    const paint = runwayPaint(rw)
    expect(paint.length).toBeGreaterThan(30)
    for (const p of paint) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(rw.x0 - 1e-6)
      expect(p.x + p.w / 2).toBeLessThanOrEqual(rw.x1 + 1e-6)
      expect(p.z - p.d / 2).toBeGreaterThanOrEqual(rw.z0 - 1e-6)
      expect(p.z + p.d / 2).toBeLessThanOrEqual(rw.z1 + 1e-6)
    }
  })

  it('places runway edge, threshold, and end lights', () => {
    const rw = runways(blankView(rect(4, 10, 14, 2, 'runway')))[0]
    const spots = runwayLightSpots(rw)
    const kinds = new Set(spots.map((s) => s.kind))
    expect(kinds).toEqual(new Set(['rwEdge', 'rwCenter', 'threshold', 'rwEnd']))
    expect(spots.filter((s) => s.kind === 'threshold').length).toBeGreaterThanOrEqual(8)
  })

  it('terminal edges and airside face the apron', () => {
    const v = blankView([...rect(10, 10, 3, 3, 'terminal'), ...rect(8, 13, 7, 1, 'taxi'), [9, 12, 'stand']])
    const [cl] = clusters(v, 'terminal')
    expect(exteriorEdges(v, cl)).toHaveLength(12)
    expect(airsideOf(v, cl)).toBe('s')
    expect(terminals(v)[0].airside).toBe('s')
  })

  it('skips centreline ladders between parallel taxi strips', () => {
    const v = blankView([...rect(4, 20, 10, 2, 'taxi'), ...rect(8, 15, 1, 5, 'taxi')])
    expect(taxiLinkVisible(v, 6, 20, 's')).toBe(false)
    // A spur meeting the strip keeps its link.
    expect(taxiLinkVisible(v, 8, 19, 's')).toBe(true)
    expect(taxiLinkVisible(v, 6, 20, 'e')).toBe(true)
    const paint = taxiPaint(v)
    expect(paint.every((p) => p.color === 'yellow')).toBe(true)
  })

  it('starter kit: stands, jet bridges, masts, taxi lights', () => {
    const game = starterGame()
    const bare = stands(game)
    expect(bare.length).toBe(2)
    expect(bare.every((s) => s.jetway)).toBe(false)
    expect(jetBridges(game, bare)).toHaveLength(0)
    game.standAccess['11,6'] = 'jetway'
    game.standAccess['11,12'] = 'jetway'
    const st = stands(game)
    expect(st.every((s) => s.jetway)).toBe(true)
    const bridges = jetBridges(game, st)
    expect(bridges).toHaveLength(2)
    // Airside is the apron. The landside door is the opposite face, on the public road.
    const [hall] = clusters(game, 'terminal')
    expect(airsideOf(game, hall)).toBe('w')
    expect(landsideSide(airsideOf(game, hall))).toBe('e')
    const east = hall.cells.filter((p) => p.c === hall.maxC)
    expect(east.some((p) => game.tile({ c: p.c + 1, r: p.r }) === 'road')).toBe(true)
    // Each gate link leaves the facade that faces its stand, never the road side.
    expect(bridges.every((b) => b.side !== 'e')).toBe(true)
    for (const b of bridges) {
      if (b.side === 'w') expect(b.stand.c).toBeLessThan(b.terminal.c)
      if (b.side === 'n') expect(b.stand.r).toBeLessThan(b.terminal.r)
      if (b.side === 's') expect(b.stand.r).toBeGreaterThan(b.terminal.r)
    }
    for (const b of bridges) {
      // Cab ends up nearer the stand than the rotunda does.
      const sx = cellX(b.stand.c)
      const sz = cellZ(b.stand.r)
      expect(Math.hypot(b.cab.x - sx, b.cab.z - sz)).toBeLessThan(Math.hypot(b.root.x - sx, b.root.z - sz))
    }
    expect(apronMasts(st)).toHaveLength(0)
    expect(standFlags(st)).toHaveLength(0)
    game.fittings['stand:11,6'] = [{ id: 'apron_light' }]
    game.fittings['stand:11,12'] = [{ id: 'flag' }]
    const dressed = stands(game)
    expect(apronMasts(dressed)).toHaveLength(1)
    expect(standFlags(dressed)).toHaveLength(1)
    expect(standFlags(dressed)[0]?.color).toBe('#1f4b7a')
    const lights = taxiLightSpots(game)
    expect(lights.some((l) => l.kind === 'twCenter')).toBe(true)
    expect(lights.some((l) => l.kind === 'twEdge')).toBe(true)
    const sp = standPaint(st)
    expect(sp.some((p) => p.color === 'M')).toBe(true)
    expect(sp.some((p) => p.color === 'red')).toBe(true)
    const west = [...st].sort((a, b) => a.c - b.c || a.r - b.r)[0]
    const box = standBox(west)
    const visual = WORLD_PER_METER * AIRCRAFT_VISUAL_SCALE
    expect(box.width).toBeCloseTo(STAND_ENVELOPE.C.widthM * visual)
    expect(box.depth).toBeCloseTo(STAND_ENVELOPE.C.depthM * visual)
    // One taxiway cell is a code-E strip (ICAO 23 m; the grid uses 22 m).
    expect(CELL / WORLD_PER_METER).toBe(22)
  })

  it('pulls a stand pad back to the terminal face', () => {
    const v = blankView(
      [
        [5, 5, 'stand'],
        [6, 5, 'terminal'],
      ],
      { standClass: { '5,5': 'M' } },
    )
    const [pad] = standPads(v, stands(v))
    const face = cellX(6) - CELL / 2
    expect(pad.x + pad.w / 2).toBeLessThanOrEqual(face + 1e-6)
    expect(pad.w).toBeGreaterThan(CELL)
  })

  it('paints road lanes and raises a kerb on open edges', () => {
    const game = starterGame()
    const paint = roadPaint(game)
    expect(paint.some((p) => p.color === 'yellow')).toBe(true)
    expect(paint.some((p) => p.color === 'white')).toBe(true)
    const kerbs = roadKerbs(game)
    expect(kerbs.length).toBeGreaterThan(4)
  })
})

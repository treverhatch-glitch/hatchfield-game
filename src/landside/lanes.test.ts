import { describe, expect, it } from 'vitest'
import { LANDSIDE } from './config.ts'
import { buildLanes, headingAt, indexAt, laneMetres, laneOffsets, laneOpenAt, pointAt } from './lanes.ts'
import { starterField } from './fixtures.test-util.ts'
import { buildNetwork, cellId } from './network.ts'
import type { Cell } from './types.ts'

function cellOf(x: number, y: number): string {
  return cellId({ c: Math.round(x / LANDSIDE.cellM), r: Math.round(y / LANDSIDE.cellM) })
}

describe('public road lanes', () => {
  it('keeps right by default, with two lanes each way and a layby outside the curb lane', () => {
    expect(LANDSIDE.drivingSide).toBe('right')
    expect(LANDSIDE.lanesEachWay).toBe(2)
    const lat = laneOffsets()
    expect(lat).toHaveLength(LANDSIDE.lanesEachWay + 1)
    expect(lat[1] - lat[0]).toBeCloseTo(LANDSIDE.laneWidthM, 6)
    expect(lat[0]).toBeCloseTo(LANDSIDE.medianM / 2 + LANDSIDE.laneWidthM / 2, 6)
    // The layby, plus half the widest body, stays inside the kerb at 0.46 of a cell.
    expect(lat[2] + LANDSIDE.laybyWidthM / 2).toBeLessThanOrEqual(LANDSIDE.cellM * 0.46)
  })

  it('runs the starter road south on the west half, U-turns in the last cell, and returns on the east half', () => {
    const net = buildNetwork(starterField())
    expect(net.exit.map(cellId)).toEqual(['17,8', '17,9', '17,10', '17,11', '17,12'])
    expect(net.edgeExit).toBe(false)
    const geo = buildLanes(net)!
    expect(geo).not.toBeNull()
    expect(geo.backStart).toBeGreaterThan(geo.forwardEnd)

    const curb = geo.curbLane
    const southbound = pointAt(geo, indexAt(geo, 5, 0, false), geo.lat[curb])
    const northbound = pointAt(geo, indexAt(geo, 5, 0, true), geo.lat[curb])
    expect(southbound.x / LANDSIDE.cellM).toBeLessThan(17)
    expect(northbound.x / LANDSIDE.cellM).toBeGreaterThan(17)
    expect(southbound.x - 17 * LANDSIDE.cellM).toBeCloseTo(-geo.lat[curb], 6)
    expect(southbound.y).toBeCloseTo(northbound.y, 6)

    // The layby beside the hall is on the hall side.
    const stall = pointAt(geo, indexAt(geo, 9, 0, false), geo.lat[geo.layby])
    expect(stall.x).toBeLessThan(17 * LANDSIDE.cellM - geo.lat[curb])

    // Every lane stays on the public road cells, and enters and leaves at the north edge.
    const roadIds = new Set([...net.path, ...net.exit].map(cellId))
    roadIds.add('17,-1')
    for (const lane of [0, curb, geo.layby]) {
      for (let i = 0; i < geo.count; i++) {
        if (!laneOpenAt(geo, lane, i)) continue
        const p = pointAt(geo, i, geo.lat[lane])
        expect(roadIds.has(cellOf(p.x, p.y)), `lane ${lane} sample ${i} at ${p.x},${p.y}`).toBe(true)
        expect(p.y / LANDSIDE.cellM).toBeLessThan(12.46)
      }
    }
    expect(pointAt(geo, 0, 0).y / LANDSIDE.cellM).toBeCloseTo(-0.5, 6)
    expect(pointAt(geo, geo.count - 1, 0).y / LANDSIDE.cellM).toBeCloseTo(-0.5, 6)

    // The U-turn is a half circle at the curb-lane offset. The inner lane closes for it.
    const arc = laneMetres(geo, curb, geo.backStart) - laneMetres(geo, curb, geo.forwardEnd)
    expect(arc).toBeCloseTo(Math.PI * geo.lat[curb], 0)
    // A bus on that circle stays on the asphalt, short of the painted end bar at 0.42 of a cell.
    const bus = LANDSIDE.bodies.bus
    const endBar = 12 + 0.42
    let busSouth = 0
    for (let i = geo.forwardEnd; i <= geo.backStart; i++) {
      const p = pointAt(geo, i, geo.lat[curb])
      const h = headingAt(geo, i, geo.lat[curb])
      const hy = Math.sin(h) * (bus.lengthM / 2)
      const wy = Math.cos(h) * (bus.widthM / 2)
      for (const [sx, sy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const y = (p.y + sy * hy + sx * wy) / LANDSIDE.cellM
        busSouth = Math.max(busSouth, y)
        expect(y, `bus corner at sample ${i}`).toBeLessThan(endBar - 0.08)
      }
    }
    expect(busSouth).toBeGreaterThan(12)
    expect(laneOpenAt(geo, 0, geo.forwardEnd + 2)).toBe(false)
    expect(laneOpenAt(geo, curb, geo.forwardEnd + 2)).toBe(true)
    expect(laneOpenAt(geo, 0, geo.backStart)).toBe(true)
  })

  it('rounds a corner without leaving the road and keeps samples close together', () => {
    const roads: Cell[] = []
    for (let r = 0; r <= 6; r++) roads.push({ c: 5, r })
    for (let c = 6; c <= 10; c++) roads.push({ c, r: 6 })
    const net = buildNetwork({
      roads,
      terminals: [{ c: 8, r: 7 }, { c: 9, r: 7 }],
      busBays: [],
      parks: [],
      rail: false,
      paxPerDay: 0,
      departures: 1,
    })
    const geo = buildLanes(net)!
    expect(geo.cells.some((cell) => cell.corner)).toBe(true)
    const ids = new Set([...roads.map(cellId), '5,-1'])
    for (let lane = 0; lane < geo.lat.length; lane++) {
      for (let i = 1; i < geo.count; i++) {
        const a = pointAt(geo, i - 1, geo.lat[lane])
        const b = pointAt(geo, i, geo.lat[lane])
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(2.2)
        if (laneOpenAt(geo, lane, i)) expect(ids.has(cellOf(b.x, b.y)), `lane ${lane} at ${i}`).toBe(true)
      }
    }
  })

  it('drives off a road that reaches a second map edge instead of turning', () => {
    const roads: Cell[] = []
    for (let r = 0; r <= 31; r++) roads.push({ c: 3, r })
    const net = buildNetwork({
      roads,
      terminals: [{ c: 2, r: 10 }],
      busBays: [],
      parks: [],
      rail: false,
      paxPerDay: 0,
      departures: 1,
    })
    expect(net.edgeExit).toBe(true)
    const geo = buildLanes(net)!
    expect(geo.backStart).toBe(-1)
    expect(pointAt(geo, geo.count - 1, 0).y / LANDSIDE.cellM).toBeCloseTo(31.5, 6)
  })
})

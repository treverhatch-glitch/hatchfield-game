import { describe, expect, it } from 'vitest'
import { LANDSIDE } from './config.ts'
import { LandsideTraffic, measure, pressureColor } from './engine.ts'
import { approachLanes, buildNetwork } from './network.ts'
import type { Cell, LandsideField } from './types.ts'

function halls(): Cell[] {
  const cells: Cell[] = []
  for (let c = 4; c <= 6; c++) for (let r = 4; r <= 6; r++) cells.push({ c, r })
  return cells
}

function approach(): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r <= 8; r++) cells.push({ c: 7, r })
  return cells
}

function field(patch: Partial<LandsideField> = {}): LandsideField {
  return {
    roads: approach(),
    terminals: halls(),
    busBays: [],
    parks: [],
    rail: false,
    paxPerDay: 0,
    departures: 2,
    ...patch,
  }
}

function parallel(roads: Cell[]): Cell[] {
  return [...roads, ...roads.map((cell) => ({ c: cell.c + 1, r: cell.r }))]
}

function longerCurb(roads: Cell[]): Cell[] {
  const extra: Cell[] = []
  for (let r = 3; r <= 7; r++) extra.push({ c: 7, r })
  const seen = new Set(roads.map((cell) => `${cell.c},${cell.r}`))
  return [...roads, ...extra.filter((cell) => !seen.has(`${cell.c},${cell.r}`))]
}

describe('curb network', () => {
  it('gives the hall frontage a stall count and the approach one lane', () => {
    const net = buildNetwork(field())
    expect(net.frontage.map((cell) => cell.r).sort((a, b) => a - b)).toEqual([4, 5, 6])
    expect(net.curbStalls).toBe(3 * LANDSIDE.stallsPerCurbCell)
    expect(net.lanes).toBe(1)
    expect(net.path[0]).toEqual({ c: 7, r: 0 })
    expect(net.path.at(-1)?.c).toBe(7)
    expect(net.exit[0]).toEqual(net.path.at(-1))
    expect(net.exit.at(-1)).toEqual({ c: 7, r: 8 })
    expect(net.edgeExit).toBe(false)
  })

  it('counts a parallel road as a second lane only when it runs the whole approach', () => {
    const base = field()
    expect(approachLanes(buildNetwork(base).path, parallel(base.roads))).toBe(2)
    const stub = [...base.roads, { c: 8, r: 4 }]
    expect(approachLanes(buildNetwork(base).path, stub)).toBe(1)
  })
})

describe('capacity', () => {
  it('keeps a small bank on time', () => {
    const sim = new LandsideTraffic()
    let view = sim.snapshot()
    let steppedOut = 0
    for (let t = 0; t < 90; t++) {
      view = sim.tick(1, field())
      steppedOut = Math.max(steppedOut, view.passengers.length)
    }
    expect(view.delaySec).toBeLessThan(LANDSIDE.delayGraceSec)
    expect(view.queue).toBeLessThan(1)
    expect(view.satisfactionDelta).toBe(0)
    expect(view.vehicles.length).toBeGreaterThan(0)
    expect(view.vehicles.some((car) => car.state === 'stop' || car.state === 'leave')).toBe(true)
    expect(steppedOut).toBeGreaterThan(0)
  })

  it('queues cars and nudges satisfaction once the bank outgrows the curb', () => {
    const sim = new LandsideTraffic()
    const grown = field({ departures: 14, paxPerDay: 2400 })
    let view = sim.snapshot()
    let heard = ''
    for (let t = 0; t < 120; t++) {
      view = sim.tick(1, grown)
      if (view.news) heard = view.news
    }
    expect(view.pressure).toBeGreaterThan(1)
    expect(view.queue).toBeGreaterThan(2)
    expect(view.delaySec).toBeGreaterThan(LANDSIDE.delayGraceSec)
    expect(view.satisfactionDelta).toBeLessThan(0)
    expect(heard).toMatch(/arriving late/)
    expect(view.vehicles.some((car) => car.state === 'queue')).toBe(true)
  })

  it('relieves a lane bottleneck when the player builds a parallel lane', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const before = measure(grown)
    const after = measure(grown, buildNetwork({ ...grown, roads: parallel(grown.roads) }))
    expect(after.lanes).toBeGreaterThan(before.lanes)
    expect(after.laneFlowPerMin).toBeGreaterThan(before.laneFlowPerMin)
    expect(after.delaySec).toBeLessThan(before.delaySec)
  })

  it('relieves the curb when the frontage gets longer', () => {
    const shortRoads = parallel(approach()).filter((cell) => cell.r <= 5)
    const tight = field({ departures: 10, paxPerDay: 400, roads: shortRoads })
    const short = measure(tight)
    const extended = measure(
      tight,
      buildNetwork({ ...tight, roads: longerCurb(parallel(approach())) }),
    )
    expect(extended.curbStalls).toBeGreaterThan(short.curbStalls)
    expect(extended.delaySec).toBeLessThan(short.delaySec)
  })

  it('keeps the opening book on the starter curb and overruns it once the bank has flown', () => {
    const bank = { departures: 2, paxPerDay: 160 }
    const early = measure(field({ ...bank, turns: 8 }))
    const beforeWindow = measure(field({ ...bank, turns: 44 }))
    const grownField = field({ ...bank, turns: 82 })
    const grown = measure(grownField)
    expect(early.pressure, `early ${early.pressure}`).toBeLessThan(1)
    expect(beforeWindow.pressure, `44 turns ${beforeWindow.pressure}`).toBeLessThan(1)
    expect(early.curbStalls).toBe(3)
    expect(grown.pressure, `82 turns ${grown.pressure}`).toBeGreaterThan(1)
    const bay = measure(grownField, buildNetwork({ ...grownField, busBays: [{ c: 9, r: 6 }] }))
    expect(bay.busBays).toBe(1)
    expect(bay.pressure, `bay ${bay.pressure}`).toBeLessThan(1)
    expect(bay.pressure).toBeLessThan(grown.pressure)
  })

  it('overruns the starter curb in a careful mid-game bank, and the three stamps add stalls', () => {
    const mid = field({ departures: 4, paxPerDay: 1600 })
    const bare = measure(mid)
    expect(bare.pressure).toBeGreaterThan(1)
    expect(bare.curbStalls).toBe(3 * LANDSIDE.stallsPerCurbCell)
    const bay = measure(mid, buildNetwork({ ...mid, busBays: [{ c: 9, r: 6 }] }))
    const lane = measure(mid, buildNetwork({ ...mid, curbLanes: [{ c: 8, r: 5 }] }))
    const rank = measure(mid, buildNetwork({ ...mid, taxiRanks: [{ c: 8, r: 6 }] }))
    expect(bay.curbStalls).toBe(bare.curbStalls + LANDSIDE.stallsPerBusBay)
    expect(lane.curbStalls).toBe(bare.curbStalls + LANDSIDE.stallsPerCurbLane)
    expect(lane.lanes).toBe(bare.lanes + 1)
    expect(rank.curbStalls).toBe(bare.curbStalls + LANDSIDE.stallsPerTaxiRank)
    expect(bay.pressure).toBeLessThan(bare.pressure)
    expect(lane.pressure).toBeLessThan(bare.pressure)
    expect(rank.pressure).toBeLessThan(bare.pressure)
    const built = measure(
      mid,
      buildNetwork({
        ...mid,
        busBays: [{ c: 9, r: 6 }],
        curbLanes: [{ c: 8, r: 5 }],
        taxiRanks: [{ c: 8, r: 6 }],
      }),
    )
    expect(built.pressure).toBeLessThan(1)
    expect(built.busBays).toBe(1)
    expect(built.curbLanes).toBe(1)
    expect(built.taxiRanks).toBe(1)
  })

  it('lets parking and a bus bay take cars and coaches off the curb', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const bare = measure(grown)
    const parked = measure(grown, buildNetwork({ ...grown, parks: [{ c: 9, r: 4, kind: 'park_g' }] }))
    const bay = measure(grown, buildNetwork({ ...grown, busBays: [{ c: 9, r: 6 }] }))
    expect(parked.curbVehPerMin).toBeLessThan(bare.curbVehPerMin)
    expect(parked.parkSpaces).toBe(LANDSIDE.parkSpaces.park_g)
    expect(bay.busBays).toBe(1)
    expect(bay.curbVehPerMin).toBeLessThan(bare.curbVehPerMin)
    expect(bay.modes.bus).toBeGreaterThan(0)
  })

  it('moves a share off the road once rail is open', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const road = measure(grown)
    const rail = measure({ ...grown, rail: true })
    expect(rail.modes.rail).toBeGreaterThan(0)
    expect(rail.roadVehPerMin).toBeLessThan(road.roadVehPerMin)
  })

  it('grows the arrival rate with the airport', () => {
    const quiet = measure(field({ departures: 1, paxPerDay: 40 }))
    const busy = measure(field({ departures: 12, paxPerDay: 2000 }))
    expect(busy.arrivalsPerMin).toBeGreaterThan(quiet.arrivalsPerMin * 2)
  })

  it('paints load from green through amber to red', () => {
    expect(pressureColor(0.2)).toBe('#3dbe6e')
    expect(pressureColor(0.8)).toBe('#e0b15a')
    expect(pressureColor(1.4)).toBe('#d35a4a')
  })

  it('does not teleport a car: they enter at the map edge, dwell, and leave round the loop', () => {
    const sim = new LandsideTraffic()
    const seen = new Map<string, { c: number; r: number }>()
    let sawStop = false
    let sawLeave = false
    let dwelling: string[] = []
    const dt = 0.25
    const cap = LANDSIDE.maxFrameJumpM * dt
    for (let t = 0; t < 400; t++) {
      const view = sim.tick(dt, field({ departures: 14, paxPerDay: 2400 }))
      const live = new Set(view.vehicles.map((car) => car.id))
      for (const id of dwelling) expect(live.has(id)).toBe(true)
      for (const car of view.vehicles) {
        const prev = seen.get(car.id)
        if (!prev) {
          // New cars appear at or beyond the north edge of the map, on the road.
          expect(car.r * LANDSIDE.cellM).toBeLessThanOrEqual(-0.5 * LANDSIDE.cellM + cap + 1e-6)
          expect(Math.abs(car.c - 7) * LANDSIDE.cellM).toBeLessThan(LANDSIDE.cellM / 2)
        } else {
          const hop = Math.hypot((car.c - prev.c) * LANDSIDE.cellM, (car.r - prev.r) * LANDSIDE.cellM)
          expect(hop).toBeLessThanOrEqual(cap + 1e-6)
        }
        if (car.state === 'stop') sawStop = true
        if (car.state === 'leave') sawLeave = true
        seen.set(car.id, { c: car.c, r: car.r })
      }
      dwelling = view.vehicles.filter((car) => car.state === 'stop').map((car) => car.id)
      for (const id of [...seen.keys()]) if (!live.has(id)) seen.delete(id)
    }
    expect(sawStop).toBe(true)
    expect(sawLeave).toBe(true)
    let missed = 0
    const late = new LandsideTraffic()
    for (let t = 0; t < 40; t++) missed += late.tick(1, field({ departures: 14, paxPerDay: 2400 })).missedCheckIns
    expect(missed).toBeGreaterThan(1)
    let quiet = 0
    const calm = new LandsideTraffic()
    for (let t = 0; t < 40; t++) quiet += calm.tick(1, field()).missedCheckIns
    expect(quiet).toBe(0)
  })

  it('repeats the same cars for the same field', () => {
    const grown = field({ departures: 8, paxPerDay: 900 })
    const a = new LandsideTraffic()
    const b = new LandsideTraffic()
    let left = a.snapshot()
    let right = b.snapshot()
    for (let t = 0; t < 40; t++) {
      left = a.tick(0.25, grown)
      right = b.tick(0.25, grown)
    }
    expect(left).toEqual(right)
  })
})

import { describe, expect, it } from 'vitest'
import { A380_READY_FLEET, defaultConfig, LogisticsSim, RoadGraph } from './index'
import { ApronTraffic, clearance, type TrafficVehicle } from './traffic'
import type { VehicleType } from './types'

const FLEET = { ...A380_READY_FLEET, fuel_truck: 4, catering_truck: 4, baggage_tug: 8, belt_loader: 4, gpu: 4, pax_bus: 4, pushback_tug: 3, uld_loader: 3 }

function busySim() {
  const sim = new LogisticsSim(defaultConfig({ traffic: true, vehicles: FLEET }))
  const ids = [sim.startTurnaround('heavy-1', 'a380', 120), sim.startTurnaround('stand-1', 'b738', 50), sim.startTurnaround('stand-2', 'a320neo', 50)]
  return Object.assign(sim, { ids })
}

function run(sim: LogisticsSim, minutes: number, step = 0.25) {
  let worst = Infinity
  let peak = 0
  const overlaps: string[] = []
  for (let t = 0; t < minutes; t += step) {
    sim.tick(step)
    for (const [a, b] of sim.traffic!.overlaps()) overlaps.push(`${t.toFixed(2)} ${a}~${b}`)
    const bodies = sim.traffic!.bodyList()
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) worst = Math.min(worst, clearance(bodies[i], bodies[j]))
    const atHeavy = sim.vehicles.filter((v) => (v.route ? v.route[v.route.length - 1] === 's6' : v.node === 's6') && v.phase !== 'idle').length
    peak = Math.max(peak, atHeavy)
  }
  return { worst, peak, overlaps, snapshot: JSON.stringify(sim.poses()) }
}

describe('apron traffic', () => {
  it('14 vehicles converging on one stand at once: they queue, yield and never overlap', () => {
    const cfg = defaultConfig()
    const roads = new RoadGraph(cfg.nodes, cfg.edges)
    const traffic = new ApronTraffic(roads, cfg.edges)
    const types: VehicleType[] = ['fuel_truck', 'hydrant_dispenser', 'catering_truck', 'highlift_catering', 'baggage_tug', 'baggage_tug',
      'heavy_baggage_tug', 'belt_loader', 'uld_loader', 'main_deck_loader', 'gpu', 'pushback_tug', 'pax_bus', 'pax_bus']
    const fleet: TrafficVehicle[] = types.map((type, i) => ({ id: `${type}-${i}`, type, node: 'depot', phase: 'idle', phaseEnd: Infinity, route: null }))
    for (const v of fleet) traffic.place(v)
    expect(traffic.overlaps()).toEqual([])
    let now = 0
    for (const v of fleet) {
      v.route = roads.route('depot', 's6')
      v.phase = 'to_stand'
      v.phaseEnd = now + traffic.begin(v, 's6', now, 400)
    }
    let worst = Infinity
    for (let i = 0; i < 4000 && fleet.some((v) => v.phase === 'to_stand'); i++) {
      const dt = traffic.cfg.stepMinutes
      traffic.step(fleet, dt, now + dt)
      now += dt
      for (const v of fleet) if (v.phase === 'to_stand' && v.phaseEnd <= now + 1e-9) {
        v.phase = 'servicing'
        v.node = 's6'
      }
      expect(traffic.overlaps()).toEqual([])
      const b = traffic.bodyList()
      for (let x = 0; x < b.length; x++) for (let y = x + 1; y < b.length; y++) worst = Math.min(worst, clearance(b[x], b[y]))
    }
    traffic.step(fleet, 0, now)
    expect(fleet.every((v) => v.phase === 'servicing')).toBe(true)
    expect(worst).toBeGreaterThanOrEqual(-1e-3)
    expect(traffic.stats.waits).toBeGreaterThan(0)
    // all 14 parked around the stand in distinct reserved slots
    const parked = traffic.bodyList()
    expect(parked).toHaveLength(14)
    expect(traffic.overlaps()).toEqual([])
  })

  it('full sim: three turnarounds incl. an A380, no overlap at any tick', () => {
    const sim = busySim()
    const r = run(sim, 150)
    expect(r.overlaps).toEqual([])
    expect(r.worst).toBeGreaterThanOrEqual(-1e-3)
    expect(r.peak).toBeGreaterThanOrEqual(8)
    expect(sim.traffic!.stats.waits).toBeGreaterThan(0) // somebody had to yield
    console.log('traffic', JSON.stringify({ peak: r.peak, worst: r.worst, ...sim.traffic!.stats }))
  })

  it('is deterministic', () => {
    const a = run(busySim(), 60)
    const b = run(busySim(), 60)
    expect(a.snapshot).toBe(b.snapshot)
  })

  it('still completes the turnarounds', () => {
    const sim = busySim()
    for (let i = 0; i < 4000 && sim.ids.some((id) => sim.getTurnaround(id)!.completedAt === null); i++) sim.tick(0.25)
    for (const id of sim.ids) expect(sim.getTurnaround(id)!.completedAt).not.toBeNull()
    expect(sim.traffic!.overlaps()).toEqual([])
  })

  it('two streams crossing at a junction: the later one gives way, nobody overlaps, no gridlock', () => {
    const nodes = [{ id: 'W', x: -95, y: 30 }, { id: 'J', x: -30, y: 30 }, { id: 'E', x: 95, y: 30 }, { id: 'N', x: -30, y: 110 }, { id: 'S', x: -30, y: -80 }]
    const at = (id: string) => nodes.find((n) => n.id === id)!
    const edges = [['W', 'J'], ['J', 'E'], ['N', 'J'], ['J', 'S']].map(([a, b]) => ({ a, b, length: Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y) }))
    const roads = new RoadGraph(nodes, edges)
    const traffic = new ApronTraffic(roads, edges, { stepMinutes: 0.01 })
    const plan: [VehicleType, string, string, number][] = [
      ['fuel_truck', 'W', 'E', 0], ['catering_truck', 'W', 'E', 0.07], ['belt_loader', 'W', 'E', 0.14], ['gpu', 'W', 'E', 0.2],
      ['pax_bus', 'N', 'S', 0.015], ['baggage_tug', 'N', 'S', 0.095], ['hydrant_dispenser', 'N', 'S', 0.17], ['pushback_tug', 'N', 'S', 0.24],
    ]
    const fleet = plan.map(([type, from, , dep], i) => ({ id: `v${i}`, type, node: from, phase: 'idle', phaseEnd: Infinity, route: null as string[] | null, dep, to: plan[i][2] }))
    for (const v of fleet) traffic.place(v)
    let now = 0
    for (let i = 0; i < 400; i++) {
      for (const v of fleet) if (v.phase === 'idle' && v.node !== v.to && now >= v.dep - 1e-9) {
        v.route = roads.route(v.node, v.to)
        v.phase = 'to_stand'
        v.phaseEnd = now + traffic.begin(v, v.to, now, 480)
      }
      traffic.step(fleet, 0.01, now + 0.01)
      now += 0.01
      for (const v of fleet) if (v.phase === 'to_stand' && v.phaseEnd <= now + 1e-9) {
        v.phase = 'idle'
        v.node = v.to
      }
      expect(traffic.overlaps()).toEqual([])
    }
    expect(fleet.every((v) => v.node === v.to)).toBe(true)
    expect(traffic.stats.waits).toBeGreaterThan(0)
    expect(traffic.stats.unjams).toBe(0)
  })
})

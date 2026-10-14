import { describe, expect, it } from 'vitest'
import { LogisticsSim } from './engine'
import { defaultConfig } from './defaults'
import type { LogisticsEvent } from './types'
import {
  DOCK_PHASES,
  ServiceFlow,
  anchorIdFor,
  buildingAnchors,
  gradeTurnaround,
  poseFor,
  serviceReason,
  standAnchors,
  taskLine,
  type AnchorSpec,
  type DockPhase,
} from './serviceFlow'

function yard(): { flow: ServiceFlow; fuel: AnchorSpec } {
  const fuel = standAnchors('stand-3', 'M', 1, 1).find((a) => a.kind === 'fuel_hose')!
  const buildings = buildingAnchors(
    { fuel: 'farm', kitchen: 'kitchen', makeup: 'makeup', cargo: 'cargo', terminal: 'terminal' },
    { fuelBays: 1, kitchenBays: 1, makeupBays: 2, cargoBays: 1 },
  )
  const flow = new ServiceFlow([fuel, ...buildings], { fuel_truck: 2, catering_truck: 1 })
  return { flow, fuel }
}

function walk(flow: ServiceFlow, id: string): DockPhase[] {
  const seen: DockPhase[] = []
  const note = () => {
    const phase = flow.actor(id)?.phase
    if (phase && seen[seen.length - 1] !== phase) seen.push(phase)
  }
  note()
  flow.enter(id, 'align')
  note()
  flow.enter(id, 'service')
  note()
  flow.beginDepart(id)
  note()
  flow.release(id)
  seen.push('idle')
  return seen
}

describe('service flow state machine', () => {
  it('walks idle, route, approach, align, service, depart', () => {
    const { flow, fuel } = yard()
    expect(flow.canDispatch('fuel_truck')).toBe(true)
    flow.markOut('fuel_truck-1', 'fuel_truck', serviceReason('fuel', 'ZO116', 'Stand 3'), 'T1')
    expect(flow.actor('fuel_truck-1')?.phase).toBe('route')
    expect(flow.claim('fuel_truck-1', fuel.id)).toBe('bay')
    expect(flow.actor('fuel_truck-1')?.phase).toBe('approach')
    const seen = walk(flow, 'fuel_truck-1')
    expect(seen).toEqual(['approach', 'align', 'service', 'depart', 'idle'])
    expect(DOCK_PHASES).toEqual(['idle', 'route', 'approach', 'align', 'service', 'depart'])
    expect(flow.actor('fuel_truck-1')).toBeUndefined()
  })

  it('queues at a busy point and lets the next vehicle in when the bay frees', () => {
    const { flow, fuel } = yard()
    flow.markOut('fuel_truck-1', 'fuel_truck', 'Refuel ZO116 at Stand 3', 'T1')
    flow.markOut('fuel_truck-2', 'fuel_truck', 'Refuel ZO204 at Stand 4', 'T2')
    expect(flow.claim('fuel_truck-1', fuel.id)).toBe('bay')
    expect(flow.claim('fuel_truck-2', fuel.id)).toBe('queue')
    expect(flow.actor('fuel_truck-2')).toMatchObject({ phase: 'route', queueIndex: 1 })
    flow.enter('fuel_truck-1', 'service')
    const board = flow.throughput().find((t) => t.id === fuel.id)!
    expect(board).toMatchObject({ bays: 1, inUse: 1, queued: 1, unitsPerMin: board.ratePerBay })
    flow.accrue(4)
    expect(flow.queuedMinutes('T2')).toBeCloseTo(4)
    const next = flow.release('fuel_truck-1')
    expect(next).toBe('fuel_truck-2')
    expect(flow.actor('fuel_truck-2')).toMatchObject({ phase: 'approach', queueIndex: 0 })
    const after = flow.throughput().find((t) => t.id === fuel.id)!
    expect(after.inUse).toBe(0)
    expect(after.queued).toBe(0)
    expect(after.unitsPerMin).toBe(0)
  })

  it('throughput follows bays in service, not empty bays', () => {
    const hold = standAnchors('stand-3', 'M')[2]
    expect(hold.kind).toBe('baggage_hold')
    expect(hold.bays).toBe(2)
    const flow = new ServiceFlow([hold], { baggage_tug: 3, belt_loader: 1 })
    flow.markOut('belt_loader-1', 'belt_loader', 'Bags for ZO116 at Stand 3', 'T1')
    flow.markOut('baggage_tug-1', 'baggage_tug', 'Bags for ZO116 at Stand 3', 'T1')
    flow.markOut('baggage_tug-2', 'baggage_tug', 'Bags for ZO204 at Stand 4', 'T2')
    expect(flow.claim('belt_loader-1', hold.id)).toBe('bay')
    expect(flow.claim('baggage_tug-1', hold.id)).toBe('bay')
    expect(flow.claim('baggage_tug-2', hold.id)).toBe('queue')
    flow.enter('belt_loader-1', 'service')
    flow.enter('baggage_tug-1', 'service')
    const one = flow.throughput().find((t) => t.id === hold.id)!
    expect(one.inUse).toBe(2)
    expect(one.unitsPerMin).toBe(2 * one.ratePerBay)
    expect(one.queued).toBe(1)
    flow.enter('belt_loader-1', 'depart')
    const leaving = flow.throughput().find((t) => t.id === hold.id)!
    expect(leaving.inUse).toBe(1)
    expect(leaving.unitsPerMin).toBe(leaving.ratePerBay)
  })

  it('fleet cap keeps spare trucks in the depot', () => {
    const { flow } = yard()
    expect(flow.canDispatch('catering_truck')).toBe(true)
    flow.markOut('catering_truck-1', 'catering_truck', 'Cater ZO116 at Stand 3', 'T1')
    expect(flow.canDispatch('catering_truck')).toBe(false)
    expect(flow.canDispatch('fuel_truck')).toBe(true)
    flow.markOut('fuel_truck-1', 'fuel_truck', 'Refuel ZO116 at Stand 3', 'T1')
    expect(flow.canDispatch('fuel_truck')).toBe(true)
    flow.markOut('fuel_truck-2', 'fuel_truck', 'Refuel ZO204 at Stand 4', 'T2')
    expect(flow.canDispatch('fuel_truck')).toBe(false)
    flow.release('fuel_truck-1')
    expect(flow.canDispatch('fuel_truck')).toBe(true)
  })

  it('parks a queued truck behind the stop line', () => {
    const fuel = standAnchors('stand-3', 'L', 2)[0]
    const first = poseFor(fuel, 'service', 1, 0)
    const waiting = poseFor(fuel, 'route', 1, 2)
    expect(Math.hypot(waiting.localX - first.localX, waiting.localY - first.localY)).toBeGreaterThan(20)
    const shove = poseFor(fuel, 'service', 1, 0)
    expect(shove.rollM).toBe(0)
    const tug = standAnchors('stand-3', 'M').find((a) => a.kind === 'pushback')!
    const pushed = poseFor(tug, 'service', 1, 0)
    expect(pushed.rollM).toBeGreaterThan(5)
    expect(pushed.localX).toBeLessThan(tug.x)
  })

  it('names the job and grades the turn', () => {
    expect(serviceReason('fuel', 'ZO116', 'Stand 3')).toBe('Refuel ZO116 at Stand 3')
    expect(taskLine('Refuel ZO116 at Stand 3', 'service', 0)).toBe('Refuel ZO116 at Stand 3 — on the job')
    expect(taskLine('Refuel ZO116 at Stand 3', 'route', 2)).toBe('Refuel ZO116 at Stand 3 — waiting, 2 ahead')
    expect(gradeTurnaround({ scheduledMin: 45, actualMin: 40, queuedMin: 0 }).grade).toBe('A')
    expect(gradeTurnaround({ scheduledMin: 45, actualMin: 44, queuedMin: 6 }).grade).toBe('B')
    expect(gradeTurnaround({ scheduledMin: 40, actualMin: 43, queuedMin: 0 }).grade).toBe('C')
    expect(gradeTurnaround({ scheduledMin: 40, actualMin: 48, queuedMin: 0 }).grade).toBe('D')
    expect(gradeTurnaround({ scheduledMin: 40, actualMin: 55, queuedMin: 0 }).grade).toBe('E')
    expect(gradeTurnaround({ scheduledMin: 40, actualMin: 70, queuedMin: 10 }).grade).toBe('F')
    expect(anchorIdFor('stand-3', 'fuel', 'source')).toBe('building:fuel')
    expect(anchorIdFor('stand-3', 'loader', 'stand')).toBe('stand:stand-3:hold')
  })
})

describe('service flow on the logistics sim', () => {
  it('queues the second tanker at a one-bay farm and tags the job', () => {
    const events: LogisticsEvent[] = []
    const sim = new LogisticsSim(
      defaultConfig({
        docks: { fuelBays: 1, kitchenBays: 2, makeupBays: 2, cargoBays: 2, terminalBays: 2 },
        vehicles: {
          fuel_truck: 2,
          catering_truck: 1,
          baggage_tug: 2,
          pushback_tug: 1,
          belt_loader: 1,
          gpu: 1,
        },
      }),
    )
    sim.on((e) => events.push(e))
    sim.startTurnaround('stand-2', 'b738', 90, { callsign: 'ZO116' })
    sim.startTurnaround('stand-3', 'b738', 90, { callsign: 'ZO204' })
    let sawQueue = false
    for (let i = 0; i < 400; i++) {
      sim.tick(0.5)
      if (sim.vehicles.some((v) => v.type === 'fuel_truck' && v.phase === 'queued')) sawQueue = true
      if (sawQueue) break
    }
    expect(sawQueue).toBe(true)
    const tagged = sim.tasks().some((t) => t.reason.includes('ZO116') || t.reason.includes('ZO204'))
    expect(tagged).toBe(true)
    const farm = sim.dockReport().find((d) => d.id === 'building:fuel')
    expect(farm?.bays).toBe(1)
    expect((farm?.queued ?? 0) + (farm?.inUse ?? 0)).toBeGreaterThan(0)
  })

  it('keeps a capped fuel truck in the depot', () => {
    const sim = new LogisticsSim(
      defaultConfig({
        docks: { fuelBays: 2, fleetCap: { fuel_truck: 1 } },
        vehicles: { fuel_truck: 2, catering_truck: 1, baggage_tug: 1, pushback_tug: 1, belt_loader: 1, gpu: 1 },
      }),
    )
    sim.startTurnaround('stand-2', 'b738', 80, { callsign: 'ZO116' })
    sim.startTurnaround('stand-3', 'b738', 80, { callsign: 'ZO204' })
    for (let i = 0; i < 80; i++) sim.tick(0.5)
    const out = sim.vehicles.filter((v) => v.type === 'fuel_truck' && v.phase !== 'idle')
    expect(out.length).toBeLessThanOrEqual(1)
  })

  it('posts an A–F grade when the turn finishes', () => {
    const events: LogisticsEvent[] = []
    const sim = new LogisticsSim(
      defaultConfig({
        docks: { fuelBays: 2, kitchenBays: 2, makeupBays: 3, cargoBays: 2, terminalBays: 2 },
        vehicles: {
          fuel_truck: 2,
          catering_truck: 1,
          baggage_tug: 3,
          pushback_tug: 1,
          belt_loader: 1,
          gpu: 1,
          pax_bus: 1,
        },
      }),
    )
    sim.on((e) => events.push(e))
    const id = sim.startTurnaround('stand-2', 'e175', 400, { callsign: 'ZO116' })
    for (let i = 0; i < 2500 && !events.some((e) => e.type === 'turnaround_complete'); i++) sim.tick(1)
    const done = events.find((e) => e.type === 'turnaround_complete' && e.turnaroundId === id)
    // Three bag tugs and one belt share a two-bay hold, so somebody waits.
    // The slot was long enough to absorb it: the letter records the queue, not a miss.
    expect(done && done.type === 'turnaround_complete' && done.grade).toBe('B')
    expect(done && done.type === 'turnaround_complete' && done.gradeNote).toBe('Made the slot, with a bay queue')
  })
})

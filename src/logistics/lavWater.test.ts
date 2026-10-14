import { describe, expect, it } from 'vitest'
import { LogisticsSim, defaultConfig, type LogisticsEvent } from './index'
import { lavWaterMinutes } from './engine'
import { DEPOT_GRANT, TIER_FREE } from '../scale/data'

const FLEET = { fuel_truck: 2, catering_truck: 2, baggage_tug: 6, pushback_tug: 2, gpu: 3, pax_bus: 3, belt_loader: 3, uld_loader: 2 }

function setup(extra: Record<string, number>) {
  const sim = new LogisticsSim(defaultConfig({ vehicles: { ...FLEET, ...extra } }))
  const ev: LogisticsEvent[] = []
  sim.on((e) => ev.push(e))
  return { sim, ev }
}

function find(ev: LogisticsEvent[], type: 'service_start' | 'service_done', s: string): number | undefined {
  return ev.find((x) => x.type === type && (x as { service?: string }).service === s)?.time
}

describe('Round F: lavatory and water trucks', () => {
  it('drive to the stand, dock, service and leave during the turnaround', () => {
    const { sim, ev } = setup({ lavatory_truck: 1, water_truck: 1 })
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    const phases = new Map<string, Set<string>>()
    for (let i = 0; i < 3000 && sim.getTurnaround(id)!.completedAt === null; i++) {
      sim.tick(1)
      for (const p of sim.poses()) {
        if (p.type !== 'lavatory_truck' && p.type !== 'water_truck') continue
        const set = phases.get(p.type) ?? new Set()
        set.add(p.phase)
        phases.set(p.type, set)
      }
    }
    expect(sim.getTurnaround(id)!.completedAt).not.toBeNull()
    const deplaned = find(ev, 'service_done', 'deplane')!
    for (const s of ['lav', 'water']) {
      expect(find(ev, 'service_start', s)).toBeGreaterThanOrEqual(deplaned)
      expect(find(ev, 'service_done', s)).toBeDefined()
    }
    for (const type of ['lavatory_truck', 'water_truck']) {
      const seen = phases.get(type)!
      expect(seen.has('to_stand')).toBe(true)
      expect(seen.has('servicing')).toBe(true)
    }
    // trucks are back off the stand when the turn completes
    for (const p of sim.poses()) if (p.type === 'lavatory_truck' || p.type === 'water_truck') expect(p.phase).not.toBe('servicing')
  })

  it('crew list reports lav / water stops while docked', () => {
    const { sim } = setup({ lavatory_truck: 1, water_truck: 1 })
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    const seen = new Set<string>()
    for (let i = 0; i < 3000 && sim.getTurnaround(id)!.completedAt === null; i++) {
      sim.tick(1)
      for (const c of sim.activeCrew()) seen.add(c.service)
    }
    expect(seen.has('lav')).toBe(true)
    expect(seen.has('water')).toBe(true)
  })

  it('is opt-in: a fleet without the trucks never asks for them', () => {
    const { sim, ev } = setup({})
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    for (let i = 0; i < 3000 && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(1)
    expect(sim.getTurnaround(id)!.completedAt).not.toBeNull()
    expect(find(ev, 'service_start', 'lav')).toBeUndefined()
    expect(find(ev, 'service_start', 'water')).toBeUndefined()
  })

  it('freighters get no lav / water stop', () => {
    const { sim, ev } = setup({ lavatory_truck: 1, water_truck: 1 })
    const id = sim.startTurnaround('stand-2', 'b748f', 90)
    for (let i = 0; i < 3000 && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(1)
    expect(find(ev, 'service_start', 'lav')).toBeUndefined()
  })

  it('depot grants one of each and they serve any size', () => {
    expect(DEPOT_GRANT.lavatory_truck).toBe(1)
    expect(DEPOT_GRANT.water_truck).toBe(1)
    expect(TIER_FREE).toContain('lavatory_truck')
    expect(lavWaterMinutes(25)).toBe(13)
    expect(lavWaterMinutes(2)).toBe(4)
  })
})

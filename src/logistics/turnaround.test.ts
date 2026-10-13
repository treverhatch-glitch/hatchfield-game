import { describe, expect, it } from 'vitest'
import { LogisticsSim, createLogisticsAdapter, defaultConfig, needsFor, type LogisticsEvent, type ServiceKind } from './index'

function setup(over: Parameters<typeof defaultConfig>[0] = {}) {
  const sim = new LogisticsSim(defaultConfig(over))
  const ev: LogisticsEvent[] = []
  sim.on((e) => ev.push(e))
  return { sim, ev }
}

function run(sim: LogisticsSim, id: string, step = 1, max = 3000): void {
  for (let i = 0; i < max && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(step)
}

function at(ev: LogisticsEvent[], type: 'service_start' | 'service_done', s: ServiceKind): number {
  const e = ev.find((x) => x.type === type && x.service === s)
  if (!e) throw new Error(`no ${type} ${s}`)
  return e.time
}

function sum(ev: LogisticsEvent[], type: 'pax_deplaned' | 'bags_to_claim'): number {
  return ev.reduce((a, e) => a + (e.type === type ? e.count : 0), 0)
}

function done(ev: LogisticsEvent[]) {
  const e = ev.find((x) => x.type === 'turnaround_complete')
  if (!e || e.type !== 'turnaround_complete') throw new Error('not complete')
  return e
}

describe('turnaround phase order', () => {
  it('deplane, then cleaning/catering/fuel, then boarding, door close, pushback', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    run(sim, id)
    const deplaned = at(ev, 'service_done', 'deplane')
    for (const s of ['fuel', 'catering', 'cleaning'] as ServiceKind[]) expect(at(ev, 'service_start', s)).toBeGreaterThanOrEqual(deplaned)
    const board = at(ev, 'service_start', 'boarding')
    for (const s of ['fuel', 'catering', 'cleaning'] as ServiceKind[]) expect(board).toBeGreaterThanOrEqual(at(ev, 'service_done', s))
    const door = at(ev, 'service_start', 'door_close')
    for (const s of ['boarding', 'bag_load', 'cargo_load'] as ServiceKind[]) expect(door).toBeGreaterThanOrEqual(at(ev, 'service_done', s))
    expect(at(ev, 'service_done', 'pushback')).toBeGreaterThanOrEqual(at(ev, 'service_done', 'door_close'))
    expect(done(ev).time).toBe(at(ev, 'service_done', 'pushback'))
  })

  it('unloading overlaps deplaning and loading waits for an empty hold', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    run(sim, id)
    expect(at(ev, 'service_start', 'bag_unload')).toBe(0)
    expect(at(ev, 'service_start', 'bag_load')).toBeGreaterThanOrEqual(at(ev, 'service_done', 'bag_unload'))
    expect(at(ev, 'service_start', 'bag_load')).toBeGreaterThanOrEqual(at(ev, 'service_done', 'cargo_unload'))
  })

  it('fuelling with passengers on board only with the safety flag', () => {
    const base = defaultConfig()
    const flagged = setup({ pax: { ...base.pax, fuelWithPaxOnBoard: true } })
    const id = flagged.sim.startTurnaround('stand-1', 'a320neo', 90)
    run(flagged.sim, id)
    expect(at(flagged.ev, 'service_start', 'fuel')).toBe(0)
    const off = setup()
    const id2 = off.sim.startTurnaround('stand-1', 'a320neo', 90)
    run(off.sim, id2)
    expect(at(off.ev, 'service_start', 'fuel')).toBeGreaterThan(0)
    expect(at(off.ev, 'service_start', 'fuel')).toBeCloseTo(at(off.ev, 'service_done', 'deplane'))
  })
})

describe('passengers', () => {
  it('pax counts follow seats x load factor', () => {
    const { sim } = setup()
    const id = sim.startTurnaround('stand-2', 'a321', 90, { loadFactor: 0.9 })
    const t = sim.getTurnaround(id)!
    expect(t.pax.arriving).toBe(Math.round(220 * 0.9))
    expect(t.pax.booked).toBe(Math.round(220 * 0.9))
    expect(sim.getTurnaround(sim.startTurnaround('stand-3', 'a321', 90, { departingPax: 999 }))!.pax.booked).toBe(220)
  })

  it('widebody deplanes faster on a two-door bridge than on stairs', () => {
    const a = setup()
    a.sim.startTurnaround('stand-2', 'a359', 120)
    a.sim.tick(60)
    const b = setup()
    b.sim.startTurnaround('stand-3', 'a359', 120)
    b.sim.tick(60)
    const pax = Math.round(325 * 0.8)
    expect(at(a.ev, 'service_done', 'deplane')).toBeCloseTo(pax / 36)
    expect(at(b.ev, 'service_done', 'deplane')).toBeCloseTo(pax / 24)
  })

  it('remote stand moves everyone by bus', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('remote-1', 'b738', 120)
    run(sim, id)
    const t = sim.getTurnaround(id)!
    expect(ev.some((e) => e.type === 'truck_arrive' && e.vehicle === 'pax_bus')).toBe(true)
    expect(sum(ev, 'pax_deplaned')).toBe(t.pax.arriving)
    expect(ev.filter((e) => e.type === 'pax_deplaned').length).toBeGreaterThanOrEqual(Math.ceil(t.pax.arriving / 60))
    expect(t.pax.boarded).toBe(t.pax.atGate)
  })

  it('remote stand with a tight schedule reports no_bridge', () => {
    const { sim, ev } = setup()
    sim.startTurnaround('remote-1', 'b738', 50)
    for (let i = 0; i < 300; i++) sim.tick(1)
    expect(done(ev).causes).toContain('no_bridge')
  })

  it('boarding groups meter the flow', () => {
    const { sim } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120)
    const t = sim.getTurnaround(id)!
    while (t.pax.boardingStart === null) sim.tick(0.5)
    sim.tick(t.pax.boardingStart! + 2.9 - sim.now)
    expect(t.pax.boarded).toBeLessThanOrEqual(t.pax.groupSizes[0] + 1e-6)
    sim.tick(3)
    expect(t.pax.boarded).toBeGreaterThan(t.pax.groupSizes[0])
  })

  it('fallback: no-shows are offloaded at gate close and their bags pulled', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120)
    run(sim, id)
    const t = sim.getTurnaround(id)!
    const off = ev.find((e) => e.type === 'pax_offloaded')!
    expect(off.type === 'pax_offloaded' && off.count).toBe(t.pax.noShows)
    expect(off.type === 'pax_offloaded' && off.bags).toBe(t.bags.noShowBags)
    expect(t.bags.offloaded).toBe(t.bags.noShowBags)
    expect(t.bags.loaded).toBe(t.bags.expected - t.bags.noShowBags)
    expect(at(ev, 'service_done', 'bag_offload')).toBeLessThanOrEqual(at(ev, 'service_done', 'pushback'))
  })

  it('a big no-show bag pull delays pushback with bag_offload', () => {
    const base = defaultConfig()
    const { sim, ev } = setup({ pax: { ...base.pax, noShowRate: 0.1 } })
    const id = sim.startTurnaround('stand-2', 'b738', 120)
    run(sim, id)
    expect(done(ev).delayMinutes).toBeGreaterThan(0)
    expect(done(ev).causes).toContain('bag_offload')
  })

  it('gate feed: ids are de-duplicated, missing pax offloaded at close', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120, { gateFeed: true, departingPax: 10 })
    const t = sim.getTurnaround(id)!
    expect(t.pax.atGate).toBe(0)
    expect(sim.paxArrivedAtGate('stand-2', ['p1', 'p2', 'p2', 'p3'])).toBe(3)
    expect(sim.paxArrivedAtGate('stand-2', ['p3', 'p4'])).toBe(1)
    expect(sim.paxArrivedAtGate('stand-2', 50)).toBe(6)
    expect(t.pax.atGate).toBe(10)
    const id2 = sim.startTurnaround('stand-3', 'b738', 120, { gateFeed: true, departingPax: 100 })
    sim.paxArrivedAtGate('stand-3', 90)
    run(sim, id2)
    const t2 = sim.getTurnaround(id2)!
    expect(t2.pax.boarded).toBe(90)
    expect(t2.pax.offloaded).toBe(10)
    expect(ev.some((e) => e.type === 'pax_offloaded' && e.standId === 'stand-3' && e.count === 10)).toBe(true)
    expect(sim.paxArrivedAtGate('stand-3', 5)).toBe(0)
  })

  it('late passengers past gate close are reported as late_pax', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 70, { gateFeed: true, departingPax: 150 })
    const t = sim.getTurnaround(id)!
    sim.paxArrivedAtGate('stand-2', 60)
    while (sim.now < t.cutoff - 0.5) sim.tick(0.5)
    sim.paxArrivedAtGate('stand-2', 90)
    run(sim, id, 0.5)
    expect(t.pax.boarded).toBe(150)
    expect(done(ev).causes).toContain('late_pax')
  })

  it('first gate-feed call takes over from the fallback model', () => {
    const { sim } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120)
    const t = sim.getTurnaround(id)!
    expect(t.pax.atGate).toBeGreaterThan(0)
    sim.paxArrivedAtGate('stand-2', 5)
    expect(t.pax.fed).toBe(true)
    expect(t.pax.atGate).toBe(5)
    expect(t.pax.arrivals).toHaveLength(0)
  })
})

describe('baggage and cargo', () => {
  it('inbound only: unload bags to claim and cargo to the shed, no boarding', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 90, { kind: 'inbound' })
    run(sim, id)
    const t = sim.getTurnaround(id)!
    expect(t.services.boarding).toBeUndefined()
    expect(t.services.pushback).toBeUndefined()
    expect(sum(ev, 'bags_to_claim')).toBe(t.bags.inbound)
    const kg = ev.reduce((a, e) => a + (e.type === 'cargo_to_area' ? e.kg : 0), 0)
    expect(kg).toBe(t.cargoIn)
    expect(t.bags.inbound).toBe(Math.round(t.pax.arriving * 0.9))
  })

  it('outbound only: loads bags and cargo, nothing to claim', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 90, { kind: 'outbound' })
    run(sim, id)
    const t = sim.getTurnaround(id)!
    expect(t.services.deplane).toBeUndefined()
    expect(sum(ev, 'bags_to_claim')).toBe(0)
    expect(t.cargoLoaded).toBe(t.cargoOut)
    expect(t.pax.boarded).toBe(t.pax.atGate)
  })

  it('tug trips are limited by cart capacity', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120, { kind: 'inbound', inboundBags: 250 })
    run(sim, id)
    const trips = ev.filter((e) => e.type === 'bags_to_claim')
    expect(trips).toHaveLength(3)
    expect(trips.every((e) => e.type === 'bags_to_claim' && e.count <= 120)).toBe(true)
  })

  it('belt loader for narrowbodies, ULD loader for widebodies and big freighters', () => {
    const nb = setup()
    nb.sim.startTurnaround('stand-2', 'a320neo', 90)
    nb.sim.tick(10)
    expect(nb.ev.some((e) => e.type === 'truck_arrive' && e.vehicle === 'belt_loader')).toBe(true)
    const wb = setup()
    wb.sim.startTurnaround('stand-2', 'b789', 120)
    wb.sim.tick(10)
    expect(wb.ev.some((e) => e.type === 'truck_arrive' && e.vehicle === 'uld_loader')).toBe(true)
    expect(needsFor('b748f').loader).toBe('uld_loader')
    expect(needsFor('crj700').loader).toBe('belt_loader')
    expect(needsFor('aw139').loader).toBeNull()
  })

  it('freighters are cargo-only', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-4', 'b748f', 180)
    run(sim, id)
    const t = sim.getTurnaround(id)!
    expect(t.pax.arriving + t.pax.booked).toBe(0)
    expect(t.bags.inbound + t.bags.expected).toBe(0)
    expect(t.cargoIn).toBe(137000 * 0.8)
    expect(t.cargoLoaded).toBe(t.cargoOut)
    expect(ev.some((e) => e.type === 'service_start' && e.service === 'boarding')).toBe(false)
  })

  it('bags per pax scale with sector type', () => {
    expect(needsFor('crj700').bagsPerPax).toBeLessThan(needsFor('b738').bagsPerPax)
    expect(needsFor('b738').bagsPerPax).toBeLessThan(needsFor('a380').bagsPerPax)
    expect(needsFor('b748f').bagsPerPax).toBe(0)
  })

  it('bag feed: bags not at make-up by gate close are left behind', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 120, { bagFeed: true, outboundBags: 100 })
    sim.bagsReadyAtMakeup('stand-2', ['b1', 'b2', 'b2'])
    sim.bagsReadyAtMakeup('stand-2', 80)
    run(sim, id)
    const t = sim.getTurnaround(id)!
    expect(ev.some((e) => e.type === 'bags_left_behind' && e.count === 18)).toBe(true)
    expect(t.bags.loaded).toBeLessThanOrEqual(82)
  })

  it('late bags pushing loading past gate close report late_bags', () => {
    const { sim, ev } = setup()
    const id = sim.startTurnaround('stand-2', 'b738', 70, { bagFeed: true, gateFeed: true, departingPax: 100, outboundBags: 200 })
    const t = sim.getTurnaround(id)!
    sim.paxArrivedAtGate('stand-2', 100)
    sim.bagsReadyAtMakeup('stand-2', 20)
    while (sim.now < t.cutoff - 1) sim.tick(0.5)
    sim.bagsReadyAtMakeup('stand-2', 180)
    run(sim, id, 0.5)
    expect(done(ev).causes).toContain('late_bags')
  })

  it('a shared single loader shows up as no_loader', () => {
    const { sim, ev } = setup({ vehicles: { ...defaultConfig().vehicles, belt_loader: 1 } })
    sim.startTurnaround('stand-2', 'b738', 45)
    const b = sim.startTurnaround('stand-3', 'b738', 45)
    run(sim, b)
    const late = ev.find((e) => e.type === 'turnaround_complete' && e.turnaroundId === b)!
    expect(late.type === 'turnaround_complete' && late.causes).toContain('no_loader')
  })
})

describe('adapter terminal hooks', () => {
  it('routes deplaned pax, claim bags and cargo; feeds gate pax', () => {
    const log: string[] = []
    let claim = 0
    const ad = createLogisticsAdapter({
      gateFeed: true,
      onPaxDeplaned: (s, n) => log.push(`pax ${s} ${n}`),
      onBagsToClaim: (_s, n) => (claim += n),
      onCargoToArea: (s, kg) => log.push(`cargo ${s} ${kg}`),
      onPaxOffloaded: (s, n) => log.push(`off ${s} ${n}`),
    })
    ad.onAircraftParked('stand-2', 'b738', 120, { departingPax: 40 })
    expect(ad.sim.turnaroundAt('stand-2')!.pax.fed).toBe(true)
    expect(ad.paxArrivedAtGate('stand-2', 38)).toBe(38)
    expect(ad.bagsReadyAtMakeup('stand-2', 5)).toBe(5)
    for (let i = 0; i < 300 && !ad.isReadyToDepart('stand-2'); i++) ad.tick(1)
    expect(ad.isReadyToDepart('stand-2')).toBe(true)
    expect(log).toContain(`pax stand-2 ${Math.round(189 * 0.8)}`)
    expect(log.some((l) => l.startsWith('cargo stand-2'))).toBe(true)
    expect(log).toContain('off stand-2 2')
    expect(claim).toBe(ad.sim.getTurnaround('T1')!.bags.inbound)
  })
})

describe('determinism with pax, bags and buses', () => {
  function scenario(step: number): string {
    const { sim, ev } = setup()
    sim.startTurnaround('remote-1', 'a321', 70)
    sim.startTurnaround('stand-2', 'b789', 90)
    sim.startTurnaround('stand-3', 'crj700', 50, { kind: 'outbound' })
    sim.startTurnaround('stand-4', 'b763f', 80)
    for (let t = 0; t < 400; t += step) sim.tick(step)
    return JSON.stringify(
      ev.filter((e) => e.type !== 'money'),
      (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v),
    )
  }
  it('independent of tick size', () => {
    const a = scenario(0.25)
    expect(scenario(1)).toBe(a)
    expect(scenario(7)).toBe(a)
    expect(scenario(100)).toBe(a)
  })
})

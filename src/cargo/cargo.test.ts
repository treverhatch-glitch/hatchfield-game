import { describe, expect, it, vi } from 'vitest'
import {
  CargoSim,
  HANDLING_UNITS,
  airframeCargoProfile,
  createCargoAdapter,
  registerCargoFlow,
  starterCargoTerminal,
  type CargoFlowLinkDef,
  type CargoFlowNodeDef,
} from './index.ts'

describe('cargo units and airframes', () => {
  it('uses real ULD mass limits and heavy-freighter payloads', () => {
    expect(HANDLING_UNITS.ake.maxGrossTonnes).toBe(1.588)
    expect(HANDLING_UNITS.ake.tareTonnes).toBe(0.082)
    expect(HANDLING_UNITS.pmc.maxGrossTonnes).toBe(6.8)
    expect(airframeCargoProfile('b748f').capacityTonnes).toBe(133.9)
    expect(airframeCargoProfile('an124').capacityTonnes).toBe(120)
  })
})

describe('CargoSim', () => {
  it('moves a staffed contract through truck, customs, screening, warehouse and build-up', () => {
    const sim = new CargoSim(starterCargoTerminal())
    const contract = sim.acceptContract({
      id: 'express-1',
      kind: 'express',
      tonnes: 12,
      deadline: 600,
    })

    sim.tick(180)
    const before = sim.snapshot()
    expect(contract.deliveredTonnes).toBeCloseTo(12)
    expect(before.facilities.find((facility) => facility.id === 'ready')?.queuedTonnes).toBeCloseTo(12)

    const load = sim.planFlight({
      id: 'belly-1',
      airframeId: 'b789',
      mode: 'belly',
      capacityTonnes: 10,
      supportedUnits: ['ake', 'loose'],
    })
    expect(load.tonnes).toBeCloseTo(10)
    expect(load.units).toBe(7)

    sim.confirmFlightDeparted('belly-1')
    expect(contract.shippedTonnes).toBeCloseTo(10)
    expect(contract.revenueEarned).toBeCloseTo(33_500)

    const second = sim.planFlight({
      id: 'belly-2',
      airframeId: 'b789',
      mode: 'belly',
      capacityTonnes: 10,
      supportedUnits: ['ake'],
    })
    expect(second.tonnes).toBeCloseTo(2)
    sim.confirmFlightDeparted('belly-2')
    expect(contract.status).toBe('fulfilled')
  })

  it('charges a per-tonne penalty on cargo not flown by its deadline', () => {
    const sim = new CargoSim(starterCargoTerminal())
    const money: number[] = []
    sim.on((event) => {
      if (event.type === 'money') money.push(event.amount)
    })
    const contract = sim.acceptContract({
      id: 'late-1',
      kind: 'perishable',
      tonnes: 8,
      deadline: 10,
    })

    sim.tick(10)
    expect(contract.status).toBe('failed')
    expect(contract.penaltyPaid).toBe(8 * 2600)
    expect(money).toEqual([-8 * 2600])
  })

  it('keeps oversize freight off belly flights and requests the logistics loader fallback', () => {
    const sim = new CargoSim(starterCargoTerminal())
    sim.acceptContract({
      id: 'oversize-1',
      kind: 'oversize',
      tonnes: 20,
      deadline: 800,
    })
    sim.tick(200)

    const belly = sim.planFlight({
      id: 'belly',
      airframeId: 'b789',
      mode: 'belly',
      capacityTonnes: 20,
      supportedUnits: ['ake', 'loose'],
    })
    expect(belly.tonnes).toBe(0)
    expect(belly.rejected[0]?.reason).toContain('freighter')

    const noLoader = sim.planFlight({
      id: 'an-no-loader',
      airframeId: 'an124',
      mode: 'freighter',
      capacityTonnes: 120,
      supportedUnits: ['oversize_piece'],
      mainDeckLoaderAvailable: false,
    })
    expect(noLoader.tonnes).toBeCloseTo(20)
    expect(noLoader.requiredLoader).toBe('uld_loader')
    sim.cancelFlight('an-no-loader')

    const loaded = sim.planFlight({
      id: 'an-loaded',
      airframeId: 'an124',
      mode: 'freighter',
      capacityTonnes: 120,
      supportedUnits: ['oversize_piece'],
      mainDeckLoaderAvailable: true,
    })
    expect(loaded.tonnes).toBeCloseTo(20)
    expect(loaded.units).toBe(1)
    expect(loaded.requiredLoader).toBe('main_deck_loader')
  })

  it('reports understaffing through stable design-advisor hooks', () => {
    const config = starterCargoTerminal()
    const screening = config.facilities.find((facility) => facility.id === 'screening')
    if (!screening) throw new Error('test config missing screening')
    screening.staffAssigned = 0
    const sim = new CargoSim(config)
    sim.acceptContract({ id: 'blocked', kind: 'general', tonnes: 30, deadline: 600 })
    sim.tick(90)

    const bottleneck = sim.detectBottlenecks().find((entry) => entry.stage === 'screening')
    expect(bottleneck?.reason).toBe('understaffed')
    expect(bottleneck?.fixes.staff).toContain('3 more')
  })

  it('adapts money, logistics payloads and flow registration without importing their modules', () => {
    const addMoney = vi.fn()
    const adapter = createCargoAdapter({ addMoney })
    adapter.acceptContract({ id: 'adapter-1', kind: 'general', tonnes: 5, deadline: 500 })
    adapter.tick(160)
    const load = adapter.prepareFlight('flight-1', 'b789', { capacityTonnes: 5 })
    expect(load.tonnes).toBeCloseTo(5)
    adapter.flightDeparted('flight-1')
    expect(addMoney).toHaveBeenCalledWith(12_350, 'cargo_revenue', 'adapter-1')

    const nodes: CargoFlowNodeDef[] = []
    const links: CargoFlowLinkDef[] = []
    registerCargoFlow({
      addNode: (definition) => nodes.push(definition),
      addLink: (definition) => links.push(definition),
    })
    expect(nodes.map((node) => node.id)).toContain('cargo:screening')
    expect(nodes.map((node) => node.id)).toContain('cargo:warehouse')
    expect(links).toHaveLength(7)
  })

  it('shares the configured truck fleet across contracts and returns failed freight', () => {
    const sim = new CargoSim(starterCargoTerminal())
    sim.acceptContract({ id: 'fleet-a', kind: 'general', tonnes: 80, deadline: 10 })
    sim.acceptContract({ id: 'fleet-b', kind: 'general', tonnes: 80, deadline: 10 })
    const arrivals = sim.snapshot().trucks.map((truck) => truck.arrivesAt)

    expect(new Set(arrivals.slice(0, 4)).size).toBe(4)
    expect(Math.min(...arrivals.slice(4))).toBeGreaterThan(Math.max(...arrivals.slice(0, 4)))

    sim.tick(10)
    const snapshot = sim.snapshot()
    expect(snapshot.contracts.every((contract) => contract.returnedTonnes === 80)).toBe(true)
    expect(snapshot.facilities.reduce((sum, facility) => sum + facility.queuedTonnes, 0)).toBe(0)
    expect(snapshot.trucks.every((truck) => truck.status === 'departed')).toBe(true)
  })

  it('rejects non-finite values before they can corrupt or hang the simulation', () => {
    const sim = new CargoSim(starterCargoTerminal())
    expect(() =>
      sim.acceptContract({ id: 'infinite', kind: 'general', tonnes: Number.POSITIVE_INFINITY, deadline: 100 }),
    ).toThrow(/finite/)
    expect(() =>
      sim.acceptContract({ id: 'nan', kind: 'general', tonnes: Number.NaN, deadline: 100 }),
    ).toThrow(/finite/)
    expect(() =>
      sim.planFlight({
        id: 'bad-flight',
        airframeId: 'b748f',
        mode: 'freighter',
        capacityTonnes: Number.POSITIVE_INFINITY,
        supportedUnits: ['ake'],
      }),
    ).toThrow(/finite/)
  })
})

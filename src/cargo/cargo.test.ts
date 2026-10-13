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

  it('penalizes only uncommitted tonnes when a partial load met cutoff', () => {
    const sim = new CargoSim(starterCargoTerminal())
    const contract = sim.acceptContract({
      id: 'partial-cutoff',
      kind: 'general',
      tonnes: 10,
      deadline: 200,
    })
    sim.tick(180)
    const load = sim.planFlight({
      id: 'partial-flight',
      airframeId: 'b789',
      mode: 'belly',
      capacityTonnes: 5,
      supportedUnits: ['ake'],
    })
    expect(load.tonnes).toBeCloseTo(5)

    sim.tick(20)
    expect(contract.returnedTonnes).toBeCloseTo(5)
    expect(contract.penaltyPaid).toBeCloseTo(4_500)
    expect(sim.reservationLoad('partial-flight')?.tonnes).toBeCloseTo(5)
    sim.confirmFlightDeparted('partial-flight')
    expect(contract.shippedTonnes).toBeCloseTo(5)
    expect(contract.status).toBe('failed')
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
    const addHandlerMoney = vi.fn()
    const adapter = createCargoAdapter({ addMoney, addHandlerMoney })
    adapter.acceptContract({ id: 'adapter-1', kind: 'general', tonnes: 5, deadline: 500 })
    adapter.tick(160)
    const load = adapter.prepareFlight('flight-1', 'b789', { capacityTonnes: 5 })
    expect(load.tonnes).toBeCloseTo(5)
    adapter.flightDeparted('flight-1')
    expect(addMoney).toHaveBeenCalledWith(4_322.5, 'cargo_airport_revenue', 'adapter-1')
    expect(addHandlerMoney).toHaveBeenCalledWith(8_027.5, 'adapter-1')

    const nodes: CargoFlowNodeDef[] = []
    const links: CargoFlowLinkDef[] = []
    registerCargoFlow({
      addNode: (definition) => nodes.push(definition),
      addLink: (definition) => links.push(definition),
    })
    expect(nodes.map((node) => node.id)).toContain('cargo:screening')
    expect(nodes.map((node) => node.id)).toContain('cargo:warehouse')
    expect(nodes.map((node) => node.id)).toContain('cargo:import_cold_storage')
    expect(links).toHaveLength(18)
  })

  it('routes perishables through staffed cold storage while general cargo bypasses it', () => {
    const sim = new CargoSim(starterCargoTerminal())
    sim.acceptContract({ id: 'cold', kind: 'perishable', tonnes: 6, deadline: 600 })
    sim.acceptContract({ id: 'ambient', kind: 'general', tonnes: 6, deadline: 600 })
    sim.tick(240)

    const coldStore = sim.snapshot().facilities.find((facility) => facility.id === 'cold_storage')
    expect(coldStore?.processedTonnes).toBeCloseTo(6)
    expect(sim.snapshot().facilities.find((facility) => facility.id === 'ready')?.queuedTonnes).toBeCloseTo(12)
  })

  it('runs imports in reverse from aircraft break-down to collecting landside trucks', () => {
    const sim = new CargoSim(starterCargoTerminal())
    const shipment = sim.receiveImport({
      id: 'import-cold',
      kind: 'perishable',
      tonnes: 8,
      standId: 'stand-4',
    })

    sim.tick(240)
    expect(shipment.status).toBe('collected')
    expect(shipment.collectedTonnes).toBeCloseTo(8)
    expect(
      sim.snapshot().facilities.find((facility) => facility.id === 'import_cold_storage')
        ?.processedTonnes,
    ).toBeCloseTo(8)
    expect(
      sim.snapshot().trucks.filter((truck) => truck.direction === 'import').every((truck) => truck.status === 'departed'),
    ).toBe(true)
  })

  it('aggregates multi-tug logistics callbacks and caps the airside dock', () => {
    const adapter = createCargoAdapter()
    const first = adapter.cargoUnloadedFromAircraft('stand-heavy', 60_000, {
      shipmentId: 'manifest-1',
      kind: 'general',
    })
    const second = adapter.cargoUnloadedFromAircraft('stand-heavy', 60_000, {
      shipmentId: 'manifest-1',
      kind: 'general',
      complete: true,
    })
    expect(second).toBe(first)
    expect(second.tonnes).toBe(120)

    adapter.tick(1)
    const snapshot = adapter.snapshot()
    const airside = snapshot.facilities.find((facility) => facility.id === 'import_airside')
    expect(airside?.queuedTonnes).toBeLessThanOrEqual(80)
    expect(snapshot.airsideBacklogTonnes).toBeCloseTo(40)

    adapter.tick(700)
    const late = adapter.cargoUnloadedFromAircraft('stand-heavy', 2_000, {
      shipmentId: 'manifest-1',
      kind: 'general',
      complete: true,
    })
    expect(late).toBe(first)
    expect(late.tonnes).toBe(122)
  })

  it('subtracts passenger baggage from belly hold cargo capacity', () => {
    const sim = new CargoSim(starterCargoTerminal())
    sim.acceptContract({ id: 'belly-space', kind: 'general', tonnes: 10, deadline: 600 })
    sim.tick(180)

    const load = sim.planFlight({
      id: 'belly-compete',
      airframeId: 'b789',
      mode: 'belly',
      capacityTonnes: 10,
      holdCapacityTonnes: 12,
      baggageTonnes: 7,
      supportedUnits: ['ake'],
    })
    expect(load.effectiveCapacityTonnes).toBe(5)
    expect(load.capacityLostToBaggageTonnes).toBe(5)
    expect(load.tonnes).toBeCloseTo(5)
  })

  it('reserves and releases the same loader through the logistics-owned port', () => {
    const release = vi.fn()
    const reserve = vi.fn(() => ({
      id: 'loader-res-1',
      flightId: 'heavy-flight',
      loaderId: 'main-deck-loader-2',
      type: 'main_deck_loader' as const,
    }))
    const adapter = createCargoAdapter({ loaderReservations: { reserve, release } })
    adapter.acceptContract({ id: 'heavy-cargo', kind: 'oversize', tonnes: 20, deadline: 800 })
    adapter.tick(220)

    const load = adapter.prepareFlight('heavy-flight', 'an124')
    expect(load.loaderReservationId).toBe('loader-res-1')
    expect(reserve).toHaveBeenCalledWith({
      flightId: 'heavy-flight',
      preferred: 'main_deck_loader',
      allowUldFallback: true,
    })
    adapter.flightDeparted('heavy-flight')
    expect(release).toHaveBeenCalledWith('loader-res-1')
  })

  it('keeps committed cargo and its loader reserved through a late turnaround', () => {
    const release = vi.fn()
    const adapter = createCargoAdapter({
      loaderReservations: {
        reserve: ({ flightId }) => ({
          id: 'expiry-loader',
          flightId,
          loaderId: 'uld-loader-1',
          type: 'uld_loader',
        }),
        release,
      },
    })
    adapter.acceptContract({
      id: 'expiry-cargo',
      kind: 'general',
      tonnes: 5,
      deadline: 200,
      allowedModes: ['freighter'],
    })
    adapter.tick(160)
    expect(adapter.prepareFlight('expiry-flight', 'b763f').loaderReservationId).toBe('expiry-loader')
    adapter.tick(40)
    expect(release).not.toHaveBeenCalled()
    adapter.flightDeparted('expiry-flight')
    expect(release).toHaveBeenCalledWith('expiry-loader')
  })

  it('shares the configured truck fleet across contracts and returns failed freight', () => {
    const sim = new CargoSim(starterCargoTerminal())
    sim.acceptContract({ id: 'fleet-a', kind: 'general', tonnes: 80, deadline: 10 })
    sim.acceptContract({ id: 'fleet-b', kind: 'general', tonnes: 80, deadline: 10 })
    expect(sim.snapshot().trucks).toHaveLength(4)
    expect(sim.snapshot().pendingExportTruckTonnes).toBe(80)

    sim.tick(10)
    const snapshot = sim.snapshot()
    expect(snapshot.contracts.every((contract) => contract.returnedTonnes === 80)).toBe(true)
    expect(snapshot.facilities.reduce((sum, facility) => sum + facility.queuedTonnes, 0)).toBe(0)
    expect(snapshot.trucks.every((truck) => truck.status === 'departed')).toBe(true)
  })

  it('never has more active truck trips than physical fleet slots', () => {
    const config = starterCargoTerminal()
    config.trucks.count = 1
    const sim = new CargoSim(config)
    sim.acceptContract({ id: 'one-truck', kind: 'general', tonnes: 60, deadline: 1_000 })
    for (let minute = 0; minute < 300; minute++) {
      sim.tick(1)
      const active = sim.snapshot().trucks.filter((truck) => truck.status !== 'departed')
      expect(active.length).toBeLessThanOrEqual(1)
    }
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

import { describe, expect, it } from 'vitest'
import { CargoSim, starterCargoTerminal } from './index.ts'

describe('cargo headless stress simulation', () => {
  it('conserves 600 tonnes across hundreds of contracts and repeated freighter turns', () => {
    const sim = new CargoSim(starterCargoTerminal())
    const contractCount = 300
    const tonnesPerContract = 2
    for (let index = 0; index < contractCount; index++) {
      sim.acceptContract({
        id: `stress-${index}`,
        kind: index % 7 === 0 ? 'express' : index % 11 === 0 ? 'perishable' : 'general',
        tonnes: tonnesPerContract,
        deadline: 9_000,
      })
    }

    let flight = 0
    for (let minute = 0; minute < 8_500; minute += 5) {
      sim.tick(5)
      if (minute % 30 !== 0) continue
      const id = `stress-flight-${flight++}`
      sim.planFlight({
        id,
        airframeId: 'b748f',
        mode: 'freighter',
        capacityTonnes: 50,
        supportedUnits: ['ake', 'pmc', 'loose'],
        mainDeckLoaderAvailable: true,
      })
      sim.confirmFlightDeparted(id)
    }

    const snapshot = sim.snapshot()
    const accepted = contractCount * tonnesPerContract
    const shipped = snapshot.contracts.reduce((sum, contract) => sum + contract.shippedTonnes, 0)
    const queued = snapshot.facilities.reduce((sum, facility) => sum + facility.queuedTonnes, 0)
    const onTrucks = snapshot.trucks
      .filter((truck) => truck.direction === 'export')
      .reduce((sum, truck) => sum + truck.remainingTonnes, 0)

    expect(
      shipped +
        queued +
        onTrucks +
        snapshot.pendingExportTruckTonnes +
        snapshot.reservedTonnes,
    ).toBeCloseTo(accepted, 5)
    expect(shipped).toBeCloseTo(accepted, 5)
    expect(snapshot.contracts.every((contract) => contract.status === 'fulfilled')).toBe(true)
    expect(snapshot.revenue).toBeGreaterThan(0)
    expect(Number.isFinite(snapshot.revenue)).toBe(true)
  })
})

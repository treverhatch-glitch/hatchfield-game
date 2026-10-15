import { describe, expect, it } from 'vitest'
import { NIGHT_BANK_SLOTS_HUB_II } from './config.ts'
import { cargoLateInfoLines } from './info.ts'
import { Tier3Session, type Tier3TickContext } from './session.ts'

const ctx = (over: Partial<Tier3TickContext> = {}): Tier3TickContext => ({
  fieldLevel: 8,
  unlockedTech: new Set<string>(),
  research: ['cargo_night_hub'],
  staffPools: { ground_crew: { hired: 45, wagePerDay: 0 } },
  powerTier: 3,
  otherPowerDemand: 0,
  isNight: true,
  nightIndex: 1,
  curfewRelaxed: true,
  candidates: [],
  ...over,
})

function wave(buildings: Parameters<Tier3Session['sync']>[0], over: Partial<Tier3TickContext> = {}) {
  const session = new Tier3Session()
  session.sync(buildings)
  const result = session.tick(1, ctx(over))
  return { session, result }
}

const hub = { id: '6,6', kind: 'night_hub' as const }

describe('cargo hub II', () => {
  it('adds freighter slots and tonnes to the night wave when crewed', () => {
    const base = wave([hub])
    const extended = wave([hub, { id: '8,6', kind: 'hub_ii' }])
    expect(extended.session.snapshot().nightHub.bankTonnes).toBeGreaterThan(base.session.snapshot().nightHub.bankTonnes)
    expect(extended.session.snapshot().nightHub.flights).toBeGreaterThan(base.session.snapshot().nightHub.flights)
    expect(extended.session.snapshot().hubII.effect).toBeGreaterThan(0.9)
  })

  it('adds nothing without a night hub', () => {
    const { session } = wave([{ id: '8,6', kind: 'hub_ii' }])
    expect(session.snapshot().nightHub.bankTonnes).toBe(0)
  })

  it('is held back by a short crew, and the hub is staffed first', () => {
    const thin = wave([hub, { id: '8,6', kind: 'hub_ii' }], {
      staffPools: { ground_crew: { hired: 24, wagePerDay: 0 } },
    })
    const snap = thin.session.snapshot()
    expect(snap.nightHub.groundCrewAssigned).toBe(12)
    expect(snap.hubII.groundCrewAssigned).toBe(12)
    expect(snap.hubII.effect).toBeLessThan(0.45)
    const full = wave([hub, { id: '8,6', kind: 'hub_ii' }]).session.snapshot()
    expect(snap.nightHub.bankTonnes).toBeLessThan(full.nightHub.bankTonnes)
  })

  it('names three extra freighter slots', () => {
    expect(NIGHT_BANK_SLOTS_HUB_II).toHaveLength(3)
  })
})

describe('cold store', () => {
  it('pays a premium on top of the night wave and counts its rooms', () => {
    const plain = wave([hub])
    const cold = wave([hub, { id: '8,7', kind: 'cold_store' }])
    const premium = cold.result.postings.find((row) => row.label === 'Cold-chain premium')
    const base = cold.result.postings.find((row) => row.label === 'Night hub freighter wave')
    expect(premium?.amount).toBeGreaterThan(0)
    expect(base?.amount).toBe(plain.result.postings.find((row) => row.label === 'Night hub freighter wave')?.amount)
    expect(premium!.amount).toBeLessThanOrEqual(Math.round(base!.amount * 0.2))
    const snap = cold.session.snapshot()
    expect(snap.coldChain.rooms).toBe(2)
    expect(snap.coldChain.revenue).toBe(premium!.amount)
    expect(cargoLateInfoLines('cold_store', snap).join(' ')).toMatch(/chilled rooms/)
  })

  it('earns nothing when no night hub runs the wave', () => {
    const { result } = wave([{ id: '8,7', kind: 'cold_store' }])
    expect(result.postings.find((row) => row.label === 'Cold-chain premium')).toBeUndefined()
  })

  it('keeps the premium through a save', () => {
    const { session } = wave([hub, { id: '8,7', kind: 'cold_store' }])
    const back = Tier3Session.restore(session.save())
    back.sync([hub, { id: '8,7', kind: 'cold_store' }])
    expect(back.snapshot().coldChain.revenue).toBe(session.snapshot().coldChain.revenue)
  })
})

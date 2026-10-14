import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CARGO_PRODUCTS } from '../cargo/catalog.ts'
import { tilesOf } from '../game/path.ts'
import { Game } from '../game/sim.ts'
import type { Flight, Vec } from '../game/types.ts'
import {
  MRO_BAYS,
  MRO_TAXI_MINUTES,
  NIGHT_BANK_SLOTS,
  NIGHT_PREMIUM,
} from './config.ts'
import { mroInfoLines, nightHubInfoLines } from './info.ts'
import { addMroMesh, addNightHubMesh, MESH_TRIANGLE_BUDGET, meshTriangleCount } from './meshes.ts'
import { bayAccepts, baySizeForAirframe, pickBay } from './mro.ts'
import { nightHubStorageTonnes, nightHubTerminal, planNightBank, runNightBank } from './nightHub.ts'
import { Tier3Session, type Tier3TickContext } from './session.ts'
import type { MroJob } from './types.ts'
import { mroUnlock, nightHubUnlock } from './unlock.ts'

const fullStaff: Tier3TickContext['staffPools'] = {
  maintenance_tech: { hired: 8, wagePerDay: 380 },
  ground_crew: { hired: 12, wagePerDay: 320 },
}

function ctx(over: Partial<Tier3TickContext> = {}): Tier3TickContext {
  return {
    fieldLevel: 5,
    unlockedTech: new Set<string>(),
    research: ['mro_hangar', 'cargo_night_hub'],
    staffPools: fullStaff,
    powerTier: 1,
    otherPowerDemand: 0,
    isNight: false,
    nightIndex: 0,
    curfewRelaxed: false,
    candidates: [],
    ...over,
  }
}

function hangar(): Tier3Session {
  const session = new Tier3Session()
  session.sync([{ id: '4,4', kind: 'mro' }])
  return session
}

describe('MRO bays', () => {
  it('gives widebody and jumbo the larger bays', () => {
    expect(baySizeForAirframe('b738')).toBe('narrow')
    expect(baySizeForAirframe('b763f')).toBe('wide')
    expect(baySizeForAirframe('a380')).toBe('jumbo')
    expect(bayAccepts('narrow', 'wide')).toBe(false)
    expect(bayAccepts('wide', 'narrow')).toBe(true)
    expect(bayAccepts('wide', 'jumbo')).toBe(false)
    expect(bayAccepts('jumbo', 'jumbo')).toBe(true)
    const jobs: MroJob[] = []
    expect(pickBay(jobs, 'h', 'jumbo')?.id).toBe('jumbo')
    expect(pickBay(jobs, 'h', 'wide')?.id).toBe('wide')
    const blocked: MroJob[] = MRO_BAYS.filter((bay) => bay.size === 'narrow').map((bay) => ({
      id: bay.id,
      aircraftId: bay.id,
      buildingId: 'h',
      bayId: bay.id,
      airframeId: 'b738',
      size: 'narrow',
      standKey: bay.id,
      phase: 'in_bay',
      remaining: 10,
    }))
    expect(pickBay(blocked, 'h', 'narrow')).toBeNull()
    expect(pickBay(blocked, 'h', 'wide')?.id).toBe('wide')
    expect(pickBay(blocked, 'h', 'jumbo')?.id).toBe('jumbo')
  })

  it('occupies a bay through taxi and the check, and ties the stand', () => {
    const session = hangar()
    const started = session.tick(1, ctx({
      candidates: [{ id: 'a1', airframeId: 'b738', standKey: '12,21' }],
    }))
    expect(started.postings).toEqual([])
    let snap = session.snapshot()
    expect(snap.mro.occupied).toBe(1)
    expect(snap.mro.standsTied).toBe(1)
    expect(snap.mro.taxiwaysTied).toBe(1)
    expect(snap.mro.jobs[0]?.phase).toBe('taxi_in')
    expect(session.tiedStandKeys().has('12,21')).toBe(true)

    session.tick(MRO_TAXI_MINUTES, ctx())
    snap = session.snapshot()
    expect(snap.mro.jobs[0]?.phase).toBe('in_bay')
    expect(snap.mro.jobs[0]?.bayId).toBe('narrow-a')
    expect(snap.mro.taxiwaysTied).toBe(0)
    expect(snap.mro.standsTied).toBe(1)

    const narrow = MRO_BAYS[0]
    session.tick(narrow.checkMinutes + MRO_TAXI_MINUTES, ctx())
    snap = session.snapshot()
    expect(snap.mro.occupied).toBe(0)
    expect(snap.mro.standsTied).toBe(0)
    expect(snap.mro.revenue).toBe(narrow.fee)
    expect(Number.isFinite(snap.mro.revenue)).toBe(true)
  })

  it('holds a second narrowbody until the induction gap, and refuses a third bay', () => {
    const session = hangar()
    const candidates = [
      { id: 'a', airframeId: 'b738', standKey: '1,1' },
      { id: 'b', airframeId: 'a320neo', standKey: '2,1' },
      { id: 'c', airframeId: 'a321', standKey: '3,1' },
    ]
    session.tick(1, ctx({ candidates }))
    expect(session.snapshot().mro.occupied).toBe(1)
    session.tick(179, ctx({ candidates }))
    expect(session.snapshot().mro.occupied).toBe(1)
    session.tick(1, ctx({ candidates }))
    expect(session.snapshot().mro.occupied).toBe(2)
    session.tick(1, ctx({ candidates }))
    expect(session.snapshot().mro.occupied).toBe(2)
    const bays = session.snapshot().mro.jobs.map((job) => job.bayId).sort()
    expect(bays).toEqual(['narrow-a', 'narrow-b'])
  })

  it('pays nothing and keeps the bay when no techs are on the pool', () => {
    const session = hangar()
    const starved = ctx({
      staffPools: { maintenance_tech: { hired: 0, wagePerDay: 0 }, ground_crew: { hired: 0, wagePerDay: 0 } },
      candidates: [{ id: 'a1', airframeId: 'a380', standKey: '8,8' }],
    })
    session.tick(MRO_TAXI_MINUTES + 5, starved)
    const snap = session.snapshot()
    expect(snap.mro.jobs[0]?.phase).toBe('in_bay')
    expect(snap.mro.jobs[0]?.bayId).toBe('jumbo')
    expect(snap.mro.revenue).toBe(0)
    session.tick(5_000, starved)
    expect(session.snapshot().mro.occupied).toBe(1)
    expect(session.snapshot().mro.revenue).toBe(0)
    expect(session.snapshot().mro.revenue).not.toBeNaN()
  })

  it('pays a partial check more slowly when the tech pool is half full', () => {
    const session = hangar()
    const half = ctx({
      staffPools: { maintenance_tech: { hired: 4, wagePerDay: 380 } },
      candidates: [{ id: 'a1', airframeId: 'b738', standKey: '1,1' }],
    })
    const narrow = MRO_BAYS[0]
    const result = session.tick(MRO_TAXI_MINUTES + narrow.checkMinutes + MRO_TAXI_MINUTES, half)
    expect(result.postings).toEqual([])
    expect(session.snapshot().mro.occupied).toBe(1)
    const rest = session.tick(narrow.checkMinutes, half)
    expect(rest.postings.reduce((sum, posting) => sum + posting.amount, 0)).toBe(narrow.fee / 2)
    expect(session.snapshot().mro.occupied).toBe(0)
  })
})

describe('cargo night hub', () => {
  it('fills storage and handling in slot order and drops the jumbo when the room is gone', () => {
    const storage = nightHubStorageTonnes()
    expect(storage).toBeGreaterThan(180)
    const full = planNightBank(NIGHT_BANK_SLOTS, storage, 200)
    expect(full.map((slot) => slot.id)).toEqual(['bank-1', 'bank-2', 'bank-3', 'bank-4'])
    expect(full.reduce((sum, slot) => sum + slot.tonnes, 0)).toBe(188)
    const tight = planNightBank(NIGHT_BANK_SLOTS, 50, 200)
    expect(tight).toEqual([{ id: 'bank-1', airframeId: 'b763f', tonnes: 40 }, { id: 'bank-2', airframeId: 'b763f', tonnes: 10 }])
    expect(planNightBank(NIGHT_BANK_SLOTS, storage, 0)).toEqual([])
  })

  it('pays the cargo express tariff, airport share only, and nothing without handling', () => {
    const planned = planNightBank(NIGHT_BANK_SLOTS, nightHubStorageTonnes(), 200)
    const wave = runNightBank('hub', 3, planned)
    const rate = CARGO_PRODUCTS.express.revenuePerTonne * NIGHT_PREMIUM
    const share = nightHubTerminal().revenueShare.airport
    const tonnes = planned.reduce((sum, slot) => sum + slot.tonnes, 0)
    expect(wave.shippedTonnes).toBeCloseTo(tonnes)
    expect(wave.flights).toBe(4)
    expect(wave.airportRevenue).toBeCloseTo(tonnes * rate * share)
    expect(wave.cash).toBe(Math.round(wave.airportRevenue))
    expect(Number.isFinite(wave.cash)).toBe(true)
    const empty = runNightBank('hub', 4, [])
    expect(empty.cash).toBe(0)
    expect(empty.shippedTonnes).toBe(0)
  })

  it('launches one night wave, scales it with ground crew, and bills a tighter curfew harder', () => {
    const session = new Tier3Session()
    session.sync([{ id: '6,6', kind: 'night_hub' }])
    const day = session.tick(10, ctx({ isNight: false }))
    expect(day.postings).toEqual([])

    const tight = session.tick(1, ctx({ isNight: true, nightIndex: 2, curfewRelaxed: false }))
    const revenue = tight.postings.find((posting) => posting.amount > 0)
    const fine = tight.postings.find((posting) => posting.label.includes('curfew'))
    expect(revenue?.amount).toBeGreaterThan(0)
    expect(fine).toBeTruthy()
    expect(tight.paxHeat).toBeLessThan(0)
    expect(session.snapshot().nightHub.flights).toBe(4)
    expect(session.snapshot().nightHub.bankTonnes).toBeCloseTo(188)
    const lines = nightHubInfoLines(session.snapshot())
    expect(lines.some((line) => line.includes('$'))).toBe(true)
    expect(lines.some((line) => line.includes('tight'))).toBe(true)

    const again = session.tick(30, ctx({ isNight: true, nightIndex: 2, curfewRelaxed: false }))
    expect(again.postings.filter((posting) => posting.amount > 0)).toEqual([])

    const half = new Tier3Session()
    half.sync([{ id: '6,6', kind: 'night_hub' }])
    const halfWave = half.tick(1, ctx({
      isNight: true,
      nightIndex: 1,
      staffPools: { ground_crew: { hired: 6, wagePerDay: 320 }, maintenance_tech: { hired: 0, wagePerDay: 0 } },
    }))
    const halfPay = halfWave.postings.find((posting) => posting.amount > 0)?.amount ?? 0
    expect(halfPay).toBeGreaterThan(0)
    expect(halfPay).toBeLessThan(revenue!.amount)
    expect(half.snapshot().nightHub.bankTonnes).toBeLessThan(188)

    const quiet = new Tier3Session()
    quiet.sync([{ id: '6,6', kind: 'night_hub' }])
    const relaxed = quiet.tick(1, ctx({ isNight: true, nightIndex: 1, curfewRelaxed: true }))
    const relaxedFine = relaxed.postings.find((posting) => posting.amount < 0)?.amount ?? 0
    expect(Math.abs(relaxedFine)).toBeLessThan(Math.abs(fine!.amount))
    expect(relaxed.paxHeat).toBeGreaterThan(tight.paxHeat)
  })
})

describe('unlock gating', () => {
  it('stays shut in the early game and opens on tier III tech or the research desk', () => {
    const early = { fieldLevel: 1, unlockedTech: new Set<string>(), research: [] as string[] }
    expect(mroUnlock(early).ok).toBe(false)
    expect(nightHubUnlock(early).ok).toBe(false)
    const mid = { fieldLevel: 3, unlockedTech: new Set(['maintenance.t4', 'cargo.t4']), research: ['mro_hangar'] }
    expect(mroUnlock(mid).ok).toBe(false)
    expect(nightHubUnlock(mid).ok).toBe(false)
    const lateBare = { fieldLevel: 4, unlockedTech: new Set<string>(), research: [] as string[] }
    expect(mroUnlock(lateBare).ok).toBe(false)
    expect(nightHubUnlock(lateBare).ok).toBe(false)
    expect(mroUnlock({ fieldLevel: 4, unlockedTech: new Set(['maintenance.t2']), research: [] }).ok).toBe(false)
    expect(mroUnlock({ fieldLevel: 4, unlockedTech: new Set(['maintenance.t3']), research: [] }).ok).toBe(true)
    expect(mroUnlock({ fieldLevel: 5, unlockedTech: new Set(['maintenance.t4']), research: [] }).ok).toBe(true)
    expect(nightHubUnlock({ fieldLevel: 5, unlockedTech: new Set(['cargo.t2']), research: [] }).ok).toBe(false)
    expect(nightHubUnlock({ fieldLevel: 5, unlockedTech: new Set(['cargo.t3']), research: [] }).ok).toBe(true)
    expect(nightHubUnlock({ fieldLevel: 4, unlockedTech: new Set(), research: ['cargo_night_hub'] }).ok).toBe(true)
  })

  it('does not earn before the gate, and every posting is a finite number', () => {
    const session = new Tier3Session()
    session.sync([
      { id: '1,1', kind: 'mro' },
      { id: '2,2', kind: 'night_hub' },
    ])
    const locked = session.tick(2_000, ctx({
      fieldLevel: 1,
      research: [],
      isNight: true,
      nightIndex: 1,
      candidates: [{ id: 'a', airframeId: 'b738', standKey: '3,3' }],
    }))
    expect(locked.postings.filter((posting) => posting.amount > 0)).toEqual([])
    expect(session.snapshot().mro.occupied).toBe(0)
    expect(session.snapshot().nightHub.revenue).toBe(0)
    for (const posting of locked.postings) expect(Number.isFinite(posting.amount)).toBe(true)
  })
})

describe('info and meshes', () => {
  it('keeps the numbers in the submenu lines', () => {
    const session = hangar()
    session.tick(1, ctx({ candidates: [{ id: 'a', airframeId: 'b789', standKey: '4,9' }] }))
    const lines = mroInfoLines(session.snapshot())
    expect(lines[0]).toMatch(/1 of 4 bays occupied/)
    expect(lines.some((line) => line.includes('$'))).toBe(true)
    expect(lines.some((line) => line.includes('b789'))).toBe(true)
  })

  it('stays inside the triangle budget', () => {
    const mro = new THREE.Group()
    const hub = new THREE.Group()
    addMroMesh(mro, 8)
    addNightHubMesh(hub, 8)
    expect(meshTriangleCount(mro)).toBeGreaterThan(20)
    expect(meshTriangleCount(mro)).toBeLessThanOrEqual(MESH_TRIANGLE_BUDGET)
    expect(meshTriangleCount(hub)).toBeGreaterThan(20)
    expect(meshTriangleCount(hub)).toBeLessThanOrEqual(MESH_TRIANGLE_BUDGET)
  })
})

function parked(game: Game, stand: Vec): Flight {
  const flight: Flight = {
    id: 'flt-mro',
    airline: 'northline',
    flightNo: 'NL100',
    airframeId: 'b738',
    airframeName: '737-800',
    pax: 20,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'parked',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: { landing: true, bags: true, bagsLoad: true, fuel: true, catering: true, bagDrop: true, mx: false, deiced: true },
    waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 10,
    ledger: [],
  }
  game.flights.push(flight)
  return flight
}

describe('game wiring', () => {
  it('refuses the buildings in the early game and keeps cash finite', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsMishandled).toBe(0)
    const before = game.cash
    game.tool = 'mro'
    game.placeSingle({ c: 2, r: 2 })
    expect(game.tile({ c: 2, r: 2 })).toBe('grass')
    expect(game.sites.some((site) => site.tile === 'mro')).toBe(false)
    expect(game.cash).toBe(before)
    game.tool = 'nighthub'
    game.placeSingle({ c: 3, r: 2 })
    expect(game.tile({ c: 3, r: 2 })).toBe('grass')
    expect(Number.isFinite(game.cash)).toBe(true)

    game.fieldXp = 700
    game.researchUnlocked = ['night_bank', 'deice', 'stand_class', 'heavy_pack', 'mro_hangar', 'cargo_night_hub']
    game.cash = 400_000
    game.tool = 'mro'
    game.placeSingle({ c: 2, r: 2 })
    expect(game.sites.some((site) => site.tile === 'mro')).toBe(true)
    game.tickConstruction(30)
    expect(game.tile({ c: 2, r: 2 })).toBe('mro')
    const stand = tilesOf(game.tiles, 'stand').sort((a, b) => a.r - b.r)[0]
    parked(game, stand)
    game.mechanics = 8
    // West of the strips: MRO at (2,2) joins the apron spine without paving the runway.
    for (let c = 3; c <= 4; c++) game.tiles[2][c] = 'taxi'
    for (let r = 2; r <= 22; r++) if (game.tiles[r][4] === 'grass') game.tiles[r][4] = 'taxi'
    for (let c = 4; c <= 7; c++) if (game.tiles[22][c] === 'grass') game.tiles[22][c] = 'taxi'
    game.tickTier3(4)
    expect(game.freeStands().some((s) => s.c === stand.c && s.r === stand.r)).toBe(false)
    expect(game.tier3Snapshot().mro.occupied).toBe(1)
    const cashBefore = game.cash
    game.tickTier3(40)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.cash).toBeGreaterThan(cashBefore)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsMishandled).toBe(0)
  })
})

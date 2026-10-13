import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WORLD_PER_METER } from '../render/aircraft/specs.ts'
import {
  COMMUTE_LINK,
  anchorForPlot,
  assessCommute,
  buildParts,
  closeHousingDay,
  commitHousing,
  emptyHousing,
  housingHeightM,
  housingParts,
  housingSnapshot,
  linkProfile,
  quoteHousing,
  restoreHousing,
  tier3Minutes,
  walkerPoses,
  workerHeightM,
  type HousingContext,
  type PlotRef,
  type TransportLinks,
} from './index.ts'

const plots: PlotRef[] = [
  { id: '1,1', col: 1, row: 1, zone: 'core', distance: 0 },
  { id: '0,1', col: 0, row: 1, zone: 'industrial', distance: 1 },
  { id: '0,2', col: 0, row: 2, zone: 'industrial', distance: 1 },
  { id: '3,3', col: 3, row: 3, zone: 'fringe', distance: 2 },
  { id: '2,3', col: 2, row: 3, zone: 'fringe', distance: 2 },
]

function ctx(fieldLevel: number, owned = plots): HousingContext {
  return { fieldLevel, owned, starterId: '1,1', mapSize: 32 }
}

function links(partial: Partial<TransportLinks> = {}): TransportLinks {
  return {
    roadCells: 0,
    roadReachesEdge: false,
    busStops: 0,
    passengerRail: false,
    tier3Rail: null,
    ...partial,
  }
}

describe('commute links', () => {
  it('ranks rail ahead of the bus and the bus ahead of a road', () => {
    const none = linkProfile(links())
    const local = linkProfile(links({ roadCells: 4 }))
    const edge = linkProfile(links({ roadCells: 6, roadReachesEdge: true }))
    const bus = linkProfile(links({ roadCells: 6, roadReachesEdge: true, busStops: 1 }))
    const rail = linkProfile(links({ passengerRail: true, busStops: 2, roadCells: 4, roadReachesEdge: true }))
    expect(none.minutes).toBeGreaterThan(local.minutes)
    expect(local.minutes).toBeGreaterThan(edge.minutes)
    expect(edge.minutes).toBeGreaterThan(bus.minutes)
    expect(bus.minutes).toBeGreaterThan(rail.minutes)
    expect(rail.reliability).toBeGreaterThan(bus.reliability)
    expect(bus.reliability).toBeGreaterThan(edge.reliability)
    expect(edge.reliability).toBeGreaterThan(none.reliability)
    expect(rail.mode).toBe('rail')
    expect(bus.label).toBe(COMMUTE_LINK.bus.label)
  })

  it('lets a tier3 rail station shorten the ride when that module is present', () => {
    const city = linkProfile(links({ passengerRail: true }))
    const station = linkProfile(
      links({
        passengerRail: false,
        tier3Rail: { present: true, headwayMin: 8, reliability: 0.98, name: 'North platform' },
      }),
    )
    expect(station.mode).toBe('rail')
    expect(station.label).toBe('North platform')
    expect(station.minutes).toBeLessThan(city.minutes)
    expect(station.reliability).toBeGreaterThan(city.reliability)
    expect(tier3Minutes(8)).toBeLessThan(COMMUTE_LINK.rail.minutes)
  })

  it('turns a long commute into lateness and a morale drag', () => {
    const stranded = assessCommute({ links: links(), beds: 0, employed: 12, bestTier: null })
    const rail = assessCommute({
      links: links({ passengerRail: true }),
      beds: 0,
      employed: 12,
      bestTier: null,
    })
    expect(stranded.lateMinutes).toBeGreaterThan(rail.lateMinutes)
    expect(stranded.failureChance).toBeGreaterThan(rail.failureChance)
    expect(stranded.morale).toBeLessThan(rail.morale)
    expect(stranded.hireCostMultiplier).toBe(1)
  })
})

describe('staff housing', () => {
  it('gates dorm, apartments, and the village by field level, order, and plots', () => {
    const bare = emptyHousing()
    expect(quoteHousing(bare, 'dorm', ctx(1)).ok).toBe(false)
    expect(quoteHousing(bare, 'apartments', ctx(4)).ok).toBe(false)
    const noLand = quoteHousing(bare, 'dorm', ctx(2, [plots[0]!]))
    expect(noLand.ok).toBe(false)
    if (!noLand.ok) expect(noLand.reason).toMatch(/plot/i)

    const dorm = quoteHousing(bare, 'dorm', ctx(2))
    expect(dorm.ok).toBe(true)
    if (!dorm.ok) return
    expect(dorm.cost).toBeGreaterThan(0)
    expect(dorm.plotIds).toEqual(['2,3'])
    expect(dorm.anchor).toEqual(anchorForPlot(plots.find((plot) => plot.id === '2,3')!))
    const withDorm = commitHousing(bare, dorm)
    expect(quoteHousing(withDorm, 'apartments', ctx(3)).ok).toBe(false)
    const flats = quoteHousing(withDorm, 'apartments', ctx(4))
    expect(flats.ok).toBe(true)
    if (!flats.ok) return
    expect(flats.plotIds).not.toContain('1,1')
    expect(flats.plotIds).not.toContain('2,3')
    const withFlats = commitHousing(withDorm, flats)
    expect(quoteHousing(withFlats, 'village', ctx(4)).ok).toBe(false)
    const village = quoteHousing(withFlats, 'village', ctx(5))
    expect(village.ok).toBe(true)
    if (!village.ok) return
    expect(village.plotIds).toHaveLength(2)
  })

  it('cuts no-shows, lifts morale and retention, and cheapens hiring', () => {
    const poor = links({ roadCells: 3, roadReachesEdge: false })
    const open = assessCommute({ links: poor, beds: 0, employed: 40, bestTier: null })
    const housed = assessCommute({ links: poor, beds: 18, employed: 40, bestTier: 'dorm' })
    const village = assessCommute({ links: poor, beds: 214, employed: 40, bestTier: 'village' })
    expect(housed.failureChance).toBeLessThan(open.failureChance)
    expect(village.failureChance).toBeLessThan(housed.failureChance)
    expect(village.commuterShare).toBe(0)
    expect(housed.morale).toBeGreaterThan(open.morale)
    expect(village.retention).toBeGreaterThan(open.retention)
    expect(village.hireCostMultiplier).toBeLessThan(housed.hireCostMultiplier)
    expect(housed.hireCostMultiplier).toBeLessThan(1)
    expect(village.lateMinutes).toBeLessThan(open.lateMinutes)
  })

  it('rolls fewer late shifts and fewer quits once the village is full', () => {
    const poor = links()
    const counts = { desk: 4, janitor: 1, mechanic: 2, researcher: 1 }
    let lateOpen = 0
    let lateHoused = 0
    let quitOpen = 0
    let quitHoused = 0
    let housed = emptyHousing()
    const quote = quoteHousing(housed, 'dorm', ctx(2))
    const flats = quote.ok ? quoteHousing(commitHousing(housed, quote), 'apartments', ctx(4)) : null
    const village =
      quote.ok && flats?.ok
        ? quoteHousing(commitHousing(commitHousing(housed, quote), flats), 'village', ctx(5))
        : null
    if (!quote.ok || !flats?.ok || !village?.ok) throw new Error('village quote failed')
    housed = commitHousing(commitHousing(commitHousing(emptyHousing(), quote), flats), village)
    for (let day = 0; day < 48; day++) {
      const openRoll = closeHousingDay(emptyHousing(), poor, 20, day, counts).roll
      const homeRoll = closeHousingDay(housed, poor, 20, day, counts).roll
      if (openRoll.late) lateOpen++
      if (homeRoll.late) lateHoused++
      if (openRoll.quit) quitOpen++
      if (homeRoll.quit) quitHoused++
    }
    expect(lateHoused).toBeLessThan(lateOpen)
    expect(quitHoused).toBeLessThan(quitOpen)
  })

  it('round-trips a save and ignores a broken tier', () => {
    const quote = quoteHousing(emptyHousing(), 'dorm', ctx(2))
    if (!quote.ok) throw new Error('dorm quote failed')
    const saved = housingSnapshot(commitHousing(emptyHousing(), quote))
    const back = restoreHousing(saved)
    expect(back.buildings).toEqual(saved.buildings)
    const dirty = restoreHousing({
      buildings: [{ tier: 'bunkhouse', plotIds: ['0,1'], anchor: { c: 1, r: 1 } }, saved.buildings[0]],
      morale: 4,
      lastDay: 3,
    })
    expect(dirty.buildings).toHaveLength(1)
    expect(dirty.buildings[0]?.tier).toBe('dorm')
    expect(dirty.morale).toBe(1)
    expect(restoreHousing(undefined).buildings).toEqual([])
  })
})

describe('walkers and meshes', () => {
  it('walks a few workers from the house toward the hall', () => {
    const quote = quoteHousing(emptyHousing(), 'dorm', ctx(2))
    if (!quote.ok) throw new Error('dorm quote failed')
    const state = commitHousing(emptyHousing(), quote)
    const start = walkerPoses(state.buildings, { c: 16, r: 16 }, 0)
    const later = walkerPoses(state.buildings, { c: 16, r: 16 }, 20)
    expect(start.length).toBe(4)
    expect(start[0]?.x).toBeCloseTo(state.buildings[0]!.anchor.c)
    expect(start[0]?.y).toBeCloseTo(state.buildings[0]!.anchor.r)
    const moved = later.some((pose, index) => pose.x !== start[index]?.x || pose.y !== start[index]?.y)
    expect(moved).toBe(true)
    expect(later.every((pose) => pose.x >= 1 && pose.x <= 31)).toBe(true)
  })

  it('builds low-poly shells on a meter scale', () => {
    expect(housingHeightM('dorm')).toBeGreaterThan(6)
    expect(housingHeightM('dorm')).toBeLessThan(9)
    expect(housingHeightM('apartments')).toBeGreaterThan(housingHeightM('dorm'))
    expect(workerHeightM()).toBeCloseTo(1.75, 1)
    expect(housingParts('village').length).toBeGreaterThan(6)
    const group = buildParts(housingParts('dorm'), WORLD_PER_METER, THREE)
    const box = new THREE.Box3().setFromObject(group)
    const heightM = (box.max.y - box.min.y) / WORLD_PER_METER
    expect(heightM).toBeCloseTo(housingHeightM('dorm'), 5)
    expect(group.children.length).toBe(housingParts('dorm').length)
  })
})

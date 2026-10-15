import { describe, expect, it } from 'vitest'
import { rosterAirline } from '../airlines/roster.ts'
import { HUB_FEE_MAX, HUB_FEE_MIN } from '../game/catalog.ts'
import { CONTRACT_TIERS } from '../wave3/config.ts'
import {
  ALLOCATOR_WAIT,
  emptyHubFacilities,
  hubChecklist,
  HUB_OFFER_FEE,
  HUB_TIER_GATE,
  nextHubTier,
  offerLadder,
  primaryTakenSentence,
  type HubCarrier,
  type HubFacilities,
} from './index.ts'

function carrier(over: Partial<HubCarrier> & Pick<HubCarrier, 'id' | 'type'>): HubCarrier {
  return {
    name: over.name ?? over.id,
    signed: true,
    tier: 'station',
    contractTier: 1,
    onTimeRate: 1,
    onTimeDays: 40,
    ...over,
  }
}

function world(over: Partial<HubFacilities> = {}): HubFacilities {
  return { ...emptyHubFacilities(), daysAtTier: 40, ...over }
}

function ids(lines: { id: string }[]): string[] {
  return lines.map((line) => line.id)
}

describe('hub checklist', () => {
  it('reads the roster archetypes the design names', () => {
    expect(rosterAirline('brisa')?.type).toBe('budget')
    expect(rosterAirline('gulf_pearl')?.type).toBe('flag')
    expect(rosterAirline('atlas_cargo')?.type).toBe('cargo')
    expect(rosterAirline('harbor_heli')?.type).toBe('heli')
    expect(rosterAirline('suncharter')?.type).toBe('charter')
    expect(rosterAirline('cityhopper')?.type).toBe('regional')
  })

  it('climbs one stored step, and only the tiers that archetype asks for', () => {
    expect(offerLadder('budget')).toEqual(['focus', 'base', 'hub'])
    expect(offerLadder('flag')).toEqual(['focus', 'base', 'hub', 'primary'])
    expect(offerLadder('cargo')).toEqual(['base', 'hub', 'primary'])
    expect(offerLadder('heli')).toEqual(['base'])
    expect(offerLadder('regional')).toEqual(['focus'])
    expect(offerLadder('charter')).toEqual(['focus'])
    expect(nextHubTier('flag', 'station')).toBe('focus')
    expect(nextHubTier('cargo', 'station')).toBe('base')
    expect(nextHubTier('heli', 'station')).toBe('base')
    expect(nextHubTier('budget', 'hub')).toBeNull()
    const gulf = hubChecklist(
      carrier({ id: 'gulf_pearl', type: 'flag', tier: 'station', contractTier: 5, diplomacyBand: 'partner' }),
      world(),
    )
    expect(gulf.next).toBe('focus')
    expect(gulf.current).toBe('station')
  })

  it('keeps Brisa at Preferred ineligible for Focus while the desk waits on the allocator', () => {
    const list = hubChecklist(
      carrier({
        id: 'brisa',
        name: 'Brisa',
        type: 'budget',
        contractTier: 2,
        diplomacyBand: 'neutral',
        onTimeRate: 0.9,
        onTimeDays: 14,
      }),
      world({ dedicatedDesks: 4, preferredDesks: 2, stands: 6 }),
    )
    expect(list.next).toBe('focus')
    expect(list.eligible).toBe(false)
    const desk = list.lines.find((line) => line.id === 'desk')
    expect(desk?.status).toBe('waiting')
    expect(desk?.label).toBe('Preferred desk or kiosk')
    expect(desk?.detail).toBe(ALLOCATOR_WAIT)
    expect(list.lines.some((line) => line.id === 'lounge')).toBe(false)
    expect(list.rewards).toContain('One guaranteed rotation on top of the Preferred extra slot.')
    expect(list.perk).toBeNull()
  })

  it('lets a preferred desk pass Focus once the allocator is the source of the count', () => {
    const list = hubChecklist(
      carrier({
        id: 'brisa',
        type: 'budget',
        contractTier: 2,
        diplomacyBand: 'neutral',
        onTimeRate: 0.86,
        onTimeDays: 14,
      }),
      world({ deskAllocator: true, preferredDesks: 1 }),
    )
    expect(list.eligible).toBe(true)
    expect(list.lines.find((line) => line.id === 'desk')).toMatchObject({ status: 'ok', detail: '1 / 1' })
  })

  it('does not add a diplomacy line when the carrier has only a wave 3 score', () => {
    const list = hubChecklist(
      carrier({ id: 'brisa', type: 'budget', contractTier: 2, onTimeRate: 0.9, onTimeDays: 20 }),
      world({ deskAllocator: true, dedicatedDesks: 1 }),
    )
    expect(ids(list.lines)).not.toContain('band')
    expect(list.eligible).toBe(true)
  })

  it('refuses Focus when the on-time sample is shorter than the gate', () => {
    const list = hubChecklist(
      carrier({ id: 'brisa', type: 'budget', contractTier: 2, diplomacyBand: 'neutral', onTimeRate: 0.95, onTimeDays: 3 }),
      world({ deskAllocator: true, preferredDesks: 1 }),
    )
    const onTime = list.lines.find((line) => line.id === 'onTime')
    expect(onTime?.status).toBe('missing')
    expect(onTime?.detail).toContain(`${HUB_TIER_GATE.focus.days} days`)
    expect(onTime?.detail).toContain('3 of 14 days')
    expect(list.eligible).toBe(false)
  })

  it('never gives Atlas Cargo a lounge line, or a desk line', () => {
    const base = hubChecklist(
      carrier({ id: 'atlas_cargo', name: 'Atlas Cargo', type: 'cargo', tier: 'station', contractTier: 3, diplomacyBand: 'warm' }),
      world(),
    )
    expect(base.next).toBe('base')
    expect(ids(base.lines)).not.toContain('lounge')
    expect(ids(base.lines)).not.toContain('desk')
    expect(ids(base.lines)).not.toContain('lane')
    expect(ids(base.lines)).toContain('ramp')

    const hub = hubChecklist(
      carrier({
        id: 'atlas_cargo',
        type: 'cargo',
        tier: 'base',
        contractTier: 4,
        diplomacyBand: 'warm',
        onTimeRate: 0.9,
        onTimeDays: 30,
      }),
      world({ hangars: 1, fuel: 1, ramp: 1, connectionMin: 40, vehicles: { fuelTruck: 1 } }),
    )
    expect(hub.next).toBe('hub')
    expect(ids(hub.lines)).not.toContain('lounge')
    expect(ids(hub.lines)).not.toContain('desk')
    expect(ids(hub.lines)).not.toContain('pier')
    expect(hub.lines.find((line) => line.id === 'band')?.status).toBe('ok')
    expect(hub.lines.find((line) => line.id === 'connection')?.label).toBe('Sort window')
    expect(hub.eligible).toBe(true)
    expect(hub.perk).toMatch(/night rotations/)
  })

  it('keeps a flag carrier at Warm short of Hub', () => {
    const hub = hubChecklist(
      carrier({ id: 'gulf_pearl', type: 'flag', tier: 'base', contractTier: 4, diplomacyBand: 'warm', onTimeRate: 0.95, onTimeDays: 30 }),
      world({ deskAllocator: true, dedicatedDesks: 2, dedicatedLanes: 1, lounges: 1, stands: 6, connectionMin: 30 }),
    )
    expect(hub.next).toBe('hub')
    expect(hub.lines.find((line) => line.id === 'band')?.status).toBe('missing')
    expect(hub.eligible).toBe(false)
  })

  it('never gives Harbor Heli a pier, a lounge, or a lane', () => {
    const list = hubChecklist(
      carrier({ id: 'harbor_heli', name: 'Harbor Heli', type: 'heli', contractTier: 3, diplomacyBand: 'warm', onTimeRate: 0.9, onTimeDays: 14 }),
      world(),
    )
    expect(list.next).toBe('base')
    expect(ids(list.lines)).not.toContain('pier')
    expect(ids(list.lines)).not.toContain('lounge')
    expect(ids(list.lines)).not.toContain('lane')
    expect(ids(list.lines)).not.toContain('desk')
    expect(ids(list.lines)).toEqual(expect.arrayContaining(['relation', 'band', 'onTime', 'pad', 'fuel']))
    expect(list.perk).toMatch(/Medevac/)

    const ready = hubChecklist(
      carrier({ id: 'medevac_one', type: 'heli', contractTier: 3, diplomacyBand: 'partner', onTimeRate: 0.9, onTimeDays: 20 }),
      world({ pads: 1, fuel: 1 }),
    )
    expect(ids(ready.lines)).toEqual(ids(list.lines))
    expect(ready.eligible).toBe(true)
  })

  it('keeps Suncharter off a pier', () => {
    const list = hubChecklist(carrier({ id: 'suncharter', type: 'charter', contractTier: 2, diplomacyBand: 'neutral' }), world())
    expect(list.next).toBe('focus')
    expect(ids(list.lines)).not.toContain('pier')
    expect(list.lines.find((line) => line.id === 'desk')?.label).toBe('Preferred desk')
  })

  it('offers Gulf Pearl Primary only from Hub, and only one carrier at a time', () => {
    const gulf = carrier({
      id: 'gulf_pearl',
      name: 'Gulf Pearl',
      type: 'flag',
      tier: 'hub',
      contractTier: 5,
      diplomacyBand: 'partner',
      onTimeRate: 0.91,
      onTimeDays: 30,
      hubBlockers: [],
    })
    const ready = world({
      deskAllocator: true,
      dedicatedDesks: 4,
      dedicatedLanes: 1,
      lounges: 1,
      pier: 8,
      fuel: 1,
      vehicles: { tug: 1, belt: 1, catering: 1 },
    })
    const hers = hubChecklist(gulf, ready)
    expect(hers.next).toBe('primary')
    expect(hers.eligible).toBe(true)
    expect(hers.lines.find((line) => line.id === 'primary')?.detail).toBe('The slot is open')
    expect(hers.rewards.join(' ')).toMatch(/Flagship fee multiplier/)
    expect(hers.perk).toMatch(/exclusive/)

    const countedEarly = hubChecklist(gulf, { ...ready, deskAllocator: false, dedicatedDesks: 4, dedicatedLanes: 1 })
    expect(countedEarly.eligible).toBe(false)
    expect(countedEarly.lines.find((line) => line.id === 'desk')?.detail).toBe(ALLOCATOR_WAIT)
    expect(countedEarly.lines.find((line) => line.id === 'lane')?.detail).toBe(ALLOCATOR_WAIT)

    const aurora = hubChecklist(
      { ...gulf, id: 'aurora_nordic', name: 'Aurora Nordic' },
      { ...ready, primaryHolderId: 'gulf_pearl', primaryHolderName: 'Gulf Pearl' },
    )
    expect(aurora.eligible).toBe(false)
    expect(aurora.lines.find((line) => line.id === 'primary')?.detail).toBe(primaryTakenSentence('Gulf Pearl'))

    const blocked = hubChecklist(
      { ...gulf, id: 'seoul_star', name: 'Seoul Star', hubBlockers: [primaryTakenSentence('Gulf Pearl')] },
      ready,
    )
    expect(blocked.eligible).toBe(false)
    expect(blocked.lines.find((line) => line.id === 'primary')?.label).toBe(
      'Gulf Pearl is already the Hub (one at a time).',
    )
  })

  it('leaves a budget carrier without a lounge line at Hub', () => {
    const list = hubChecklist(
      carrier({ id: 'brisa', type: 'budget', tier: 'base', contractTier: 4, diplomacyBand: 'partner', onTimeRate: 0.95, onTimeDays: 30 }),
      world({ deskAllocator: true, dedicatedDesks: 4, stands: 6, vehicles: { tug: 1 } }),
    )
    expect(list.next).toBe('hub')
    expect(ids(list.lines)).not.toContain('lounge')
    expect(ids(list.lines)).not.toContain('connection')
    expect(list.eligible).toBe(true)
    expect(list.rewards).toContain('A fee promise on a large base.')
  })

  it('matches the plaque fees and does not invent a second fee multiplier', () => {
    expect(HUB_OFFER_FEE.hub).toBe(HUB_FEE_MIN)
    expect(HUB_OFFER_FEE.primary).toBe(HUB_FEE_MAX)
    expect(HUB_OFFER_FEE.focus).toBe(4_000)
    expect(HUB_OFFER_FEE.base).toBe(8_000)
    expect(CONTRACT_TIERS.map((row) => row.tier)).toEqual([1, 2, 3, 4, 5])
    const list = hubChecklist(
      carrier({ id: 'gulf_pearl', type: 'flag', tier: 'hub', contractTier: 5, diplomacyBand: 'partner', hubBlockers: [] }),
      world(),
    )
    expect(list).not.toHaveProperty('feeMult')
  })

  it('stays off the ladder until the carrier is signed', () => {
    const list = hubChecklist(carrier({ id: 'brisa', type: 'budget', signed: false, contractTier: 5 }), world())
    expect(list.next).toBeNull()
    expect(list.eligible).toBe(false)
    expect(list.lines).toEqual([{ id: 'signed', label: 'Signed', detail: 'No contract yet', status: 'missing' }])
  })
})

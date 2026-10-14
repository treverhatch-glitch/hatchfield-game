import { describe, expect, it } from 'vitest'
import { buildingCard } from './card.ts'

describe('building card', () => {
  it('names the idle tug bay and keeps the counts for a click-open section', () => {
    const card = buildingCard({
      id: '5,5',
      name: 'Medium stand',
      plan: 'stand',
      tier: 'small',
      fleet: { fuel_truck: 1, baggage_tug: 1, belt_loader: 1, catering_truck: 1 },
      staffAssigned: 1,
      demand: 1,
      upkeepPerDay: 0,
    })
    expect(card.status).toBe('limited')
    expect(card.why).toBe('Bay 2 idle: no tug')
    expect(card.baysText).toBe('4 / 5')
    expect(card.bays[1]).toMatchObject({ label: 'Bay 2', state: 'idle', limit: 'no tug' })
    expect(card.icons.find((icon) => icon.id === 'tug')).toMatchObject({
      badge: 'tug',
      why: 'Bay 2 idle: no tug',
    })
    expect(card.throughputText).toBe('4 services')
    expect(card.staffText).toBe('1 / 1')
  })

  it('a jumbo stand stays limited when only a small tug is on the fleet', () => {
    const card = buildingCard({
      id: '1,1',
      name: 'Jumbo stand',
      plan: 'stand',
      tier: 'jumbo',
      fleet: { pushback_tug: 2, hydrant_dispenser: 1, heavy_baggage_tug: 1, main_deck_loader: 1, highlift_catering: 1 },
      staffAssigned: 1,
      demand: 1,
      upkeepPerDay: 0,
    })
    expect(card.why).toBe('Bay 2 idle: no tug')
  })

  it('does not let a staff gap hide the missing tug', () => {
    const card = buildingCard({
      id: '2,2',
      name: 'Medium stand',
      plan: 'stand',
      fleet: {},
      staffAssigned: 0,
      demand: 1,
      upkeepPerDay: 0,
    })
    expect(card.why).toBe('Bay 1 idle: no fuel truck')
    expect(card.icons.map((icon) => icon.id)).toEqual(expect.arrayContaining(['tug', 'fuel', 'staff']))
  })

  it('calls a staffed empty stand idle, and a working one clear', () => {
    const reading = {
      name: 'Small stand',
      plan: 'stand' as const,
      fleet: { pushback_tug: 1, fuel_truck: 1, baggage_tug: 1, belt_loader: 1, catering_truck: 1 },
      staffAssigned: 1,
      upkeepPerDay: 0,
    }
    const idle = buildingCard({ ...reading, id: '3,3', demand: 0 })
    expect(idle.status).toBe('idle')
    expect(idle.why).toBe('Idle — nothing is using a bay')
    expect(idle.icons).toHaveLength(0)
    expect(idle.baysText).toBe('0 / 5')

    const working = buildingCard({ ...reading, id: '3,4', demand: 1 })
    expect(working.status).toBe('working')
    expect(working.why).toBe('Clear')
    expect(working.baysText).toBe('5 / 5')
  })

  it('keeps a building that is still going up closed, with no bottleneck icons', () => {
    const card = buildingCard({
      id: '8,8',
      name: 'Airport hotel',
      plan: 'late_hotel',
      closed: true,
      upkeepPerDay: 0,
    })
    expect(card.statusLabel).toBe('Closed')
    expect(card.why).toBe('Still building')
    expect(card.throughputText).toBe('0 rooms')
    expect(card.icons).toHaveLength(0)
    expect(card.baysText).toBe('0 / 1')
  })

  it('uses measured service points when the sim already counted them', () => {
    const card = buildingCard({
      id: 'checkin',
      name: 'Check-in',
      plan: 'checkin',
      staffAssigned: 1,
      staffNeeded: 2,
      upkeepPerDay: 40,
      throughputPerMin: 6.25,
      unit: 'pax/min',
      demand: 1,
      bays: [
        { inUse: true },
        { inUse: false, limit: 'unstaffed', icon: 'staff', badge: 'staff' },
      ],
    })
    expect(card.why).toBe('Bay 2 idle: unstaffed')
    expect(card.baysText).toBe('1 / 2')
    expect(card.throughputText).toBe('6.3 pax/min')
    expect(card.upkeepText).toBe('$40 / day')
    expect(card.staffText).toBe('1 / 2')
    expect(card.icons[0]?.why).toBe('Bay 2 idle: unstaffed')
  })
})

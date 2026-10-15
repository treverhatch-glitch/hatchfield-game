import { describe, expect, it } from 'vitest'
import { hubChecklist, emptyHubFacilities, type HubChecklist } from './checklist.ts'
import { hubProgressRows, hubShowcase, hubStatusNote } from './present.ts'
import type { HubCarrier } from './checklist.ts'

function carrier(over: Partial<HubCarrier> & Pick<HubCarrier, 'id' | 'type'>): HubCarrier {
  return {
    name: over.id,
    signed: true,
    tier: 'station',
    contractTier: 2,
    onTimeRate: 0.9,
    onTimeDays: 20,
    ...over,
  }
}

describe('hub profile copy', () => {
  it('puts Primary hub first and names a waiting desk', () => {
    const brisa = hubChecklist(carrier({ id: 'brisa', name: 'Brisa', type: 'budget' }), emptyHubFacilities())
    const gulf = hubChecklist(
      carrier({ id: 'gulf_pearl', name: 'Gulf Pearl', type: 'flag', tier: 'primary', contractTier: 5 }),
      emptyHubFacilities(),
    )
    const rows = hubProgressRows([
      { id: 'brisa', name: 'Brisa', type: 'budget', checklist: brisa },
      { id: 'gulf_pearl', name: 'Gulf Pearl', type: 'flag', checklist: gulf },
    ])
    expect(rows.map((row) => row.id)).toEqual(['gulf_pearl', 'brisa'])
    expect(rows[0].primary).toBe(true)
    expect(hubStatusNote('budget', brisa)).toBe('desks')
    expect(hubShowcase(brisa).next).toContain('Waiting on the desk allocator')
    expect(hubShowcase(brisa).now).toBe('Common use')
  })

  it('keeps a finished regional on feeding and a charter in season', () => {
    const done = (type: 'regional' | 'charter'): HubChecklist =>
      hubChecklist(carrier({ id: type, type, tier: 'focus' }), emptyHubFacilities())
    expect(hubStatusNote('regional', done('regional'))).toBe('feeding')
    expect(hubStatusNote('charter', done('charter'))).toBe('in season')
  })
})

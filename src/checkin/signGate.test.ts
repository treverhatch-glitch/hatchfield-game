import { describe, expect, it } from 'vitest'
import { SERVICE_POINT_TUNING } from '../servicepoints/config.ts'
import { checkinSignGate } from './signGate.ts'

describe('contract check-in capacity', () => {
  it('blocks a passenger contract the open desks and kiosks cannot clear', () => {
    const blocked = checkinSignGate({
      kind: 'pax',
      label: 'Harbor Air',
      peakPaxPerMin: 28,
      openDesks: 1,
      kiosks: 1,
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.capacity).toBe(14)
    expect(blocked.line).toContain('28 passengers a minute')
    expect(blocked.line).toContain('Desks and kiosks clear 14')
    expect(blocked.line).toContain('Add check-in desks')

    const clear = checkinSignGate({
      kind: 'pax',
      label: 'Northline',
      peakPaxPerMin: 14,
      openDesks: 1,
      kiosks: 1,
    })
    expect(clear.ok).toBe(true)
    expect(clear.line).not.toContain('Add check-in desks')
  })

  it('does not ask a freighter for check-in desks', () => {
    const cargo = checkinSignGate({ kind: 'cargo', label: 'Iron', peakPaxPerMin: 48, openDesks: 0, kiosks: 0 })
    expect(cargo.ok).toBe(true)
    expect(cargo.line).toBe('')
  })

  it('keeps the kiosk at a share of a staffed desk', () => {
    expect(SERVICE_POINT_TUNING.kioskServiceShare).toBe(0.45)
  })
})

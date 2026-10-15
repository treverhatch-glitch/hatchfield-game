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
    expect(blocked.capacity).toBe(18)
    expect(blocked.line).toContain('28 passengers a minute')
    expect(blocked.line).toContain('Desks and kiosks clear 18')
    expect(blocked.line).toContain('Add check-in desks')
    expect(blocked.line).toContain('expand the hall')
    expect(blocked.line).toContain('Room for 1 carrier')
    expect(blocked.slots).toBe(1)

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

  it('a bought lane or a bigger hall opens a carrier the desks alone cannot', () => {
    const desksOnly = checkinSignGate({
      kind: 'pax',
      label: 'Brisa',
      peakPaxPerMin: 42,
      openDesks: 3,
      kiosks: 1,
    })
    expect(desksOnly.ok).toBe(false)
    expect(desksOnly.slots).toBe(2)

    const withLane = checkinSignGate({
      kind: 'pax',
      label: 'Brisa',
      peakPaxPerMin: 42,
      openDesks: 3,
      kiosks: 1,
      openLanes: 1,
      bundleLanes: 0,
    })
    expect(withLane.ok).toBe(true)
    expect(withLane.slots).toBeGreaterThanOrEqual(3)

    const withHall = checkinSignGate({
      kind: 'pax',
      label: 'Brisa',
      peakPaxPerMin: 42,
      openDesks: 3,
      kiosks: 1,
      hallTier: 2,
      premade: true,
      openLanes: 2,
      bundleLanes: 2,
    })
    expect(withHall.ok).toBe(true)
    expect(withHall.capacity).toBeGreaterThan(desksOnly.capacity)

    const fourth = checkinSignGate({
      kind: 'pax',
      label: 'Zephyr',
      peakPaxPerMin: 56,
      openDesks: 2,
      kiosks: 1,
      hallTier: 2,
      premade: true,
      openLanes: 3,
      bundleLanes: 3,
    })
    expect(fourth.ok).toBe(false)
    expect(fourth.line).toContain('expand the hall')

    const satellites = checkinSignGate({
      kind: 'pax',
      label: 'Zephyr',
      peakPaxPerMin: 56,
      openDesks: 3,
      kiosks: 1,
      hallTier: 3,
      premade: true,
      openLanes: 4,
      bundleLanes: 4,
    })
    expect(satellites.ok).toBe(true)
    expect(satellites.slots).toBeGreaterThanOrEqual(4)
  })
})

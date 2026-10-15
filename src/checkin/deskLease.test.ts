import { describe, expect, it } from 'vitest'
import { leasesFor, releaseLease, requestLease, type DeskLeasePoint } from './deskLease.ts'

const desk: DeskLeasePoint = { id: 'd1', kind: 'desk', built: true, staffed: true, kiosk: false }
const lane: DeskLeasePoint = { id: 'l1', kind: 'lane', built: true, staffed: true, kiosk: false }
const points = [
  desk,
  lane,
  { id: 'kiosk', kind: 'desk', built: true, staffed: true, kiosk: true },
  { id: 'dark', kind: 'desk', built: true, staffed: false, kiosk: false },
] satisfies DeskLeasePoint[]

describe('desk and lane leases', () => {
  it('leases a staffed desk and lists it for that carrier', () => {
    const asked = requestLease([], points, 'd1', 'brisa', 'dedicated')
    expect(asked.ok).toBe(true)
    if (!asked.ok) return
    expect(leasesFor(asked.leases, 'brisa')).toEqual([
      { pointId: 'd1', kind: 'desk', airlineId: 'brisa', mode: 'dedicated' },
    ])
    expect(leasesFor(asked.leases, 'gulf_pearl')).toEqual([])
    expect(releaseLease(asked.leases, 'd1')).toEqual([])
  })

  it('refuses an unstaffed point, a kiosk, a missing point, and a desk someone else holds', () => {
    expect(requestLease([], points, 'dark', 'brisa', 'dedicated')).toEqual({ ok: false, reason: 'unstaffed' })
    expect(requestLease([], points, 'kiosk', 'brisa', 'preferred')).toEqual({ ok: false, reason: 'kiosk' })
    expect(requestLease([], points, 'gone', 'brisa', 'dedicated')).toEqual({ ok: false, reason: 'not_built' })
    const held = requestLease([], points, 'l1', 'brisa', 'dedicated')
    if (!held.ok) throw new Error('lane')
    expect(requestLease(held.leases, points, 'l1', 'gulf_pearl', 'dedicated')).toEqual({ ok: false, reason: 'taken' })
    const again = requestLease(held.leases, points, 'l1', 'brisa', 'preferred')
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.leases[0]?.mode).toBe('preferred')
  })
})

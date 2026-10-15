import { describe, expect, it } from 'vitest'
import { LEASE_SCORE_CAP, SCORE_PER_LEASE } from './config.ts'
import { facilityAskMet, leaseCredit, releaseBreaksTier, tierBelow } from './leases.ts'

describe('facility lease rules', () => {
  it('caps dedicated credit and leaves a spare lease off the checklist gate', () => {
    expect(leaseCredit(1)).toBe(SCORE_PER_LEASE.dedicated)
    expect(leaseCredit(0)).toBe(0)
    expect(leaseCredit(40)).toBe(LEASE_SCORE_CAP)
    expect(releaseBreaksTier('budget', 'base', 'lounge', 0)).toBe(false)
    expect(releaseBreaksTier('flag', 'hub', 'lounge', 0)).toBe(true)
    expect(releaseBreaksTier('flag', 'hub', 'lounge', 1)).toBe(false)
    expect(releaseBreaksTier('cargo', 'hub', 'hangar', 0)).toBe(true)
    expect(releaseBreaksTier('flag', 'primary', 'gate', 7)).toBe(true)
    expect(facilityAskMet('flag', 'hub', { lounge: 1, pier: 0, hangar: 0 })).toBe(true)
    expect(tierBelow('cargo', 'hub')).toBe('base')
    expect(tierBelow('flag', 'focus')).toBe('station')
  })
})
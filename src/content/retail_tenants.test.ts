import { describe, it, expect } from 'vitest'
import {
  RETAIL_TENANTS,
  tenantsForStars,
  tenantsForType,
  wouldCancel,
  validateRetailTenants,
} from './retail_tenants.ts'
import type { RetailTenantDef } from './retail_tenants.ts'
import { SHOP_TYPE_IDS } from './_shopIds.ts'

describe('retail_tenants', () => {
  it('should have 12 retail tenants', () => {
    expect(RETAIL_TENANTS.length).toBe(12)
  })

  it('should pass validation', () => {
    const errors = validateRetailTenants(RETAIL_TENANTS, SHOP_TYPE_IDS)
    expect(errors).toEqual([])
  })

  it('should have unique ids', () => {
    const ids = RETAIL_TENANTS.map(t => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should cover at least 8 distinct concession type ids', () => {
    const types = new Set(RETAIL_TENANTS.map(t => t.concessionTypeId))
    expect(types.size).toBeGreaterThanOrEqual(8)
  })

  it('all minStars should be in 1..5', () => {
    for (const t of RETAIL_TENANTS) {
      expect(t.minStars).toBeGreaterThanOrEqual(1)
      expect(t.minStars).toBeLessThanOrEqual(5)
    }
  })

  it('all cancelAfterMissedDays should be 5', () => {
    for (const t of RETAIL_TENANTS) {
      expect(t.cancelAfterMissedDays).toBe(5)
    }
  })

  it('all rentPerM2 should be > 0', () => {
    for (const t of RETAIL_TENANTS) {
      expect(t.rentPerM2).toBeGreaterThan(0)
    }
  })

  it('all commission should be between 0.05 and 0.35', () => {
    for (const t of RETAIL_TENANTS) {
      expect(t.commission).toBeGreaterThanOrEqual(0.05)
      expect(t.commission).toBeLessThanOrEqual(0.35)
    }
  })

  describe('tenantsForStars', () => {
    it('returns tenants requiring up to the given stars', () => {
      const star3Tenants = tenantsForStars(3)
      for (const t of star3Tenants) {
        expect(t.minStars).toBeLessThanOrEqual(3)
      }
      expect(star3Tenants.length).toBeGreaterThan(0)
    })
  })

  describe('tenantsForType', () => {
    it('returns tenants for a specific type', () => {
      const coffeeTenants = tenantsForType('coffee_kiosk')
      for (const t of coffeeTenants) {
        expect(t.concessionTypeId).toBe('coffee_kiosk')
      }
      expect(coffeeTenants.length).toBeGreaterThan(0)
    })
  })

  describe('wouldCancel', () => {
    it('returns true if missedDays is >= cancelAfterMissedDays', () => {
      const tenant = RETAIL_TENANTS[0]
      expect(wouldCancel(5, tenant)).toBe(true)
      expect(wouldCancel(6, tenant)).toBe(true)
    })

    it('returns false if missedDays is < cancelAfterMissedDays', () => {
      const tenant = RETAIL_TENANTS[0]
      expect(wouldCancel(4, tenant)).toBe(false)
      expect(wouldCancel(0, tenant)).toBe(false)
    })
  })

  describe('validateRetailTenants', () => {
    it('returns error for duplicate id', () => {
      const list: RetailTenantDef[] = [
        RETAIL_TENANTS[0],
        RETAIL_TENANTS[0]
      ]
      const errors = validateRetailTenants(list)
      expect(errors).toContain(`Duplicate tenant id: ${RETAIL_TENANTS[0].id}`)
    })

    it('returns error for invalid concessionTypeId', () => {
      const t = { ...RETAIL_TENANTS[0], concessionTypeId: 'invalid_type' }
      const errors = validateRetailTenants([t])
      expect(errors).toContain(`Invalid concessionTypeId for tenant ${t.id}: invalid_type`)
    })

    it('returns error for invalid minStars', () => {
      const t = { ...RETAIL_TENANTS[0], minStars: 6 }
      const errors = validateRetailTenants([t])
      expect(errors).toContain(`Invalid minStars for tenant ${t.id}: 6`)
    })
  })
})

import { SHOP_TYPE_IDS } from './_shopIds.ts'

export interface RetailTenantDef {
  id: string
  brand: string
  /** Which concession type this brand fills */
  concessionTypeId: string
  /** Airport star rating required to unlock the offer (1-5) */
  minStars: number
  /** Rent per m2 per game day (USD) */
  rentPerM2: number
  /** Sales commission 0-1 */
  commission: number
  /** Daily sales target (USD) the player must hit */
  dailySalesTarget: number
  /** Missed-target days before the tenant cancels (ACEO = 5) */
  cancelAfterMissedDays: number
  airsidePreferred: boolean
  blurb: string
}

export const RETAIL_TENANTS: RetailTenantDef[] = [
  {
    id: 'tnt_coffee_express',
    brand: 'Bean Express',
    concessionTypeId: 'coffee_kiosk',
    minStars: 1,
    rentPerM2: 50,
    commission: 0.05,
    dailySalesTarget: 500,
    cancelAfterMissedDays: 5,
    airsidePreferred: false,
    blurb: 'Quick coffee for people on the go.',
  },
  {
    id: 'tnt_bakery_delight',
    brand: 'Crust & Crumb',
    concessionTypeId: 'bakery',
    minStars: 2,
    rentPerM2: 65,
    commission: 0.10,
    dailySalesTarget: 800,
    cancelAfterMissedDays: 5,
    airsidePreferred: false,
    blurb: 'Freshly baked goods every morning.',
  },
  {
    id: 'tnt_burger_hub',
    brand: 'Burger Hub',
    concessionTypeId: 'fast_food',
    minStars: 2,
    rentPerM2: 80,
    commission: 0.12,
    dailySalesTarget: 1200,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Classic fast food burgers and fries.',
  },
  {
    id: 'tnt_fine_dining',
    brand: 'Skyline Dining',
    concessionTypeId: 'sit_down_restaurant',
    minStars: 4,
    rentPerM2: 120,
    commission: 0.20,
    dailySalesTarget: 3000,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'An upscale dining experience before the flight.',
  },
  {
    id: 'tnt_duty_free_global',
    brand: 'Global Duty Free',
    concessionTypeId: 'duty_free',
    minStars: 3,
    rentPerM2: 200,
    commission: 0.25,
    dailySalesTarget: 5000,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Tax-free shopping for international travelers.',
  },
  {
    id: 'tnt_luxury_watches',
    brand: 'Chrono Lux',
    concessionTypeId: 'luxury_boutique',
    minStars: 5,
    rentPerM2: 300,
    commission: 0.35,
    dailySalesTarget: 8000,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Premium watches and accessories.',
  },
  {
    id: 'tnt_news_stand',
    brand: 'Daily Read',
    concessionTypeId: 'newsagent',
    minStars: 1,
    rentPerM2: 40,
    commission: 0.05,
    dailySalesTarget: 300,
    cancelAfterMissedDays: 5,
    airsidePreferred: false,
    blurb: 'Magazines, newspapers, and snacks.',
  },
  {
    id: 'tnt_electronics_hub',
    brand: 'Tech Haven',
    concessionTypeId: 'electronics',
    minStars: 3,
    rentPerM2: 150,
    commission: 0.15,
    dailySalesTarget: 2500,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Travel adapters, headphones, and gadgets.',
  },
  {
    id: 'tnt_pharmacy_care',
    brand: 'Health & Travel',
    concessionTypeId: 'pharmacy',
    minStars: 2,
    rentPerM2: 70,
    commission: 0.08,
    dailySalesTarget: 600,
    cancelAfterMissedDays: 5,
    airsidePreferred: false,
    blurb: 'Over-the-counter medicine and toiletries.',
  },
  {
    id: 'tnt_currency_exchange',
    brand: 'Forex Global',
    concessionTypeId: 'currency_exchange',
    minStars: 2,
    rentPerM2: 100,
    commission: 0.10,
    dailySalesTarget: 1000,
    cancelAfterMissedDays: 5,
    airsidePreferred: false,
    blurb: 'Fast and reliable currency exchange.',
  },
  {
    id: 'tnt_coffee_premium',
    brand: 'AeroRoast',
    concessionTypeId: 'coffee_kiosk',
    minStars: 3,
    rentPerM2: 70,
    commission: 0.08,
    dailySalesTarget: 1000,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Artisan coffee for the discerning traveler.',
  },
  {
    id: 'tnt_fast_food_chicken',
    brand: 'Cluck & Go',
    concessionTypeId: 'fast_food',
    minStars: 2,
    rentPerM2: 85,
    commission: 0.11,
    dailySalesTarget: 1300,
    cancelAfterMissedDays: 5,
    airsidePreferred: true,
    blurb: 'Fried chicken and sides.',
  }
]

export function tenantsForStars(stars: number): RetailTenantDef[] {
  return RETAIL_TENANTS.filter(t => t.minStars <= stars)
}

export function tenantsForType(typeId: string): RetailTenantDef[] {
  return RETAIL_TENANTS.filter(t => t.concessionTypeId === typeId)
}

export function wouldCancel(missedDays: number, tenant: RetailTenantDef): boolean {
  return missedDays >= tenant.cancelAfterMissedDays
}

export function validateRetailTenants(list: RetailTenantDef[], shopIds: readonly string[] = SHOP_TYPE_IDS): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const tenant of list) {
    if (ids.has(tenant.id)) {
      errors.push(`Duplicate tenant id: ${tenant.id}`)
    }
    ids.add(tenant.id)

    if (!shopIds.includes(tenant.concessionTypeId)) {
      errors.push(`Invalid concessionTypeId for tenant ${tenant.id}: ${tenant.concessionTypeId}`)
    }

    if (tenant.minStars < 1 || tenant.minStars > 5) {
      errors.push(`Invalid minStars for tenant ${tenant.id}: ${tenant.minStars}`)
    }

    if (tenant.commission < 0.05 || tenant.commission > 0.35) {
      errors.push(`Invalid commission for tenant ${tenant.id}: ${tenant.commission}`)
    }

    if (tenant.rentPerM2 <= 0) {
      errors.push(`Invalid rentPerM2 for tenant ${tenant.id}: ${tenant.rentPerM2}`)
    }

    if (tenant.cancelAfterMissedDays !== 5) {
      errors.push(`Invalid cancelAfterMissedDays for tenant ${tenant.id}: ${tenant.cancelAfterMissedDays}`)
    }
  }

  return errors
}

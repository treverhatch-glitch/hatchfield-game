/**
 * Prefab hall counters. The catering engine is the only shelf.
 * Sale prices stay in `DEFAULT_CATERING.prices`. Cost of goods is charged
 * once per restock, on the units the runner actually shelves.
 *
 * Gross margin on a stocked counter (price − unit COGS) / price:
 * - burger $12 − $3 = $9, 75%
 * - coffee $5 − $1 = $4, 80%
 * - sandwich $8 − $2 = $6, 75%
 * - water $3 − $1 = $2, 67%
 * - magazine $7 − $2 = $5, 71%
 * - souvenir $18 − $4 = $14, 78%
 *
 * A full burger restock (80 servings) costs 80 × $3 = $240 and can sell for
 * 80 × $12 = $960. The counter stays clearly profitable while it has stock.
 */
import { DEFAULT_CATERING } from './defaults.ts'
import type { ShopSku } from './types.ts'

export type HallCounterKind = 'food' | 'shop'

export interface HallCounterSpec {
  shopId: string
  sku: ShopSku
  /** Servings on the shelf when the prefab hall opens. */
  opening: number
  /** Ask for a runner when the shelf falls to this. */
  reorderAt: number
}

export const HALL_COUNTER: Record<HallCounterKind, HallCounterSpec> = {
  food: { shopId: 'shop_burger', sku: 'burger', opening: 80, reorderAt: 32 },
  shop: { shopId: 'shop_news', sku: 'souvenir', opening: 60, reorderAt: 24 },
}

/** Unit cost of goods. Kept under the sale price so a stocked counter earns. */
export const HALL_COGS: Record<ShopSku, number> = {
  burger: 3,
  coffee: 1,
  sandwich: 2,
  water: 1,
  magazine: 2,
  souvenir: 4,
}

export function unitMargin(sku: ShopSku): { price: number; cogs: number; margin: number } {
  const price = DEFAULT_CATERING.prices[sku]
  const cogs = HALL_COGS[sku]
  return { price, cogs, margin: price > 0 ? (price - cogs) / price : 0 }
}

/** Dollars to post on `retail_cogs` for one finished unload. */
export function cogsFor(added: Partial<Record<ShopSku, number>>): number {
  let sum = 0
  for (const [sku, n] of Object.entries(added) as [ShopSku, number][]) {
    if (n > 0) sum += n * HALL_COGS[sku]
  }
  return Math.round(sum)
}

/** Info chip when the shelf the guest is looking at is empty. */
export function stockoutChip(etaSec: number): string {
  const sec = Math.max(1, Math.round(etaSec))
  return `Out of stock, restock run ${sec} s away`
}

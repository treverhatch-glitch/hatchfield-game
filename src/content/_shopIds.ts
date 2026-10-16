/** Concession ids the retail brands may fill. Kept in step with CONCESSION_TYPES. */
import { CONCESSION_TYPES } from './shops.ts'

export const SHOP_TYPE_IDS = CONCESSION_TYPES.map((shop) => shop.id)
export type ShopTypeId = (typeof SHOP_TYPE_IDS)[number]

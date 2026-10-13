import type { CateringConfig, ShopConfig } from './types.ts'

export const DEFAULT_CATERING: CateringConfig = {
  trucks: 2,
  supplyRunners: 1,
  kitchenMealsPerMinute: 6,
  kitchenCapacity: 2400,
  kitchenInitial: { hot_meal: 600, snack_box: 600, drinks: 1200 },
  depotInitialPerSku: 400,
  depotRestockPerDay: 400,
  cartsPerPaxDivisor: 30,
  durations: {
    loading_at_kitchen: 4,
    driving_to_stand: 5,
    parking: 1,
    crew_exit: 1,
    lift_raise: 2,
    carts_out: 3,
    carts_in: 4,
    lift_lower: 2,
    crew_board: 1,
    driving_to_kitchen: 5,
    unloading_at_kitchen: 3,
  },
  supplyDurations: {
    loading_at_depot: 3,
    driving_to_dock: 4,
    security_screening: 3,
    trolley_to_shop: 3,
    shelving: 4,
    returning: 5,
  },
  outOfStockHappiness: -3,
  prices: { burger: 12, coffee: 5, sandwich: 8, water: 3, magazine: 7, souvenir: 18 },
}

export const DEFAULT_SHOPS: ShopConfig[] = [
  { id: 'shop_burger', name: 'Burger Bar', skus: ['burger', 'water'], capacityPerSku: 60, reorderAt: 15 },
  { id: 'shop_cafe', name: 'Gate Café', skus: ['coffee', 'sandwich', 'water'], capacityPerSku: 80, reorderAt: 20 },
  { id: 'shop_news', name: 'Newsstand', skus: ['magazine', 'water', 'souvenir'], capacityPerSku: 50, reorderAt: 10 },
]

const NOUN: Record<string, string> = {
  burger: 'burgers',
  coffee: 'coffee',
  sandwich: 'sandwiches',
  water: 'water',
  magazine: 'magazines',
  souvenir: 'souvenirs',
}

export function wishThought(sku: string): string {
  return `wish they had ${NOUN[sku] ?? sku}`
}

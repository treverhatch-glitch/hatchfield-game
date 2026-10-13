/**
 * Terminal build kit — food outlets, seating, and decorations.
 *
 * Tunable numbers live in the connectivity catalog. `terminal.ts` merges
 * KIT_ITEMS into ITEMS.
 */
import type { ItemDef } from './terminal.ts'
import type { PaxTag } from './guests.ts'

import { CONNECTIVITY_CATALOG } from '../connectivity/catalog.ts'

export type KitCategory = 'food' | 'seating' | 'decor' | 'links'

/** One hall cell holds this many slots. Desks and lanes fill the whole cell. */
export const CELL_SLOTS = 4

export interface OutletSpec {
  /** Multiplies the tag price on the hall food counter. */
  priceMult: number
  /** Hunger cleared by one meal. */
  hunger: number
  /** Happiness for a meal. */
  joy: number
  /** Energy cleared by one meal (coffee, a sit-down). */
  energy: number
  /** Servings this outlet adds to the shared food shelf on top of the room base. */
  extraStock: number
  /** Tags that pick this outlet first. */
  tags: PaxTag[]
}

export const KIT_TUNING = {
  /** Comfort stops stacking here, so a forest of plants is not free happiness. */
  comfortCap: 10,
  /** Happiness per second per comfort point while a guest is in the zone. */
  comfortJoyPerSec: 0.02,
  /** Energy recovered per second while seated. The needs drift adds 1.1/s. */
  seatRestPerSec: 1.6,
  /** Happiness per second while seated. */
  seatJoyPerSec: 0.08,
  /** Bulldozing a placed kit item pays this share back. */
  refundShare: 0.4,
} as const

/** Hall nodes where a waiting guest looks for a seat. */
export const SEAT_NODES = ['gate', 'claim', 'food', 'lounge'] as const

const ANY_PUBLIC: ItemDef['zones'] = ['checkin', 'gates', 'arrivals', 'retail', 'toilets']

/** Outlet tuning for the food items. The café keeps the old counter numbers. */
export const OUTLETS: Partial<Record<string, OutletSpec>> = {
  cafe: { priceMult: 1, hunger: 50, joy: 6, energy: 10, extraStock: 0, tags: ['business'] },
  fast_food: {
    priceMult: 0.8,
    hunger: 55,
    joy: 5,
    energy: 0,
    extraStock: 6,
    tags: ['budget', 'family'],
  },
  restaurant: {
    priceMult: 1.5,
    hunger: 75,
    joy: 10,
    energy: 15,
    extraStock: 4,
    tags: ['premium', 'business'],
  },
}

export const KIT_ITEMS: ItemDef[] = [
  {
    id: 'fast_food',
    name: 'Fast food',
    blurb: 'Burgers at speed. Cheap meals, a big shelf, budget and family pax first.',
    zones: ['retail', 'gates', 'arrivals'],
    servers: 2,
    queueCap: 10,
    serviceSec: 3,
    cost: 8000,
    upkeep: 60,
    staff: 2,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    room: 'food',
    category: 'food',
    size: 2,
  },
  {
    id: 'bench',
    name: 'Bench',
    blurb: 'Three seats. Waiting pax sit, rest, and grumble less.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 350,
    upkeep: 1,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0.05,
    paxCap: 3,
    category: 'seating',
    size: 1,
    seats: 3,
  },
  {
    id: 'plant',
    name: 'Planter',
    blurb: 'A small green lift for the cells around it. Needs watering.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 250,
    upkeep: 1,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 1,
    comfort: 2,
    comfortRadius: 1,
  },
  {
    id: 'art',
    name: 'Art piece',
    blurb: 'A sculpture on a plinth. Calms the cells around it.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 900,
    upkeep: 2,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 1,
    comfort: 3,
    comfortRadius: 1,
  },
  {
    id: 'info_screen',
    name: 'Flight screen',
    blurb: 'Departures board. People relax when they can see their gate.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 800,
    upkeep: 5,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 1,
    comfort: 2,
    comfortRadius: 2,
  },
  {
    id: 'info_kiosk',
    name: 'Info kiosk',
    blurb: 'Touch-screen map. A small comfort bump nearby.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 1200,
    upkeep: 4,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 1,
    comfort: 2,
    comfortRadius: 1,
  },
  {
    id: 'fountain',
    name: 'Water feature',
    blurb: 'A fountain basin. Wide calm radius, real pump upkeep.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 4500,
    upkeep: 12,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 2,
    comfort: 5,
    comfortRadius: 2,
  },
  {
    id: 'walkway',
    name: CONNECTIVITY_CATALOG.moving_walkway.name,
    blurb: `${CONNECTIVITY_CATALOG.moving_walkway.blurb} ${CONNECTIVITY_CATALOG.moving_walkway.catch}`,
    zones: ['gates', 'arrivals'],
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: CONNECTIVITY_CATALOG.moving_walkway.cost,
    upkeep: CONNECTIVITY_CATALOG.moving_walkway.upkeepPerDay,
    staff: 0,
    minFieldLevel: CONNECTIVITY_CATALOG.moving_walkway.fieldLevel,
    wearPerUse: 0.05,
    category: 'links',
    size: 4,
    perk: 'Faster walk along the belt',
  },
]

/** Kit fields layered onto the existing food and seat items. */
export const KIT_PATCHES: Partial<Record<string, Partial<ItemDef>>> = {
  cafe: { category: 'food', size: 2 },
  restaurant: { category: 'food', size: 4 },
  seat_row: { category: 'seating', size: 1, seats: 4 },
}

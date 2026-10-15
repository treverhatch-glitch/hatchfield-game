/**
 * Terminal build kit — food outlets, seating, and decorations.
 *
 * Tunable numbers live in the connectivity catalog. `terminal.ts` merges
 * KIT_ITEMS into ITEMS.
 */
import type { ItemDef } from './terminal.ts'
import type { PaxTag } from './guests.ts'

import { CONNECTIVITY_CATALOG } from '../connectivity/catalog.ts'

export type KitCategory = 'commercial' | 'seating' | 'decor' | 'links' | 'service' | 'rooms'

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
const ALL_ZONES: ItemDef['zones'] = ['checkin', 'security', 'gates', 'arrivals', 'retail', 'toilets']

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
    cost: 6_000,
    upkeep: 60,
    staff: 2,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    room: 'food',
    category: 'commercial',
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
    id: 'departures_wall',
    name: 'Departures wall',
    blurb: 'Three big flight screens on a lit pylon. Calms a whole concourse.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 3_200,
    upkeep: 18,
    staff: 0,
    minFieldLevel: 2,
    wearPerUse: 0,
    category: 'decor',
    size: 2,
    comfort: 3,
    comfortRadius: 3,
  },
  {
    id: 'gate_pylon',
    name: 'Gate sign',
    blurb: 'Lit gate number on a tall post. Lost pax find their gate faster.',
    zones: ['gates'],
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 600,
    upkeep: 3,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'decor',
    size: 1,
    comfort: 1,
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
    footprint: 'belt',
    perk: 'Faster walk along the belt',
  },
  {
    id: 'trash_can',
    name: 'Trash can',
    blurb: 'Catches wrappers and cups within ~12 m. Fills up — janitors empty it.',
    zones: ANY_PUBLIC,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 150,
    upkeep: 1,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'service',
    size: 1,
  },
  {
    id: 'bag_drop',
    name: 'Bag drop',
    blurb: 'Drops a checked bag after the ticket. The belt behind it has to stay clear.',
    zones: ['checkin'],
    servers: 1,
    queueCap: 6,
    serviceSec: 2,
    cost: 7_000,
    upkeep: 25,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    room: 'bagdrop',
    category: 'rooms',
    size: 4,
  },
  {
    id: 'passport_booth',
    name: 'Passport control',
    blurb: 'Three booths for an international arrival. Officers and the glass are on the daily bill.',
    zones: ['arrivals'],
    servers: 1,
    queueCap: 8,
    serviceSec: 2,
    cost: 14_000,
    upkeep: 45,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.3,
    category: 'rooms',
    size: 4,
  },
  {
    id: 'scanner',
    name: 'Security scanner',
    blurb: 'An extra X-ray and walk-through. Adds a server on the secure line.',
    zones: ['security'],
    servers: 1,
    queueCap: 8,
    serviceSec: 2.5,
    cost: 9_000,
    upkeep: 45,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.6,
    room: 'security',
    category: 'rooms',
    size: 2,
  },
  {
    id: 'wall',
    name: 'Wall',
    blurb: 'Closes a cell. Passengers walk around it. Nothing can be placed on it.',
    zones: ALL_ZONES,
    servers: 0,
    queueCap: 0,
    serviceSec: 0,
    cost: 400,
    upkeep: 1,
    staff: 0,
    minFieldLevel: 1,
    wearPerUse: 0,
    category: 'rooms',
    size: 4,
    footprint: 'wall',
  },
  {
    id: 'newsagent',
    name: 'Newsagent',
    blurb: 'Airside shop. Browsing clears the shop need.',
    zones: ['retail', 'gates'],
    servers: 1,
    queueCap: 6,
    serviceSec: 4,
    cost: 6_000,
    upkeep: 40,
    staff: 1,
    minFieldLevel: 1,
    wearPerUse: 0.2,
    room: 'souvenir',
    category: 'commercial',
    size: 2,
  },
]

/** Kit fields layered onto the existing food and seat items. */
export const KIT_PATCHES: Partial<Record<string, Partial<ItemDef>>> = {
  cafe: { category: 'commercial', size: 2 },
  restaurant: { category: 'commercial', size: 4 },
  seat_row: { category: 'seating', size: 1, seats: 4 },
  checkin_belt: { category: 'rooms' },
  security_small: { category: 'rooms' },
  toilet: { category: 'rooms' },
  wayfinding: { category: 'rooms' },
  bag_system: { category: 'rooms' },
  claim_carousel: { category: 'rooms', size: 4 },
}

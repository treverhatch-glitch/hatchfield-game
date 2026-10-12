import type {
  Airline,
  BuildDef,
  FuelContract,
  RoomDef,
  Tool,
} from './types'

export const START_CASH = { easy: 120_000, standard: 64_000 } as const

export const RUNWAY_TILE = 2800
/** One-click regional strip (Airport Tycoon style). Later: heavy / long-haul classes. */
export const RUNWAY_PREFAB_COST = 38000
export const RUNWAY_PREFAB_LEN = 14
export const RUNWAY_PREFAB_WID = 2
export const TAXI_COST = 700
export const STAND_COST = 6200
export const TERMINAL_COST = 14800
export const SNACK_COST = 3600
export const BAGS_COST = 4800
export const FUEL_COST = 5600
export const BULLDOZE_REFUND = 0.4
export const MIN_RUNWAY = 6
export const BAG_DROP_PAY = 180
export const LOADS_PER_BUY = 4

export const AIRLINES: Record<'northline' | 'harbor', Airline> = {
  northline: {
    id: 'northline',
    name: 'Northline',
    color: '#2f6f9a',
    stripe: '#e8eef5',
    landing: 5200,
    catering: 1600,
    bags: 1100,
    paxMin: 48,
    paxMax: 72,
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor Air',
    color: '#1f6b57',
    stripe: '#f3d27a',
    landing: 7400,
    catering: 2100,
    bags: 1800,
    paxMin: 64,
    paxMax: 96,
  },
}

export const FUEL: Record<'apex' | 'kiln', FuelContract> = {
  apex: {
    id: 'apex',
    name: 'Apex Fuel',
    sign: 3500,
    wholesale: 900,
    pump: 2400,
  },
  kiln: {
    id: 'kiln',
    name: 'Kiln Aviation',
    sign: 8000,
    wholesale: 1400,
    pump: 4200,
  },
}

export const BUILDINGS: BuildDef[] = [
  {
    tool: 'taxi',
    tile: 'taxi',
    name: 'Taxiway',
    cost: TAXI_COST,
    blurb: 'Pavement jets and trucks follow. If it does not connect, they do not move.',
  },
  {
    tool: 'stand',
    tile: 'stand',
    name: 'Stand',
    cost: STAND_COST,
    blurb: 'Parking bay. A jet only pays after it actually parks here.',
  },
  {
    tool: 'terminal',
    tile: 'terminal',
    name: 'Terminal',
    cost: TERMINAL_COST,
    blurb: '2×2 hall. Furnish rooms on the side panel. People walk here.',
  },
  {
    tool: 'snack',
    tile: 'snack',
    name: 'Snack bar',
    cost: SNACK_COST,
    blurb: 'Meals for arriving guests and catering to the wing.',
  },
  {
    tool: 'bags',
    tile: 'bags',
    name: 'Bag sort',
    cost: BAGS_COST,
    blurb: 'Outside sort. Carts have to reach it or the bag fee never posts.',
  },
  {
    tool: 'fuel',
    tile: 'fuel',
    name: 'Fuel farm',
    cost: FUEL_COST,
    blurb: 'Must sit beside pavement. Sign a carrier, buy loads, truck to the wing.',
  },
]

export const ROOMS: RoomDef[] = [
  { id: 'checkin', name: 'Check-in', cost: 2400, blurb: 'Departing people start here.' },
  { id: 'security', name: 'Security', cost: 2800, blurb: 'Queue before the gate.' },
  { id: 'gate', name: 'Gate hold', cost: 1800, blurb: 'Seats at the stand end of the hall.' },
  { id: 'bagclaim', name: 'Bag claim', cost: 3200, blurb: 'Arrivals want this after the jet.' },
  { id: 'food', name: 'Hall food', cost: 2600, blurb: 'Indoor meal if they skip the outdoor snack.' },
  { id: 'souvenir', name: 'Souvenirs', cost: 2200, blurb: 'Gift shop on the way out.' },
  { id: 'bagdrop', name: 'Bag drop', cost: 1800, blurb: 'Pays $180 extra when the outside sort exists.' },
]

export const TOOL_LABEL: Record<Tool, string> = {
  pan: 'Look',
  runway: 'Runway',
  taxi: 'Taxiway',
  stand: 'Stand',
  terminal: 'Terminal',
  snack: 'Snack',
  bags: 'Bags',
  fuel: 'Fuel farm',
  clear: 'Clear',
}

export function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

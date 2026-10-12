export const SIZE = 16
export const SAVE_KEY = 'apron-save-v1'

export type Tile =
  | 'grass'
  | 'runway'
  | 'taxi'
  | 'stand'
  | 'terminal'
  | 'snack'
  | 'bags'
  | 'fuel'

export type Tool =
  | 'pan'
  | 'runway'
  | 'taxi'
  | 'stand'
  | 'terminal'
  | 'snack'
  | 'bags'
  | 'fuel'
  | 'clear'

export type Speed = 0 | 1 | 3
export type Difficulty = 'easy' | 'standard'
export type FuelBrand = 'apex' | 'kiln'
export type AirlineId = 'northline' | 'harbor'

export type Phase =
  | 'hold'
  | 'approach'
  | 'landing'
  | 'taxi_in'
  | 'deboard'
  | 'servicing'
  | 'board'
  | 'taxi_out'
  | 'takeoff'
  | 'gone'

export type RoomId =
  | 'checkin'
  | 'security'
  | 'gate'
  | 'bagclaim'
  | 'food'
  | 'souvenir'
  | 'bagdrop'

export type Vec = { c: number; r: number }

export interface Airline {
  id: AirlineId
  name: string
  color: string
  stripe: string
  landing: number
  catering: number
  bags: number
  paxMin: number
  paxMax: number
}

export interface FuelContract {
  id: FuelBrand
  name: string
  sign: number
  wholesale: number
  pump: number
}

export interface BuildDef {
  tool: Exclude<Tool, 'pan' | 'clear' | 'runway'>
  tile: Tile
  name: string
  cost: number
  blurb: string
}

export interface RoomDef {
  id: RoomId
  name: string
  cost: number
  blurb: string
}

export interface Flight {
  id: string
  airline: AirlineId
  flightNo: string
  pax: number
  phase: Phase
  stand: Vec | null
  x: number
  y: number
  z: number
  heading: number
  path: Vec[]
  seg: number
  t: number
  holdAngle: number
  posted: {
    landing: boolean
    bags: boolean
    fuel: boolean
    catering: boolean
    bagDrop: boolean
  }
  waitingOn: {
    bags: boolean
    fuel: boolean
    catering: boolean
    paxOut: number
    paxIn: number
  }
  phaseTime: number
  ledger: { label: string; amount: number }[]
}

export interface Truck {
  id: string
  kind: 'fuel' | 'bags' | 'catering'
  flightId: string
  x: number
  y: number
  path: Vec[]
  seg: number
  t: number
  returning: boolean
  dwell: number
}

export interface Person {
  id: string
  flightId: string
  x: number
  y: number
  path: Vec[]
  seg: number
  t: number
  color: string
  job: 'arrive' | 'board' | 'staff'
  wantBag: boolean
  wantFood: boolean
  wantGift: boolean
  stage: number
  paidFood: boolean
  paidGift: boolean
}

export interface News {
  id: string
  text: string
  tone: 'ok' | 'good' | 'bad'
  age: number
}

export interface TerminalFit {
  origin: Vec
  rooms: Record<RoomId, number>
}

export interface GameSnapshot {
  tiles: Tile[][]
  terminalFits: TerminalFit[]
  cash: number
  difficulty: Difficulty
  clock: number
  speed: Speed
  fuelBrand: FuelBrand | null
  fuelLoads: number
  mealSold: boolean
  harborUnlocked: boolean
  flightsDone: number
  paxServed: number
  revenue: number
}

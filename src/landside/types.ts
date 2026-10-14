import type { ParkKind } from './config.ts'

export interface Cell {
  c: number
  r: number
}

export interface LandsideField {
  roads: Cell[]
  /** Cells cars may cross that are not themselves a road, such as the guard post. */
  connectors?: Cell[]
  terminals: Cell[]
  busBays: Cell[]
  /** Extra drop-off lanes. Each one adds curb stalls and a lane of flow. */
  curbLanes?: Cell[]
  /** Taxi ranks. Each one adds curb stalls. */
  taxiRanks?: Cell[]
  parks: { c: number; r: number; kind: ParkKind }[]
  /** True once a passenger rail station is open. Rail is a later mode. */
  rail: boolean
  paxPerDay: number
  /** Live passenger departures. Pressure grows with this. */
  departures: number
  /** Extra vehicles per minute on the approach, such as a fuel tanker. They do not use the curb. */
  extraVehPerMin?: number
}

export type VehicleKind = 'car' | 'taxi' | 'bus'
export type VehicleState = 'drive' | 'queue' | 'stop' | 'leave'

export interface SegmentRead {
  id: string
  c: number
  r: number
  kind: 'road' | 'curb'
  lanes: number
  /** Vehicles this cell can hold. */
  capacity: number
  /** Vehicles per minute the lane can pass, or stalls turned over at the curb. */
  servicePerMin: number
  /** Vehicles per minute using the cell. */
  flowPerMin: number
  /** Vehicles waiting on the cell. */
  queue: number
  /** Load against capacity. Above 1 the cell is over. */
  ratio: number
}

export interface VehicleRead {
  id: string
  kind: VehicleKind
  /** Fractional cell position. */
  c: number
  r: number
  heading: number
  state: VehicleState
}

export interface PassengerRead {
  id: string
  c: number
  r: number
  heading: number
}

export interface ModeSplit {
  car: number
  taxi: number
  bus: number
  rail: number
}

/** One tick of the curb, for the overlay and the renderer. */
export interface LandsideView {
  segments: SegmentRead[]
  vehicles: VehicleRead[]
  passengers: PassengerRead[]
  lanes: number
  laneFlowPerMin: number
  roadFlowPerMin: number
  curbStalls: number
  curbBusy: number
  curbFlowPerMin: number
  parkSpaces: number
  busBays: number
  curbLanes: number
  taxiRanks: number
  rail: boolean
  arrivalsPerMin: number
  modes: ModeSplit
  queue: number
  delaySec: number
  /** Demand against the tighter of the lane and the curb. */
  pressure: number
  /** Reputation points for this tick. Negative when passengers are late. */
  satisfactionDelta: number
  /** Arrivals this tick who miss check-in because the curb was late. */
  missedCheckIns: number
  /** Share of arrivals missing check-in, 0 when the curb is inside the grace. */
  missShare: number
  /** Rising-edge line for the news ticker. Empty when nothing new happened. */
  news: string
  /** What would loosen the curb, in player language. */
  fixes: string[]
  focusId: string | null
}

export interface Network {
  roads: Cell[]
  /** Road cells beside the hall. */
  frontage: Cell[]
  /** City end of the public road. */
  entry: Cell | null
  /** Entry to the curb, inclusive. */
  path: Cell[]
  lanes: number
  curbStalls: number
  parkSpaces: number
  busBays: number
  curbLanes: number
  taxiRanks: number
  /** Nearest terminal cell, for people walking off a car. */
  door: Cell | null
  /**
   * Forward road from the curb to the way out.
   * The first cell is the curb. The last cells leave the pavement
   * so a car can drive off instead of turning around.
   */
  exit: Cell[]
}

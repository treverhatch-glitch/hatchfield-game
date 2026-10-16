import type { ParkKind } from './config.ts'

export interface Cell {
  c: number
  r: number
}

export interface LandsideField {
  roads: Cell[]
  /**
   * Service gates such as the guard post. Passenger cars do not enter them.
   * Fuel tankers and other airport vehicles may.
   */
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
  /**
   * Passenger turns the runway has already completed.
   * The starter curb absorbs the opening book. Once the field has flown
   * a real bank, the city sends more people than three stalls can drop.
   */
  turns?: number
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
  /** Lane index on the loop: through lanes from the median out, then the drop-off layby. */
  lane: number
  /** Metres per second. */
  speed: number
  /** Trip this vehicle is driving, when the fleet is carrying named passengers. */
  orderId?: string
  /** Drop-off at the kerb, or a pickup leaving with an arrival. */
  role?: 'drop' | 'pick'
}

export interface PassengerRead {
  id: string
  c: number
  r: number
  heading: number
  /** Hall guest this walker is, when the curb is carrying a real passenger. */
  guestId?: string
  orderId?: string
  /** `in` walks to the hall door. `out` walks from the door to a waiting car. */
  dir?: 'in' | 'out'
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
   * Road from the curb to the far end of the route, paved cells only.
   * The first cell is the curb. Traffic U-turns in the last cell unless
   * that cell is on the map edge, in which case it drives off there.
   */
  exit: Cell[]
  /** True when the far end is a second way off the map rather than a U-turn. */
  edgeExit: boolean
}

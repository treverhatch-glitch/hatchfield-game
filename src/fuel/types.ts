export interface Cell {
  c: number
  r: number
}

export interface FuelFlight {
  id: string
  litres: number
  /** Earlier departures are fuelled first. */
  departAt: number
}

export type DeliveryMode = 'tanker' | 'pipeline'
export type DeliveryState = 'road' | 'dock' | 'wait_cash'

export interface DeliveryRead {
  id: string
  mode: DeliveryMode
  litres: number
  /** 0 at the city edge, 1 at the farm. */
  progress: number
  state: DeliveryState
  docked: boolean
}

export interface DockRead {
  farm: 'farm_fill'
  truck: 'truck_fill'
}

/** What the panel and the renderer read. The ledger is not in here. */
export interface FuelView {
  capacityLitres: number
  litres: number
  /** Days of cover at the current truck and hydrant draw. Infinite when nothing is drawing. */
  daysCover: number
  queue: DeliveryRead[]
  truckDrawPerMin: number
  hydrantDrawPerMin: number
  groundedIds: string[]
  /** Vehicles per minute this chain adds to the landside road. */
  roadVehPerMin: number
  /** Bill for fuel accepted this tick, at the contract wholesale the caller passed in. */
  paid: number
  delivered: number
  dock: DockRead | null
  path: Cell[]
  farm: Cell | null
  /** Arrival gate. Distinct from exit. */
  entry: Cell | null
  /** Departure gate. The tanker does not reverse out of entry. */
  exit: Cell | null
  /** entry, farm, exit. */
  through: Cell[]
  wholesalePerLitre: number
}

export interface FuelOrder {
  capacityLitres: number
  litres: number
  mode: DeliveryMode
  tankerLitres: number
  leadMinutes: number
  /** Existing contract wholesale. The chain does not invent a price. */
  wholesalePerLitre: number
  cash: number
  truckDrawPerMin: number
  hydrantDrawPerMin: number
  /** Pipeline litres per game minute. 0 while the line is dark. */
  pipelinePerMin: number
  roads: Cell[]
  connectors?: Cell[]
  farms: Cell[]
  flights: FuelFlight[]
}

export interface FuelWatch extends FuelOrder {
  /** Game minutes already spent on the tanker the economy clock is tracking. */
  roadMinutes: number
  /** The economy just accepted a delivery. */
  justDelivered: boolean
  /** Rail or pipe is moving litres this tick. */
  pipelineFlowing: boolean
  /** Game minutes since the last read. */
  minutes: number
}

/** Hub links between terminals. Numbers live in `catalog.ts`. */

export type ConnectivityBuildingId = 'people_mover' | 'airside_transfer_bus_depot' | 'transfer_centre'

/** A building that actually carries passengers between two terminals. */
export type LinkMode = 'people_mover' | 'airside_transfer_bus'

export interface ConnectivityBuilding {
  id: ConnectivityBuildingId
  name: string
  /** Field Level required before the player can build it. */
  fieldLevel: number
  /** Sticker price in dollars. */
  cost: number
  /** Charged once per game day. */
  upkeepPerDay: number
  /** Passengers per hour while the link is open. Zero for the transfer centre. */
  paxPerHour: number
  /** Extra apron movements per hour. The bus depot is the one that adds traffic. */
  apronTrafficPerHour: number
  /** Ride between the two terminals, in minutes. Zero when this building is not a ride. */
  rideMinutes: number
  /** True when placing it creates a terminal-to-terminal link. */
  linksTerminals: boolean
  /** A breakdown of this building strands the gates it was serving. */
  breakdownStrandsGates: boolean
  /** Published minimum connection time, in minutes, when this building sets it. */
  mctMinutes: number | null
  blurb: string
  /** The pressure that keeps the building from being a free upgrade. */
  catch: string
}

export interface TerminalLink {
  id: string
  fromId: string
  toId: string
  mode: LinkMode
  /** False after a breakdown until the link is repaired. */
  open: boolean
}

export interface TerminalGates {
  id: string
  gateIds: readonly string[]
}

export type LinkRefusal = 'missing_terminal' | 'same_terminal'

export type LinkAttempt =
  | { ok: true; link: TerminalLink }
  | { ok: false; reason: LinkRefusal }

export interface ThroughputInput {
  links: readonly TerminalLink[]
  /** Passengers trying to change terminals this hour. */
  demandPerHour: number
  /** When set, only links between this pair count. Order does not matter. */
  between?: readonly [string, string]
}

export interface Throughput {
  movedPerHour: number
  capacityPerHour: number
  queuedPerHour: number
  apronTrafficPerHour: number
}

export type BreakdownReason = 'people_mover_stopped' | 'transfer_bus_stopped'

export interface BreakdownEvent {
  type: 'connectivity_breakdown'
  linkId: string
  mode: LinkMode
  reason: BreakdownReason
  /** True when this failure mode strands gates. The bus depot does not. */
  strandsGates: boolean
  strandedGateIds: readonly string[]
  explanation: string
  suggestedFix: string
}

export interface BreakdownResult {
  event: BreakdownEvent
  /** The same link, closed. */
  link: TerminalLink
}

export interface ConnectionOptions {
  /** Transfer centre is what publishes the 45-minute connection. */
  hasTransferCentre: boolean
  /**
   * RFID bag-line stub. The FL9 building is not in this module.
   * The flag cuts the connection to 25 minutes only while a transfer centre is open.
   */
  rfid?: boolean
}

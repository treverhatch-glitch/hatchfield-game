/** Hub links between terminals. Numbers live in `catalog.ts`. Connection time does not. */

export type ConnectivityBuildingId =
  | 'people_mover'
  | 'airside_transfer_bus_depot'
  | 'moving_walkway'
  | 'skywalk'

/** A building that actually carries passengers between two terminals. */
export type LinkMode = 'people_mover' | 'airside_transfer_bus'

/**
 * How a connecting passenger moves.
 * The people mover wins when it is open. The airside bus, then the terminal bus, are the fallbacks.
 */
export type PassengerLink = LinkMode | 'terminal_bus' | 'skywalk' | 'walkway' | 'walk'

export interface ConnectivityBuilding {
  id: ConnectivityBuildingId
  name: string
  /** Field Level required before the player can build it. */
  fieldLevel: number
  /** Sticker price in dollars. */
  cost: number
  /** Charged once per game day. */
  upkeepPerDay: number
  /** Cash to put a broken link back in service. Zero when the building does not break. */
  repairCost: number
  /** Passengers per hour while the link is open. Zero when this is not a ride. */
  paxPerHour: number
  /** Extra apron movements per hour. The bus depot is the one that adds traffic. */
  apronTrafficPerHour: number
  /** Ride between the two terminals, in minutes. Zero when the ride is distance-based or not a ride. */
  rideMinutes: number
  /** Metres of belt one stamp covers. Zero except the moving walkway. */
  lengthMetres: number
  /** Walking speed multiplier along `lengthMetres`. 1 when this stamp does not speed a walk. */
  speedMult: number
  /** Distance pace for a skywalk. Zero when the building uses a fixed ride or is not a bridge. */
  metresPerMin: number
  /** True when placing it creates a terminal-to-terminal link. */
  linksTerminals: boolean
  /** A breakdown of this building strands the gates it was serving. */
  breakdownStrandsGates: boolean
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
  /** Transfer Centre from the hub config. This module does not define a second one. */
  hasTransferCentre: boolean
  /**
   * RFID bag-line flag. Cuts the connection to 25 game-minutes.
   * The published times live in `src/hub/config.ts` (60 / 45 / 25).
   */
  rfid?: boolean
}

export interface PassengerLinkInput {
  peopleMoverOpen: boolean
  transferBusOpen: boolean
  terminalBusOpen: boolean
  skywalkOpen: boolean
  walkwayMetres: number
}

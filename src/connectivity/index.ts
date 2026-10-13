export type {
  BreakdownEvent,
  BreakdownReason,
  BreakdownResult,
  ConnectionOptions,
  ConnectivityBuilding,
  ConnectivityBuildingId,
  LinkAttempt,
  LinkMode,
  LinkRefusal,
  PassengerLink,
  PassengerLinkInput,
  TerminalGates,
  TerminalLink,
  Throughput,
  ThroughputInput,
} from './types.ts'

export {
  BUS_APRON_TRAFFIC_PER_HOUR,
  BUS_PAX_PER_HOUR,
  BUS_RIDE_MINUTES,
  CONNECTIVITY_BUILDINGS,
  CONNECTIVITY_CATALOG,
  LINK_BUILDING,
  LINK_MAINT_SAFE,
  LINK_WEAR_BREAK,
  LINK_WEAR_PER_DAY,
  PEOPLE_MOVER_PAX_PER_HOUR,
  PEOPLE_MOVER_RIDE_MINUTES,
  STANDING_HIT_CAP,
  STANDING_PER_MISSED_PASSENGER,
  buildingById,
  dailyUpkeep,
  isUnlocked,
} from './catalog.ts'

export { breakdown, choosePassengerLink, linkTerminals, throughput } from './links.ts'

export { connectionStandingDelta, minimumConnectionMinutes, missedConnectionStandingDelta } from './connection.ts'

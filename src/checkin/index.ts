export { CHECKIN_ALLOC, NEUTRAL_DESK_BRAND } from './config.ts'
export { carrierPeakPaxPerMin, checkinCapacityPerMin, checkinSignGate, type CheckinSignGate } from './signGate.ts'
export {
  allocate,
  desksNeeded,
  windowBounds,
  type AllocateInput,
  type Allocation,
  type CheckinDesk,
  type CheckinFlight,
  type DedicatedLock,
  type DeskAssignment,
  type DeskMode,
  type FlightDeskShare,
} from './allocate.ts'

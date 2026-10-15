export type { Fitting, FittingHost, FittingId, StandRung, StandSize } from './types.ts'
export {
  ASPHALT_AIRFRAMES,
  FITTINGS,
  GRASS_AIRFRAMES,
  RUNG_LABEL,
  RUNG_STEP,
  RUNG_UPKEEP,
  SIZE_LABEL,
  STAND_STAMP,
  aliasSize,
  boardingDoorScale,
  bridgeCap,
  DRILL_STANDING_SEC,
  FIRE_DRILL_AT,
  fireDrillLine,
  fireDrillStanding,
  fireFine,
  fireReputationHit,
  fireScrambleShare,
  fittingDef,
  FLAG_CLOTH,
  footprintLetter,
  standServiceTier,
  hostKey,
  jetBridgeCost,
  jetBridgeUpkeep,
  parseHostKey,
  rungStepCost,
  rungUpkeep,
  SCRAMBLE_BELL,
  SCRAMBLE_SEC,
  scrambleNote,
  scrambleSeconds,
  usableBridgeDoors,
} from './catalog.ts'
export { letterOf, standAllowReason, standAllows } from './fit.ts'
export { standRefusal } from './eligibility.ts'
export type { StandClaim } from './eligibility.ts'
export { rungRefusal, upgradeLabel } from './gates.ts'
export { fittingRefusal } from './attach.ts'
export type { FittingAsk } from './attach.ts'
export { legacyFitting, migrateStand, readFittings, readStandRungs, readStandSizes } from './migrate.ts'
export type { LegacyStand, MigratedStand } from './migrate.ts'

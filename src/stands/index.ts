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
  bridgeCap,
  fittingDef,
  footprintLetter,
  hostKey,
  jetBridgeCost,
  jetBridgeUpkeep,
  parseHostKey,
  rungStepCost,
  rungUpkeep,
} from './catalog.ts'
export { letterOf, standAllows } from './fit.ts'
export { legacyFitting, migrateStand, readFittings, readStandRungs, readStandSizes } from './migrate.ts'
export type { LegacyStand, MigratedStand } from './migrate.ts'

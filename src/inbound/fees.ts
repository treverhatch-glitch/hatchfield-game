/**
 * Money this module posts. Landing fees and fines are the trunk catalog
 * constants, so a retune there retunes inbound requests too.
 */
import {
  AIR_AMBULANCE_FEE,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_FAIL_FINE,
  EMERGENCY_REFUSE_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  HOTEL_NIGHT_FEE,
  MIL_AGREE_COST,
  MIL_LANDING,
  TANKER_FEE,
  TANKER_MX_FEE,
} from '../game/catalog.ts'

export {
  AIR_AMBULANCE_FEE,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_FAIL_FINE,
  EMERGENCY_REFUSE_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  HOTEL_NIGHT_FEE,
  MIL_AGREE_COST,
  MIL_LANDING,
  TANKER_FEE,
  TANKER_MX_FEE,
}

/** Field clock: one game day is 180 sim-seconds (24h on the face). */
export const SIM_DAY_SEC = 180

/** Missed Guard sortie. A quarter of the landing fee, so it tracks MIL_LANDING. */
export const MISSED_SORTIE_PENALTY = Math.round(MIL_LANDING * 0.25)

/** Paid on a week where at least one sortie actually flew. */
export const MIL_WEEKLY_RETAINER = Math.round(MIL_LANDING * 0.5)

/** Early cancel of a Guard contract. A quarter of the agreement, not the airline-contract scale. */
export const MIL_EARLY_CANCEL_FEE = Math.round(MIL_AGREE_COST * 0.25)

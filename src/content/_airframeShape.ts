/** Ids already on AIRFRAMES. The extra pack must not reuse them. */
import { AIRFRAMES } from '../game/airframes.ts'

export const EXISTING_AIRFRAME_IDS: readonly string[] = Object.keys(AIRFRAMES)

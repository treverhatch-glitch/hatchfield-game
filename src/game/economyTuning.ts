/**
 * Day-30 soak knobs. Payroll shares stay in the bank module.
 * A one- or two-carrier field with no hotel, parking, or rail pays this share
 * of building upkeep and bills this multiple of turn fees. Another carrier or
 * a landside building drops both.
 */
export const SMALL_FIELD_MAX_CARRIERS = 2
export const SMALL_FIELD_UPKEEP_FACTOR = 0.35
export const SMALL_FIELD_FEE_FACTOR = 1.22

/**
 * Hall and apron spend while a departure is grounded for fuel.
 * 1 is a normal turn. A dry flight does not shop as if it were boarding.
 */
export const GROUNDED_RETAIL_TAPER = 0.15

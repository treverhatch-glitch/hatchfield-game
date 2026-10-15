/**
 * Info-view colours. Same green / amber / red the curb tint already uses,
 * so a player can read every overlay the same way.
 */
export const HEAT = {
  low: '#3dbe6e',
  mid: '#e0b15a',
  high: '#d35a4a',
} as const

/** Curb pressure bands. Matches `pressureColor` in the landside sim. */
export const TRAFFIC_LEGEND = [
  { label: 'Under 70%', color: HEAT.low },
  { label: '70–100%', color: HEAT.mid },
  { label: 'Over capacity', color: HEAT.high },
] as const

/** Estimated wait, in seconds, before a queue point steps up a colour. */
export const QUEUE_WAIT_SEC = {
  mid: 45,
  high: 120,
} as const

export const QUEUE_LEGEND = [
  { label: 'Wait under 45s', color: HEAT.low },
  { label: 'Wait under 2 min', color: HEAT.mid },
  { label: 'Long wait', color: HEAT.high },
] as const

export const BAY_LEGEND = [
  { label: 'Idle', color: HEAT.low },
  { label: 'In use', color: HEAT.mid },
  { label: 'Bay queue', color: HEAT.high },
] as const

/** Demand / capacity before the power tint steps up. */
export const POWER_RATIO = {
  mid: 0.7,
  high: 1,
} as const

export const AIRFIELD_LEGEND = [
  { label: 'Spare movements', color: HEAT.low },
  { label: 'Bank over 70%', color: HEAT.mid },
  { label: 'Contracts over capacity', color: HEAT.high },
] as const

export const POWER_LEGEND = [
  { label: 'Spare capacity', color: HEAT.low },
  { label: 'Load over 70%', color: HEAT.mid },
  { label: 'At or over capacity', color: HEAT.high },
] as const

/** Tank fill (litres / capacity) before the farm tint steps up. Low stock is the hot end. */
export const FUEL_FILL = {
  low: 0.25,
  mid: 0.66,
} as const

export const FUEL_LEGEND = [
  { label: 'Under a quarter', color: HEAT.high },
  { label: 'Quarter to two thirds', color: HEAT.mid },
  { label: 'Stock comfortable', color: HEAT.low },
] as const

/** How strongly a tint sits on the ground. Aircraft stay readable through it. */
export const TINT_OPACITY = 0.42
export const TINT_OPACITY_HOT = 0.62

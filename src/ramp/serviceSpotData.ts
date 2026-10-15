/**
 * Where a fuel bowser and a bag truck stop beside an airframe.
 * Metres and radians. The mesh hose length stays HOSE_M in the vehicle model.
 */
export const SERVICE_SPOT = {
  /** Span at or under this is the further, angled stop. A 737 (35.8 m) is large. */
  smallSpanM: 32,
  /** Skin-to-skin gap between a truck and the fuselage, metres. */
  skinGapM: 0.55,
  /** Truck rectangles stay at least this far apart, metres. */
  minSeparationM: 8,
  fuel: {
    /** Radians off a parallel park. The hose still ends on the fuel port. */
    smallYaw: 0.62,
    largeYaw: 0.1,
  },
  bags: {
    smallYaw: 0.5,
    largeYaw: 0.08,
  },
  belt: {
    smallYaw: 0.42,
    largeYaw: 0.06,
  },
} as const

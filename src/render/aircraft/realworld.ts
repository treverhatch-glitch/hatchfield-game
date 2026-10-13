/**
 * Verified airframe figures (meters). Wheelbase is nose gear to main gear.
 * Door stations are fractions from the nose (0) to the tail (1).
 * Source: the owner data pack (airport planning manuals and type fact sheets).
 */

/** ICAO aerodrome reference code letter, plus H for a helipad. */
export type IcaoCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'H'

export type DoorKind = 'pax' | 'service' | 'cargo' | 'crew' | 'ramp' | 'upper'

export interface RealDoor {
  /** 0 at the nose, 1 at the tail. */
  t: number
  /** +1 port, -1 starboard, 0 on the centerline (ramp). */
  side: -1 | 0 | 1
  kind: DoorKind
}

export interface RealAirframe {
  lengthM: number
  spanM: number
  heightM: number
  wheelbaseM: number
  /** Wingspan code from the pack. H is a helicopter. */
  icao: IcaoCode
  doors: RealDoor[]
}

function d(t: number, side: -1 | 0 | 1, kind: DoorKind): RealDoor {
  return { t, side, kind }
}

export const REAL_AIRFRAMES: Record<string, RealAirframe> = {
  bn2: {
    lengthM: 10.86, spanM: 14.94, heightM: 4.18, wheelbaseM: 3.99,
    icao: 'A',
    doors: [d(0.28, 1, 'pax'), d(0.55, -1, 'cargo')],
  },
  dhc6: {
    lengthM: 15.77, spanM: 19.81, heightM: 5.94, wheelbaseM: 4.52,
    icao: 'B',
    doors: [d(0.22, 1, 'pax'), d(0.22, -1, 'pax'), d(0.62, 1, 'cargo')],
  },
  crj700: {
    lengthM: 32.3, spanM: 23.2, heightM: 7.6, wheelbaseM: 15.01,
    icao: 'B',
    doors: [d(0.16, 1, 'pax'), d(0.2, -1, 'service'), d(0.74, 1, 'cargo')],
  },
  e175: {
    lengthM: 31.68, spanM: 26.0, heightM: 9.86, wheelbaseM: 14.5,
    icao: 'C',
    doors: [d(0.15, 1, 'pax'), d(0.18, -1, 'service'), d(0.34, 1, 'cargo'), d(0.76, 1, 'cargo')],
  },
  a320neo: {
    lengthM: 37.57, spanM: 35.8, heightM: 11.76, wheelbaseM: 12.64,
    icao: 'C',
    doors: [d(0.14, 1, 'pax'), d(0.62, 1, 'pax'), d(0.16, -1, 'service'), d(0.58, -1, 'service'), d(0.36, -1, 'cargo'), d(0.78, -1, 'cargo')],
  },
  b738: {
    lengthM: 39.5, spanM: 35.8, heightM: 12.5, wheelbaseM: 15.6,
    icao: 'C',
    doors: [d(0.13, 1, 'pax'), d(0.58, 1, 'pax'), d(0.16, -1, 'service'), d(0.55, -1, 'service'), d(0.34, -1, 'cargo'), d(0.76, -1, 'cargo')],
  },
  a321: {
    lengthM: 44.51, spanM: 35.8, heightM: 11.76, wheelbaseM: 16.9,
    icao: 'C',
    doors: [d(0.12, 1, 'pax'), d(0.38, 1, 'pax'), d(0.78, 1, 'pax'), d(0.14, -1, 'service'), d(0.72, -1, 'service'), d(0.3, -1, 'cargo'), d(0.82, -1, 'cargo')],
  },
  b752f: {
    lengthM: 47.32, spanM: 38.05, heightM: 13.6, wheelbaseM: 18.29,
    icao: 'D',
    doors: [d(0.12, 1, 'crew'), d(0.24, 1, 'cargo'), d(0.55, -1, 'cargo'), d(0.78, -1, 'cargo')],
  },
  b789: {
    lengthM: 62.8, spanM: 60.1, heightM: 17.0, wheelbaseM: 25.83,
    icao: 'E',
    doors: [d(0.12, 1, 'pax'), d(0.32, 1, 'pax'), d(0.14, -1, 'service'), d(0.34, -1, 'service'), d(0.7, -1, 'service'), d(0.42, -1, 'cargo'), d(0.8, -1, 'cargo')],
  },
  b77w: {
    lengthM: 73.86, spanM: 64.8, heightM: 18.5, wheelbaseM: 31.22,
    icao: 'E',
    doors: [d(0.1, 1, 'pax'), d(0.28, 1, 'pax'), d(0.62, 1, 'pax'), d(0.12, -1, 'service'), d(0.3, -1, 'service'), d(0.64, -1, 'service'), d(0.4, -1, 'cargo'), d(0.78, -1, 'cargo')],
  },
  a359: {
    lengthM: 66.8, spanM: 64.75, heightM: 17.05, wheelbaseM: 28.67,
    icao: 'E',
    doors: [d(0.11, 1, 'pax'), d(0.3, 1, 'pax'), d(0.13, -1, 'service'), d(0.32, -1, 'service'), d(0.68, -1, 'service'), d(0.4, -1, 'cargo'), d(0.78, -1, 'cargo')],
  },
  b763f: {
    lengthM: 54.94, spanM: 47.57, heightM: 15.85, wheelbaseM: 22.76,
    icao: 'D',
    doors: [d(0.12, 1, 'crew'), d(0.22, 1, 'cargo'), d(0.48, -1, 'cargo'), d(0.74, -1, 'cargo')],
  },
  b748f: {
    lengthM: 76.25, spanM: 68.4, heightM: 19.4, wheelbaseM: 29.7,
    icao: 'F',
    doors: [d(0.08, 0, 'cargo'), d(0.72, 1, 'cargo'), d(0.4, -1, 'cargo'), d(0.82, -1, 'cargo')],
  },
  a380: {
    lengthM: 72.72, spanM: 79.75, heightM: 24.09, wheelbaseM: 33.58,
    icao: 'F',
    doors: [
      d(0.1, 1, 'pax'), d(0.28, 1, 'pax'), d(0.7, 1, 'pax'),
      d(0.12, 1, 'upper'), d(0.32, 1, 'upper'),
      d(0.14, -1, 'service'), d(0.3, -1, 'service'), d(0.16, -1, 'upper'),
      d(0.4, -1, 'cargo'), d(0.78, -1, 'cargo'),
    ],
  },
  an124: {
    lengthM: 69.1, spanM: 73.3, heightM: 21.08, wheelbaseM: 22.8,
    icao: 'F',
    doors: [d(0.06, 0, 'cargo'), d(0.94, 0, 'ramp'), d(0.18, 1, 'crew')],
  },
  c17: {
    lengthM: 53.0, spanM: 51.75, heightM: 16.79, wheelbaseM: 20.05,
    icao: 'D',
    doors: [d(0.14, 1, 'crew'), d(0.78, 1, 'pax'), d(0.78, -1, 'pax'), d(0.96, 0, 'ramp')],
  },
  kc135: {
    lengthM: 41.53, spanM: 39.88, heightM: 12.7, wheelbaseM: 14.0,
    icao: 'D',
    doors: [d(0.18, 1, 'cargo')],
  },
  c5: {
    lengthM: 75.31, spanM: 67.89, heightM: 19.84, wheelbaseM: 22.2,
    icao: 'F',
    doors: [d(0.06, 0, 'cargo'), d(0.95, 0, 'ramp')],
  },
  f15: {
    lengthM: 19.43, spanM: 13.05, heightM: 5.63, wheelbaseM: 5.42,
    icao: 'A',
    doors: [],
  },
  citation: {
    lengthM: 16.08, spanM: 17.17, heightM: 5.23, wheelbaseM: 6.5,
    icao: 'B',
    doors: [d(0.22, 1, 'pax'), d(0.78, 1, 'cargo')],
  },
  pc12: {
    lengthM: 14.4, spanM: 16.28, heightM: 4.27, wheelbaseM: 5.3,
    icao: 'B',
    doors: [d(0.28, 1, 'crew'), d(0.7, 1, 'cargo')],
  },
  at802: {
    lengthM: 10.99, spanM: 18.06, heightM: 3.38, wheelbaseM: 5.4,
    icao: 'B',
    doors: [d(0.42, 1, 'crew')],
  },
  atr72: {
    lengthM: 27.17, spanM: 27.05, heightM: 7.65, wheelbaseM: 10.77,
    icao: 'C',
    doors: [d(0.72, 1, 'pax'), d(0.28, 1, 'cargo'), d(0.8, 1, 'cargo')],
  },
  cl415: {
    lengthM: 19.82, spanM: 28.6, heightM: 8.98, wheelbaseM: 7.23,
    icao: 'C',
    doors: [d(0.62, 1, 'crew')],
  },
  c130: {
    lengthM: 29.79, spanM: 40.41, heightM: 11.84, wheelbaseM: 9.77,
    icao: 'D',
    doors: [d(0.16, 1, 'crew'), d(0.7, 1, 'pax'), d(0.7, -1, 'pax'), d(0.96, 0, 'ramp')],
  },
  aw139: {
    lengthM: 16.66, spanM: 13.8, heightM: 4.98, wheelbaseM: 4.0,
    icao: 'H',
    doors: [d(0.42, 1, 'pax'), d(0.42, -1, 'pax'), d(0.72, 1, 'cargo')],
  },
  s76: {
    lengthM: 16.0, spanM: 13.41, heightM: 4.42, wheelbaseM: 5.0,
    icao: 'H',
    doors: [d(0.4, 1, 'pax'), d(0.4, -1, 'pax'), d(0.7, 1, 'cargo')],
  },
}

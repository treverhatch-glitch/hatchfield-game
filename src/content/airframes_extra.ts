export type AircraftKind =
  | 'regional'
  | 'narrowbody'
  | 'widebody'
  | 'freighter'
  | 'helo_med'
  | 'helo_exec'
  | 'military'
  | 'air_ambulance';

export interface Airframe {
  id: string;
  name: string;
  kind: AircraftKind;
  minRunway: number;
  paxMin: number;
  paxMax: number;
  seats: number;
  bagVolume: number;
  cargoHold: number;
  fuelLoad: number;
  scale: number;
  landingMult: number;
  blurb: string;
  research?: string;
}

export const AIRFRAMES_EXTRA: Record<string, Airframe> = {
  // Regionals
  q400: {
    id: 'q400',
    name: 'Dash 8 Q400',
    kind: 'regional',
    minRunway: 6,
    paxMin: 50,
    paxMax: 78,
    seats: 78,
    bagVolume: 10,
    cargoHold: 2,
    fuelLoad: 5000,
    scale: 0.8,
    landingMult: 0.85,
    blurb: 'Fast, efficient turboprop for short regional routes.',
  },
  atr42: {
    id: 'atr42',
    name: 'ATR 42-600',
    kind: 'regional',
    minRunway: 6,
    paxMin: 30,
    paxMax: 50,
    seats: 50,
    bagVolume: 6,
    cargoHold: 1,
    fuelLoad: 4500,
    scale: 0.7,
    landingMult: 0.8,
    blurb: 'Reliable short-haul turboprop perfect for small regional airports.',
  },
  crj900: {
    id: 'crj900',
    name: 'CRJ-900',
    kind: 'regional',
    minRunway: 8,
    paxMin: 55,
    paxMax: 90,
    seats: 90,
    bagVolume: 12,
    cargoHold: 3,
    fuelLoad: 8000,
    scale: 0.9,
    landingMult: 0.9,
    blurb: 'Extended regional jet offering greater capacity and range.',
  },

  // Widebodies
  b78x: {
    id: 'b78x',
    name: '787-10',
    kind: 'widebody',
    minRunway: 14,
    paxMin: 200,
    paxMax: 330,
    seats: 330,
    bagVolume: 45,
    cargoHold: 15,
    fuelLoad: 65000,
    scale: 1.6,
    landingMult: 1.15,
    blurb: 'Longest variant of the Dreamliner family, optimizing capacity and efficiency.',
  },
  a339: {
    id: 'a339',
    name: 'A330-900neo',
    kind: 'widebody',
    minRunway: 13,
    paxMin: 180,
    paxMax: 300,
    seats: 300,
    bagVolume: 40,
    cargoHold: 12,
    fuelLoad: 60000,
    scale: 1.5,
    landingMult: 1.1,
    blurb: 'Next-generation A330 featuring new engines and improved economics.',
  },
  b779: {
    id: 'b779',
    name: '777-9',
    kind: 'widebody',
    minRunway: 16,
    paxMin: 250,
    paxMax: 426,
    seats: 426,
    bagVolume: 60,
    cargoHold: 20,
    fuelLoad: 85000,
    scale: 1.8,
    landingMult: 1.25,
    blurb: 'The newest, largest twin-engine jet in the world featuring folding wingtips.',
  },
  a35k: {
    id: 'a35k',
    name: 'A350-1000',
    kind: 'widebody',
    minRunway: 15,
    paxMin: 220,
    paxMax: 410,
    seats: 410,
    bagVolume: 55,
    cargoHold: 18,
    fuelLoad: 80000,
    scale: 1.7,
    landingMult: 1.2,
    blurb: 'Largest variant of the A350 XWB, maximizing long-haul efficiency.',
  },

  // Freighters
  b77f: {
    id: 'b77f',
    name: '777F',
    kind: 'freighter',
    minRunway: 15,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 102,
    fuelLoad: 75000,
    scale: 1.7,
    landingMult: 1.2,
    blurb: 'High-capacity, long-range twin-engine freighter based on the 777-200LR.',
  },
  a350f: {
    id: 'a350f',
    name: 'A350F',
    kind: 'freighter',
    minRunway: 15,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 109,
    fuelLoad: 78000,
    scale: 1.7,
    landingMult: 1.2,
    blurb: 'Next-generation large freighter offering lower fuel burn and high payload.',
  },
  b763bcf: {
    id: 'b763bcf',
    name: '767-300BCF',
    kind: 'freighter',
    minRunway: 12,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 52,
    fuelLoad: 45000,
    scale: 1.3,
    landingMult: 1.05,
    blurb: 'Versatile converted medium widebody freighter, excellent for express cargo.',
  },
};

export function validateAirframesExtra(
  table: Record<string, Airframe>,
  existingIds: readonly string[]
): string[] {
  const errors: string[] = [];
  const existingSet = new Set(existingIds);
  const localIds = new Set<string>();

  for (const [key, airframe] of Object.entries(table)) {
    if (key !== airframe.id) {
      errors.push(`Key mismatch: "${key}" != id "${airframe.id}"`);
    }

    if (existingSet.has(airframe.id)) {
      errors.push(`ID conflict with EXISTING_AIRFRAME_IDS: "${airframe.id}"`);
    }

    if (localIds.has(airframe.id)) {
      errors.push(`Duplicate local ID: "${airframe.id}"`);
    }
    localIds.add(airframe.id);

    if (!airframe.name || airframe.name.trim() === '') {
      errors.push(`Empty name for airframe: "${airframe.id}"`);
    }

    if (airframe.kind === 'freighter') {
      if (airframe.seats !== 0) {
        errors.push(`Freighter must have 0 seats: "${airframe.id}"`);
      }
      if (airframe.bagVolume !== 0) {
        errors.push(`Freighter must have 0 bagVolume: "${airframe.id}"`);
      }
      if (airframe.paxMin !== 0 || airframe.paxMax !== 0) {
        errors.push(`Freighter must have 0 paxMin and paxMax: "${airframe.id}"`);
      }
    } else {
      if (airframe.seats <= 0) {
        errors.push(`Passenger aircraft must have > 0 seats: "${airframe.id}"`);
      }
    }

    if (airframe.paxMin > airframe.paxMax) {
      errors.push(`paxMin > paxMax for airframe: "${airframe.id}"`);
    }

    if (airframe.scale <= 0) {
      errors.push(`Scale must be positive: "${airframe.id}"`);
    }

    if (airframe.fuelLoad <= 0) {
      errors.push(`fuelLoad must be positive: "${airframe.id}"`);
    }

    if (airframe.minRunway <= 0) {
      errors.push(`minRunway must be positive: "${airframe.id}"`);
    }
  }

  return errors;
}

export function mergeAirframes(
  base: Record<string, Airframe>,
  extra: Record<string, Airframe>
): Record<string, Airframe> {
  const result = { ...base };
  for (const [key, val] of Object.entries(extra)) {
    if (key in result) {
      throw new Error(`Collision merging airframes: key "${key}" already exists`);
    }
    result[key] = val;
  }
  return result;
}

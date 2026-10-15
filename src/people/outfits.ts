/**
 * Outfit, accessory and colour per role, as data. Every figure is the same
 * base body (parts.ts); this table is the only place that says what a role
 * wears. Palettes are taken from the Gemini sheets in assets/people/originals.
 * The sheets themselves are not decoded at boot.
 *
 * A colour is a hex number, or 'primary' / 'secondary' for the airline livery.
 */
import type { CrewKind, GearKind, HatKind, OutfitKind } from './types.ts'

export type Tone = number | 'primary' | 'secondary'

export const HI_VIS_YELLOW = 0xf6e05e
export const HI_VIS_ORANGE = 0xf97316

/** Check-in desk: navy blazer, white shirt, red scarf. Not an airline logo. */
export const CHECKIN_BLAZER = 0x1a365d
export const CHECKIN_SHIRT = 0xf7fafc
export const CHECKIN_SCARF = 0xc53030
export const CHECKIN_TROUSERS = 0x1a202c

/** Security: light-blue shirt, navy trousers, black peaked cap. */
export const SECURITY_SHIRT = 0x63b3ed
export const SECURITY_TROUSERS = 0x1a365d

/** Fueler: red coveralls, white helmet, yellow vest. */
export const FUEL_RED = 0xe53e3e

/** Ramp: navy shirt under a yellow vest, navy cap. */
export const RAMP_NAVY = 0x1a365d

export interface CrewOutfit {
  outfit: OutfitKind
  top: Tone
  bottom: Tone
  hat: HatKind
  hatColor: Tone
  /** Reflective vest colour, 0 for none. */
  vest: number
  /** Jacket colour (arms follow it), 0 for none. */
  jacket: Tone | 0
  /** Tie or scarf, 0 for none. */
  accent: Tone | 0
  shoes: number
  gear: readonly GearKind[]
  gearColor: number
  /** Cabin crew keep their hair up, others roll it. */
  hairUp: boolean
  /** Rolling case of the airline crew. */
  roller: boolean
}

export const CREW_OUTFITS: Record<CrewKind, CrewOutfit> = {
  pilot: {
    outfit: 'uniform', top: 0xf8fafc, bottom: 0x111827, hat: 'pilotCap', hatColor: 0x111827, vest: 0, jacket: 0x111827, accent: 'primary',
    shoes: 0x0a0a0a, gear: [], gearColor: 0xd4af37, hairUp: false, roller: true,
  },
  cabin: {
    outfit: 'uniform', top: 'primary', bottom: 'secondary', hat: 'beret', hatColor: 'primary', vest: 0, jacket: 0, accent: 'secondary',
    shoes: 0x1c1917, gear: ['lanyard'], gearColor: 0xf8fafc, hairUp: true, roller: true,
  },
  ground: {
    outfit: 'uniform', top: RAMP_NAVY, bottom: 0x1a202c, hat: 'cap', hatColor: RAMP_NAVY, vest: HI_VIS_YELLOW, jacket: 0, accent: 0,
    shoes: 0x1a202c, gear: ['earDefenders', 'boots', 'lanyard'], gearColor: 0x1a202c, hairUp: false, roller: false,
  },
  marshaller: {
    outfit: 'uniform', top: 0x1f2937, bottom: 0x1f2937, hat: 'helmet', hatColor: HI_VIS_ORANGE, vest: HI_VIS_ORANGE, jacket: 0, accent: 0,
    shoes: 0x292524, gear: ['headset', 'boots'], gearColor: 0x111827, hairUp: false, roller: false,
  },
  security: {
    outfit: 'uniform', top: SECURITY_SHIRT, bottom: SECURITY_TROUSERS, hat: 'securityCap', hatColor: 0x1a202c, vest: 0, jacket: 0, accent: 0,
    shoes: 0x1a202c, gear: ['lanyard'], gearColor: HI_VIS_YELLOW, hairUp: false, roller: false,
  },
  fuel: {
    outfit: 'uniform', top: FUEL_RED, bottom: 0x9b2c2c, hat: 'helmet', hatColor: 0xf7fafc, vest: HI_VIS_YELLOW, jacket: 0, accent: 0,
    shoes: 0xc53030, gear: ['earDefenders', 'boots'], gearColor: HI_VIS_YELLOW, hairUp: false, roller: false,
  },
  maintenance: {
    outfit: 'uniform', top: 0x2563eb, bottom: 0x2563eb, hat: 'helmet', hatColor: 0xf8fafc, vest: 0, jacket: 0, accent: 0xf5c400,
    shoes: 0x3f3f46, gear: ['headset', 'boots', 'lanyard'], gearColor: 0x1f2937, hairUp: false, roller: false,
  },
  checkin: {
    outfit: 'uniform', top: CHECKIN_SHIRT, bottom: CHECKIN_TROUSERS, hat: 'none', hatColor: CHECKIN_BLAZER, vest: 0, jacket: CHECKIN_BLAZER, accent: CHECKIN_SCARF,
    shoes: 0x1a202c, gear: ['lanyard'], gearColor: CHECKIN_BLAZER, hairUp: true, roller: false,
  },
  catering: {
    outfit: 'uniform', top: 0xfff7ed, bottom: 0x292524, hat: 'cap', hatColor: 0xfff7ed, vest: 0, jacket: 0, accent: 0xea580c,
    shoes: 0x292524, gear: ['lanyard'], gearColor: 0xea580c, hairUp: true, roller: false,
  },
}

export function resolveTone(tone: Tone, airline: { primary: number; secondary?: number }, fallbackSecondary = 0xf8fafc): number {
  if (tone === 'primary') return airline.primary
  if (tone === 'secondary') return airline.secondary ?? fallbackSecondary
  return tone
}

export interface PassengerOutfit {
  /** Relative share among passengers. Zero is forced only (kids). */
  weight: number
  tops: readonly number[]
  bottoms: readonly number[]
  /** Chance of long sleeves (casual and tourist only). */
  sleeves: number
  /** Chance of shorts. */
  shorts: number
  jackets: readonly number[]
  /** Tie colours, empty for none. */
  ties: readonly number[]
  gear: readonly GearKind[]
  /** Chance of a hat, and which. */
  hat: number
  hats: readonly HatKind[]
  shoes: readonly number[]
}

export const PASSENGER_OUTFITS: Record<Exclude<OutfitKind, 'uniform'>, PassengerOutfit> = {
  casual: {
    weight: 0,
    tops: [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x3b82f6, 0xf5f5f4, 0x737373],
    bottoms: [0x1e293b, 0x334155, 0x57534e, 0x0f172a],
    sleeves: 0.45, shorts: 0.12, jackets: [], ties: [], gear: [], hat: 0.1, hats: ['cap', 'beanie'], shoes: [0x1c1917, 0xe7e5e4],
  },
  business: {
    weight: 0.25,
    tops: [0xf7fafc, 0xe2e8f0, 0xebf8ff],
    bottoms: [0x1a202c, 0x2d3748, 0x1a365d],
    sleeves: 1, shorts: 0, jackets: [0x1a202c, 0x2d3748, 0x1a365d], ties: [0x9b2c2c, 0x2a4365, 0x1a365d], gear: [], hat: 0, hats: [], shoes: [0x1a202c, 0x3b2616],
  },
  tourist: {
    weight: 0.4,
    tops: [0xed8936, 0x38b2ac, 0xf6e05e, 0xfc8181, 0x4299e1],
    bottoms: [0xd6c7a1, 0xc4a574, 0xa0aec0],
    sleeves: 0.05, shorts: 1, jackets: [], ties: [], gear: [], hat: 0.85, hats: ['sunhat'], shoes: [0xf7fafc, 0xc05621],
  },
  family: {
    weight: 0.15,
    tops: [0x2c5282, 0xf7fafc, 0x9b2c2c, 0x2b6cb0],
    bottoms: [0x2d3748, 0x1a202c, 0x4a5568],
    sleeves: 0.7, shorts: 0, jackets: [], ties: [], gear: [], hat: 0.08, hats: ['cap'], shoes: [0x1a202c, 0xf7fafc],
  },
  backpacker: {
    weight: 0.2,
    tops: [0x2f855a, 0xdd6b20, 0x2b6cb0, 0x4a5568],
    bottoms: [0x4a5568, 0x744210, 0x2d3748],
    sleeves: 0.35, shorts: 0, jackets: [], ties: [], gear: [], hat: 0.35, hats: ['cap', 'beanie'], shoes: [0xf7fafc, 0x1a202c, 0xc05621],
  },
}

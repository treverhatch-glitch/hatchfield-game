/**
 * Outfit, accessory and colour per role, as data. Every figure is the same
 * base body (parts.ts); this table is the only place that says what a role
 * wears, so the Gemini front/side/back sheets in public/art/refs/people/ can
 * be matched by editing numbers here without touching geometry.
 *
 * A colour is a hex number, or 'primary' / 'secondary' for the airline livery.
 */
import type { CrewKind, GearKind, HatKind, OutfitKind } from './types.ts'

export type Tone = number | 'primary' | 'secondary'

export const HI_VIS_YELLOW = 0xf5c400
export const HI_VIS_ORANGE = 0xf97316

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
    outfit: 'uniform', top: 0x1e3a5f, bottom: 0x1e293b, hat: 'helmet', hatColor: 0xf8fafc, vest: HI_VIS_YELLOW, jacket: 0, accent: 0,
    shoes: 0x292524, gear: ['earDefenders', 'boots', 'lanyard'], gearColor: 0xdc2626, hairUp: false, roller: false,
  },
  marshaller: {
    outfit: 'uniform', top: 0x1f2937, bottom: 0x1f2937, hat: 'helmet', hatColor: HI_VIS_ORANGE, vest: HI_VIS_ORANGE, jacket: 0, accent: 0,
    shoes: 0x292524, gear: ['headset', 'boots'], gearColor: 0x111827, hairUp: false, roller: false,
  },
  security: {
    outfit: 'uniform', top: 0x334155, bottom: 0x0f172a, hat: 'securityCap', hatColor: 0x0f172a, vest: 0, jacket: 0, accent: 0xf5f5f4,
    shoes: 0x0a0a0a, gear: ['lanyard'], gearColor: 0xf5c400, hairUp: false, roller: false,
  },
  fuel: {
    outfit: 'uniform', top: 0xdc2626, bottom: 0x7f1d1d, hat: 'helmet', hatColor: 0xdc2626, vest: HI_VIS_YELLOW, jacket: 0, accent: 0,
    shoes: 0x292524, gear: ['earDefenders', 'boots'], gearColor: 0xf5c400, hairUp: false, roller: false,
  },
  maintenance: {
    outfit: 'uniform', top: 0x2563eb, bottom: 0x2563eb, hat: 'helmet', hatColor: 0xf8fafc, vest: 0, jacket: 0, accent: 0xf5c400,
    shoes: 0x3f3f46, gear: ['headset', 'boots', 'lanyard'], gearColor: 0x1f2937, hairUp: false, roller: false,
  },
  checkin: {
    outfit: 'uniform', top: 0xf8fafc, bottom: 0x1e3a5f, hat: 'none', hatColor: 0x1e3a8a, vest: 0, jacket: 0x1e3a8a, accent: 0x1d4ed8,
    shoes: 0x0a0a0a, gear: ['lanyard'], gearColor: 0xf5c400, hairUp: false, roller: false,
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
  /** Relative share among passengers. */
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
    weight: 0.6,
    tops: [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x14b8a6, 0x3b82f6, 0x8b5cf6, 0xec4899, 0xf5f5f4, 0x737373, 0x78350f, 0x0ea5e9],
    bottoms: [0x1e293b, 0x334155, 0x1d4ed8, 0x57534e, 0x0f172a, 0xa8a29e, 0x3f6212, 0x7c2d12],
    sleeves: 0.45, shorts: 0.12, jackets: [], ties: [], gear: [], hat: 0.1, hats: ['cap', 'beanie'], shoes: [0x1c1917, 0xe7e5e4],
  },
  business: {
    weight: 0.22,
    tops: [0xf8fafc, 0xbfdbfe, 0xe5e7eb, 0xfde68a],
    bottoms: [0x111827, 0x1f2937, 0x374151, 0x1e3a5f],
    sleeves: 1, shorts: 0, jackets: [0x111827, 0x1f2937, 0x374151, 0x1e3a5f, 0x44403c], ties: [0x7f1d1d, 0x1e3a8a, 0x065f46, 0x6b21a8], gear: [], hat: 0, hats: [], shoes: [0x0a0a0a, 0x3b2616],
  },
  tourist: {
    weight: 0.18,
    tops: [0xf97316, 0x22d3ee, 0xfacc15, 0xf472b6, 0x84cc16, 0xfb7185],
    bottoms: [0xd6c7a1, 0xa8a29e, 0x38bdf8, 0x65a30d],
    sleeves: 0.1, shorts: 0.65, jackets: [], ties: [], gear: [],hat: 0.55, hats: ['sunhat', 'cap'], shoes: [0xe7e5e4, 0xb45309],
  },
}

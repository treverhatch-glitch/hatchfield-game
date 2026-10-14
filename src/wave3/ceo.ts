import type { CeoCard, PortraitSlot } from './types.ts'

export interface CeoSeed {
  name: string
  title: string
  traits: readonly [string, string]
  voice: string
}

/** Fictional people. Real airline executives are not used. */
const KNOWN: Record<string, CeoSeed> = {
  bushline: {
    name: 'Nell Bramble',
    title: 'Chief pilot',
    traits: ['Cautious', 'Family'],
    voice: 'Nell keeps the letter short and asks whether the strip is clear for a Twin Otter.',
  },
  northline: {
    name: 'Jonas Pike',
    title: 'Managing director',
    traits: ['Cost-hawk', 'Punctual'],
    voice: 'Jonas wants the turn on time and the invoice unchanged.',
  },
  harbor: {
    name: 'Amira Solano',
    title: 'Chief executive',
    traits: ['Proud', 'Punctual'],
    voice: 'Amira notices a messy pier before she notices the fee.',
  },
  summit: {
    name: 'Helena Voss',
    title: 'Chair',
    traits: ['Lavish', 'Prestige'],
    voice: 'Helena writes as if the pier already has her name on it.',
  },
  crown: {
    name: 'Idris Okonkwo',
    title: 'Group chief',
    traits: ['Showman', 'Proud'],
    voice: 'Idris treats a hub ceremony as part of the contract.',
  },
  upps: {
    name: 'Ruth Calder',
    title: 'Cargo director',
    traits: ['Cargo-minded', 'Hardball'],
    voice: 'Ruth asks about the shed before she asks about the hall.',
  },
  umazon: {
    name: 'Pavel Nunez',
    title: 'Night-bank chief',
    traits: ['Cargo-minded', 'Cost-hawk'],
    voice: 'Pavel counts night slots, not marble floors.',
  },
  exfed: {
    name: 'Sable Quill',
    title: 'Express president',
    traits: ['Hardball', 'Punctual'],
    voice: 'Sable will cut a bank the week the uplift slips.',
  },
  air_regional_1: {
    name: 'Mara Quill',
    title: 'Owner-pilot',
    traits: ['Cautious', 'Family'],
    voice: 'Mara still flies the Friday rotation herself.',
  },
  air_lowcost_1: {
    name: 'Dex Harrow',
    title: 'Commercial chief',
    traits: ['Cost-hawk', 'Hardball'],
    voice: 'Dex opens with the discount and waits.',
  },
  air_fullservice_1: {
    name: 'Leona Varga',
    title: 'Chief executive',
    traits: ['Lavish', 'Punctual'],
    voice: 'Leona expects a lounge and an on-time board.',
  },
  air_flag_1: {
    name: 'Otto Maren',
    title: 'Flag chair',
    traits: ['Proud', 'Prestige'],
    voice: 'Otto mentions the flag before the fleet.',
  },
  air_cargo_1: {
    name: 'Bess Calder',
    title: 'Fleet director',
    traits: ['Cargo-minded', 'Cautious'],
    voice: 'Bess will not sign a passenger stand.',
  },
}

const FIRST = ['Nell', 'Jonas', 'Amira', 'Helena', 'Idris', 'Ruth', 'Pavel', 'Sable', 'Mara', 'Dex', 'Leona', 'Otto']
const LAST = ['Bramble', 'Pike', 'Solano', 'Voss', 'Okonkwo', 'Calder', 'Nunez', 'Quill', 'Harrow', 'Varga', 'Maren', 'Ash']
const TRAITS = ['Cautious', 'Family', 'Cost-hawk', 'Punctual', 'Proud', 'Lavish', 'Showman', 'Hardball', 'Cargo-minded', 'Prestige'] as const
const SKINS = ['#f3d2b5', '#e0b08a', '#c68642', '#8d5524', '#5c3317']
const HAIRS = ['#1b1b1b', '#4a3428', '#8a5a2a', '#c4b7a6', '#6b2d3c']
const SUITS = ['#1e3a5f', '#24362c', '#3d2a4a', '#4a3030', '#2c3a44']

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function portrait(seed: number): PortraitSlot {
  const styles = ['short', 'long', 'bun', 'bald'] as const
  return {
    seed,
    skin: SKINS[seed % SKINS.length]!,
    hair: HAIRS[(seed >> 3) % HAIRS.length]!,
    hairStyle: styles[(seed >> 6) % styles.length]!,
    suit: SUITS[(seed >> 9) % SUITS.length]!,
    accent: '#e6c35c',
    glasses: (seed & 4) === 4,
  }
}

export function ceoFor(airlineId: string): CeoCard {
  const known = KNOWN[airlineId]
  if (known) {
    return { airlineId, ...known, portrait: portrait(hash(airlineId)) }
  }
  const seed = hash(airlineId)
  const a = FIRST[seed % FIRST.length]!
  const b = LAST[(seed >> 4) % LAST.length]!
  const t1 = TRAITS[seed % TRAITS.length]!
  let t2 = TRAITS[(seed >> 5) % TRAITS.length]!
  if (t2 === t1) t2 = TRAITS[(seed + 3) % TRAITS.length]!
  return {
    airlineId,
    name: `${a} ${b}`,
    title: 'Chief executive',
    traits: [t1, t2],
    voice: `${a} writes in a ${t1.toLowerCase()} tone and signs the letter by hand.`,
    portrait: portrait(seed),
  }
}

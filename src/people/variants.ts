import { BAG_COLORS, BODY, HAIR_COLORS, PAX_RATES, SHIRT_COLORS, SKIN_TONES, TROUSER_COLORS } from './config.ts'
import { makeRng, pick } from './rng.ts'
import type { AgeClass, CrewKind, HairStyle, HatKind, PersonLook } from './types.ts'

const HI_VIS = 0xf5c400
const HI_VIS_B = 0xf97316

export interface PassengerOptions {
  age?: AgeClass
  /** Forces the carried item; otherwise rolled from the seed. */
  carry?: PersonLook['carry']
}

export interface CrewOptions {
  /** Airline livery colours for cabin crew and pilots. */
  airline?: { primary: number; secondary?: number }
}

function keyOf(look: Omit<PersonLook, 'key'>): string {
  return [
    look.crew ?? 'pax', look.age, look.skin.toString(16), look.hair, look.hairColor.toString(16), look.hat,
    look.hatColor.toString(16), look.top.toString(16), look.bottom.toString(16), look.backpack ? 'b' : '-', look.carry,
  ].join('.')
}

function finish(look: Omit<PersonLook, 'key'>): PersonLook {
  return { ...look, key: keyOf(look) }
}

function bodyScale(rng: () => number, age: AgeClass): { height: number; width: number } {
  const base = age === 'kid' ? BODY.kidScale : age === 'teen' ? BODY.teenScale : 1
  return {
    height: base * (1 + (rng() - 0.5) * 2 * BODY.heightSpread),
    width: (age === 'kid' ? 0.9 : 1) * (1 + (rng() - 0.5) * 2 * BODY.widthSpread),
  }
}

export function passengerLook(seed: string | number, opts: PassengerOptions = {}): PersonLook {
  const rng = makeRng(`pax:${seed}`)
  const age: AgeClass = opts.age ?? 'adult'
  const bald = age === 'adult' && rng() < PAX_RATES.bald
  const long = rng() < PAX_RATES.longHair
  const hair: HairStyle = bald ? 'none' : long ? (rng() < 0.3 ? 'bun' : 'long') : 'short'
  const hatRoll = rng()
  const hatPick = pick(rng, ['cap', 'beanie', 'sunhat'] as const)
  const hat: HatKind = age === 'kid' ? (hatRoll < 0.1 ? 'beanie' : 'none') : hatRoll < PAX_RATES.hat ? hatPick : 'none'
  const carryRoll = rng()
  let carry: PersonLook['carry'] = 'none'
  if (age !== 'kid') {
    if (carryRoll < PAX_RATES.roller) carry = 'roller'
    else if (carryRoll < PAX_RATES.roller + PAX_RATES.duffel) carry = 'duffel'
    else if (carryRoll < PAX_RATES.roller + PAX_RATES.duffel + PAX_RATES.cart) carry = 'cart'
  }
  if (opts.carry) carry = opts.carry
  const backpackRoll = rng()
  const backpack = age === 'kid' ? backpackRoll < 0.5 : carry !== 'cart' && backpackRoll < PAX_RATES.backpack
  const scale = bodyScale(rng, age)
  return finish({
    age,
    skin: pick(rng, SKIN_TONES),
    hair,
    hairColor: pick(rng, HAIR_COLORS),
    hat,
    hatColor: pick(rng, SHIRT_COLORS),
    top: pick(rng, SHIRT_COLORS),
    bottom: pick(rng, TROUSER_COLORS),
    shoes: rng() < 0.5 ? 0x1c1917 : 0xe7e5e4,
    sleeves: rng() < 0.45,
    backpack,
    backpackColor: pick(rng, BAG_COLORS),
    carry,
    carryColor: pick(rng, BAG_COLORS),
    vest: 0,
    wands: false,
    accent: 0,
    ...scale,
    phase: rng(),
    crew: null,
  })
}

interface Uniform {
  top: number
  bottom: number
  hat: HatKind
  hatColor: number
  vest: number
  accent: number
  shoes: number
}

function uniformFor(kind: CrewKind, airline: { primary: number; secondary?: number }): Uniform {
  switch (kind) {
    case 'pilot':
      return { top: 0xf8fafc, bottom: 0x111827, hat: 'pilotCap', hatColor: 0x111827, vest: 0, accent: airline.primary, shoes: 0x0a0a0a }
    case 'cabin':
      return { top: airline.primary, bottom: airline.secondary ?? 0x1e293b, hat: 'beret', hatColor: airline.primary, vest: 0, accent: airline.secondary ?? 0xf8fafc, shoes: 0x1c1917 }
    case 'ground':
      return { top: 0x1e3a5f, bottom: 0x1e293b, hat: 'helmet', hatColor: 0xf8fafc, vest: HI_VIS, accent: 0, shoes: 0x292524 }
    case 'marshaller':
      return { top: 0x1f2937, bottom: 0x1f2937, hat: 'helmet', hatColor: HI_VIS_B, vest: HI_VIS_B, accent: 0, shoes: 0x292524 }
    case 'security':
      return { top: 0x334155, bottom: 0x0f172a, hat: 'securityCap', hatColor: 0x0f172a, vest: 0, accent: 0xf5f5f4, shoes: 0x0a0a0a }
    case 'fuel':
      return { top: 0xdc2626, bottom: 0x7f1d1d, hat: 'helmet', hatColor: 0xdc2626, vest: HI_VIS, accent: 0, shoes: 0x292524 }
    case 'maintenance':
      return { top: 0x2563eb, bottom: 0x2563eb, hat: 'helmet', hatColor: 0xf8fafc, vest: 0, accent: 0xf5c400, shoes: 0x3f3f46 }
  }
}

export function crewLook(kind: CrewKind, seed: string | number, opts: CrewOptions = {}): PersonLook {
  const rng = makeRng(`crew:${kind}:${seed}`)
  const u = uniformFor(kind, opts.airline ?? { primary: 0x1d4ed8, secondary: 0xf8fafc })
  const scale = bodyScale(rng, 'adult')
  const long = kind === 'cabin' || rng() < 0.25
  return finish({
    age: 'adult',
    skin: pick(rng, SKIN_TONES),
    hair: long ? (kind === 'cabin' ? 'bun' : 'long') : 'short',
    hairColor: pick(rng, HAIR_COLORS),
    hat: u.hat,
    hatColor: u.hatColor,
    top: u.top,
    bottom: u.bottom,
    shoes: u.shoes,
    sleeves: true,
    backpack: false,
    backpackColor: 0,
    carry: kind === 'pilot' || kind === 'cabin' ? 'roller' : 'none',
    carryColor: 0x111827,
    vest: u.vest,
    wands: kind === 'marshaller',
    accent: u.accent,
    ...scale,
    phase: rng(),
    crew: kind,
  })
}

export interface GroupMember {
  look: PersonLook
  /** Offset from the lead in the lead's frame (x right, z forward), metres. */
  slot: { x: number; z: number }
  isLead: boolean
}

/** Family or party: adults first, kids last, slots fanned out behind the lead. */
export function groupLooks(seed: string | number, size: number, kids = 0): GroupMember[] {
  const rng = makeRng(`grp:${seed}`)
  const total = Math.max(1, Math.round(size))
  const kidCount = Math.min(Math.max(0, Math.round(kids)), total - 1)
  const out: GroupMember[] = []
  for (let i = 0; i < total; i++) {
    const isKid = i >= total - kidCount
    const age: AgeClass = isKid ? (rng() < 0.35 ? 'teen' : 'kid') : 'adult'
    const side = i % 2 === 0 ? -1 : 1
    const ring = Math.ceil(i / 2)
    out.push({
      look: passengerLook(`${seed}:${i}`, { age }),
      slot: i === 0 ? { x: 0, z: 0 } : { x: side * (0.6 + 0.25 * ring) * (isKid ? 0.8 : 1), z: -0.5 * ring },
      isLead: i === 0,
    })
  }
  return out
}

/**
 * Pull a follower toward its slot so it never strays past the leash.
 * Pure: returns the new position, caller applies it.
 */
export function followSlot(
  lead: { x: number; z: number; heading: number },
  slot: { x: number; z: number },
  current: { x: number; z: number },
  leashM: number,
  dt: number,
  speed: number,
): { x: number; z: number } {
  const cos = Math.cos(lead.heading)
  const sin = Math.sin(lead.heading)
  // heading 0 faces +z; slot.x is to the right.
  const tx = lead.x + slot.x * cos + slot.z * sin
  const tz = lead.z - slot.x * sin + slot.z * cos
  let dx = tx - current.x
  let dz = tz - current.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-6) return { x: current.x, z: current.z }
  const step = Math.min(d, Math.max(0, speed) * Math.max(0, dt))
  let nx = current.x + (dx / d) * step
  let nz = current.z + (dz / d) * step
  dx = nx - lead.x
  dz = nz - lead.z
  const away = Math.hypot(dx, dz)
  if (away > leashM) {
    nx = lead.x + (dx / away) * leashM
    nz = lead.z + (dz / away) * leashM
  }
  return { x: nx, z: nz }
}

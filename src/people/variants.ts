import { BAG_COLORS, BODY, ELDER_HAIR, HAIR_COLORS, PAX_RATES, SKIN_TONES } from './config.ts'
import { CHECKIN_BLAZER, CHECKIN_SCARF, CHECKIN_SHIRT, CHECKIN_TROUSERS, CREW_OUTFITS, PASSENGER_OUTFITS, resolveTone } from './outfits.ts'
import { makeRng, pick } from './rng.ts'
import { sheetForCrewKind } from './sheets.ts'
import type { AgeClass, CrewKind, GearKind, HairStyle, HatKind, OutfitKind, PersonLook, SheetId } from './types.ts'

export interface PassengerOptions {
  age?: AgeClass
  /** Forces the carried item; otherwise rolled from the seed. */
  carry?: PersonLook['carry']
  /** Forces the clothing family; otherwise rolled from the seed or the purpose. */
  outfit?: Exclude<OutfitKind, 'uniform'>
  /**
   * Existing sim purpose or fare tag: business, premium, leisure, family, budget.
   * Premium wears the business suit. Does not add a sim role.
   */
  purpose?: string
}

export interface CrewOptions {
  /** Airline livery colours for cabin crew and pilots. */
  airline?: { primary: number; secondary?: number }
}

const PURPOSE_OUTFIT: Record<string, Exclude<OutfitKind, 'uniform'>> = {
  business: 'business',
  premium: 'business',
  leisure: 'tourist',
  family: 'family',
  budget: 'backpacker',
}

function keyOf(look: Omit<PersonLook, 'key'>): string {
  return [
    look.sheet ?? look.crew ?? 'pax', look.age, look.outfit, look.skin.toString(16), look.hair, look.hairColor.toString(16), look.hat,
    look.hatColor.toString(16), look.top.toString(16), look.bottom.toString(16), look.jacket.toString(16),
    look.shorts ? 's' : '-', look.backpack ? 'b' : '-', look.carry, look.gear.join('+'),
  ].join('.')
}

function finish(look: Omit<PersonLook, 'key'>): PersonLook {
  return { ...look, key: keyOf(look) }
}

function sheetOf(outfit: OutfitKind, crew: CrewKind | null): SheetId | null {
  if (crew) return sheetForCrewKind(crew)
  if (outfit === 'business') return 'pax_business'
  if (outfit === 'tourist') return 'pax_tourist'
  if (outfit === 'family') return 'pax_family'
  if (outfit === 'backpacker') return 'pax_backpacker'
  return null
}

/** Height, build, head size and stoop for an age. */
function bodyFor(rng: () => number, age: AgeClass): Pick<PersonLook, 'height' | 'width' | 'headScale' | 'stoop'> {
  const base = age === 'kid' ? BODY.kidScale : age === 'teen' ? BODY.teenScale : age === 'elder' ? BODY.elderScale : 1
  return {
    height: base * (1 + (rng() - 0.5) * 2 * BODY.heightSpread),
    width: (age === 'kid' ? 0.9 : 1) * (1 + (rng() - 0.5) * 2 * BODY.widthSpread),
    headScale: BODY.headScale[age],
    stoop: age === 'elder' ? BODY.elderStoop : 0,
  }
}

function rollOutfit(rng: () => number): Exclude<OutfitKind, 'uniform'> {
  const kinds = ['business', 'tourist', 'family', 'backpacker'] as const
  let r = rng() * kinds.reduce((sum, k) => sum + PASSENGER_OUTFITS[k].weight, 0)
  for (const k of kinds) {
    r -= PASSENGER_OUTFITS[k].weight
    if (r <= 0) return k
  }
  return 'tourist'
}

export function passengerLook(seed: string | number, opts: PassengerOptions = {}): PersonLook {
  const rng = makeRng(`pax:${seed}`)
  const age: AgeClass = opts.age ?? (rng() < PAX_RATES.elder ? 'elder' : 'adult')
  const kidlike = age === 'kid'
  const fromPurpose = opts.purpose ? PURPOSE_OUTFIT[opts.purpose] : undefined
  const outfit = kidlike ? 'casual' : (opts.outfit ?? fromPurpose ?? rollOutfit(rng))
  const o = PASSENGER_OUTFITS[outfit]
  const bald = (age === 'adult' || age === 'elder') && rng() < PAX_RATES.bald
  const long = rng() < PAX_RATES.longHair
  const style = rng()
  const hair: HairStyle = bald ? 'none' : long ? (style < 0.35 ? 'bun' : 'long') : 'short'
  const hatRoll = rng()
  const hatPick = pick(rng, o.hats.length ? o.hats : (['cap'] as const))
  const hat: HatKind = kidlike ? (hatRoll < 0.1 ? 'beanie' : 'none') : o.hats.length && hatRoll < o.hat ? hatPick : 'none'
  const carryRoll = rng()
  let carry: PersonLook['carry'] = 'none'
  if (!kidlike && outfit !== 'business') {
    const r = PAX_RATES
    if (carryRoll < r.roller) carry = 'roller'
    else if (carryRoll < r.roller + r.duffel) carry = 'duffel'
    else if (carryRoll < r.roller + r.duffel + r.cart) carry = 'cart'
    else if (carryRoll < r.roller + r.duffel + r.cart + r.stroller && age === 'adult' && outfit !== 'backpacker') carry = 'stroller'
  }
  if (outfit === 'business' && !opts.carry) carry = carryRoll < 0.55 ? 'briefcase' : 'roller'
  if (opts.carry) carry = opts.carry
  const backpackRoll = rng()
  let backpack = kidlike ? backpackRoll < 0.5 : carry !== 'cart' && carry !== 'stroller' && backpackRoll < PAX_RATES.backpack
  let shorts = !kidlike && o.shorts > 0 && rng() < o.shorts
  if (outfit === 'backpacker') {
    backpack = true
    if (!opts.carry && (carry === 'cart' || carry === 'stroller' || carry === 'roller')) carry = carryRoll < 0.45 ? 'duffel' : 'none'
  }
  if (outfit === 'business') {
    backpack = false
    shorts = false
  }
  if (outfit === 'tourist') shorts = true
  if (outfit === 'family') {
    backpack = false
    shorts = false
  }
  const body = bodyFor(rng, age)
  const jacket = o.jackets.length ? pick(rng, o.jackets) : 0
  const gear: GearKind[] = o.gear.filter(() => rng() < 0.5)
  return finish({
    age,
    outfit,
    skin: pick(rng, SKIN_TONES),
    hair,
    hairColor: age === 'elder' ? pick(rng, ELDER_HAIR) : pick(rng, HAIR_COLORS),
    hat,
    hatColor: outfit === 'tourist' ? 0xf7fafc : pick(rng, o.tops),
    top: pick(rng, o.tops),
    bottom: pick(rng, o.bottoms),
    shoes: pick(rng, o.shoes),
    sleeves: jacket !== 0 || rng() < o.sleeves,
    shorts,
    jacket,
    backpack,
    backpackColor: outfit === 'backpacker' ? 0x3f6212 : pick(rng, BAG_COLORS),
    carry,
    carryColor: outfit === 'business' ? 0x1a202c : pick(rng, BAG_COLORS),
    vest: 0,
    wands: false,
    accent: o.ties.length ? pick(rng, o.ties) : 0,
    gear,
    gearColor: 0x111827,
    ...body,
    phase: rng(),
    crew: null,
    sheet: sheetOf(outfit, null),
  })
}

export function crewLook(kind: CrewKind, seed: string | number, opts: CrewOptions = {}): PersonLook {
  const rng = makeRng(`crew:${kind}:${seed}`)
  const airline = opts.airline ?? { primary: 0x1d4ed8, secondary: 0xf8fafc }
  const u = CREW_OUTFITS[kind]
  const body = bodyFor(rng, 'adult')
  const long = u.hairUp || rng() < 0.25
  return finish({
    age: 'adult',
    outfit: u.outfit,
    skin: pick(rng, SKIN_TONES),
    hair: long ? (u.hairUp ? 'bun' : 'long') : 'short',
    hairColor: pick(rng, HAIR_COLORS),
    hat: u.hat,
    hatColor: resolveTone(u.hatColor, airline),
    top: resolveTone(u.top, airline),
    bottom: resolveTone(u.bottom, airline, 0x1e293b),
    shoes: u.shoes,
    sleeves: true,
    shorts: false,
    jacket: u.jacket ? resolveTone(u.jacket, airline) : 0,
    backpack: false,
    backpackColor: 0,
    carry: u.roller ? 'roller' : 'none',
    carryColor: 0x111827,
    vest: u.vest,
    wands: kind === 'marshaller',
    accent: u.accent ? resolveTone(u.accent, airline) : 0,
    gear: u.gear,
    gearColor: u.gearColor,
    ...body,
    phase: rng(),
    crew: kind,
    sheet: sheetForCrewKind(kind),
  })
}

/** Check-in desk agent: navy blazer, white shirt, red scarf, badge. Same body as cabin crew. */
export function checkinLook(seed: string | number): PersonLook {
  const { key: _dropped, ...look } = crewLook('cabin', seed, { airline: { primary: CHECKIN_SHIRT, secondary: CHECKIN_BLAZER } })
  return finish({
    ...look,
    top: CHECKIN_SHIRT,
    bottom: CHECKIN_TROUSERS,
    jacket: CHECKIN_BLAZER,
    accent: CHECKIN_SCARF,
    hat: 'none',
    hatColor: CHECKIN_BLAZER,
    shoes: 0x1a202c,
    carry: 'none',
    backpack: false,
    vest: 0,
    gear: ['lanyard'],
    gearColor: CHECKIN_BLAZER,
    hair: 'bun',
    sheet: 'crew_checkin',
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
      look: passengerLook(`${seed}:${i}`, { age, outfit: isKid ? 'casual' : 'family' }),
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

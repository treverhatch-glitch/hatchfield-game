export type AgeClass = 'adult' | 'teen' | 'kid' | 'elder'
export type HairStyle = 'none' | 'short' | 'long' | 'bun'
export type HatKind = 'none' | 'cap' | 'beanie' | 'sunhat' | 'pilotCap' | 'helmet' | 'beret' | 'securityCap'
export type CarryKind = 'none' | 'roller' | 'duffel' | 'cart' | 'stroller' | 'briefcase'
/** Clothing family. Adults wear a sheet outfit; kids stay casual; crew are 'uniform'. */
export type OutfitKind = 'casual' | 'business' | 'tourist' | 'family' | 'backpacker' | 'uniform'
/**
 * Finished reference sheet wired to an existing purpose or post.
 * Premium fares use pax_business. There is no separate sim role.
 */
export type SheetId =
  | 'pax_business'
  | 'pax_tourist'
  | 'pax_family'
  | 'pax_backpacker'
  | 'crew_ramp'
  | 'crew_security'
  | 'crew_checkin'
  | 'crew_fueler'
/** Worn accessories that ride on the shared body. */
export type GearKind = 'headset' | 'earDefenders' | 'lanyard' | 'boots'

export type CrewKind = 'pilot' | 'cabin' | 'ground' | 'marshaller' | 'security' | 'fuel' | 'maintenance' | 'checkin' | 'catering'
export const CREW_KINDS: readonly CrewKind[] = ['pilot', 'cabin', 'ground', 'marshaller', 'security', 'fuel', 'maintenance', 'checkin', 'catering']

export type PersonPose =
  | 'walk'
  | 'idle'
  | 'queue'
  | 'bagPull'
  | 'push'
  | 'wave'
  | 'reach'
  | 'seated'
  /** Down on one knee at a chock, coupling or panel. */
  | 'kneel'
  /** Handing a bag or box up: arms cycle from hip to shoulder. */
  | 'lift'
  /** Walking with both hands holding something in front. */
  | 'carry'
  /** Wing walker: walking with one wand held out. */
  | 'signal'
export const PERSON_POSES: readonly PersonPose[] = [
  'walk',
  'idle',
  'queue',
  'bagPull',
  'push',
  'wave',
  'reach',
  'seated',
  'kneel',
  'lift',
  'carry',
  'signal',
]

export interface PersonLook {
  /** Stable key for the variant: same look, same key. */
  key: string
  age: AgeClass
  outfit: OutfitKind
  skin: number
  hair: HairStyle
  hairColor: number
  hat: HatKind
  hatColor: number
  top: number
  bottom: number
  shoes: number
  /** Long sleeves: arms use the top colour, otherwise skin. */
  sleeves: boolean
  /** Short trousers: the lower leg shows skin. */
  shorts: boolean
  /** Suit jacket colour (arms follow it), 0 for none. */
  jacket: number
  backpack: boolean
  backpackColor: number
  carry: CarryKind
  carryColor: number
  /** Reflective vest colour, 0 for none. */
  vest: number
  /** Held wands for marshallers. */
  wands: boolean
  /** Tie, scarf or stripe colour, 0 for none. */
  accent: number
  gear: readonly GearKind[]
  /** Headset, ear defender and lanyard colour. */
  gearColor: number
  /** Body scale multipliers. */
  height: number
  width: number
  /** Head size relative to an adult: kids have bigger heads. */
  headScale: number
  /** Forward stoop in radians, for the elderly. */
  stoop: number
  /** Walk phase offset 0..1 so crowds do not step in unison. */
  phase: number
  crew: CrewKind | null
  /** Reference sheet this look was coloured from. Null for kids and unspecialised crew. */
  sheet: SheetId | null
}

export type AgeClass = 'adult' | 'teen' | 'kid' | 'elder'
export type HairStyle = 'none' | 'short' | 'long' | 'bun'
export type HatKind = 'none' | 'cap' | 'beanie' | 'sunhat' | 'pilotCap' | 'helmet' | 'beret' | 'securityCap'
export type CarryKind = 'none' | 'roller' | 'duffel' | 'cart' | 'stroller'
/** Clothing family. Passengers pick one of the first three; crew are 'uniform'. */
export type OutfitKind = 'casual' | 'business' | 'tourist' | 'uniform'
/** Worn accessories that ride on the shared body. */
export type GearKind = 'headset' | 'earDefenders' | 'lanyard' | 'boots'

export type CrewKind = 'pilot' | 'cabin' | 'ground' | 'marshaller' | 'security' | 'fuel' | 'maintenance'
export const CREW_KINDS: readonly CrewKind[] = ['pilot', 'cabin', 'ground', 'marshaller', 'security', 'fuel', 'maintenance']

export type PersonPose = 'walk' | 'idle' | 'queue' | 'bagPull' | 'push' | 'wave' | 'reach' | 'seated'
export const PERSON_POSES: readonly PersonPose[] = ['walk', 'idle', 'queue', 'bagPull', 'push', 'wave', 'reach', 'seated']

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
}

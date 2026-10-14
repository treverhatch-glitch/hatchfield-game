export type AgeClass = 'adult' | 'teen' | 'kid'
export type HairStyle = 'none' | 'short' | 'long' | 'bun'
export type HatKind = 'none' | 'cap' | 'beanie' | 'sunhat' | 'pilotCap' | 'helmet' | 'beret' | 'securityCap'
export type CarryKind = 'none' | 'roller' | 'duffel' | 'cart'

export type CrewKind = 'pilot' | 'cabin' | 'ground' | 'marshaller' | 'security' | 'fuel' | 'maintenance'
export const CREW_KINDS: readonly CrewKind[] = ['pilot', 'cabin', 'ground', 'marshaller', 'security', 'fuel', 'maintenance']

export type PersonPose = 'walk' | 'idle' | 'queue' | 'bagPull' | 'wave' | 'reach' | 'seated'
export const PERSON_POSES: readonly PersonPose[] = ['walk', 'idle', 'queue', 'bagPull', 'wave', 'reach', 'seated']

export interface PersonLook {
  /** Stable key for the variant: same look, same key. */
  key: string
  age: AgeClass
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
  /** Body scale multipliers. */
  height: number
  width: number
  /** Walk phase offset 0..1 so crowds do not step in unison. */
  phase: number
  crew: CrewKind | null
}

/**
 * Reference sheets for passengers and crew. Full-resolution JPEGs live in
 * `assets/people/originals/` and are not served. The figures are vertex-coloured
 * from these palettes, so boot does not decode the sheets.
 *
 * A caller that does sample a sheet (a close-up bake, a swatch) must pass the
 * texture-quality setting and stay under `peopleSheetEdge`. Nothing in the
 * people renderer imports an image loader.
 */
import type { CrewKind, SheetId } from './types.ts'

export const PEOPLE_ORIGINALS_DIR = 'assets/people/originals'

/** Long side after `hatchfield-texture-quality`. Matches the livery plates. */
export const PEOPLE_SHEET_EDGE = { low: 320, med: 640, high: 1280 } as const

export type PeopleTextureQuality = keyof typeof PEOPLE_SHEET_EDGE

export function peopleSheetEdge(quality: PeopleTextureQuality): number {
  return PEOPLE_SHEET_EDGE[quality]
}

export function peopleOriginalPath(id: string): string {
  return `${PEOPLE_ORIGINALS_DIR}/${id}.jpg`
}

/**
 * Existing sim purposes and crew kinds. Premium fares wear the business suit.
 * Leisure is the tourist. Budget is the backpacker. No new sim roles.
 */
export function sheetForPurpose(purpose: string | undefined | null): SheetId {
  switch (purpose) {
    case 'business':
    case 'premium':
      return 'pax_business'
    case 'family':
      return 'pax_family'
    case 'budget':
      return 'pax_backpacker'
    case 'leisure':
      return 'pax_tourist'
    default:
      return 'pax_tourist'
  }
}

export function sheetForCrewKind(kind: CrewKind): SheetId | null {
  switch (kind) {
    case 'ground':
      return 'crew_ramp'
    case 'security':
      return 'crew_security'
    case 'fuel':
      return 'crew_fueler'
    case 'checkin':
      return 'crew_checkin'
    default:
      return null
  }
}

/** Terminal posts. Check-in is the desk agent, not every cabin uniform. */
export function sheetForPost(post: string | undefined | null): SheetId | null {
  switch (post) {
    case 'checkin':
    case 'agent':
      return 'crew_checkin'
    case 'security':
    case 'screener':
      return 'crew_security'
    default:
      return null
  }
}

/** Sheets this pass wires into a look. The test walks this list. */
export const MAPPED_SHEETS = [
  'pax_business',
  'pax_tourist',
  'pax_family',
  'pax_backpacker',
  'crew_ramp',
  'crew_security',
  'crew_checkin',
  'crew_fueler',
] as const satisfies readonly SheetId[]

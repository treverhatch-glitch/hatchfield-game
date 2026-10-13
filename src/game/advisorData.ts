/**
 * Terminal Advisor — tunables and player-facing copy for the live hint list.
 *
 * Pure data. `advisorBridge.ts` reads this; the sim and the hint panel never
 * hard-code a severity, a refresh period, or a hint title.
 */
import type { EquipmentId, RoomId } from '../terminaladvisor/index.ts'

export type HintSeverity = 'blocker' | 'warning' | 'tip'

/** Worst first. The panel sorts on this and the badge shows the lowest rank. */
export const SEVERITY_RANK: Record<HintSeverity, number> = { blocker: 0, warning: 1, tip: 2 }

export const SEVERITY_LABEL: Record<HintSeverity, string> = {
  blocker: 'Blocker',
  warning: 'Warning',
  tip: 'Tip',
}

export const SEVERITY_COLOR: Record<HintSeverity, string> = {
  blocker: '#e5534b',
  warning: '#f0c14a',
  tip: '#7ec3e8',
}

export const ADVISOR_TUNING = {
  /** Sim-seconds between background refreshes. Builds and bulldozes refresh at once. */
  refreshSec: 5,
  /** Share of the remaining distance the camera covers each frame on "Show me". */
  panEase: 0.16,
  /** The pan snaps home inside this many meters. */
  panSnapM: 0.05,
} as const

/**
 * Severity of the ops and kit notes that predate the layout advisor.
 * Exact ids win over prefixes. Anything unlisted is a warning.
 */
export const NOTE_SEVERITY: Record<string, HintSeverity> = {
  'unreachable-gate': 'blocker',
  'security-bypass': 'blocker',
  'missing-signs': 'tip',
  'litter-no-bins': 'tip',
}

export const NOTE_SEVERITY_PREFIX: [string, HintSeverity][] = [
  ['standing-', 'warning'],
  ['zone-', 'warning'],
  ['dead-', 'warning'],
]

/**
 * One problem, several reporters. The first id in a group that is present
 * stays; the layout advisor is listed first because it carries a cell.
 */
export const HINT_DUPES: string[][] = [
  ['security_bypass', 'security-bypass'],
  ['gates_unreachable', 'missing_gates', 'unreachable-gate'],
  ['missing_restrooms', 'toilets-far'],
  ['missing_bagclaim', 'claim_unreachable', 'claim-far'],
]

/** Layout advisor checks the live hall does not model yet (bag hall, jet bridges). */
export const LAYOUT_DROP = ['no_baghall', 'no_bridges', 'equip_baghall_belt']

/** Advisor room → the zone name the player paints. */
export const ROOM_ZONE_LABEL: Partial<Record<RoomId, string>> = {
  checkin: 'Check-in',
  security: 'Security',
  corridor: 'Security',
  gates: 'Gates',
  bagclaim: 'Arrivals',
  restrooms: 'Toilets',
  food: 'Shops / Food',
  shops: 'Shops / Food',
  lounge: 'Shops / Food',
}

/** Advisor equipment → the kit item the player places. */
export const NEED_WORD: Partial<Record<EquipmentId, { noun: string; place: string }>> = {
  desk: { noun: 'check-in desk', place: 'a Check-in desk' },
  scanner: { noun: 'security lane', place: 'a security lane' },
  gate_desk: { noun: 'boarding desk', place: 'a Boarding desk' },
  seat: { noun: 'seating', place: 'a bench or seat row' },
  carousel: { noun: 'claim carousel', place: 'a Claim carousel' },
  toilet: { noun: 'toilet', place: 'a Toilet' },
}

/** Kit item → what the advisor counts it as. Unlisted items (decor, rails) do not count. */
export const ITEM_EQUIPMENT: Partial<Record<string, EquipmentId>> = {
  checkin_belt: 'desk',
  checkin_express: 'desk',
  kiosk: 'kiosk',
  security_small: 'scanner',
  security_medium: 'scanner',
  security_large: 'scanner',
  boarding_desk: 'gate_desk',
  seat_row: 'seat',
  bench: 'seat',
  claim_carousel: 'carousel',
  bag_system: 'belt',
  toilet: 'toilet',
  toilet_plus: 'toilet',
  cafe: 'shop_unit',
  restaurant: 'shop_unit',
  fast_food: 'shop_unit',
  wayfinding: 'sign',
}

/** Title and fix for each layout check. `{zone}` and `{need}` / `{place}` fill in per hint. */
export const LAYOUT_COPY: Record<string, { title: string; fix: string }> = {
  no_curb: {
    title: 'No entrance doors',
    fix: 'Place Entrance doors on a Check-in cell.',
  },
  missing_checkin: {
    title: 'No check-in yet',
    fix: 'Paint Check-in cells by the doors and place a desk.',
  },
  missing_security: {
    title: 'No security checkpoint',
    fix: 'Paint Security between Check-in and Gates, then place a security lane.',
  },
  missing_gates: {
    title: 'No gates yet',
    fix: 'Paint Gates past Security and place a Boarding desk.',
  },
  missing_bagclaim: {
    title: 'No arrivals hall',
    fix: 'Paint Arrivals next to Check-in or Security and place a Claim carousel.',
  },
  missing_restrooms: {
    title: 'No toilets',
    fix: 'Paint a Toilets cell and place a Toilet.',
  },
  security_bypass: {
    title: 'Gates reachable without security',
    fix: 'Put a security lane in every Security strip. Check-in and Arrivals may only reach Gates through it.',
  },
  gates_unreachable: {
    title: 'Gates cut off from the doors',
    fix: 'Join Check-in to Security, and Security to Gates.',
  },
  claim_unreachable: {
    title: 'Arrivals has no way out',
    fix: 'Let Arrivals touch Check-in or Security so people can reach the curb.',
  },
  dead_: {
    title: '{zone} is sealed off',
    fix: 'Paint cells to join it to the rest of the hall.',
  },
  equip_: {
    title: '{zone} has no {need}',
    fix: 'Place {place} in that zone.',
  },
}

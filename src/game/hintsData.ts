/**
 * Hint panel data — default severities, mute kinds, and duplicate groups.
 * Pure data. Tunable here, read by hints.ts.
 */
import type { HintSeverity } from './hints.ts'

/** Ids that carry a hall, stand, or airline suffix share one mute kind. */
export const HINT_KIND_PREFIX: [prefix: string, kind: string][] = [
  ['session-', 'session'],
  ['standing-', 'standing'],
  ['delay-', 'turnaround-delay'],
  ['dead-', 'dead-end'],
  ['plan-dead_', 'plan-dead-end'],
  ['zone-', 'zone-unreachable'],
  // Built-from-scratch halls (src/terminalbuild): per-room / per-kit / per-door suffixes.
  ['build-room_empty:', 'build-room-empty'],
  ['build-room_zone:', 'build-room-zone'],
  ['build-room_floor:', 'build-room-floor'],
  ['build-gate_unreachable:', 'build-gate-unreachable'],
  ['build-gate_no_apron:', 'build-gate-no-apron'],
  ['build-lane_dead_end:', 'build-lane-dead-end'],
  ['build-bags_no_route:', 'build-bags-no-route'],
  ['build-makeup_no_apron:', 'build-makeup-no-apron'],
  ['build-equip_room:', 'build-equip-room'],
  ['build-equip_blocked:', 'build-equip-blocked'],
  ['build-equip_unreachable:', 'build-equip-unreachable'],
  ['build-door_', 'build-door'],
]

/** Severity for notes that do not set their own. Everything else is a warning. */
export const HINT_SEVERITY: Record<string, HintSeverity> = {
  'unreachable-gate': 'blocker',
  'security-bypass': 'blocker',
  'over-capacity': 'blocker',
  'zone-unreachable': 'warning',
  'dead-end': 'warning',
  'missing-signs': 'tip',
  'claim-far': 'warning',
  'toilets-far': 'warning',
  'litter-no-bins': 'tip',
  'litter-floor': 'warning',
  'litter-bins-full': 'warning',
  'restroom-dirty': 'warning',
  'low-meals': 'tip',
  'low-fuel': 'warning',
  'turnaround-delay': 'tip',
  standing: 'warning',
  session: 'tip',
}

/**
 * Two checks that say the same thing in different words share a group.
 * The panel keeps the worst one so the player reads it once.
 */
export const HINT_SAME: Record<string, string> = {
  'unreachable-gate': 'gate-reach',
  'plan-gates_unreachable': 'gate-reach',
  'plan-missing_gates': 'gate-reach',
  'toilets-far': 'toilets',
  'plan-missing_restrooms': 'toilets',
  'claim-far': 'claim',
  'plan-missing_bagclaim': 'claim',
}

/** Seconds between periodic advisor refreshes while the clock runs. */
export const HINT_REFRESH_SEC = 4

/** Settings key that mirrors the save's hint choices. */
export const HINT_SETTINGS_KEY = 'hatchfield-hint-settings'

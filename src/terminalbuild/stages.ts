/**
 * Passenger stages, as data. WP2 records the list. WP3 makes the walk follow it.
 * Passport control is international arrivals only, and that rule lands in WP3.
 */
import type { FittingKind, ZoneSide } from './types.ts'

export type StageId =
  | 'CURB_IN'
  | 'LANDSIDE_FREE'
  | 'CHECKIN'
  | 'BAG_DROP'
  | 'SECURITY'
  | 'AIRSIDE_FREE'
  | 'GATE_HOLD'
  | 'GATE_QUEUE'
  | 'BOARD'
  | 'DEPLANE'
  | 'ARR_CORRIDOR'
  | 'PASSPORT'
  | 'ARR_FREE'
  | 'CLAIM'
  | 'EXIT'
  | 'CURB_OUT'

export interface StageDef {
  id: StageId
  flow: 'departure' | 'arrival'
  servedBy: readonly FittingKind[]
  side: ZoneSide
  /** The passenger may skip this stage. */
  optional: boolean
  /** When the skip applies. Empty means the stage is never skipped. */
  skip: string
}

export const DEPARTURE_STAGES: readonly StageId[] = [
  'CURB_IN',
  'LANDSIDE_FREE',
  'CHECKIN',
  'BAG_DROP',
  'SECURITY',
  'AIRSIDE_FREE',
  'GATE_HOLD',
  'GATE_QUEUE',
  'BOARD',
]

export const ARRIVAL_STAGES: readonly StageId[] = [
  'DEPLANE',
  'ARR_CORRIDOR',
  'PASSPORT',
  'ARR_FREE',
  'CLAIM',
  'EXIT',
  'LANDSIDE_FREE',
  'CURB_OUT',
]

export const STAGES: readonly StageDef[] = [
  { id: 'CURB_IN', flow: 'departure', servedBy: [], side: 'landside', optional: false, skip: '' },
  { id: 'LANDSIDE_FREE', flow: 'departure', servedBy: ['shop_counter', 'cafe_table', 'wc_block', 'bench', 'fids'], side: 'landside', optional: true, skip: 'no need, or the show-up is late' },
  { id: 'CHECKIN', flow: 'departure', servedBy: ['checkin_desk', 'checkin_kiosk'], side: 'landside', optional: true, skip: 'online check-in with no bags' },
  { id: 'BAG_DROP', flow: 'departure', servedBy: ['bag_drop', 'checkin_desk'], side: 'landside', optional: true, skip: 'no checked bags' },
  { id: 'SECURITY', flow: 'departure', servedBy: ['bp_podium', 'security_lane'], side: 'security', optional: false, skip: '' },
  { id: 'AIRSIDE_FREE', flow: 'departure', servedBy: ['shop_counter', 'cafe_table', 'wc_block', 'seat_row', 'bench'], side: 'airside', optional: true, skip: 'boarding has opened' },
  { id: 'GATE_HOLD', flow: 'departure', servedBy: ['seat_row', 'bench'], side: 'airside', optional: true, skip: 'gate not yet assigned' },
  { id: 'GATE_QUEUE', flow: 'departure', servedBy: ['gate_desk'], side: 'airside', optional: false, skip: '' },
  { id: 'BOARD', flow: 'departure', servedBy: ['gate_head'], side: 'airside', optional: false, skip: '' },
  { id: 'DEPLANE', flow: 'arrival', servedBy: ['gate_head'], side: 'sterile_arr', optional: false, skip: '' },
  { id: 'ARR_CORRIDOR', flow: 'arrival', servedBy: [], side: 'sterile_arr', optional: false, skip: '' },
  { id: 'PASSPORT', flow: 'arrival', servedBy: ['passport_booth'], side: 'sterile_arr', optional: true, skip: 'flight is not international' },
  { id: 'ARR_FREE', flow: 'arrival', servedBy: ['wc_block', 'shop_counter'], side: 'sterile_arr', optional: true, skip: 'no need' },
  { id: 'CLAIM', flow: 'arrival', servedBy: ['claim_carousel'], side: 'sterile_arr', optional: true, skip: 'no checked bags' },
  { id: 'EXIT', flow: 'arrival', servedBy: [], side: 'landside', optional: false, skip: '' },
  { id: 'CURB_OUT', flow: 'arrival', servedBy: [], side: 'landside', optional: false, skip: '' },
]

const BY_ID = new Map(STAGES.map((s) => [s.id, s]))

export function stageDef(id: StageId): StageDef {
  const s = BY_ID.get(id)
  if (!s) throw new Error(`unknown stage ${id}`)
  return s
}

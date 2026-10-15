import { HUB_TIERS, HUB_TIER_LABEL, type HubArchetype, type HubTier } from './config.ts'
import type { HubChecklist } from './checklist.ts'

const FACILITY_IDS = new Set([
  'desk',
  'lane',
  'overnight',
  'lounge',
  'stand',
  'pier',
  'fuel',
  'hangar',
  'ramp',
  'pad',
  'connection',
])

export interface HubShowcase {
  now: string
  next: string
}

/** What is already in place, and the facility lines still open on this offer. */
export function hubShowcase(list: HubChecklist): HubShowcase {
  const facilities = list.lines.filter((line) => FACILITY_IDS.has(line.id))
  const have = facilities.filter((line) => line.status === 'ok').map((line) => line.label)
  const gap = facilities
    .filter((line) => line.status !== 'ok')
    .map((line) => (line.status === 'waiting' ? line.detail : line.label))
  const later = list.nextAsk.join(' · ')
  return {
    now: have.length > 0 ? have.join(' · ') : 'Common use',
    next: gap.length > 0 ? gap.join(' · ') : later || 'Ladder complete',
  }
}

export interface HubProgressRow {
  id: string
  name: string
  type: HubArchetype
  tier: HubTier
  tierLabel: string
  rank: number
  primary: boolean
  met: number
  total: number
  note: string
}

export function hubStatusNote(type: HubArchetype, list: HubChecklist): string {
  if (list.current === 'focus' && type === 'regional' && list.next == null) return 'feeding'
  if (list.current === 'focus' && type === 'charter' && list.next == null) return 'in season'
  if (list.next == null) return 'held'
  if (list.eligible) return 'ready'
  const waiting = list.lines.find((line) => line.status === 'waiting')
  if (waiting?.id === 'desk' || waiting?.id === 'lane') return 'desks'
  const gap = list.lines.find((line) => line.status !== 'ok')
  return gap?.id ?? 'open'
}

/** Primary hub first, then the higher stored tiers. */
export function hubProgressRows(
  views: readonly { id: string; name: string; type: HubArchetype; checklist: HubChecklist }[],
): HubProgressRow[] {
  return views
    .map((view) => ({
      id: view.id,
      name: view.name,
      type: view.type,
      tier: view.checklist.current,
      tierLabel: HUB_TIER_LABEL[view.checklist.current],
      rank: HUB_TIERS.indexOf(view.checklist.current),
      primary: view.checklist.current === 'primary',
      met: view.checklist.met,
      total: view.checklist.total,
      note: hubStatusNote(view.type, view.checklist),
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.rank - a.rank || a.name.localeCompare(b.name))
}

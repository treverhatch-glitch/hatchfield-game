import type { WayfindingKind } from './types'

export interface WayfindingSign {
  kind: WayfindingKind
  title: string
  hint: string
  arrow: 'up' | 'left' | 'right'
  accent: string
}

/** Procedural hall signs. Copy and colours live here, not in the mesh code. */
export const WAYFINDING: Record<WayfindingKind, WayfindingSign> = {
  checkin: { kind: 'checkin', title: 'CHECK-IN', hint: 'DEPARTURES', arrow: 'up', accent: '#f2c14a' },
  security: { kind: 'security', title: 'SECURITY', hint: 'SCREENING', arrow: 'right', accent: '#7ec8e3' },
  gates: { kind: 'gates', title: 'GATES', hint: 'ALL GATES', arrow: 'up', accent: '#8fd3ff' },
  baggage: { kind: 'baggage', title: 'BAGGAGE', hint: 'CLAIM HALL', arrow: 'left', accent: '#e07a5f' },
}

export const WAYFINDING_KINDS = Object.keys(WAYFINDING) as WayfindingKind[]

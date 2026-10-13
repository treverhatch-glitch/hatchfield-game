import type { ActiveDisruption, FocusTarget, StaffPoolId } from './types.ts'

export interface DisruptionAlertCell {
  c: number
  r: number
}

export interface DisruptionAlertFocus {
  view: 'apron' | 'hall'
  cells: DisruptionAlertCell[]
  hall?: string
}

/** Tiles and hall zones the camera can land on. The sim fills this; no Game import. */
export interface DisruptionLocusField {
  stands: DisruptionAlertCell[]
  runways: DisruptionAlertCell[]
  fuel: DisruptionAlertCell[]
  terminal: DisruptionAlertCell[]
  fire: DisruptionAlertCell[]
  hangar: DisruptionAlertCell[]
  tower: DisruptionAlertCell[]
  police: DisruptionAlertCell[]
  guard: DisruptionAlertCell[]
  checkin: DisruptionAlertCell[]
  security: DisruptionAlertCell[]
  hallKey?: string
}

function first(cells: DisruptionAlertCell[], fallback: DisruptionAlertCell[]): DisruptionAlertCell {
  return cells[0] ?? fallback[0] ?? { c: 0, r: 0 }
}

function apron(cells: DisruptionAlertCell[], fallback: DisruptionAlertCell[] = []): DisruptionAlertFocus {
  return { view: 'apron', cells: [first(cells, fallback)] }
}

function hall(
  cells: DisruptionAlertCell[],
  hallKey: string | undefined,
  fallback: DisruptionAlertCell[],
): DisruptionAlertFocus {
  return { view: 'hall', hall: hallKey, cells: [first(cells, fallback)] }
}

function staffCells(pool: StaffPoolId | null, field: DisruptionLocusField): DisruptionAlertCell[] {
  if (pool === 'fire' || pool === 'ambulance') return field.fire
  if (pool === 'maintenance') return field.hangar.length ? field.hangar : field.tower
  if (pool === 'security') {
    if (field.police.length) return field.police
    if (field.guard.length) return field.guard
    return field.tower
  }
  if (pool === 'cleaning') return field.terminal
  return field.tower
}

/**
 * Where "Pan to problem" looks.
 * Gate (stand), runway, hall zone, fuel farm, or the terminal building.
 */
export function disruptionLocus(
  event: Pick<ActiveDisruption, 'focus' | 'kind' | 'effect'>,
  field: DisruptionLocusField,
): DisruptionAlertFocus {
  const focus: FocusTarget = event.focus
  if (focus === 'checkin' || (focus === 'staff' && event.effect.staffPool === 'desk')) {
    return hall(field.checkin, field.hallKey, field.security)
  }
  if (focus === 'security') return hall(field.security, field.hallKey, field.checkin)
  if (focus === 'runway') return apron(field.runways, field.stands)
  if (focus === 'fees') return apron(field.terminal, field.stands)
  if (focus === 'staff') {
    const cells = staffCells(event.effect.staffPool, field)
    return apron(cells, field.terminal.length ? field.terminal : field.stands)
  }
  if (!field.stands.length && field.fuel.length) return apron(field.fuel, field.terminal)
  return apron(field.stands, field.fuel.length ? field.fuel : field.terminal)
}

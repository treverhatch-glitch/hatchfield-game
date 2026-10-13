import type { ActiveDisruption, DisruptionId } from './types.ts'
import type { DisruptionAlertFocus } from './locus.ts'

/**
 * Player-facing disruption cards. One row on the existing alert stack
 * (`src/game/alerts.ts`). Dismiss, ignore, and minimise are that stack's
 * actions. This module only builds the row.
 */
export const DISRUPTION_ALERT_PREFIX = 'disruption:'

export interface DisruptionAlert {
  key: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  at: DisruptionAlertFocus
}

const SEVERITY: Record<DisruptionId, DisruptionAlert['severity']> = {
  'volcanic-ash': 'critical',
  'state-visit': 'warning',
  'software-outage': 'warning',
  'strike-day': 'warning',
  'hub-meltdown': 'critical',
  'health-screening': 'warning',
  'rival-price-war': 'info',
}

export function disruptionAlertKey(id: string): string {
  return `${DISRUPTION_ALERT_PREFIX}${id}`
}

/** One key per live event, so a second raise refreshes the same card. */
export function disruptionToAlert(event: ActiveDisruption, at: DisruptionAlertFocus): DisruptionAlert {
  return {
    key: disruptionAlertKey(event.id),
    severity: SEVERITY[event.kind],
    title: event.title,
    detail: `${event.explanation} Fix: ${event.suggestedFix}`,
    at,
  }
}

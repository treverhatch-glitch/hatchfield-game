import type { Alert } from '../../game/alerts.ts'

export interface AlertMarkTarget {
  id: string
  key: string
  title: string
  view: 'apron' | 'hall'
  cell: { c: number; r: number }
}

/**
 * One pin per visible critical alert, on its first cell.
 * Visible matches the dock: the first `limit` critical and warning rows.
 * Warning and info rows do not mark.
 */
export function criticalAlertMarks(ranked: readonly Alert[], limit: number): AlertMarkTarget[] {
  const shown = ranked.filter((alert) => alert.severity === 'critical' || alert.severity === 'warning').slice(0, limit)
  const marks: AlertMarkTarget[] = []
  for (const alert of shown) {
    if (alert.severity !== 'critical') continue
    const cell = alert.at?.cells[0]
    if (!alert.at || !cell) continue
    marks.push({
      id: alert.id,
      key: alert.key,
      title: alert.title,
      view: alert.at.view,
      cell: { c: cell.c, r: cell.r },
    })
  }
  return marks
}

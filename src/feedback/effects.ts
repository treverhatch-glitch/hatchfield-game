import { FEEDBACK } from './config.ts'
import type { LeverReading, MeasureUnit, MetricReading } from './types.ts'

export interface EffectWatch {
  id: string
  metricId: string
  label: string
  unit: MeasureUnit
  before: number
  due: number
}

export interface EffectToast {
  id: string
  text: string
  until: number
}

export function formatMeasure(value: number, unit: MeasureUnit): string {
  const n = Math.round(value)
  if (unit === 'min') return `${n}m`
  if (unit === 'pct') return `${n}%`
  return `${n}`
}

/** "Security wait 6m to 2m" */
export function formatEffect(label: string, before: number, after: number, unit: MeasureUnit): string {
  return `${label} ${formatMeasure(before, unit)} to ${formatMeasure(after, unit)}`
}

export interface ArmResult {
  watches: EffectWatch[]
  seq: number
}

/**
 * A lever that moved since the last read opens a watch on its metric.
 * `before` is the previous measurement, not the value already on this read.
 */
export function armWatches(
  levers: readonly LeverReading[],
  metrics: readonly MetricReading[],
  previousLevers: ReadonlyMap<string, number>,
  previousMetrics: ReadonlyMap<string, number>,
  now: number,
  seq: number,
  settleSec = FEEDBACK.effectSettleSec,
): ArmResult {
  const byId = new Map(metrics.map((m) => [m.id, m]))
  const watches: EffectWatch[] = []
  let next = seq
  for (const lever of levers) {
    if (!previousLevers.has(lever.id)) continue
    if (previousLevers.get(lever.id) === lever.value) continue
    const metric = byId.get(lever.metricId)
    if (!metric || !previousMetrics.has(metric.id)) continue
    const before = previousMetrics.get(metric.id) ?? metric.value
    watches.push({
      id: `w${next}`,
      metricId: metric.id,
      label: metric.label,
      unit: metric.unit,
      before,
      due: now + settleSec,
    })
    next += 1
  }
  return { watches, seq: next }
}

export function settleWatches(
  watches: readonly EffectWatch[],
  metrics: readonly MetricReading[],
  now: number,
  seq: number,
  lifeSec = FEEDBACK.toastLifeSec,
): { pending: EffectWatch[]; toasts: EffectToast[]; seq: number } {
  const byId = new Map(metrics.map((m) => [m.id, m]))
  const pending: EffectWatch[] = []
  const toasts: EffectToast[] = []
  let next = seq
  for (const watch of watches) {
    if (now < watch.due) {
      pending.push(watch)
      continue
    }
    const metric = byId.get(watch.metricId)
    if (!metric) continue
    const text = formatEffect(watch.label, watch.before, metric.value, watch.unit)
    if (formatMeasure(watch.before, watch.unit) === formatMeasure(metric.value, watch.unit)) continue
    toasts.push({ id: `t${next}`, text, until: now + lifeSec })
    next += 1
  }
  return { pending, toasts, seq: next }
}

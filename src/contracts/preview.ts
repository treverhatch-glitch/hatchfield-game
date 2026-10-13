import { airframeInfo, standFits } from './airframes.ts'
import { autoSchedule, expandContracts, hhmm, withDefaults } from './scheduler.ts'
import { MIN_PER_DAY } from './seasons.ts'
import type { Contract, Infrastructure, SchedulerOptions, Season, SlotInstance } from './types.ts'

export type HourLight = 'green' | 'amber' | 'red'

export interface CapacityPreview {
  /** 24 entries, worst day of the sampled week */
  hours: { hour: number; light: HourLight; runwayUse: number; standUse: number }[]
  /** e.g. "this line exceeds declared stand capacity 07:00–09:00" */
  warnings: string[]
  overCapacitySlots: number
}

/**
 * Contract offer card preview: schedule the first week of the season with the offer added (status forced active)
 * and colour each hour. Amber ≥ 80% use, red > 100% or any over-capacity flag. Signing is never blocked.
 */
export function previewOffer(
  offer: Contract, existing: Contract[], season: Season, infra: Infrastructure, opts?: Partial<SchedulerOptions>,
): CapacityPreview {
  const o = withDefaults(opts)
  const trial: Contract = { ...offer, status: 'active', seasons: offer.seasons.includes(season.id) ? offer.seasons : [...offer.seasons, season.id] }
  const all = [...existing.filter((c) => c.id !== offer.id), trial]
  const week: Season = { ...season, endDay: Math.min(season.endDay, season.startDay + 6) }
  const slots = autoSchedule({ slots: expandContracts(all, week, o), contracts: all, infra, options: o })
  const runwayCap = infra.runways.reduce((a, r) => a + r.movesPerHour, 0)
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, light: 'green' as HourLight, runwayUse: 0, standUse: 0 }))
  const redHours = { stand: new Set<number>(), runway: new Set<number>() }
  for (let day = week.startDay; day <= week.endDay; day++) {
    for (let h = 0; h < 24; h++) {
      const t0 = day * MIN_PER_DAY + h * 60
      const t1 = t0 + 60
      const live = slots.filter((s) => !s.cancelled)
      const moves = live.filter((s) => inHour(s.plannedOnBlock, t0) || inHour(s.plannedOffBlock, t0)).length
        + live.filter((s) => inHour(s.plannedOnBlock, t0) && inHour(s.plannedOffBlock, t0)).length
      const onStand = live.filter((s) => s.plannedOnBlock < t1 && s.plannedOffBlock > t0)
      const runwayUse = runwayCap ? moves / runwayCap : moves ? Infinity : 0
      const standUse = standUtil(onStand, infra, o)
      const e = hours[h]
      e.runwayUse = Math.max(e.runwayUse, runwayUse)
      e.standUse = Math.max(e.standUse, standUse)
      const offerRed = slots.some((s) => s.contractId === offer.id && s.flag === 'over_capacity' && s.plannedOnBlock < t1 && s.plannedOffBlock > t0)
      if (offerRed || standUse > 1) redHours.stand.add(h)
      if (runwayUse > 1) redHours.runway.add(h)
    }
  }
  for (const e of hours) {
    const worst = Math.max(e.runwayUse, e.standUse)
    e.light = redHours.stand.has(e.hour) || redHours.runway.has(e.hour) || worst > 1 ? 'red' : worst >= 0.8 ? 'amber' : 'green'
  }
  const warnings: string[] = []
  for (const r of ranges(redHours.stand)) warnings.push(`this line exceeds declared stand capacity ${hhmm(r[0] * 60)}–${hhmm((r[1] + 1) * 60)}`)
  for (const r of ranges(redHours.runway)) warnings.push(`this line exceeds declared runway capacity ${hhmm(r[0] * 60)}–${hhmm((r[1] + 1) * 60)}`)
  return { hours, warnings, overCapacitySlots: slots.filter((s) => s.contractId === offer.id && s.flag === 'over_capacity').length }
}

function inHour(m: number, t0: number) {
  return m >= t0 && m < t0 + 60
}

/** Max over size classes of (aircraft needing ≥ class) / (stands of ≥ class). */
function standUtil(onStand: SlotInstance[], infra: Infrastructure, o: SchedulerOptions): number {
  let worst = 0
  for (const cls of ['regional', 'narrow', 'wide', 'super'] as const) {
    const need = onStand.filter((s) => standFits(airframeInfo(o.airframes, s.airframeId).sizeClass, cls)).length
    if (!need) continue
    const have = infra.stands.filter((st) => standFits(st.sizeClass, cls)).length
    worst = Math.max(worst, have ? need / have : Infinity)
  }
  return worst
}

function ranges(set: Set<number>): [number, number][] {
  const hs = [...set].sort((a, b) => a - b)
  const out: [number, number][] = []
  for (const h of hs) {
    const last = out[out.length - 1]
    if (last && last[1] === h - 1) last[1] = h
    else out.push([h, h])
  }
  return out
}

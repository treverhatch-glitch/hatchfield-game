/**
 * Live-game seam for src/tier3plus.
 *
 * The connecting hub (PR #70) is not on trunk. When it lands, a missed
 * connection that needs a bed should call `Game.noteMissedConnectionNights`.
 * The airport hotel books those guests at day close. Guests it cannot house
 * stay queued. Until that module exists, nothing fills the queue except the hook.
 */
import { money } from './catalog.ts'
import { inBounds } from './path.ts'
import {
  buildingById,
  dailyPnL,
  demandModifier,
  fuelMultiplier,
  greenDemandSatisfied,
  tickBuildProgress,
} from '../tier3plus/index.ts'
import type { DailyPnL, HotelNight, Tier3PlusId } from '../tier3plus/index.ts'
import type { Tile } from './types.ts'

export interface LatePlacement {
  id: Tier3PlusId
  c: number
  r: number
  elapsedDays: number
}

const TILE_OF: Record<Tier3PlusId, Tile> = {
  airport_hotel: 'late_hotel',
  rail_link: 'late_rail',
  saf_blending: 'saf',
}

export function lateIdForTool(tool: string): Tier3PlusId | null {
  if (tool === 'airport_hotel' || tool === 'rail_link' || tool === 'saf_blending') return tool
  return null
}

export function tileForLate(id: Tier3PlusId): Tile {
  return TILE_OF[id]
}

/** Button face. Cost, upkeep, and bonuses stay in the click-open info lines. */
export function lateStampLabel(id: Tier3PlusId): string {
  return buildingById(id)?.name ?? id
}

export function wholeNights(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

/** Wholesale fuel bill with the open SAF plant's multiplier. No plant returns the base bill. */
export function safFuelCost(
  wholesalePerLoad: number,
  loads: number,
  sites: readonly LatePlacement[],
): number {
  const base = wholesalePerLoad * loads
  if (!Number.isFinite(base) || base <= 0) return 0
  const cost = base * fuelMultiplier(sites)
  if (!Number.isFinite(cost) || cost <= 0) return 0
  return Math.round(cost)
}

export function railDemandScale(sites: readonly LatePlacement[]): number {
  return demandModifier(sites)
}

export function advanceLateDay(
  sites: readonly LatePlacement[],
  night: HotelNight,
  days = 1,
): { sites: LatePlacement[]; pnl: DailyPnL } {
  const step = tickBuildProgress(sites, days)
  const next = sites.map((site, i) => ({
    ...site,
    elapsedDays: step[i]?.elapsedDays ?? site.elapsedDays,
  }))
  return { sites: next, pnl: dailyPnL(next, night) }
}

export function lateCatalogLines(id: Tier3PlusId, fieldLevel: number, placed: number): string[] {
  const spec = buildingById(id)
  if (!spec) return []
  const level = Number.isFinite(fieldLevel) ? Math.floor(fieldLevel) : 0
  const lines = [
    spec.name,
    level >= spec.fieldLevel
      ? `Field Level ${level} — unlocked (needs ${spec.fieldLevel})`
      : `Field Level ${spec.fieldLevel} required — you are ${level}`,
    `${money(spec.cost)} to build`,
    `${money(spec.dailyUpkeep)} upkeep per day`,
  ]
  if (spec.kind === 'hotel') {
    lines.push(`${spec.rooms} rooms`)
    lines.push(`${money(spec.transferNightRate)} transfer night · ${money(spec.crewNightRate)} crew night`)
  } else if (spec.kind === 'rail') {
    lines.push(`+${Math.round(spec.demandBonus * 100)}% demand once open`)
    lines.push(`${spec.buildDays}-day build`)
  } else {
    lines.push(`Fuel cost +${Math.round((spec.fuelCostMultiplier - 1) * 100)}%`)
    lines.push(spec.satisfiesGreen ? 'Meets green airline demand' : 'Does not meet green airline demand')
  }
  lines.push(spec.purpose, spec.catch)
  if (placed > 0) lines.push(`${placed} on the field`)
  return lines
}

export function lateSiteLines(
  sites: readonly LatePlacement[],
  index: number,
  night: HotelNight,
): string[] {
  const site = sites[index]
  if (!site) return []
  const spec = buildingById(site.id)
  if (!spec) return []
  const progress = tickBuildProgress([site], 0)[0]
  const report = dailyPnL(sites, night)
  const line = report.lines[index]
  const lines = [spec.name]
  if (!progress || progress.phase === 'building') {
    const left = progress?.daysLeft ?? spec.buildDays
    lines.push(`${left} ${left === 1 ? 'day' : 'days'} left`)
    lines.push('No upkeep until it opens')
  } else if (line) {
    lines.push(line.note)
    lines.push(`Income ${money(line.income)}`)
    lines.push(`Upkeep ${money(line.upkeep)}`)
    if (spec.kind === 'hotel') {
      lines.push(`${line.occupiedRooms} occupied · ${line.emptyRooms} empty`)
      lines.push(`${line.transferRooms} transfer · ${line.crewRooms} crew`)
    }
  }
  if (spec.kind === 'rail' && progress?.phase === 'open') {
    lines.push(`Demand ×${demandModifier(sites).toFixed(2)}`)
  }
  if (spec.kind === 'saf' && progress?.phase === 'open') {
    lines.push(`Fuel ×${fuelMultiplier(sites).toFixed(2)}`)
    lines.push(greenDemandSatisfied(sites) ? 'Green airline demand met' : 'Green airline demand unmet')
  }
  return lines
}

export function restoreLateSites(saved: unknown, tiles: Tile[][]): LatePlacement[] {
  if (!Array.isArray(saved)) return []
  const out: LatePlacement[] = []
  const seen = new Set<string>()
  for (const row of saved) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Partial<LatePlacement>
    const id = lateIdForTool(String(rec.id ?? ''))
    if (!id) continue
    if (!Number.isFinite(rec.c) || !Number.isFinite(rec.r)) continue
    const c = Math.floor(rec.c!)
    const r = Math.floor(rec.r!)
    if (!inBounds(c, r)) continue
    const key = `${c},${r}`
    if (seen.has(key)) continue
    seen.add(key)
    const elapsed = Number.isFinite(rec.elapsedDays) && (rec.elapsedDays ?? 0) > 0 ? rec.elapsedDays! : 0
    tiles[r]![c] = TILE_OF[id]
    out.push({ id, c, r, elapsedDays: elapsed })
  }
  return out
}

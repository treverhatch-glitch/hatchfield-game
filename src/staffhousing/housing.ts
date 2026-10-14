import { COMMUTE, HOUSING_TIERS, MAP_SIZE, housingTier } from './data.ts'
import { assessCommute, bestTierId } from './commute.ts'
import type {
  BuildQuote,
  BuildRefusal,
  CommuteReport,
  DayRoll,
  HousingBuilding,
  HousingContext,
  HousingTierId,
  PlotRef,
  StaffCounts,
  StaffHousingSave,
  StaffHousingState,
  StaffSeat,
  TransportLinks,
} from './types.ts'

export function emptyHousing(): StaffHousingState {
  return { buildings: [], morale: COMMUTE.moraleStart, shiftLate: false, lastDay: -1 }
}

export function housingSnapshot(state: StaffHousingState): StaffHousingSave {
  return {
    buildings: state.buildings.map((building) => ({
      id: building.id,
      tier: building.tier,
      plotIds: [...building.plotIds],
      anchor: { ...building.anchor },
    })),
    morale: state.morale,
    shiftLate: state.shiftLate,
    lastDay: state.lastDay,
  }
}

export function restoreHousing(raw: unknown): StaffHousingState {
  const base = emptyHousing()
  if (!raw || typeof raw !== 'object') return base
  const row = raw as Partial<StaffHousingSave>
  const buildings: HousingBuilding[] = []
  for (const item of row.buildings ?? []) {
    if (!item || typeof item !== 'object') continue
    const tier = item.tier
    if (tier !== 'dorm' && tier !== 'apartments' && tier !== 'village') continue
    const plotIds = (item.plotIds ?? []).filter((id) => typeof id === 'string' && id.length > 0)
    const anchor = item.anchor
    if (!plotIds.length || !anchor || !Number.isFinite(anchor.c) || !Number.isFinite(anchor.r)) continue
    if (buildings.some((built) => built.tier === tier)) continue
    buildings.push({
      id: typeof item.id === 'string' && item.id ? item.id : `house-${tier}`,
      tier,
      plotIds,
      anchor: { c: anchor.c, r: anchor.r },
    })
  }
  return {
    buildings,
    morale: finite(row.morale, COMMUTE.moraleStart, 0, 1),
    shiftLate: Boolean(row.shiftLate),
    lastDay: Number.isFinite(row.lastDay) ? Math.floor(row.lastDay as number) : -1,
  }
}

export function housingBeds(state: StaffHousingState): number {
  return state.buildings.reduce((sum, building) => sum + housingTier(building.tier).beds, 0)
}

export function housingUpkeep(state: StaffHousingState): number {
  return state.buildings.reduce((sum, building) => sum + housingTier(building.tier).upkeepPerDay, 0)
}

export function claimedPlots(state: StaffHousingState): string[] {
  return state.buildings.flatMap((building) => building.plotIds)
}

export function housingReport(
  state: StaffHousingState,
  links: TransportLinks,
  employed: number,
): CommuteReport {
  return assessCommute({
    links,
    beds: housingBeds(state),
    employed,
    bestTier: bestTierId(state.buildings.map((building) => building.tier)),
  })
}

export function quoteHousing(
  state: StaffHousingState,
  tierId: HousingTierId,
  ctx: HousingContext,
): BuildQuote | BuildRefusal {
  const tier = housingTier(tierId)
  if (state.buildings.some((building) => building.tier === tierId)) {
    return { ok: false, reason: `${tier.name} is already up.` }
  }
  if (tier.requires && !state.buildings.some((building) => building.tier === tier.requires)) {
    const prior = housingTier(tier.requires)
    return { ok: false, reason: `Build ${prior.name.toLowerCase()} first.` }
  }
  if (ctx.fieldLevel < tier.fieldLevel) {
    return { ok: false, reason: `${tier.name} opens at Field Level ${tier.fieldLevel}.` }
  }
  const free = freePlots(state, ctx)
  if (free.length < tier.plots) {
    const need = tier.plots === 1 ? 'a free expansion plot' : `${tier.plots} free expansion plots`
    return { ok: false, reason: `${tier.name} needs ${need}. Buy a parcel first.` }
  }
  const taken = free.slice(0, tier.plots)
  return {
    ok: true,
    tier: tierId,
    name: tier.name,
    cost: tier.cost,
    upkeepPerDay: tier.upkeepPerDay,
    beds: tier.beds,
    plotIds: taken.map((plot) => plot.id),
    anchor: anchorForPlot(taken[0]!, ctx.mapSize || MAP_SIZE),
  }
}

export function commitHousing(state: StaffHousingState, quote: BuildQuote): StaffHousingState {
  if (state.buildings.some((building) => building.tier === quote.tier)) return state
  return {
    ...state,
    buildings: [
      ...state.buildings,
      {
        id: `house-${quote.tier}`,
        tier: quote.tier,
        plotIds: [...quote.plotIds],
        anchor: { ...quote.anchor },
      },
    ],
  }
}

/**
 * Fringe and industrial parcels sit on the map edge so the houses read as off the apron.
 * Index steps keep two parcels from stacking on one cell.
 */
export function anchorForPlot(plot: Pick<PlotRef, 'col' | 'row' | 'zone'>, mapSize = MAP_SIZE): { c: number; r: number } {
  const near = 2
  const far = Math.max(near + 1, mapSize - 3)
  const along = (index: number) => clampCell(near + index * 7, mapSize)
  if (plot.zone === 'industrial' || plot.col === 0) return { c: near, r: along(plot.row) }
  if (plot.zone === 'approach' || plot.row === 0) return { c: along(plot.col), r: near }
  if (plot.col >= 3) return { c: far, r: along(plot.row) }
  return { c: along(plot.col), r: far }
}

export function closeHousingDay(
  state: StaffHousingState,
  links: TransportLinks,
  employed: number,
  day: number,
  counts: StaffCounts,
): { state: StaffHousingState; roll: DayRoll } {
  const upkeep = housingUpkeep(state)
  if (day <= state.lastDay) {
    return {
      state,
      roll: {
        upkeep,
        late: state.shiftLate,
        reputationHit: 0,
        quit: null,
        morale: state.morale,
        news: null,
      },
    }
  }
  const report = housingReport(state, links, employed)
  const morale = clamp(
    state.morale + (report.morale - state.morale) * COMMUTE.moraleLerp,
    COMMUTE.moraleMin,
    1,
  )
  const severe = report.failureChance >= COMMUTE.quitFailureFloor
  const late = employed > 0 && unitHash(`late:${day}:${buildingKey(state)}`) < report.failureChance
  const quitChance = employed > 0 && severe ? (1 - report.retention) * report.commuterShare * COMMUTE.dailyQuit : 0
  const quit =
    quitChance > 0 && unitHash(`quit:${day}:${buildingKey(state)}`) < quitChance
      ? fullestSeat(counts)
      : null
  const next: StaffHousingState = { ...state, morale, shiftLate: late, lastDay: day }
  return {
    state: next,
    roll: {
      upkeep,
      late,
      reputationHit: late && severe ? COMMUTE.lateReputation : 0,
      quit,
      morale,
      news: severe ? dayNews(late, quit, report.modeLabel) : null,
    },
  }
}

export function outputPace(state: StaffHousingState): number {
  if (state.lastDay < 0 || state.buildings.length === 0) return 1
  const pace = 1 + (state.morale - COMMUTE.moraleStart) * COMMUTE.outputPerMorale
  return clamp(pace, COMMUTE.outputMin, COMMUTE.outputMax)
}

/** FNV-1a as a unit interval. Stable across days and saves. */
export function unitHash(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

export function tierOffers(state: StaffHousingState, ctx: HousingContext) {
  return HOUSING_TIERS.map((tier) => {
    const quote = quoteHousing(state, tier.id, ctx)
    return {
      tier: tier.id,
      name: tier.name,
      blurb: tier.blurb,
      built: state.buildings.some((building) => building.tier === tier.id),
      locked: !quote.ok,
      reason: quote.ok ? '' : quote.reason,
      cost: tier.cost,
      upkeep: tier.upkeepPerDay,
      beds: tier.beds,
      plots: tier.plots,
      fieldLevel: tier.fieldLevel,
    }
  })
}

function freePlots(state: StaffHousingState, ctx: HousingContext): PlotRef[] {
  const used = new Set(claimedPlots(state))
  return ctx.owned
    .filter((plot) => plot.id !== ctx.starterId && !used.has(plot.id))
    .slice()
    .sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id))
}

function fullestSeat(counts: StaffCounts): StaffSeat | null {
  const order: StaffSeat[] = ['desk', 'mechanic', 'janitor', 'researcher']
  let best: StaffSeat | null = null
  let n = 0
  for (const seat of order) {
    if (counts[seat] > n) {
      n = counts[seat]
      best = seat
    }
  }
  return best
}

function dayNews(late: boolean, quit: StaffSeat | null, modeLabel: string): string | null {
  if (!late && !quit) return null
  const bits: string[] = []
  if (late) bits.push(`Shift late on the ${modeLabel.toLowerCase()} commute`)
  if (quit) bits.push(`${seatLabel(quit)} left overnight — retention slipped`)
  return `${bits.join('. ')}.`
}

function seatLabel(seat: StaffSeat): string {
  if (seat === 'desk') return 'A desk agent'
  if (seat === 'mechanic') return 'A mechanic'
  if (seat === 'janitor') return 'A janitor'
  return 'A researcher'
}

function buildingKey(state: StaffHousingState): string {
  return state.buildings.map((building) => building.tier).join(',') || 'open'
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function clampCell(n: number, mapSize: number): number {
  return Math.min(mapSize - 3, Math.max(2, Math.round(n)))
}

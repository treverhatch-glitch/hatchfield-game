import { starterPlotId } from '../land/index.ts'
import { plotById } from '../land/plots.ts'
import {
  closeHousingDay,
  commitHousing,
  emptyHousing,
  housingReport,
  housingUpkeep,
  outputPace,
  quoteHousing,
  restoreHousing,
  housingSnapshot,
  housingTier,
  tierOffers,
  walkerPoses,
  readTier3Rail,
  type BuildQuote,
  type BuildRefusal,
  type CommuteReport,
  type DayRoll,
  type HousingBuilding,
  type HousingContext,
  type HousingTierId,
  type PlotRef,
  type StaffCounts,
  type StaffHousingSave,
  type StaffHousingState,
  type TransportLinks,
  type WalkerPose,
} from '../staffhousing/index.ts'
import { LAND_PLOT } from './catalog.ts'
import type { Tile } from './types.ts'

export interface StaffField {
  tiles: Tile[][]
  railLinked: boolean
  fieldLevel: number
  ownedPlots: readonly { id: string }[]
  counts: StaffCounts
  /** Sim seconds. Walkers advance with the field clock. */
  clock: number
  work: { c: number; r: number }
}

export interface StaffOfferRow {
  tier: HousingTierId
  name: string
  blurb: string
  built: boolean
  locked: boolean
  reason: string
  cost: number
  upkeep: number
  beds: number
  plots: number
  fieldLevel: number
}

export interface StaffPanel {
  commuteSummary: string
  housingSummary: string
  crewSummary: string
  commute: {
    modeLabel: string
    minutes: number
    reliabilityPct: number
    lateMinutes: number
    failurePct: number
    roadCells: number
    roadReachesEdge: boolean
    busStops: number
    passengerRail: boolean
    tier3Name: string | null
  }
  housing: {
    beds: number
    housed: number
    upkeep: number
    plotIds: string[]
    offers: StaffOfferRow[]
  }
  crew: {
    moralePct: number
    retentionPct: number
    hireOffPct: number
    employed: number
    commuters: number
    shiftLate: boolean
  }
}

/**
 * Glue between the housing model and the live field.
 * The model stays headless; this reads tiles, plots, and the optional tier-3 station.
 */
export class StaffHousingBridge {
  private state: StaffHousingState = emptyHousing()

  reset(): void {
    this.state = emptyHousing()
  }

  save(): StaffHousingSave {
    return housingSnapshot(this.state)
  }

  load(raw: unknown): void {
    this.state = restoreHousing(raw)
  }

  economyTier(): 0 | 1 | 2 | 3 {
    return housingReport(this.state, this.links(emptyField()), 0).economyTier
  }

  shiftLate(): boolean {
    return this.state.shiftLate
  }

  outputPace(): number {
    return outputPace(this.state)
  }

  sites(): HousingBuilding[] {
    return this.state.buildings.map((building) => ({
      ...building,
      plotIds: [...building.plotIds],
      anchor: { ...building.anchor },
    }))
  }

  walkers(field: StaffField): WalkerPose[] {
    return walkerPoses(this.state.buildings, field.work, field.clock)
  }

  report(field: StaffField): CommuteReport {
    return housingReport(this.state, this.links(field), employed(field.counts))
  }

  hirePrice(base: number, field: StaffField): number {
    const factor = this.report(field).hireCostMultiplier
    return Math.max(0, Math.round(base * factor))
  }

  quote(tier: HousingTierId, field: StaffField): BuildQuote | BuildRefusal {
    return quoteHousing(this.state, tier, this.context(field))
  }

  commit(quote: BuildQuote): void {
    this.state = commitHousing(this.state, quote)
  }

  panel(field: StaffField): StaffPanel {
    const report = this.report(field)
    const link = this.links(field)
    const built = this.state.buildings.map((building) => building.tier)
    return {
      commuteSummary: report.modeLabel,
      housingSummary: built.length
        ? this.state.buildings.map((building) => housingTier(building.tier).name).join(' · ')
        : 'No housing',
      crewSummary: moraleWord(report.morale),
      commute: {
        modeLabel: report.modeLabel,
        minutes: report.minutes,
        reliabilityPct: Math.round(report.reliability * 100),
        lateMinutes: report.lateMinutes,
        failurePct: Math.round(report.failureChance * 100),
        roadCells: link.roadCells,
        roadReachesEdge: link.roadReachesEdge,
        busStops: link.busStops,
        passengerRail: link.passengerRail,
        tier3Name: link.tier3Rail?.present ? link.tier3Rail.name ?? 'Rail station' : null,
      },
      housing: {
        beds: report.beds,
        housed: report.housed,
        upkeep: housingUpkeep(this.state),
        plotIds: this.state.buildings.flatMap((building) => building.plotIds),
        offers: tierOffers(this.state, this.context(field)),
      },
      crew: {
        moralePct: Math.round(report.morale * 100),
        retentionPct: Math.round(report.retention * 100),
        hireOffPct: Math.round((1 - report.hireCostMultiplier) * 100),
        employed: report.employed,
        commuters: report.employed - report.housed,
        shiftLate: this.state.shiftLate,
      },
    }
  }

  closeDay(field: StaffField, day: number): DayRoll {
    const rolled = closeHousingDay(this.state, this.links(field), employed(field.counts), day, field.counts)
    this.state = rolled.state
    return rolled.roll
  }

  links(field: StaffField): TransportLinks {
    const roads = roadLink(field.tiles)
    let busStops = 0
    let railTiles = 0
    for (const row of field.tiles) {
      for (const tile of row) {
        if (tile === 'bus') busStops++
        if (tile === 'rail') railTiles++
      }
    }
    return {
      roadCells: roads.cells,
      roadReachesEdge: roads.reaches,
      busStops,
      passengerRail: field.railLinked && railTiles > 0,
      tier3Rail: readTier3Rail(),
    }
  }

  private context(field: StaffField): HousingContext {
    const owned: PlotRef[] = []
    for (const plot of field.ownedPlots) {
      const spec = plotById(LAND_PLOT, plot.id)
      if (!spec) continue
      owned.push({ id: spec.id, col: spec.col, row: spec.row, zone: spec.zone, distance: spec.distance })
    }
    return {
      fieldLevel: field.fieldLevel,
      owned,
      starterId: starterPlotId(LAND_PLOT),
      mapSize: field.tiles.length || 32,
    }
  }
}

export function roadLink(tiles: Tile[][]): { cells: number; reaches: boolean } {
  const size = tiles.length
  const roads: { c: number; r: number }[] = []
  for (let r = 0; r < size; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'road') roads.push({ c, r })
    }
  }
  if (!roads.length) return { cells: 0, reaches: false }
  const set = new Set(roads.map((cell) => `${cell.c},${cell.r}`))
  const seen = new Set<string>()
  const queue = [...roads]
  while (queue.length) {
    const cell = queue.pop()!
    const key = `${cell.c},${cell.r}`
    if (seen.has(key)) continue
    seen.add(key)
    if (cell.c === 0 || cell.r === 0 || cell.c === size - 1 || cell.r === size - 1) {
      return { cells: roads.length, reaches: true }
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = `${cell.c + dc},${cell.r + dr}`
      if (set.has(next)) queue.push({ c: cell.c + dc, r: cell.r + dr })
    }
  }
  return { cells: roads.length, reaches: false }
}

function employed(counts: StaffCounts): number {
  return Math.max(0, counts.desk + counts.janitor + counts.mechanic + counts.researcher)
}

function moraleWord(morale: number): string {
  if (morale >= 0.85) return 'Settled'
  if (morale >= 0.7) return 'Steady'
  if (morale >= 0.55) return 'Tired'
  return 'Strained'
}

function emptyField(): StaffField {
  return {
    tiles: [],
    railLinked: false,
    fieldLevel: 1,
    ownedPlots: [],
    counts: { desk: 0, janitor: 0, mechanic: 0, researcher: 0 },
    clock: 0,
    work: { c: 16, r: 16 },
  }
}

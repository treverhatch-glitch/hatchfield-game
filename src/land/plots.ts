import type {
  LandPlotConfig,
  OwnedPlot,
  PlotOffer,
  PlotPurchase,
  PlotRefusal,
  PlotSpec,
  PlotZone,
} from './types.ts'

const ZONE_LABEL: Record<PlotZone, string> = {
  core: 'Core',
  apron: 'Apron',
  approach: 'Approach',
  industrial: 'Industrial',
  fringe: 'Fringe',
}

export function starterPlotId(config: LandPlotConfig): string {
  return plotId(config.starterCol, config.starterRow)
}

export function plotId(col: number, row: number): string {
  return `${col},${row}`
}

export function plotGrid(config: LandPlotConfig): PlotSpec[] {
  const plots: PlotSpec[] = []
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      plots.push({
        id: plotId(col, row),
        col,
        row,
        zone: zoneFor(col, row, config),
        distance: Math.max(
          Math.abs(col - config.starterCol),
          Math.abs(row - config.starterRow),
        ),
      })
    }
  }
  return plots
}

export function plotById(config: LandPlotConfig, id: string): PlotSpec | null {
  return plotGrid(config).find((plot) => plot.id === id) ?? null
}

export function plotName(plot: PlotSpec): string {
  return `${ZONE_LABEL[plot.zone]} plot ${plot.col + 1}-${plot.row + 1}`
}

/** Price rises with zone, distance from the starter, and plots already on the books. */
export function plotPrice(plot: PlotSpec, ownedCount: number, config: LandPlotConfig): number {
  const zone = config.zoneMult[plot.zone]
  const distance = 1 + Math.max(0, plot.distance) * config.distancePremium
  const crowd = 1 + Math.max(0, ownedCount - 1) * config.ownedPremium
  return Math.round(Math.max(0, config.basePrice) * zone * distance * crowd)
}

export function starterHolding(config: LandPlotConfig): OwnedPlot {
  const plot = plotById(config, starterPlotId(config))
  if (!plot) return { id: starterPlotId(config), assessed: config.basePrice }
  return { id: plot.id, assessed: plotPrice(plot, 1, config) }
}

export function requiredLevel(plot: PlotSpec, ownedCount: number, config: LandPlotConfig): number {
  const byDistance = Math.min(5, Math.max(1, plot.distance + 1))
  return Math.max(byDistance, capLevel(ownedCount, config))
}

export function nextPlotOffer(
  owned: readonly OwnedPlot[],
  fieldLevel: number,
  config: LandPlotConfig,
): PlotOffer | null {
  const options = adjacentOffers(owned, fieldLevel, config)
  if (!options.length) return null
  return options.find((offer) => !offer.locked) ?? options[0]!
}

export function commitPlot(
  owned: readonly OwnedPlot[],
  id: string,
  fieldLevel: number,
  config: LandPlotConfig,
): PlotPurchase | PlotRefusal {
  const offer = describePlot(owned, id, fieldLevel, config)
  if (!offer) return { ok: false, reason: 'That plot is not on this map.' }
  if (offer.locked) return { ok: false, reason: offer.reason }
  return {
    ok: true,
    id: offer.id,
    name: offer.name,
    price: offer.price,
    owned: [...owned, { id: offer.id, assessed: offer.price }],
  }
}

/**
 * Save migration. Grants `count` plots in cheapest-adjacent order and ignores
 * the field-level gate, because those parcels were already bought.
 */
export function seedOwned(count: number, config: LandPlotConfig): OwnedPlot[] {
  const owned: OwnedPlot[] = [starterHolding(config)]
  const target = Math.max(1, Math.min(Math.floor(count) || 1, config.cols * config.rows))
  while (owned.length < target) {
    const next = cheapestAdjacent(owned, config)
    if (!next) break
    owned.push({ id: next.id, assessed: plotPrice(next, owned.length, config) })
  }
  return owned
}

export function restoreOwned(
  saved: readonly OwnedPlot[] | undefined,
  parcelCount: number,
  config: LandPlotConfig,
): OwnedPlot[] {
  const known = new Map(plotGrid(config).map((plot) => [plot.id, plot]))
  const cleaned: OwnedPlot[] = []
  for (const row of saved ?? []) {
    const plot = known.get(row.id)
    if (!plot || cleaned.some((owned) => owned.id === row.id)) continue
    const assessed =
      Number.isFinite(row.assessed) && row.assessed > 0
        ? Math.round(row.assessed)
        : plotPrice(plot, cleaned.length + 1, config)
    cleaned.push({ id: plot.id, assessed })
  }
  if (!cleaned.some((owned) => owned.id === starterPlotId(config))) {
    return seedOwned(Math.max(1, parcelCount), config)
  }
  return cleaned
}

function describePlot(
  owned: readonly OwnedPlot[],
  id: string,
  fieldLevel: number,
  config: LandPlotConfig,
): PlotOffer | null {
  const plot = plotById(config, id)
  if (!plot) return null
  if (owned.some((row) => row.id === id)) {
    return offer(plot, owned.length, fieldLevel, config, 'Already owned.')
  }
  if (!owned.length) {
    return offer(plot, 0, fieldLevel, config, 'Buy land first.')
  }
  if (!touchesOwned(plot, owned, config)) {
    return offer(plot, owned.length, fieldLevel, config, 'That plot does not touch land you own.')
  }
  const need = requiredLevel(plot, owned.length, config)
  if (fieldLevel < need) {
    return offer(
      plot,
      owned.length,
      fieldLevel,
      config,
      `Parcel locked — reach Field Level ${need} first.`,
    )
  }
  return offer(plot, owned.length, fieldLevel, config, '')
}

function adjacentOffers(
  owned: readonly OwnedPlot[],
  fieldLevel: number,
  config: LandPlotConfig,
): PlotOffer[] {
  if (!owned.length) return []
  return cheapestList(owned, config).map((plot) => {
    const described = describePlot(owned, plot.id, fieldLevel, config)
    return described!
  })
}

function cheapestAdjacent(owned: readonly OwnedPlot[], config: LandPlotConfig): PlotSpec | null {
  return cheapestList(owned, config)[0] ?? null
}

function cheapestList(owned: readonly OwnedPlot[], config: LandPlotConfig): PlotSpec[] {
  const ownedIds = new Set(owned.map((row) => row.id))
  return plotGrid(config)
    .filter((plot) => !ownedIds.has(plot.id) && touchesOwned(plot, owned, config))
    .sort((a, b) => {
      const price = plotPrice(a, owned.length, config) - plotPrice(b, owned.length, config)
      return price || a.id.localeCompare(b.id)
    })
}

function offer(
  plot: PlotSpec,
  ownedCount: number,
  fieldLevel: number,
  config: LandPlotConfig,
  reason: string,
): PlotOffer {
  const needLevel = requiredLevel(plot, Math.max(1, ownedCount), config)
  return {
    id: plot.id,
    name: plotName(plot),
    zone: plot.zone,
    price: plotPrice(plot, Math.max(1, ownedCount), config),
    distance: plot.distance,
    needLevel,
    locked: reason.length > 0 || fieldLevel < needLevel,
    reason: reason || (fieldLevel < needLevel ? `Parcel locked — reach Field Level ${needLevel} first.` : ''),
  }
}

function touchesOwned(plot: PlotSpec, owned: readonly OwnedPlot[], config: LandPlotConfig): boolean {
  const specs = plotGrid(config)
  return owned.some((row) => {
    const other = specs.find((candidate) => candidate.id === row.id)
    if (!other) return false
    return Math.abs(other.col - plot.col) + Math.abs(other.row - plot.row) === 1
  })
}

function capLevel(ownedCount: number, config: LandPlotConfig): number {
  for (let level = 1; level < config.ownedCapByLevel.length; level++) {
    if ((config.ownedCapByLevel[level] ?? 0) > ownedCount) return level
  }
  return config.ownedCapByLevel.length
}

function zoneFor(col: number, row: number, config: LandPlotConfig): PlotZone {
  if (col === config.starterCol && row === config.starterRow) return 'core'
  if (col === 0) return 'industrial'
  if (row === 0) return 'approach'
  if (col === config.cols - 1 || row === config.rows - 1) return 'fringe'
  return 'apron'
}

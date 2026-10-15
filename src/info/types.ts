/** One map overlay at a time. The bar, the legend, and the renderer share these ids. */
export const MAP_VIEWS = ['traffic', 'queues', 'bays', 'airfield', 'power', 'fuel'] as const

export type MapViewId = (typeof MAP_VIEWS)[number]

export const MAP_VIEW_LABEL: Record<MapViewId, string> = {
  traffic: 'Traffic',
  queues: 'Queues',
  bays: 'Bays',
  airfield: 'Airfield',
  power: 'Power',
  fuel: 'Fuel',
}

/** A number on a view. The tooltip names the inputs that produced it. */
export interface InfoScore {
  id: string
  label: string
  value: string
  why: string
}

export interface LegendStop {
  label: string
  color: string
}

/** A cell the info tint recolours. Traffic uses the landside layer instead. */
export interface TintCell {
  id: string
  c: number
  r: number
  color: string
  opacity: number
}

/**
 * Everything a view draws, built from snapshots.
 * `scores` sit on the legend. `details` open on click.
 */
export interface InfoViewModel {
  id: MapViewId
  title: string
  legend: LegendStop[]
  scores: InfoScore[]
  details: InfoScore[]
  /** Lines the sims already produce: curb fixes, the service-point bottleneck. */
  fixes: string[]
  tint: TintCell[]
}

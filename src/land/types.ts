/** Cities: Skylines-style expansion plots. Numbers live in `LAND_PLOT`. */

export type PlotZone = 'core' | 'apron' | 'approach' | 'industrial' | 'fringe'

export interface LandPlotConfig {
  cols: number
  rows: number
  starterCol: number
  starterRow: number
  /**
   * Index by field level. `ownedCapByLevel[2] === 3` means level 2 may own 3 plots.
   * Index 0 is unused.
   */
  ownedCapByLevel: readonly number[]
  /** Sticker price before zone, distance, and how many plots are already owned. */
  basePrice: number
  /** Fractional add per Chebyshev step away from the starter plot. */
  distancePremium: number
  /** Fractional add per plot already owned, after the starter. */
  ownedPremium: number
  zoneMult: Readonly<Record<PlotZone, number>>
  /** Groundskeeping per owned plot, once per game day. */
  dailyUpkeep: number
  /** Share of assessed plot value taken once per game day. */
  propertyTaxRate: number
  /** Share of assessed assets taken once per game day, before incident pressure. */
  insuranceRate: number
  /** Each recorded incident multiplies the insurance bill. */
  insurancePerIncident: number
  insuranceIncidentCap: number
  /** Dollars per power-load unit per game day. */
  utilityPerPower: number
  /** Dollars per water-load unit per game day. */
  utilityPerWater: number
  /** Index by field level. Level 1 can be zero so the first day is not a licence bill. */
  operatingLicence: readonly number[]
  /** Per fire station, once the field is operating. */
  arffLicence: number
  /** Charged when the field handles international / heavy traffic. */
  intlLicence: number
  /** Optional outsourced pavement crew, per game day. */
  maintenanceContract: number
  /** Staffed repair multiplier while the contract is on. */
  contractRepair: number
  /** Runway-condition points per sim-second when the contract stands in for an empty crew. */
  contractRepairRate: number
}

export interface PlotSpec {
  id: string
  col: number
  row: number
  zone: PlotZone
  /** Chebyshev distance from the starter plot. */
  distance: number
}

/** Assessed value is frozen at purchase so later buys do not reprice the tax base. */
export interface OwnedPlot {
  id: string
  assessed: number
}

export interface PlotOffer {
  id: string
  name: string
  zone: PlotZone
  price: number
  distance: number
  needLevel: number
  locked: boolean
  reason: string
}

export interface PlotPurchase {
  ok: true
  owned: OwnedPlot[]
  price: number
  name: string
  id: string
}

export interface PlotRefusal {
  ok: false
  reason: string
}

export type SinkId =
  | 'plot_upkeep'
  | 'property_tax'
  | 'insurance'
  | 'utilities'
  | 'licence_operating'
  | 'licence_arff'
  | 'licence_intl'
  | 'maintenance_contract'
  | 'loan_interest'

export interface SinkLine {
  id: SinkId
  label: string
  amount: number
  /**
   * Loan interest is quoted for the cash-flow picture. The loan clock already
   * posts it, so the day-close must not charge that line again.
   */
  charged: boolean
}

export interface DailySinkInput {
  plots: readonly Pick<OwnedPlot, 'assessed'>[]
  /** Buildings and other non-plot assets. Insurance uses the larger of this and plot value. */
  assetValue: number
  incidents: number
  fieldLevel: number
  operational: boolean
  powerLoad: number
  waterLoad: number
  fireStations: number
  intl: boolean
  maintenanceContract: boolean
  loanBalance: number
  loanRate: number
  loanFloor: number
  /** Seconds between the existing loan-interest ticks. */
  loanEverySeconds: number
  sandbox: boolean
}

export interface DailySinks {
  lines: SinkLine[]
  /** Sum of lines the day-close should post. */
  chargedTotal: number
  /** Charged lines plus the loan-interest quote. */
  quotedTotal: number
}

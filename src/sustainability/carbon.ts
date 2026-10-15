import type { AircraftClass } from './data';
import {
  BUILDING_KG_CO2_PER_DAY,
  CARBON_BUILDING_LABELS,
  CARBON_HISTORY_DAYS,
  GROUND_OPS_KG_PER_DAY_PER_MW,
  KG_CO2_PER_LTO,
  OFFSET_COST_PER_TONNE,
  SAF_CUT_FACTOR,
} from './data';

export type MovementInput =
  | Partial<Record<AircraftClass, number>>
  | { class: AircraftClass; count: number }[]
  | AircraftClass[];

export interface DailyEmissionsParams {
  movements: MovementInput;
  powerMW: number;
  safBlend: number;
  solarMW: number;
  buildings?: readonly BuildingEmissionInput[];
}

export interface DailyEmissionsResult {
  flightKg: number;
  groundKg: number;
  buildingKg: number;
  totalKg: number;
  totalTonnes: number;
}

export interface BuildingEmissionInput {
  /** Stable placement id, normally "type:c,r". */
  id: string;
  type: string;
  label?: string;
}

export interface BuildingEmission {
  id: string;
  type: string;
  label: string;
  kg: number;
}

export interface FlightEmissionInput {
  id: string;
  flightNo: string;
  aircraft: string;
  aircraftClass: AircraftClass;
  safBlend: number;
}

export interface FlightEmission extends FlightEmissionInput {
  kg: number;
}

export interface CarbonDay extends DailyEmissionsResult {
  day: number;
  flights: FlightEmission[];
  buildings: BuildingEmission[];
}

export interface GreenPioneerGoal {
  startedDay: number;
  deadlineDay: number;
  status: 'running' | 'met' | 'missed';
}

export interface CarbonSave {
  days?: CarbonDay[];
  /** Emission total from daily rows older than the retained detail window. */
  archivedTonnes?: number;
  archivedDays?: number;
  currentFlights?: FlightEmission[];
  offsetsTonnes?: number;
  greenPioneer?: GreenPioneerGoal | null;
}

export interface CarbonView {
  daysTracked: number;
  currentFlights: readonly FlightEmission[];
  buildings: readonly BuildingEmission[];
  latestDay: CarbonDay | null;
  totalEmissionsTonnes: number;
  offsetsTonnes: number;
  netTonnes: number;
  outstandingTonnes: number;
  greenPioneer: GreenPioneerGoal | null;
}

export interface NetZeroProgressResult {
  net: number;
  isNetZero: boolean;
  totalEmissions: number;
  offsets: number;
  [Symbol.iterator](): Iterator<number | boolean>;
}

function cleanPrecision(val: number): number {
  return Math.round(val * 1e6) / 1e6;
}

/**
  Calculates daily carbon emissions (kg and tonnes) for flight movements and airside ground ops.
  SAF cuts flight CO2 by safBlend x 0.8.
  Solar power offsets ground ops power demand before applying the ground ops CO2 factor.
 */
export function dailyEmissions(params: DailyEmissionsParams): DailyEmissionsResult {
  const { movements, powerMW, safBlend, solarMW, buildings = [] } = params;

  let rawFlightKg = 0;

  if (Array.isArray(movements)) {
    for (const item of movements) {
      if (typeof item === 'string') {
        const classRate = KG_CO2_PER_LTO[item as AircraftClass] ?? 0;
        rawFlightKg += classRate;
      } else if (item && typeof item === 'object') {
        const classRate = KG_CO2_PER_LTO[item.class] ?? 0;
        rawFlightKg += classRate * (item.count ?? 0);
      }
    }
  } else if (movements && typeof movements === 'object') {
    for (const [cls, count] of Object.entries(movements)) {
      const classRate = KG_CO2_PER_LTO[cls as AircraftClass] ?? 0;
      if (typeof count === 'number') {
        rawFlightKg += classRate * count;
      }
    }
  }

  const rawBlendFrac = safBlend > 1 ? safBlend / 100 : safBlend;
  const blendFrac = Math.min(1, Math.max(0, rawBlendFrac));
  const flightCut = blendFrac * SAF_CUT_FACTOR;
  const flightKg = cleanPrecision(rawFlightKg * (1 - flightCut));

  const netPowerMW = Math.max(0, powerMW - solarMW);
  const groundKg = cleanPrecision(netPowerMW * GROUND_OPS_KG_PER_DAY_PER_MW);
  const buildingKg = cleanPrecision(
    buildingEmissions(buildings).reduce((sum, building) => sum + building.kg, 0),
  );

  const totalKg = cleanPrecision(flightKg + groundKg + buildingKg);
  const totalTonnes = cleanPrecision(totalKg / 1000);

  return {
    flightKg,
    groundKg,
    buildingKg,
    totalKg,
    totalTonnes,
  };
}

export function flightEmission(input: FlightEmissionInput): FlightEmission {
  const result = dailyEmissions({
    movements: [input.aircraftClass],
    powerMW: 0,
    safBlend: input.safBlend,
    solarMW: 0,
  });
  return { ...input, safBlend: clampBlend(input.safBlend), kg: result.flightKg };
}

export function buildingEmissions(buildings: readonly BuildingEmissionInput[]): BuildingEmission[] {
  return buildings.flatMap((building) => {
    const kg = BUILDING_KG_CO2_PER_DAY[building.type];
    if (!(kg > 0)) return [];
    return [{
      id: building.id,
      type: building.type,
      label: building.label ?? CARBON_BUILDING_LABELS[building.type] ?? building.type,
      kg,
    }];
  });
}

function clampBlend(value: number): number {
  const raw = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
}

export type HistoryEntry =
  | number
  | { totalTonnes?: number; totalKg?: number };

/**
  Tracks cumulative net-zero progress given an emissions history and total purchased offsets (in tonnes).
  Returns net CO2 (in tonnes) and whether the airport has achieved net-zero (net <= 0).
  Supports both object destructuring `{ net, isNetZero }` and array destructuring `[net, isNetZero]`.
 */
export function netZeroProgress(
  history: HistoryEntry[],
  offsetsT: number
): NetZeroProgressResult {
  let totalEmissionsTonnes = 0;

  for (const entry of history) {
    if (typeof entry === 'number') {
      totalEmissionsTonnes += entry;
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.totalTonnes === 'number') {
        totalEmissionsTonnes += entry.totalTonnes;
      } else if (typeof entry.totalKg === 'number') {
        totalEmissionsTonnes += entry.totalKg / 1000;
      }
    }
  }

  totalEmissionsTonnes = cleanPrecision(totalEmissionsTonnes);
  const net = cleanPrecision(totalEmissionsTonnes - offsetsT);
  const isNetZero = net <= 0;

  return {
    net,
    isNetZero,
    totalEmissions: totalEmissionsTonnes,
    offsets: offsetsT,
    *[Symbol.iterator]() {
      yield net;
      yield isNetZero;
    },
  };
}

/**
  Calculates dollar cost for buying t tonnes of carbon offsets ($25/t).
 */
export function offsetCost(t: number): number {
  return cleanPrecision(Math.max(0, t) * OFFSET_COST_PER_TONNE);
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function validGoal(value: unknown): GreenPioneerGoal | null {
  if (!value || typeof value !== 'object') return null;
  const goal = value as Partial<GreenPioneerGoal>;
  if (goal.status !== 'running' && goal.status !== 'met' && goal.status !== 'missed') return null;
  if (!Number.isFinite(goal.startedDay) || !Number.isFinite(goal.deadlineDay)) return null;
  return {
    startedDay: Math.max(0, goal.startedDay as number),
    deadlineDay: Math.max(goal.startedDay as number, goal.deadlineDay as number),
    status: goal.status,
  };
}

function validFlight(value: unknown): value is FlightEmission {
  if (!value || typeof value !== 'object') return false;
  const flight = value as Partial<FlightEmission>;
  return (
    typeof flight.id === 'string' &&
    typeof flight.flightNo === 'string' &&
    typeof flight.aircraft === 'string' &&
    typeof flight.aircraftClass === 'string' &&
    flight.aircraftClass in KG_CO2_PER_LTO &&
    typeof flight.kg === 'number' &&
    Number.isFinite(flight.kg) &&
    flight.kg >= 0
  );
}

function validBuilding(value: unknown): value is BuildingEmission {
  if (!value || typeof value !== 'object') return false;
  const building = value as Partial<BuildingEmission>;
  return (
    typeof building.id === 'string' &&
    typeof building.type === 'string' &&
    typeof building.label === 'string' &&
    typeof building.kg === 'number' &&
    Number.isFinite(building.kg) &&
    building.kg >= 0
  );
}

function validDay(value: unknown): value is CarbonDay {
  if (!value || typeof value !== 'object') return false;
  const day = value as Partial<CarbonDay>;
  return (
    typeof day.day === 'number' &&
    Number.isFinite(day.day) &&
    Array.isArray(day.flights) &&
    day.flights.every(validFlight) &&
    Array.isArray(day.buildings) &&
    day.buildings.every(validBuilding) &&
    typeof day.totalTonnes === 'number' &&
    Number.isFinite(day.totalTonnes) &&
    day.totalTonnes >= 0
  );
}

/**
 * Save-safe simulation book. It records a flight once at completed turnaround and
 * snapshots building operations at day close. Rendering reads `view()` only.
 */
export class CarbonBook {
  private days: CarbonDay[] = [];
  private archivedTonnes = 0;
  private archivedDays = 0;
  private currentFlights: FlightEmission[] = [];
  private offsetsTonnes = 0;
  private greenPioneer: GreenPioneerGoal | null = null;

  static restore(saved?: CarbonSave | null): CarbonBook {
    const book = new CarbonBook();
    if (!saved || typeof saved !== 'object') return book;
    const validDays = Array.isArray(saved.days) ? saved.days.filter(validDay) : [];
    const archivedRows = validDays.slice(0, Math.max(0, validDays.length - CARBON_HISTORY_DAYS));
    book.archivedTonnes = cleanPrecision(
      finiteNonNegative(saved.archivedTonnes) +
      archivedRows.reduce((sum, day) => sum + day.totalTonnes, 0),
    );
    book.archivedDays = Math.floor(finiteNonNegative(saved.archivedDays)) + archivedRows.length;
    book.days = validDays
      .slice(-CARBON_HISTORY_DAYS)
      .map((day) => ({
          ...day,
          flights: day.flights.map((flight) => ({ ...flight })),
          buildings: day.buildings.map((building) => ({ ...building })),
        }));
    book.currentFlights = Array.isArray(saved.currentFlights)
      ? saved.currentFlights.filter(validFlight).map((flight) => ({ ...flight }))
      : [];
    book.offsetsTonnes = finiteNonNegative(saved.offsetsTonnes);
    book.greenPioneer = validGoal(saved.greenPioneer);
    return book;
  }

  save(): CarbonSave {
    return {
      days: this.days.map((day) => ({
        ...day,
        flights: day.flights.map((flight) => ({ ...flight })),
        buildings: day.buildings.map((building) => ({ ...building })),
      })),
      archivedTonnes: this.archivedTonnes,
      archivedDays: this.archivedDays,
      currentFlights: this.currentFlights.map((flight) => ({ ...flight })),
      offsetsTonnes: this.offsetsTonnes,
      greenPioneer: this.greenPioneer ? { ...this.greenPioneer } : null,
    };
  }

  recordFlight(input: FlightEmissionInput): FlightEmission {
    const existing = this.currentFlights.find((flight) => flight.id === input.id);
    if (existing) return existing;
    const emission = flightEmission(input);
    this.currentFlights.push(emission);
    return emission;
  }

  closeDay(day: number, buildings: readonly BuildingEmissionInput[]): CarbonDay {
    const buildingRows = buildingEmissions(buildings);
    const flightKg = cleanPrecision(this.currentFlights.reduce((sum, flight) => sum + flight.kg, 0));
    const buildingKg = cleanPrecision(buildingRows.reduce((sum, building) => sum + building.kg, 0));
    const totalKg = cleanPrecision(flightKg + buildingKg);
    const entry: CarbonDay = {
      day,
      flights: this.currentFlights.map((flight) => ({ ...flight })),
      buildings: buildingRows,
      flightKg,
      groundKg: 0,
      buildingKg,
      totalKg,
      totalTonnes: cleanPrecision(totalKg / 1000),
    };
    const old = this.days.findIndex((row) => row.day === day);
    if (old >= 0) this.days[old] = entry;
    else this.days.push(entry);
    if (this.days.length > CARBON_HISTORY_DAYS) {
      const removed = this.days.splice(0, this.days.length - CARBON_HISTORY_DAYS);
      this.archivedTonnes = cleanPrecision(
        this.archivedTonnes + removed.reduce((sum, oldDay) => sum + oldDay.totalTonnes, 0),
      );
      this.archivedDays += removed.length;
    }
    this.currentFlights = [];
    this.scoreGoal(day);
    return entry;
  }

  startGreenPioneer(day: number, windowDays: number): boolean {
    if (this.greenPioneer != null || !(windowDays > 0)) return false;
    this.greenPioneer = {
      startedDay: Math.max(0, Math.floor(day)),
      deadlineDay: Math.max(0, Math.floor(day)) + Math.floor(windowDays),
      status: 'running',
    };
    return true;
  }

  purchaseOffsets(tonnes: number, day: number): number {
    const bought = finiteNonNegative(tonnes);
    this.offsetsTonnes = cleanPrecision(this.offsetsTonnes + bought);
    this.scoreGoal(day);
    return bought;
  }

  view(buildings: readonly BuildingEmissionInput[] = []): CarbonView {
    const total = netZeroProgress([this.archivedTonnes, ...this.days], this.offsetsTonnes);
    return {
      daysTracked: this.archivedDays + this.days.length,
      currentFlights: this.currentFlights.map((flight) => ({ ...flight })),
      buildings: buildingEmissions(buildings),
      latestDay: this.days.length ? this.days[this.days.length - 1] : null,
      totalEmissionsTonnes: total.totalEmissions,
      offsetsTonnes: total.offsets,
      netTonnes: total.net,
      outstandingTonnes: Math.max(0, total.net),
      greenPioneer: this.greenPioneer ? { ...this.greenPioneer } : null,
    };
  }

  private scoreGoal(day: number) {
    if (!this.greenPioneer || this.greenPioneer.status !== 'running') return;
    const progress = netZeroProgress([this.archivedTonnes, ...this.days], this.offsetsTonnes);
    const hasGoalDay = this.days.some((entry) => entry.day >= this.greenPioneer!.startedDay);
    if (hasGoalDay && progress.isNetZero) {
      this.greenPioneer.status = 'met';
    } else if (day >= this.greenPioneer.deadlineDay) {
      this.greenPioneer.status = 'missed';
    }
  }
}

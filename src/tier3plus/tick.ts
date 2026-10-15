import { buildingById } from './catalog.ts'
import { LANDMARK_RATING_CAP_POINTS } from './landmarkConfig.ts'
import type {
  BuildProgress,
  BuildSite,
  DailyPnL,
  HotelBuilding,
  HotelNight,
  LandmarkBuilding,
  PlaceResult,
  PnLLine,
  Tier3PlusBuilding,
  Tier3PlusId,
} from './types.ts'

const EMPTY_NIGHT: HotelNight = { transfers: 0, crew: 0 }

/** Field Level gate. Cash is the caller's job — this only records the site and the sticker price. */
export function placeBuilding(id: Tier3PlusId, fieldLevel: number): PlaceResult {
  const spec = buildingById(id)
  if (!spec) return { ok: false, reason: 'Unknown building.' }
  const level = Number.isFinite(fieldLevel) ? Math.floor(fieldLevel) : 0
  if (level < spec.fieldLevel) {
    return { ok: false, reason: `${spec.name} unlocks at Field Level ${spec.fieldLevel}.` }
  }
  return { ok: true, site: { id: spec.id, elapsedDays: 0 }, cost: spec.cost }
}

export function isOpen(site: BuildSite): boolean {
  const spec = buildingById(site.id)
  if (!spec) return false
  if (spec.buildDays <= 0) return true
  return finiteDays(site.elapsedDays) >= spec.buildDays
}

/**
 * Advance construction by `days` game days.
 * The rail link opens on day 10. Hotel and SAF blending have no timer.
 * Returns new sites; the input array is left alone.
 */
export function tickBuildProgress(sites: readonly BuildSite[], days: number): BuildProgress[] {
  const step = finiteDays(days)
  return sites.flatMap((site) => {
    const spec = buildingById(site.id)
    if (!spec) return []
    return [advance(site, spec, step)]
  })
}

/** Demand multiplier from an open rail link. A second station does not stack. */
export function demandModifier(sites: readonly BuildSite[]): number {
  let bonus = 0
  for (const site of sites) {
    if (!isOpen(site)) continue
    const spec = buildingById(site.id)
    if (spec?.kind !== 'rail') continue
    if (spec.demandBonus > bonus) bonus = spec.demandBonus
  }
  return 1 + (Number.isFinite(bonus) && bonus > 0 ? bonus : 0)
}

/** Passenger demand multiplier from open landmarks. Bonuses add; each landmark counts once. */
export function landmarkDemandModifier(sites: readonly BuildSite[]): number {
  let bonus = 0
  for (const site of openLandmarks(sites)) bonus += site.demandBonus
  return 1 + (Number.isFinite(bonus) && bonus > 0 ? bonus : 0)
}

/** Field-rating points (0..100 scale) the open landmarks add, capped. */
export function landmarkRatingPoints(sites: readonly BuildSite[]): number {
  let points = 0
  for (const site of openLandmarks(sites)) points += site.ratingBonus * 100
  if (!Number.isFinite(points) || points <= 0) return 0
  return Math.min(LANDMARK_RATING_CAP_POINTS, points)
}

function openLandmarks(sites: readonly BuildSite[]): LandmarkBuilding[] {
  const seen = new Set<string>()
  const out: LandmarkBuilding[] = []
  for (const site of sites) {
    if (seen.has(site.id) || !isOpen(site)) continue
    const spec = buildingById(site.id)
    if (spec?.kind !== 'landmark') continue
    seen.add(site.id)
    out.push(spec)
  }
  return out
}

/** Fuel-cost multiplier from an open SAF plant. A second plant does not stack. */
export function fuelMultiplier(sites: readonly BuildSite[]): number {
  let multiplier = 1
  let found = false
  for (const site of sites) {
    if (!isOpen(site)) continue
    const spec = buildingById(site.id)
    if (spec?.kind !== 'saf') continue
    if (!found || spec.fuelCostMultiplier > multiplier) {
      multiplier = spec.fuelCostMultiplier
      found = true
    }
  }
  if (!found || !Number.isFinite(multiplier) || multiplier <= 0) return 1
  return multiplier
}

/** True when an open SAF plant can meet green-airline fuel demand. */
export function greenDemandSatisfied(sites: readonly BuildSite[]): boolean {
  return sites.some((site) => {
    const spec = buildingById(site.id)
    return spec?.kind === 'saf' && spec.satisfiesGreen && isOpen(site)
  })
}

/**
 * Income and upkeep for one game day.
 * Hotel upkeep is the full daily amount whether or not a room sold.
 * Transfer guests take beds first; crew fill what is left. Guests past the
 * room count are not housed and do not pay. Sites still under construction
 * post nothing.
 */
export function dailyPnL(sites: readonly BuildSite[], night: HotelNight = EMPTY_NIGHT): DailyPnL {
  let transfers = wholeGuests(night.transfers)
  let crew = wholeGuests(night.crew)
  const lines: PnLLine[] = []

  for (const site of sites) {
    const spec = buildingById(site.id)
    if (!spec) continue
    if (!isOpen(site)) {
      lines.push(closedLine(site, spec))
      continue
    }
    if (spec.kind === 'hotel') {
      const booked = bookHotel(spec, transfers, crew)
      transfers = booked.transfersLeft
      crew = booked.crewLeft
      lines.push(booked.line)
      continue
    }
    if (spec.kind === 'landmark') {
      const door = dollars(spec.visitorsPerDay * spec.ticketUsd)
      lines.push(openLine(spec, door, spec.dailyUpkeep, 0, 0, 0, 0, openNote(spec)))
      continue
    }
    lines.push(openLine(spec, 0, spec.dailyUpkeep, 0, 0, 0, 0, openNote(spec)))
  }

  const income = lines.reduce((sum, line) => sum + line.income, 0)
  const upkeep = lines.reduce((sum, line) => sum + line.upkeep, 0)
  return { lines, income, upkeep, net: income - upkeep }
}

function advance(site: BuildSite, spec: Tier3PlusBuilding, step: number): BuildProgress {
  if (spec.buildDays <= 0) {
    return { id: spec.id, elapsedDays: 0, phase: 'open', progress: 1, daysLeft: 0 }
  }
  const elapsed = Math.min(spec.buildDays, finiteDays(site.elapsedDays) + step)
  const daysLeft = spec.buildDays - elapsed
  return {
    id: spec.id,
    elapsedDays: elapsed,
    phase: daysLeft <= 0 ? 'open' : 'building',
    progress: elapsed / spec.buildDays,
    daysLeft,
  }
}

function bookHotel(spec: HotelBuilding, transfers: number, crew: number) {
  const transferRooms = Math.min(spec.rooms, transfers)
  const crewRooms = Math.min(Math.max(0, spec.rooms - transferRooms), crew)
  const occupiedRooms = transferRooms + crewRooms
  const emptyRooms = spec.rooms - occupiedRooms
  const income = dollars(transferRooms * spec.transferNightRate + crewRooms * spec.crewNightRate)
  const upkeep = dollars(spec.dailyUpkeep)
  const note =
    emptyRooms === spec.rooms
      ? 'Empty rooms still cost'
      : emptyRooms > 0
        ? `${occupiedRooms} occupied, ${emptyRooms} empty — upkeep unchanged`
        : `${occupiedRooms} occupied`
  return {
    transfersLeft: transfers - transferRooms,
    crewLeft: crew - crewRooms,
    line: openLine(spec, income, upkeep, occupiedRooms, emptyRooms, transferRooms, crewRooms, note),
  }
}

function closedLine(site: BuildSite, spec: Tier3PlusBuilding): PnLLine {
  const daysLeft = Math.max(0, spec.buildDays - finiteDays(site.elapsedDays))
  const noun = daysLeft === 1 ? 'day' : 'days'
  return openLine(spec, 0, 0, 0, 0, 0, 0, `Under construction — ${daysLeft} ${noun} left`, false)
}

function openLine(
  spec: Tier3PlusBuilding,
  income: number,
  upkeep: number,
  occupiedRooms: number,
  emptyRooms: number,
  transferRooms: number,
  crewRooms: number,
  note: string,
  open = true,
): PnLLine {
  return {
    id: spec.id,
    name: spec.name,
    open,
    income,
    upkeep,
    net: income - upkeep,
    occupiedRooms,
    emptyRooms,
    transferRooms,
    crewRooms,
    note,
  }
}

function openNote(spec: Tier3PlusBuilding): string {
  if (spec.kind === 'landmark') {
    return spec.ticketUsd > 0
      ? `${spec.visitorsPerDay} visitors a day at ${dollars(spec.ticketUsd)} dollars each`
      : `${spec.visitorsPerDay} visitors a day, no ticket`
  }
  if (spec.kind === 'rail') return `+${Math.round(spec.demandBonus * 100)}% demand`
  if (spec.kind === 'saf') {
    const premium = Math.round((spec.fuelCostMultiplier - 1) * 100)
    return `Green airline demand met — fuel cost +${premium}%`
  }
  return spec.purpose
}

function finiteDays(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function wholeGuests(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function dollars(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

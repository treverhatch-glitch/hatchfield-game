/**
 * Airport save schema.
 *
 * The envelope `version` is the schema version. Each step upgrades N → N+1:
 *   1  cash was `money`, the name was flat, tiles could be `{ w, h, fill }`
 *   2  `cash` plus `airport: { name, code }`, tiles expanded to a grid
 *   3  flat `airportName` / `code`, map, parcels, budgets, fuel pillar, plots
 *   4  current sim snapshot: fee index, deposit tier, speed, runway condition
 *
 * A game save is written at SAVE_SCHEMA_VERSION. Older envelopes walk this chain.
 * Rendering never sees this module.
 */
import type { Migration, SaveIssue } from './save.ts'

export const SAVE_SCHEMA_VERSION = 4

const MAPS = new Set<string | number>(['temperate', 'tropical', 'desert'])
const SPEEDS = new Set<string | number>([0, 1, 3, 5])
const DIFFICULTIES = new Set<string | number>(['easy', 'standard'])
const SITES = new Set<string>(['city', 'factory'])
const WEATHERS = new Set<string | number>(['clear', 'rain', 'fog', 'storm'])
const DEPOSIT_TIERS = new Set<string | number>(['big', 'standard', 'small', 'none'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(data: unknown): Record<string, unknown> {
  return isRecord(data) ? { ...data } : {}
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** v1 stored a filled rectangle instead of a grid. Already-expanded grids pass through. */
function expandTiles(tiles: unknown): unknown {
  if (Array.isArray(tiles)) return tiles
  if (!isRecord(tiles)) return tiles
  const w = tiles.w
  const h = tiles.h
  const fill = typeof tiles.fill === 'string' && tiles.fill.length > 0 ? tiles.fill : 'grass'
  if (!Number.isInteger(w) || !Number.isInteger(h) || (w as number) <= 0 || (h as number) <= 0) return tiles
  if ((w as number) > 64 || (h as number) > 64) return tiles
  return Array.from({ length: h as number }, () => Array.from({ length: w as number }, () => fill))
}

function defaultPillar(): Record<string, unknown> {
  return {
    contractId: null,
    tankTier: 1,
    litres: 0,
    supply: 'road',
    roadMinutes: 0,
    fleet: {},
    bagSystem: 'carts',
    desks: 2,
    kiosks: 0,
    bagDrops: 0,
    scannerLanes: 1,
    eGates: 0,
  }
}

/** 1 → 2. Rename money, nest the airport name, expand compact tiles. */
export function migrateV1ToV2(data: unknown): unknown {
  const o = asRecord(data)
  const fromMoney = finiteNumber(o.money)
  const fromCash = finiteNumber(o.cash)
  const name = typeof o.name === 'string' && o.name.trim() ? o.name : 'Hatchfield'
  const next: Record<string, unknown> = {
    ...o,
    cash: fromCash ?? fromMoney ?? 0,
    tiles: expandTiles(o.tiles),
    airport: { name, code: 'HTF' },
  }
  if (typeof next.reputation !== 'number' || !Number.isFinite(next.reputation)) next.reputation = 40
  delete next.money
  delete next.name
  return next
}

/** 2 → 3. Flatten the airport block and fill the map / pillar fields older games omitted. */
export function migrateV2ToV3(data: unknown): unknown {
  const o = asRecord(data)
  const airport = isRecord(o.airport) ? o.airport : {}
  const airportName = typeof airport.name === 'string' ? airport.name : typeof o.airportName === 'string' ? o.airportName : 'Hatchfield'
  const code = typeof airport.code === 'string' ? airport.code : typeof o.code === 'string' ? o.code : 'HTF'
  const next: Record<string, unknown> = { ...o, airportName, code }
  delete next.airport
  if (next.mapId == null) next.mapId = 'temperate'
  if (next.mapChallenges == null) next.mapChallenges = {}
  if (typeof next.parcels !== 'number') next.parcels = 1
  if (next.budgets == null) next.budgets = {}
  if (!Array.isArray(next.ownedPlots)) next.ownedPlots = []
  if (!isRecord(next.pillar)) next.pillar = defaultPillar()
  return next
}

/** 3 → 4. Fee index, deposit tier, clock speed, and runway condition. */
export function migrateV3ToV4(data: unknown): unknown {
  const o = asRecord(data)
  const next: Record<string, unknown> = { ...o }
  if (next.publishedFeeIndex == null) next.publishedFeeIndex = 1
  if (next.depositTier == null) next.depositTier = 'standard'
  if (next.speed == null) next.speed = 0
  if (next.runwayCondition == null) next.runwayCondition = 100
  return next
}

/** `migrations[v]` upgrades a save from schema v to v+1. Keys cover 1 .. SAVE_SCHEMA_VERSION-1. */
export const SAVE_MIGRATIONS: Record<number, Migration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
}

export function migrationSources(): number[] {
  return Object.keys(SAVE_MIGRATIONS)
    .map(Number)
    .sort((a, b) => a - b)
}

function repair(issues: SaveIssue[], path: string, message: string, kind: SaveIssue['kind'] = 'repaired') {
  issues.push({ path, kind, message })
}

function repairCash(next: Record<string, unknown>, issues: SaveIssue[]) {
  const present = Object.hasOwn(next, 'cash')
  const n = finiteNumber(next.cash)
  if (!present || n === null) {
    next.cash = 0
    repair(issues, 'cash', 'cash was missing or not a finite number; repaired to 0')
    return
  }
  if (n !== next.cash) {
    next.cash = n
    repair(issues, 'cash', `cash repaired to ${n}`)
  }
}

function repairMin(next: Record<string, unknown>, issues: SaveIssue[], key: string, min: number, fallback: number) {
  if (!Object.hasOwn(next, key)) return
  const n = finiteNumber(next[key])
  if (n === null || n < min) {
    next[key] = fallback
    repair(issues, key, `${key} repaired to ${fallback}`)
    return
  }
  if (n !== next[key]) {
    next[key] = n
    repair(issues, key, `${key} repaired to ${n}`)
  }
}

function repairClamp(next: Record<string, unknown>, issues: SaveIssue[], key: string, min: number, max: number, fallback: number) {
  if (!Object.hasOwn(next, key)) return
  const n = finiteNumber(next[key])
  if (n === null) {
    next[key] = fallback
    repair(issues, key, `${key} repaired to ${fallback}`)
    return
  }
  const clamped = Math.min(max, Math.max(min, n))
  if (clamped !== next[key]) {
    next[key] = clamped
    repair(issues, key, `${key} repaired to ${clamped}`)
  }
}

function repairCount(next: Record<string, unknown>, issues: SaveIssue[], key: string) {
  if (!Object.hasOwn(next, key)) return
  const n = finiteNumber(next[key])
  const value = n === null || n < 0 ? 0 : Math.floor(n)
  if (value !== next[key]) {
    next[key] = value
    repair(issues, key, `${key} repaired to ${value}`)
  }
}

function repairEnum(next: Record<string, unknown>, issues: SaveIssue[], key: string, allowed: Set<string | number>, fallback: string | number) {
  if (!Object.hasOwn(next, key) || next[key] == null) return
  const value = next[key]
  if (typeof value === 'string' || typeof value === 'number') {
    if (allowed.has(value)) return
  }
  next[key] = fallback
  repair(issues, key, `${key} repaired to ${JSON.stringify(fallback)}`)
}

function checkTiles(next: Record<string, unknown>, issues: SaveIssue[]) {
  const tiles = next.tiles
  if (!Array.isArray(tiles) || tiles.length === 0 || !Array.isArray(tiles[0]) || tiles[0].length === 0) {
    repair(issues, 'tiles', 'tiles are missing or empty', 'flagged')
    return
  }
  const width = tiles[0].length
  const broken: { r: number; c: number }[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!Array.isArray(row) || row.length !== width) {
      repair(issues, 'tiles', 'tile grid is not rectangular', 'flagged')
      return
    }
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (typeof cell !== 'string' || cell.length === 0) broken.push({ r, c })
    }
  }
  if (!broken.length) return
  const grid = tiles.map((row) => (row as unknown[]).slice())
  for (const cell of broken) {
    const row = grid[cell.r]
    if (row) row[cell.c] = 'grass'
  }
  next.tiles = grid
  const noun = broken.length === 1 ? 'cell was not a name' : 'cells were not names'
  repair(issues, 'tiles', `${broken.length} tile ${noun}; repaired to grass`)
}

/**
 * Repairs values the sim can safely substitute and flags fields it must not guess.
 * A flagged issue means the save should not be applied.
 */
export function validateAirportSave(data: unknown): { data: unknown; issues: SaveIssue[] } {
  if (!isRecord(data)) {
    return { data: {}, issues: [{ path: '', kind: 'flagged', message: 'save data is not an object' }] }
  }
  const next: Record<string, unknown> = { ...data }
  const issues: SaveIssue[] = []
  repairCash(next, issues)
  repairMin(next, issues, 'clock', 0, 0)
  repairClamp(next, issues, 'reputation', 0, 100, 40)
  repairEnum(next, issues, 'mapId', MAPS, 'temperate')
  repairEnum(next, issues, 'speed', SPEEDS, 0)
  repairEnum(next, issues, 'difficulty', DIFFICULTIES, 'standard')
  repairEnum(next, issues, 'weather', WEATHERS, 'clear')
  repairEnum(next, issues, 'depositTier', DEPOSIT_TIERS, 'standard')
  if (Object.hasOwn(next, 'site') && next.site != null && (typeof next.site !== 'string' || !SITES.has(next.site))) {
    repair(issues, 'site', `site ${JSON.stringify(next.site)} is not a known field`, 'flagged')
  }
  repairMin(next, issues, 'parcels', 1, 1)
  repairClamp(next, issues, 'runwayCondition', 0, 100, 100)
  repairMin(next, issues, 'publishedFeeIndex', 0, 1)
  for (const key of ['janitors', 'mechanics', 'deskStaff', 'researchers']) repairCount(next, issues, key)
  if (Object.hasOwn(next, 'terminalFits') && !Array.isArray(next.terminalFits)) {
    next.terminalFits = []
    repair(issues, 'terminalFits', 'terminalFits was not a list; repaired to empty')
  }
  checkTiles(next, issues)
  return { data: next, issues }
}

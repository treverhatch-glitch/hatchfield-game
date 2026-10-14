/**
 * Older save files live in ./fixtures as real envelopes (checksum and all).
 * Loading them walks the schema chain, then the validator.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game } from '../../game/sim.ts'
import { SAVE_KEY } from '../../game/types.ts'
import { SAVE_FORMAT } from './save.ts'
import {
  SAVE_MIGRATIONS,
  SAVE_SCHEMA_VERSION,
  migrationSources,
  validateAirportSave,
} from './schema.ts'
import { openSave, readStoredSave, serialize, storedData, type SaveIssue } from './save.ts'

const dir = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(dir, 'fixtures', name), 'utf8')

function issuePaths(issues: SaveIssue[], kind?: SaveIssue['kind']): string[] {
  return issues.filter((issue) => !kind || issue.kind === kind).map((issue) => issue.path).sort()
}

describe('save schema chain', () => {
  it('has one step from every older version up to the current schema', () => {
    const sources = migrationSources()
    expect(sources).toEqual(Array.from({ length: SAVE_SCHEMA_VERSION - 1 }, (_, i) => i + 1))
    expect(SAVE_SCHEMA_VERSION).toBe(4)
  })

  it('loads a v1 fixture through every migration', () => {
    const text = fixture('save-v1.json')
    const raw = JSON.parse(text) as { version: number; data: { money: number; name: string } }
    expect(raw.version).toBe(1)
    expect(raw.data.money).toBe(250000)
    expect(raw.data.name).toBe('Old Field')

    const v2 = SAVE_MIGRATIONS[1]!(raw.data) as { cash: number; airport: { name: string; code: string }; money?: unknown; tiles: string[][] }
    expect(v2.cash).toBe(250000)
    expect(v2.airport).toEqual({ name: 'Old Field', code: 'HTF' })
    expect(v2.money).toBeUndefined()
    expect(v2.tiles).toHaveLength(32)
    expect(v2.tiles[0]).toHaveLength(32)

    const v3 = SAVE_MIGRATIONS[2]!(v2) as { airport?: unknown; airportName: string; mapId: string; pillar: { bagSystem: string } }
    expect(v3.airport).toBeUndefined()
    expect(v3.airportName).toBe('Old Field')
    expect(v3.mapId).toBe('temperate')
    expect(v3.pillar.bagSystem).toBe('carts')

    const v4 = SAVE_MIGRATIONS[3]!(v3) as { publishedFeeIndex: number; speed: number; runwayCondition: number; depositTier: string }
    expect(v4).toMatchObject({ publishedFeeIndex: 1, speed: 0, runwayCondition: 100, depositTier: 'standard' })

    const opened = openSave<Record<string, unknown>>(text, SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(opened.envelope.version).toBe(SAVE_SCHEMA_VERSION)
    expect(opened.issues).toEqual([])
    expect(opened.envelope.data).toMatchObject({
      cash: 250000,
      airportName: 'Old Field',
      code: 'HTF',
      mapId: 'temperate',
      site: 'city',
      clock: 120,
    })
  })

  it('loads a v2 fixture and keeps the nested airport name', () => {
    const opened = openSave<Record<string, unknown>>(fixture('save-v2.json'), SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(JSON.parse(fixture('save-v2.json')).version).toBe(2)
    expect(opened.issues).toEqual([])
    expect(opened.envelope.data).toMatchObject({
      cash: 42000,
      airportName: 'Pier Two',
      code: 'PR2',
      mapId: 'temperate',
      site: 'factory',
      publishedFeeIndex: 1,
    })
    expect(opened.envelope.data.airport).toBeUndefined()
    const tiles = opened.envelope.data.tiles as string[][]
    expect(tiles).toEqual([
      ['grass', 'runway'],
      ['taxi', 'stand'],
    ])
  })

  it('loads a v3 fixture without overwriting fields that version already had', () => {
    const opened = openSave<Record<string, unknown>>(fixture('save-v3.json'), SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(JSON.parse(fixture('save-v3.json')).version).toBe(3)
    expect(opened.issues).toEqual([])
    expect(opened.envelope.data).toMatchObject({
      cash: 42000,
      airportName: 'Pier Two',
      code: 'PR2',
      mapId: 'desert',
      parcels: 2,
      speed: 0,
      runwayCondition: 100,
    })
    expect(opened.envelope.data.pillar).toMatchObject({ tankTier: 2, bagSystem: 'sorter', supply: 'rail' })
    expect(opened.envelope.data.mapChallenges).toEqual({ heat: 1 })
  })

  it('repairs corrupt fields and flags ones it cannot guess', () => {
    const opened = openSave<Record<string, unknown>>(fixture('save-v4-corrupt.json'), SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(JSON.parse(fixture('save-v4-corrupt.json')).format).toBe(SAVE_FORMAT)
    expect(opened.envelope.data).toMatchObject({
      cash: 12.5,
      clock: 0,
      reputation: 100,
      mapId: 'temperate',
      speed: 0,
      difficulty: 'standard',
      parcels: 1,
      runwayCondition: 100,
      janitors: 0,
      weather: 'clear',
      publishedFeeIndex: 1,
      depositTier: 'standard',
      terminalFits: [],
    })
    expect(issuePaths(opened.issues, 'repaired')).toEqual([
      'cash',
      'clock',
      'depositTier',
      'difficulty',
      'janitors',
      'mapId',
      'parcels',
      'publishedFeeIndex',
      'reputation',
      'runwayCondition',
      'speed',
      'terminalFits',
      'weather',
    ])
    expect(issuePaths(opened.issues, 'flagged')).toEqual(['site', 'tiles'])
  })

  it('repairs a tile cell that is not a name and flags a jagged grid', () => {
    const torn = serialize(
      {
        version: SAVE_SCHEMA_VERSION,
        snapshot: () => ({ cash: 1, tiles: [['grass', 2], ['taxi', 'stand']] }),
        restore() {},
      },
      0,
    )
    const opened = openSave<{ tiles: unknown }>(torn, SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(opened.envelope.data.tiles).toEqual([
      ['grass', 'grass'],
      ['taxi', 'stand'],
    ])
    expect(opened.issues).toEqual([
      { path: 'tiles', kind: 'repaired', message: '1 tile cell was not a name; repaired to grass' },
    ])

    const jagged = serialize(
      {
        version: SAVE_SCHEMA_VERSION,
        snapshot: () => ({ cash: 1, tiles: [['grass', 'grass'], ['taxi']] }),
        restore() {},
      },
      0,
    )
    const flagged = openSave(jagged, SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(flagged.issues).toEqual([{ path: 'tiles', kind: 'flagged', message: 'tile grid is not rectangular' }])
  })
})

describe('game saves use the schema', () => {
  it('stamps the current schema version and reloads a clean field', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    expect(game.buyLand('city')).toBe(true)
    game.persist()
    const raw = localStorage.getItem(SAVE_KEY)!
    const env = JSON.parse(raw) as { format: string; version: number }
    expect(env.format).toBe(SAVE_FORMAT)
    expect(env.version).toBe(SAVE_SCHEMA_VERSION)

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.site).toBe('city')
    expect(loaded.lastSaveIssues).toEqual([])
  })

  it('still loads an unversioned snapshot from before envelopes', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    expect(game.buyLand('city')).toBe(true)
    game.persist()
    const flat = storedData(localStorage.getItem(SAVE_KEY)!)
    localStorage.setItem(SAVE_KEY, JSON.stringify(flat))
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.site).toBe('city')
    expect(loaded.lastSaveIssues).toEqual([])
  })

  it('loads the v1 fixture into a live field', () => {
    localStorage.setItem(SAVE_KEY, fixture('save-v1.json'))
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.cash).toBe(250000)
    expect(loaded.site).toBe('city')
    expect(loaded.mapId).toBe('temperate')
    expect(loaded.difficulty).toBe('easy')
    expect(loaded.clock).toBe(120)
    expect(loaded.lastSaveIssues).toEqual([])
    expect(loaded.tiles).toHaveLength(32)
    expect(loaded.tiles[0]).toHaveLength(32)
  })

  it('repairs a damaged current save and refuses one with a flagged field', () => {
    const migrated = openSave<Record<string, unknown>>(fixture('save-v1.json'), SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    const damaged = { ...migrated.envelope.data, cash: '180000', reputation: 250 }
    localStorage.setItem(
      SAVE_KEY,
      serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => damaged, restore() {} }, 50),
    )
    const repaired = new Game()
    expect(repaired.load()).toBe(true)
    expect(repaired.cash).toBe(180000)
    expect(repaired.reputation).toBe(100)
    expect(issuePaths(repaired.lastSaveIssues)).toEqual(['cash', 'reputation'])

    localStorage.setItem(SAVE_KEY, fixture('save-v4-corrupt.json'))
    const refused = new Game()
    expect(refused.load()).toBe(false)
    expect(refused.site).toBeNull()
    expect(issuePaths(refused.lastSaveIssues, 'flagged')).toEqual(['site', 'tiles'])
  })

  it('readStoredSave validates a raw snapshot without treating it as v1', () => {
    const text = JSON.stringify({ cash: 10, site: 'city', tiles: [['grass']], mapId: 'tropical' })
    const opened = readStoredSave<Record<string, unknown>>(text, SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
    expect(opened.envelope.version).toBe(SAVE_SCHEMA_VERSION)
    expect(opened.issues).toEqual([])
    expect(opened.envelope.data.cash).toBe(10)
    expect(opened.envelope.data.airportName).toBeUndefined()
    expect(opened.envelope.data.mapId).toBe('tropical')
  })
})

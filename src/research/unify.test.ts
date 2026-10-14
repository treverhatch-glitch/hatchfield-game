import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '../game/catalog.ts'
import type { ResearchId } from '../game/types.ts'
import { migrateV4ToV5 } from '../features/save/schema.ts'
import { MRO_RESEARCH_ID, NIGHT_HUB_RESEARCH_ID } from '../tier3/config.ts'
import { TECH_NODES } from '../wave3/research.ts'
import { CONSUMED_MOD_FIELDS, NODE_MODS, researchMods } from './effects.ts'
import { BUILD_LINKS } from './links.ts'
import {
  DESK_TO_NODE,
  WAVE3_TO_NODE,
  foldResearch,
  treeCatalogCost,
  wave3CatalogCost,
} from './legacy.ts'
import { RESEARCH_NODES } from './nodes.ts'

const deskIds = Object.keys(DESK_TO_NODE) as ResearchId[]
const buildNodes = new Set(Object.values(BUILD_LINKS))
const deskNodes = new Set(Object.values(DESK_TO_NODE))

function gatesFor(tool: string): Set<string> {
  const gates = new Set<string>()
  const link = BUILD_LINKS[tool]
  if (link) gates.add(link)
  const def = BUILDINGS.find((row) => row.tool === tool)
  if (def?.research) {
    const node = DESK_TO_NODE[def.research]
    if (node) gates.add(node)
  }
  if (tool === 'mro') gates.add(DESK_TO_NODE[MRO_RESEARCH_ID])
  if (tool === 'nighthub') gates.add(DESK_TO_NODE[NIGHT_HUB_RESEARCH_ID])
  if (tool === 'deice') gates.add(DESK_TO_NODE.deice)
  return gates
}

describe('one research tree', () => {
  it('maps every desk project and every Wave 3 node onto a real tree node', () => {
    const ids = new Set(RESEARCH_NODES.map((node) => node.id))
    expect(deskIds.length).toBe(new Set(deskIds).size)
    for (const id of deskIds) expect(ids.has(DESK_TO_NODE[id])).toBe(true)
    expect(TECH_NODES.length).toBeGreaterThan(0)
    for (const node of TECH_NODES) {
      expect(WAVE3_TO_NODE[node.id]).toBeTruthy()
      expect(ids.has(WAVE3_TO_NODE[node.id]!)).toBe(true)
    }
    expect(Object.keys(WAVE3_TO_NODE)).toHaveLength(TECH_NODES.length)
  })

  it('gives every tree node a build, a desk project, or a sim modifier', () => {
    const consumed = new Set<string>([...buildNodes, ...deskNodes, ...Object.keys(NODE_MODS)])
    const orphans = RESEARCH_NODES.filter((node) => !consumed.has(node.id)).map((node) => node.id)
    expect(orphans).toEqual([])
    for (const id of Object.keys(NODE_MODS)) {
      expect(RESEARCH_NODES.some((node) => node.id === id)).toBe(true)
    }
    const usedFields = new Set(Object.values(NODE_MODS))
    for (const field of CONSUMED_MOD_FIELDS) expect(usedFields.has(field)).toBe(true)
    const sample = researchMods(['airfield-1', 'spec-cargo-1'])
    expect(sample.turn).toBeLessThan(1)
    expect(sample.cargo).toBeGreaterThan(0)
    expect(sample.security).toBe(1)
  })

  it('gives each build at most one research node', () => {
    for (const def of BUILDINGS) {
      expect(def.research).toBeUndefined()
      const gates = gatesFor(def.tool)
      expect(gates.size).toBeLessThanOrEqual(1)
    }
    expect(DESK_TO_NODE[MRO_RESEARCH_ID]).toBe(BUILD_LINKS.mro)
    expect(DESK_TO_NODE[NIGHT_HUB_RESEARCH_ID]).toBe(BUILD_LINKS.nighthub)
    expect(DESK_TO_NODE.deice).toBe(BUILD_LINKS.deice)
    expect(BUILD_LINKS.oil).toBe(BUILD_LINKS.fuel_rail)
  })

  it('folds desk and Wave 3 progress into the tree without dropping a fraction or a relation clock', () => {
    const folded = foldResearch(
      {
        researchPoints: 40.5,
        researchUnlocked: ['night_bank', 'deice', 'transfer_centre'],
        wave3: {
          relations: { rows: { harbor: { score: 4 } } },
          research: {
            points: 32000,
            carry: 0.25,
            unlocked: ['passenger.1', 'cargo.1'],
            animSeconds: 12,
          },
        },
      },
      3,
    )
    expect(folded.researchTree.unlocked).toEqual(
      expect.arrayContaining(['airside-6', 'airfield-2', 'retail-1', 'terminal-1', 'spec-cargo-1']),
    )
    expect(folded.researchUnlocked).toEqual(expect.arrayContaining(['night_bank', 'deice', 'transfer_centre']))
    expect(folded.researchTree.unlocked.length).toBeGreaterThan(0)
    expect(folded.wave3Research.points).toBe(0)
    expect(folded.wave3Research.unlocked).toEqual([])
    expect(folded.wave3Research.animSeconds).toBe(12)
    const ratio = treeCatalogCost() / wave3CatalogCost()
    const total = 40.5 + (32000 + 0.25) * ratio
    expect(folded.researchTree.points + folded.researchTree.carry).toBeCloseTo(total, 8)
    expect(folded.researchTree.carry).toBeGreaterThan(0)

    const again = foldResearch(
      {
        researchUnified: true,
        researchPoints: folded.researchPoints + 999,
        researchUnlocked: folded.researchUnlocked,
        researchTree: folded.researchTree,
        wave3: { research: { ...folded.wave3Research, points: 5000, unlocked: ['prestige.1'] } },
      },
      3,
    )
    expect(again.researchTree.points).toBe(folded.researchTree.points)
    expect(again.researchTree.carry).toBeCloseTo(folded.researchTree.carry, 8)
    expect(again.researchTree.unlocked).toContain('retail-3')
    expect(again.wave3Research.points).toBe(0)
  })

  it('migrates a v4 save that never had a tree', () => {
    const migrated = migrateV4ToV5({
      cash: 250000,
      fieldXp: 220,
      researchPoints: 18,
      researchUnlocked: ['self_service'],
      wave3: {
        relations: { rows: { bushline: { score: 3, band: 'neutral' } } },
        research: { points: 0, carry: 0, unlocked: [], animSeconds: 4 },
      },
    }) as {
      researchUnified: boolean
      researchTree: { unlocked: string[]; rewardedThrough: number }
      wave3: { relations: { rows: { bushline: { score: number } } }; research: { animSeconds: number; points: number } }
    }
    expect(migrated.researchUnified).toBe(true)
    expect(migrated.researchTree.unlocked).toContain('terminal-2')
    expect(migrated.researchTree.unlocked).not.toEqual([])
    expect(migrated.researchTree.rewardedThrough).toBeGreaterThanOrEqual(3)
    expect(migrated.wave3.relations.rows.bushline.score).toBe(3)
    expect(migrated.wave3.research.animSeconds).toBe(4)
    expect(migrated.wave3.research.points).toBe(0)
  })

  it('lists every node in docs/RESEARCH.md', () => {
    const doc = readFileSync(new URL('../../docs/RESEARCH.md', import.meta.url), 'utf8')
    for (const node of RESEARCH_NODES) {
      expect(doc).toContain(node.id)
      expect(doc).toContain(node.name)
      expect(doc).toContain(node.unlocks)
    }
  })
})

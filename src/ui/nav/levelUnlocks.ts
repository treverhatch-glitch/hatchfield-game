import {
  BUILDINGS,
  MAX_FIELD_LEVEL,
  RESEARCH_NODES,
  TOOL_LABEL,
  type FieldProgress,
} from '../../game/catalog.ts'
import { PROGRESSION_BUILDABLES, unlockLevel } from '../../progression/unlocks.ts'
import { buildingById } from '../../tier3plus/index.ts'
import { BUILD_MENUS } from './taxonomy.ts'

export interface LevelUnlock {
  id: string
  name: string
  /** field = a stamp or commission. research = a research-desk node. */
  kind: 'field' | 'research'
}

/** Field level that actually gates a stamp. Late buildings use their own table. */
export function gateLevel(id: string): number {
  const late = buildingById(id)
  if (late) return late.fieldLevel
  const def = BUILDINGS.find((row) => row.tool === id)
  return Math.max(unlockLevel(id), def?.minFieldLevel ?? 1)
}

function stampName(id: string): string {
  const late = buildingById(id)
  if (late) return late.name
  const progression = PROGRESSION_BUILDABLES.find((row) => row.id === id)
  if (progression) return progression.name
  const def = BUILDINGS.find((row) => row.tool === id)
  if (def) return def.name
  if (id in TOOL_LABEL) return TOOL_LABEL[id as keyof typeof TOOL_LABEL]
  return id
}

/** Stamps and research nodes that open when the field reaches this level. */
export function unlocksAtLevel(level: number): LevelUnlock[] {
  const rows: LevelUnlock[] = []
  const seen = new Set<string>()
  for (const menu of BUILD_MENUS) {
    for (const id of [...menu.tools, ...menu.progression]) {
      if (id === 'clear' || id === 'pan') continue
      if (gateLevel(id) !== level || seen.has(id)) continue
      seen.add(id)
      rows.push({ id, name: stampName(id), kind: 'field' })
    }
  }
  for (const node of RESEARCH_NODES) {
    if (node.minFieldLevel !== level) continue
    rows.push({ id: node.id, name: node.name, kind: 'research' })
  }
  return rows
}

/** Names shown on the XP bar. The rest collapse to `+N`. */
export const NEXT_UNLOCK_CAP = 3

export function formatUnlockNames(names: readonly string[], cap = NEXT_UNLOCK_CAP): string {
  if (names.length === 0) return ''
  const shown = names.slice(0, cap)
  const extra = names.length - shown.length
  return extra > 0 ? `${shown.join(' · ')} +${extra}` : shown.join(' · ')
}

/**
 * What the next bit of XP opens. Levels 1–9 name `unlocksAtLevel(level + 1)`.
 * Level 10 names the next prestige star. Max prestige is a blank line.
 */
export function nextUnlockLine(progress: FieldProgress): string {
  if (progress.level >= MAX_FIELD_LEVEL) {
    if (progress.nextLabel === 'max') return ''
    return `Prestige star ${progress.nextLabel}`
  }
  return formatUnlockNames(unlocksAtLevel(progress.level + 1).map((row) => row.name))
}

export function fieldLevels(): number[] {
  return Array.from({ length: MAX_FIELD_LEVEL }, (_, index) => index + 1)
}

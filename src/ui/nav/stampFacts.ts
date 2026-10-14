import {
  BUILDINGS,
  HEAVY_RUNWAY_COST,
  HEAVY_RUNWAY_LEN,
  HEAVY_RUNWAY_WID,
  PREMADE_TERMINAL_COST,
  RESEARCH_NODES,
  RUNWAY_PREFAB_COST,
  RUNWAY_PREFAB_LEN,
  RUNWAY_PREFAB_WID,
  SHORT_RUNWAY_COST,
  SHORT_RUNWAY_LEN,
  SHORT_RUNWAY_WID,
  TOOL_LABEL,
  money,
} from '../../game/catalog.ts'
import type { ResearchId } from '../../game/types.ts'
import { progressionBuildable } from '../../progression/unlocks.ts'
import { linkFor } from '../../research/links.ts'
import { nodeById as treeNodeById } from '../../research/nodes.ts'
import { buildingById } from '../../tier3plus/index.ts'
import { gateLevel } from './levelUnlocks.ts'
import type { ManageTabId } from './taxonomy.ts'

export interface UnlockLink {
  tab: Extract<ManageTabId, 'levels' | 'research'>
  /** Element id to scroll into view. */
  anchor: string
  label: string
}

export interface StampBadge {
  kind: 'field' | 'research'
  /** Field level text, or the research node's own name. */
  label: string
  nodeId?: string
}

export interface StampCard {
  name: string
  blurb: string
  price: string
  upkeep: string
  capacity: string
  noise: string
  locked: boolean
  /** Research node when that is the gate; otherwise the field level. */
  badge: StampBadge | null
  /** Exact gate, when the stamp is still locked. */
  sentence: string | null
  link: UnlockLink | null
}

export interface StampInput {
  id: string
  name: string
  blurb: string
  cost: number | null
  upkeepPerDay: number
  fieldLevel: number
  /** Late buildings compare against this wider ladder. */
  lateLevel?: number
  researchId?: ResearchId | null
  researchOwned?: boolean
  /** Cities research-tree node, when this stamp is on the build-link table. */
  treeNodeId?: string | null
  treeOwned?: boolean
}

const RUNWAY_FOOT: Record<string, string> = {
  runway_short: `${SHORT_RUNWAY_LEN} × ${SHORT_RUNWAY_WID} cells`,
  runway: `${RUNWAY_PREFAB_LEN} × ${RUNWAY_PREFAB_WID} cells`,
  runway_heavy: `${HEAVY_RUNWAY_LEN} × ${HEAVY_RUNWAY_WID} cells`,
}

function capacityOf(id: string): string {
  if (RUNWAY_FOOT[id]) return RUNWAY_FOOT[id]
  const late = buildingById(id)
  if (late?.kind === 'hotel') return `${late.rooms} rooms`
  return '—'
}

function noiseOf(blurb: string): string {
  return /noise/i.test(blurb) ? 'The city bills it' : '—'
}

function upkeepLabel(perDay: number): string {
  return perDay > 0 ? `${money(perDay)}/day` : 'None'
}

/**
 * Hover-card copy. A locked stamp names the field level, the research node, or both,
 * and points at that row in Growth.
 */
export function stampCard(input: StampInput): StampCard {
  const need = gateLevel(input.id)
  const late = buildingById(input.id)
  const levelNow = late ? (input.lateLevel ?? input.fieldLevel) : input.fieldLevel
  const levelShort = need > 1 && levelNow < need
  const tree = input.treeNodeId ? treeNodeById(input.treeNodeId) : undefined
  const treeLink = tree ? linkFor(input.id) : null
  const treeShort = Boolean(tree && treeLink && !input.treeOwned)
  const node = input.researchId ? RESEARCH_NODES.find((row) => row.id === input.researchId) : undefined
  const deskShort = Boolean(node && !input.researchOwned)
  const locked = levelShort || treeShort || deskShort
  const parts: string[] = []
  if (treeShort && treeLink) parts.push(`Requires research: ${treeLink.label}.`)
  if (deskShort && node) parts.push(`Requires research: ${node.name}.`)
  if (levelShort) parts.push(`Unlocks at Field level ${need}.`)
  let badge: StampBadge | null = null
  let link: UnlockLink | null = null
  if (treeShort && tree) {
    badge = { kind: 'research', label: tree.name, nodeId: tree.id }
    link = { tab: 'research', anchor: `research-node-${tree.id}`, label: tree.name }
  } else if (deskShort && node) {
    badge = { kind: 'research', label: node.name, nodeId: node.id }
    link = { tab: 'research', anchor: `research-node-${node.id}`, label: node.name }
  } else if (levelShort) {
    badge = { kind: 'field', label: `Field level ${need}` }
    link = { tab: 'levels', anchor: `level-${need}`, label: `Field level ${need}` }
  }
  return {
    name: input.name,
    blurb: input.blurb,
    price: input.cost == null ? 'Refund' : money(input.cost),
    upkeep: upkeepLabel(input.upkeepPerDay),
    capacity: capacityOf(input.id),
    noise: noiseOf(input.blurb),
    locked,
    badge,
    sentence: parts.length ? parts.join(' ') : null,
    link,
  }
}

export function toolStampInput(
  id: string,
  fieldLevel: number,
  lateLevel: number,
  owned: ReadonlySet<string>,
  treeUnlocked: ReadonlySet<string> = new Set(),
): StampInput {
  const late = buildingById(id)
  const def = BUILDINGS.find((row) => row.tool === id)
  const progression = progressionBuildable(id)
  const name = late?.name ?? progression?.name ?? def?.name ?? TOOL_LABEL[id as keyof typeof TOOL_LABEL] ?? id
  const blurb = late?.purpose ?? progression?.blurb ?? def?.blurb ?? ''
  const known =
    id === 'runway_short'
      ? SHORT_RUNWAY_COST
      : id === 'runway'
        ? RUNWAY_PREFAB_COST
        : id === 'runway_heavy'
          ? HEAVY_RUNWAY_COST
          : id === 'premade'
            ? PREMADE_TERMINAL_COST
            : null
  const cost = late?.cost ?? progression?.cost ?? def?.cost ?? known
  const upkeep = late?.dailyUpkeep ?? progression?.upkeepPerDay ?? def?.upkeepPerDay ?? 0
  const tree = linkFor(id)
  return {
    id,
    name,
    blurb,
    cost: id === 'clear' ? null : cost,
    upkeepPerDay: upkeep,
    fieldLevel,
    lateLevel,
    researchId: def?.research ?? null,
    researchOwned: def?.research ? owned.has(def.research) : true,
    treeNodeId: tree?.nodeId ?? null,
    treeOwned: tree ? treeUnlocked.has(tree.nodeId) : true,
  }
}

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
import { LATE_OPS_TECH } from '../../tier3plus/cargoConfig.ts'
import { gateLevel } from './levelUnlocks.ts'
import type { ManageTabId } from './taxonomy.ts'

export interface UnlockLink {
  tab: Extract<ManageTabId, 'levels' | 'research' | 'wallet'>
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
  /** Prestige stars held. Landmarks compare against their own star gate. */
  prestigeStars?: number
  /** Ops-wallet node the stamp needs, and whether the player owns it. */
  opsTech?: { id: string; name: string; owned: boolean } | null
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
  if (late?.kind === 'landmark') return `${late.visitorsPerDay} visitors/day`
  return '—'
}

function noiseOf(blurb: string): string {
  return /noise/i.test(blurb) ? 'The city bills it' : '—'
}

function upkeepLabel(perDay: number): string {
  return perDay > 0 ? `${money(perDay)}/day` : 'None'
}

/**
 * Fuel rail and the oil station share the Night bank node. The badge names
 * the fuel research, the line, and the station. Night hub keeps the node name.
 */
function hydrantStamp(id: string): string | null {
  if (id !== 'hydrant') return null
  return 'Research the hydrant system. Stamp the pit on a stand.'
}

function fuelRailStamp(id: string): string | null {
  if (id === 'fuel_rail') {
    return 'Research Fuel rail. Paint the line to the map edge, then put the oil station on that line.'
  }
  if (id === 'oil') {
    return 'Research Fuel rail. Put the oil station on the line, beside the farm.'
  }
  return null
}

function berthStamp(id: string): string | null {
  if (id !== 'berth') return null
  return 'Research Fuel rail. Stamp the berth on the river edge of a riverside plot. Inland fields have no river.'
}

function fuelPipeStamp(id: string): string | null {
  if (id === 'fuel_pipe') {
    return 'Research the fuel pipeline. Paint the pipe to the map edge, then put the receipt manifold on that pipe, beside the farm.'
  }
  if (id === 'manifold') {
    return 'Research the fuel pipeline. Put the receipt manifold on the pipe, beside the farm.'
  }
  return null
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
  const starNeed = late?.kind === 'landmark' ? late.unlockPrestigeStars : 0
  const starShort = !levelShort && starNeed > (input.prestigeStars ?? 0)
  const tree = input.treeNodeId ? treeNodeById(input.treeNodeId) : undefined
  const treeLink = tree ? linkFor(input.id) : null
  const treeShort = Boolean(tree && treeLink && !input.treeOwned)
  const node = input.researchId ? RESEARCH_NODES.find((row) => row.id === input.researchId) : undefined
  const deskShort = Boolean(node && !input.researchOwned)
  const walletShort = Boolean(input.opsTech && !input.opsTech.owned)
  const locked = levelShort || starShort || walletShort || treeShort || deskShort
  const fuelRail = fuelRailStamp(input.id)
  const fuelPipe = fuelPipeStamp(input.id)
  const fuelLine = fuelRail ?? fuelPipe ?? berthStamp(input.id)
  const hydrant = hydrantStamp(input.id)
  const hydrantShort = Boolean(hydrant && !input.researchOwned)
  const parts: string[] = []
  if (hydrantShort && hydrant) parts.push(hydrant)
  else if (treeShort && fuelLine) parts.push(fuelLine)
  else if (treeShort && treeLink) parts.push(`Requires research: ${treeLink.label}.`)
  else if (deskShort && node) parts.push(`Requires research: ${node.name}.`)
  if (levelShort) parts.push(`Unlocks at Field level ${need}.`)
  if (walletShort && input.opsTech) parts.push(`Buy ${input.opsTech.name} in Growth > Ops wallet.`)
  if (starShort) parts.push(`Needs ${starNeed} prestige ${starNeed === 1 ? 'star' : 'stars'} past Field level 10.`)
  let badge: StampBadge | null = null
  let link: UnlockLink | null = null
  if (hydrantShort) {
    badge = { kind: 'research', label: 'Hydrant', nodeId: 'airside-1' }
    link = { tab: 'research', anchor: 'research-node-airside-1', label: 'Hydrant' }
  } else if (treeShort && tree) {
    const label = fuelRail || berthStamp(input.id) ? 'Fuel rail' : fuelPipe ? 'Fuel pipeline' : tree.name
    badge = { kind: 'research', label, nodeId: tree.id }
    link = { tab: 'research', anchor: `research-node-${tree.id}`, label }
  } else if (!treeLink && deskShort && node) {
    badge = { kind: 'research', label: node.name, nodeId: node.id }
    link = { tab: 'research', anchor: `research-node-${node.id}`, label: node.name }
  } else if (levelShort) {
    badge = { kind: 'field', label: `Field level ${need}` }
    link = { tab: 'levels', anchor: `level-${need}`, label: `Field level ${need}` }
  } else if (walletShort && input.opsTech) {
    badge = { kind: 'field', label: 'Ops wallet' }
    link = { tab: 'wallet', anchor: `ops-node-${input.opsTech.id}`, label: input.opsTech.name }
  } else if (starShort) {
    badge = { kind: 'field', label: `${starNeed} prestige ${starNeed === 1 ? 'star' : 'stars'}` }
    link = { tab: 'levels', anchor: 'level-10', label: 'Prestige stars' }
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
  prestigeStars = 0,
  opsTechOwned: (techId: string) => boolean = () => true,
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
  const researchId = id === 'hydrant' ? 'hydrant_fuel' : (def?.research ?? null)
  return {
    id,
    name,
    blurb,
    cost: id === 'clear' ? null : cost,
    upkeepPerDay: upkeep,
    fieldLevel,
    lateLevel,
    prestigeStars,
    opsTech: LATE_OPS_TECH[id] ? { ...LATE_OPS_TECH[id], owned: opsTechOwned(LATE_OPS_TECH[id].id) } : null,
    researchId,
    researchOwned: researchId ? owned.has(researchId) : true,
    treeNodeId: tree?.nodeId ?? null,
    treeOwned: tree ? treeUnlocked.has(tree.nodeId) : true,
  }
}

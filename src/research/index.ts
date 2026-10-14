export { CATEGORIES, LEVEL_REWARDS, OPS_RP_PER_SEC, SPEC_BRANCHES, SPEC_PENALTY, TIER_COSTS, levelReward } from './config.ts'
export { ResearchEngine } from './engine.ts'
export { BUILD_LINKS, linkFor, researchRequirement } from './links.ts'
export { DESK_TO_NODE, WAVE3_TO_NODE, foldResearch, foldResearchSave, treeCatalogCost, wave3CatalogCost } from './legacy.ts'
export { researchMods } from './effects.ts'
export {
  accrue,
  blockReason,
  buyNode,
  categoryNodes,
  claimLevels,
  emptyResearchState,
  nodeCost,
  nodeState,
  researchRate,
  shortfallCopy,
  shortfallDays,
} from './logic.ts'
export { RESEARCH_NODES, nodeById } from './nodes.ts'
export type { BuildLink } from './links.ts'
export type { NodeState, ResearchNode, ResearchState, RoomCounts } from './types.ts'

export interface ResearchDef {
  id: string
  name: string
  tier: 4 | 5
  cost: number
  days: number
  requires: string[]
  unlocks: string[]
  minFL: number
  blurb: string
}

/**
  Checks research definitions for missing prerequisites, cycles,
 * and tier-order violations (e.g. tier-4 requiring tier-5).
 */
export function validateResearchGraph(
  defs: ResearchDef[],
  knownIds: string[]
): string[] {
  const errors: string[] = []
  const knownSet = new Set(knownIds)
  const defMap = new Map<string, ResearchDef>()

  for (const def of defs) {
    if (defMap.has(def.id)) {
      errors.push(`Duplicate research ID found: "${def.id}"`)
    } else {
      defMap.set(def.id, def)
    }
  }

  // Check missing prerequisites & tier-order violations
  for (const def of defs) {
    for (const reqId of def.requires) {
      if (!defMap.has(reqId) && !knownSet.has(reqId)) {
        errors.push(`Research "${def.id}" has missing prerequisite "${reqId}"`)
      } else if (defMap.has(reqId)) {
        const reqDef = defMap.get(reqId)!
        if (reqDef.tier > def.tier) {
          errors.push(
            `Tier-order violation: Tier ${def.tier} research "${def.id}" requires Tier ${reqDef.tier} research "${reqDef.id}"`
          )
        }
      }
    }
  }

  // Cycle detection via Depth-First Search
  // State: 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited
  const state = new Map<string, number>()
  const path: string[] = []

  function visit(id: string): void {
    const currentState = state.get(id) ?? 0
    if (currentState === 1) {
      const cycleStartIndex = path.indexOf(id)
      const cyclePath = [...path.slice(cycleStartIndex), id].join(' -> ')
      errors.push(`Cycle detected in research graph: ${cyclePath}`)
      return
    }
    if (currentState === 2) {
      return
    }

    state.set(id, 1)
    path.push(id)

    const def = defMap.get(id)
    if (def) {
      for (const reqId of def.requires) {
        if (defMap.has(reqId)) {
          visit(reqId)
        }
      }
    }

    path.pop()
    state.set(id, 2)
  }

  for (const def of defs) {
    if ((state.get(def.id) ?? 0) === 0) {
      visit(def.id)
    }
  }

  return errors
}

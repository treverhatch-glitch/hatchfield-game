import { bridgeCap, fittingDef, jetBridgeCost } from './catalog.ts'
import type { FittingHost, FittingId, StandRung, StandSize } from './types.ts'

export interface FittingAsk {
  id: FittingId
  host: FittingHost
  size: StandSize | null
  rung: StandRung
  fieldLevel: number
  research: ReadonlySet<string>
  hasDeice: boolean
  hallNear: boolean
  count: number
  cash: number
}

/** First reason a fitting cannot be bought. Null when the row can take cash. */
export function fittingRefusal(ask: FittingAsk): string | null {
  const def = fittingDef(ask.id)
  if (!def.hosts.includes(ask.host)) return `${def.name} does not go on this building.`
  if (ask.host === 'stand') {
    if (!ask.size) return 'This stand has no size yet.'
    if (def.sizes.length && !def.sizes.includes(ask.size)) return `${def.name} does not fit this stand.`
    if (ask.id === 'jet_bridge') {
      if (ask.size !== 'heavy' && ask.rung < 1) return 'Pave this stand first.'
    } else if (ask.rung < def.minRung) {
      return 'Pave this stand first.'
    }
  }
  if (ask.fieldLevel < def.minFieldLevel) return `${def.name} needs Field level ${def.minFieldLevel}.`
  if (def.research && !ask.research.has(def.research)) return `Research ${def.research} first.`
  if (def.needs === 'deice' && !ask.hasDeice) return 'Build a de-ice pad. The truck fills there.'
  if (ask.id === 'jet_bridge') {
    if (!ask.hallNear) return 'No hall within 8 cells.'
    const cap = ask.size ? bridgeCap(ask.size, ask.rung) : 1
    if (ask.count >= cap) {
      return cap === 1 ? 'This stand already has a bridge.' : `This stand already has ${ask.count} bridges.`
    }
  } else if (ask.count >= def.max) {
    return `${def.name} is already fitted.`
  }
  const cost = ask.id === 'jet_bridge' && ask.size ? jetBridgeCost(ask.size) : def.cost
  if (ask.cash < cost) return `Need $${cost.toLocaleString('en-US')}.`
  return null
}

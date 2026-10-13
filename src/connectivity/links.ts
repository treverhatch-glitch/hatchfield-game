import { CONNECTIVITY_CATALOG, LINK_BUILDING, finite, nonNegative } from './catalog.ts'
import type {
  BreakdownEvent,
  BreakdownResult,
  LinkAttempt,
  LinkMode,
  PassengerLink,
  PassengerLinkInput,
  TerminalGates,
  TerminalLink,
  Throughput,
  ThroughputInput,
} from './types.ts'

/**
 * Connecting passengers take the people mover when it is open, then the
 * airside transfer bus, then the terminal bus, then a skywalk, then a belt.
 * A stopped people mover or transfer bus is skipped. The terminal bus is the
 * last ride. A skywalk is a bridge. A walkway only helps a walk.
 */
export function choosePassengerLink(input: PassengerLinkInput): PassengerLink {
  if (input.peopleMoverOpen === true) return 'people_mover'
  if (input.transferBusOpen === true) return 'airside_transfer_bus'
  if (input.terminalBusOpen === true) return 'terminal_bus'
  if (input.skywalkOpen === true) return 'skywalk'
  if (nonNegative(input.walkwayMetres) > 0) return 'walkway'
  return 'walk'
}

/**
 * Open a passenger link between two terminals.
 * The people mover and the airside bus are the only ride modes.
 */
export function linkTerminals(fromId: string, toId: string, mode: LinkMode, id?: string): LinkAttempt {
  if (fromId.trim() === '' || toId.trim() === '') return { ok: false, reason: 'missing_terminal' }
  if (fromId === toId) return { ok: false, reason: 'same_terminal' }
  const linkId = id !== undefined && id.trim() !== '' ? id : `${mode}:${fromId}:${toId}`
  return { ok: true, link: { id: linkId, fromId, toId, mode, open: true } }
}

/**
 * Passengers moved this hour, capped by the open links the player actually built.
 * A closed link adds neither flow nor apron traffic. Non-finite demand is treated
 * as no demand so a bad counter cannot produce NaN or an infinite queue.
 */
export function throughput(input: ThroughputInput): Throughput {
  const demand = nonNegative(input.demandPerHour)
  let capacity = 0
  let apron = 0
  for (const link of input.links) {
    if (!link.open) continue
    if (input.between && !serves(link, input.between[0], input.between[1])) continue
    const spec = CONNECTIVITY_CATALOG[LINK_BUILDING[link.mode]]
    capacity += nonNegative(spec.paxPerHour)
    apron += nonNegative(spec.apronTrafficPerHour)
  }
  const moved = Math.min(demand, capacity)
  return {
    movedPerHour: finite(moved),
    capacityPerHour: finite(capacity),
    queuedPerHour: finite(demand - moved),
    apronTrafficPerHour: finite(apron),
  }
}

/**
 * Breakdown stub. Closes the link and, for the people mover, names the gates
 * that are stranded. The bus depot stops moving people and drops its apron
 * traffic, but it does not strand gates. The event is explained and names a fix.
 */
export function breakdown(link: TerminalLink, terminals: readonly TerminalGates[]): BreakdownResult {
  const spec = CONNECTIVITY_CATALOG[LINK_BUILDING[link.mode]]
  const strandsGates = spec.breakdownStrandsGates
  const peopleMover = link.mode === 'people_mover'
  const event: BreakdownEvent = {
    type: 'connectivity_breakdown',
    linkId: link.id,
    mode: link.mode,
    reason: peopleMover ? 'people_mover_stopped' : 'transfer_bus_stopped',
    strandsGates,
    strandedGateIds: strandsGates ? gatesOnLink(link, terminals) : [],
    explanation: peopleMover
      ? 'The people mover broke down. Gates on this link are stranded until it runs again.'
      : 'The airside transfer buses are stopped. This link is closed until the depot is repaired.',
    suggestedFix: peopleMover ? 'Repair the people mover' : 'Repair the transfer bus depot',
  }
  return { event, link: { ...link, open: false } }
}

function serves(link: TerminalLink, a: string, b: string): boolean {
  return (link.fromId === a && link.toId === b) || (link.fromId === b && link.toId === a)
}

function gatesOnLink(link: TerminalLink, terminals: readonly TerminalGates[]): string[] {
  const gates: string[] = []
  const seen = new Set<string>()
  for (const terminalId of [link.fromId, link.toId]) {
    const terminal = terminals.find((item) => item.id === terminalId)
    if (!terminal) continue
    for (const gateId of terminal.gateIds) {
      if (gateId.trim() === '' || seen.has(gateId)) continue
      seen.add(gateId)
      gates.push(gateId)
    }
  }
  return gates
}

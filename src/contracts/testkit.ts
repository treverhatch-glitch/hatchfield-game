// Shared fixtures for tests (not imported by game code).
import { makeOffer, signContract, timeWindow } from './contracts.ts'
import { seasonFor } from './seasons.ts'
import type { Contract, FlightLine, Infrastructure } from './types.ts'

export const SUMMER = seasonFor('summer', 0)

export function line(id: string, airframeId: string, prefMin: number, extra: Partial<FlightLine> = {}): FlightLine {
  return {
    id, airframeId, kind: 'pax', days: [0, 1, 2, 3, 4, 5, 6], arrival: timeWindow(prefMin),
    turnaroundTargetMin: airframeId === 'a380' ? 120 : airframeId.startsWith('b77') || airframeId.startsWith('a3') && airframeId !== 'a320' && airframeId !== 'a321' ? 90 : 45,
    origin: 'HAT', destination: 'XXX', ...extra,
  }
}

export function active(id: string, airlineId: string, lines: FlightLine[], extra: Partial<Contract> = {}): Contract {
  const offer = { ...makeOffer({ id, airlineId, lines, services: ['fuel', 'catering', 'baggage'] }), ...extra }
  const r = signContract(offer, SUMMER, [])
  if (!r.ok) throw new Error(r.reason)
  return r.contract
}

export const INFRA: Infrastructure = {
  stands: [
    { id: 'N1', sizeClass: 'narrow', contact: true, pier: 'A' },
    { id: 'N2', sizeClass: 'narrow', contact: false, pier: 'B' },
    { id: 'W1', sizeClass: 'wide', contact: true, pier: 'A' },
    { id: 'S1', sizeClass: 'super', contact: true, pier: 'B' },
  ],
  runways: [{ id: 'R09', movesPerHour: 20 }],
}

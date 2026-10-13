import { ASH_HOTEL_ROOMS, POOL_LABEL } from './data.ts'
import type { DisruptionId, FocusTarget, StaffPoolId } from './types.ts'

export const TITLE: Record<DisruptionId, string> = {
  'volcanic-ash': 'Volcanic ash',
  'state-visit': 'State visit',
  'software-outage': 'Software outage',
  'strike-day': 'Strike day',
  'hub-meltdown': 'Hub meltdown',
  'health-screening': 'Health-screening scare',
  'rival-price-war': 'Rival price war',
}

export const FOCUS: Record<DisruptionId, FocusTarget> = {
  'volcanic-ash': 'apron',
  'state-visit': 'runway',
  'software-outage': 'checkin',
  'strike-day': 'staff',
  'hub-meltdown': 'apron',
  'health-screening': 'security',
  'rival-price-war': 'fees',
}

export const FIX: Record<DisruptionId, string> = {
  'volcanic-ash':
    'Open stands and hotel rooms for the diversions you can take. Rent overflow beds if the hotels are short. Anyone who does not fit diverts onward.',
  'state-visit':
    'Keep a stand corridor clear and hold departures during each runway window. Pay the corridor crew to lift the closures early.',
  'software-outage': 'Open extra manual desks so the slower check-in still clears the bank.',
  'strike-day': 'Pay overtime and the remaining crew covers the pool until the walkout ends.',
  'hub-meltdown': 'Rebank that wave onto the next open slots so the flights depart late instead of disappearing.',
  'health-screening': 'Open a relief lane beside the extra screening step.',
  'rival-price-war': 'Run a short promotion to meet the cut, or hold your fees until the war ends.',
}

export function explainAsh(count: number, hosted: number, onward: number, shortRooms: number): string {
  const beds =
    shortRooms > 0
      ? ` Hotels are short ${shortRooms} rooms (${ASH_HOTEL_ROOMS} per aircraft).`
      : ` Hotels can cover the ${ASH_HOTEL_ROOMS} rooms each aircraft needs.`
  return (
    `Volcanic ash has closed the airway. ${count} diverted airliners are arriving together. ` +
    `${hosted} can take a stand now and ${onward} divert onward if the apron is full.` +
    beds +
    ' The ones you cannot park leave for another field. This does not end the day.'
  )
}

export function explainState(windows: number): string {
  const noun = windows === 1 ? 'window' : 'windows'
  return (
    `A state flight is inbound. The secure zone stays up around one stand corridor, and the runway closes for ${windows} short ${noun}. ` +
    'Movements slip during a window and resume when it ends.'
  )
}

export function explainSoftware(multiplier: number): string {
  return (
    `The departure system is down. Check-in has fallen back to manual processing at ${multiplier.toFixed(1)}× the usual desk time. ` +
    'The line still moves, just slower.'
  )
}

export function explainStrike(pool: StaffPoolId, scale: number): string {
  const pct = Math.round(scale * 100)
  return (
    `${POOL_LABEL[pool]} walked out. That pool is at ${pct}% until the day ends. ` +
    'The other pools stay on duty, and this one does not drop to zero.'
  )
}

export function explainHub(label: string, count: number): string {
  const flights = count === 1 ? '1 flight is' : `${count} flights are`
  return (
    `A storm wiped ${label}. ${flights} held, not cancelled, so passengers and bags stay in the system. ` +
    'The rest of the timetable keeps moving.'
  )
}

export function explainHealth(multiplier: number): string {
  return (
    `A health-screening scare added an extra step at security. Lanes are ${multiplier.toFixed(1)}× slower. ` +
    'Nobody is turned away.'
  )
}

export function explainPrice(rivalName: string, multiplier: number): string {
  const who = rivalName ? `${rivalName} has cut fares` : 'A rival field has cut fares'
  const pct = Math.round(multiplier * 100)
  return (
    `${who}. Your fees sit at ${pct}% of normal while the war lasts. ` +
    'The cut is floored so the books stay a real number, and fees return when it ends.'
  )
}

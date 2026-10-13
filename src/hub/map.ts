import type { PassengerLink } from '../connectivity/types.ts'
import { bankCrowd } from './banks.ts'
import {
  assistedWalkMinutes,
  gateMetres,
  linkTravelMinutes,
  minimumConnectionTime,
  resolveLink,
  walkMinutes,
} from './connect.ts'
import type { BankWave, ConnectionMap, GatePairTime, GatePoint, HubFacilities } from './types.ts'

function linkLabel(link: PassengerLink): string {
  if (link === 'people_mover') return 'People mover open'
  if (link === 'airside_transfer_bus') return 'Airside transfer bus open'
  if (link === 'terminal_bus') return 'Ride link open (terminal bus)'
  if (link === 'skywalk') return 'Skywalk open'
  if (link === 'walkway') return 'Moving walkway — faster along the belt'
  return 'Walk only — no bus or walkway'
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function gatePairs(
  gates: readonly GatePoint[],
  ride: boolean,
  linkFor?: (from: string, to: string) => PassengerLink,
  walkwayMetres = 0,
): GatePairTime[] {
  const pairs: GatePairTime[] = []
  const ordered = [...gates].sort((a, b) => a.id.localeCompare(b.id))
  for (const from of ordered) {
    for (const to of ordered) {
      if (from.id === to.id) continue
      const metres = gateMetres(from, to)
      const link = linkFor
        ? linkFor(from.id, to.id)
        : resolveLink(ride, undefined, walkwayMetres)
      const riding = link !== 'walk' && link !== 'walkway'
      const walk =
        link === 'walkway' ? assistedWalkMinutes(metres, walkwayMetres) : walkMinutes(metres)
      pairs.push({
        from: from.id,
        to: to.id,
        metres,
        walkMinutes: walk,
        rideMinutes: riding ? linkTravelMinutes(link, metres, walkwayMetres) : null,
        mode: riding ? 'ride' : 'walk',
      })
    }
  }
  return pairs
}

export function connectionMap(input: {
  gates: readonly GatePoint[]
  ride: boolean
  missed: number
  facilities: HubFacilities
  banks?: readonly BankWave[]
  linkFor?: (from: string, to: string) => PassengerLink
  walkwayMetres?: number
}): ConnectionMap {
  const mct = minimumConnectionTime(input.facilities)
  const missed = Number.isFinite(input.missed) ? Math.max(0, Math.floor(input.missed)) : 0
  const crowdPeak = bankCrowd(input.banks ?? [])
  const walkwayMetres = input.walkwayMetres ?? 0
  const pairs = gatePairs(input.gates, input.ride, input.linkFor, walkwayMetres)
  const sample = pairs[0]
  const sampleLink = sample
    ? input.linkFor
      ? input.linkFor(sample.from, sample.to)
      : resolveLink(input.ride, undefined, walkwayMetres)
    : resolveLink(input.ride, undefined, walkwayMetres)
  const lines = [
    `Connection time ${mct} min`,
    `Missed connections ${missed}`,
    `Crowd peak ${round1(crowdPeak)}×`,
    linkLabel(sampleLink),
  ]
  if (!pairs.length) lines.push('Need two gates to show a connection map')
  for (const pair of pairs) {
    const walk = round1(pair.walkMinutes)
    const ride =
      pair.rideMinutes == null ? '' : ` · ride ${round1(pair.rideMinutes)} min`
    lines.push(`${pair.from} → ${pair.to} · walk ${walk} min${ride}`)
  }
  return { mct, missed, crowdPeak, ride: input.ride, pairs, lines }
}

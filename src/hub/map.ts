import { bankCrowd } from './banks.ts'
import { gateMetres, minimumConnectionTime, rideMinutes, walkMinutes } from './connect.ts'
import type { BankWave, ConnectionMap, GatePairTime, GatePoint, HubFacilities } from './types.ts'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function gatePairs(gates: readonly GatePoint[], ride: boolean): GatePairTime[] {
  const pairs: GatePairTime[] = []
  const ordered = [...gates].sort((a, b) => a.id.localeCompare(b.id))
  for (const from of ordered) {
    for (const to of ordered) {
      if (from.id === to.id) continue
      const metres = gateMetres(from, to)
      pairs.push({
        from: from.id,
        to: to.id,
        metres,
        walkMinutes: walkMinutes(metres),
        rideMinutes: ride ? rideMinutes(metres) : null,
        mode: ride ? 'ride' : 'walk',
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
}): ConnectionMap {
  const mct = minimumConnectionTime(input.facilities)
  const missed = Number.isFinite(input.missed) ? Math.max(0, Math.floor(input.missed)) : 0
  const crowdPeak = bankCrowd(input.banks ?? [])
  const pairs = gatePairs(input.gates, input.ride)
  const lines = [
    `Connection time ${mct} min`,
    `Missed connections ${missed}`,
    `Crowd peak ${round1(crowdPeak)}×`,
    input.ride ? 'Ride link open (bus)' : 'Walk only — no bus or walkway',
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

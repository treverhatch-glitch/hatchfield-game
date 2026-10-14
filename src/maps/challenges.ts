import { mapById } from './calendar'
import type { ChallengeCard, ChallengeEvent, MapId } from './types'

export function accrueChallenges(
  mapId: MapId,
  progress: Readonly<Record<string, number>>,
  event: ChallengeEvent,
): Record<string, number> {
  const map = mapById(mapId)
  const next: Record<string, number> = { ...progress }
  const pax = Number.isFinite(event.pax) ? Math.max(0, event.pax) : 0
  for (const goal of map.challenges) {
    const current = next[goal.id] ?? 0
    if (current >= goal.target) {
      next[goal.id] = goal.target
      continue
    }
    let gain = 0
    if (goal.kind === 'holiday_pax' && goal.match.some((id) => event.holidayIds.includes(id))) gain = pax
    else if (goal.kind === 'season_flights' && event.seasonId != null && goal.match.includes(event.seasonId)) gain = 1
    else if (goal.kind === 'heat_flights' && event.heat) gain = 1
    if (gain > 0) next[goal.id] = Math.min(goal.target, current + gain)
  }
  return next
}

export function challengeCards(mapId: MapId, progress: Readonly<Record<string, number>>): ChallengeCard[] {
  return mapById(mapId).challenges.map((goal) => {
    const value = Math.max(0, progress[goal.id] ?? 0)
    return {
      id: goal.id,
      title: goal.title,
      detail: goal.detail,
      value: Math.min(goal.target, value),
      target: goal.target,
      done: value >= goal.target,
    }
  })
}

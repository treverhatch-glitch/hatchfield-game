import { mapById, seasonOn } from './calendar'
import type { ChallengeCard, ChallengeEvent, MapChallenge, MapDefinition, MapId } from './types'

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
  return mapById(mapId).challenges.map((goal) => cardFor(goal, progress))
}

export interface SeasonMissionBoard {
  seasonId: string
  seasonName: string
  missions: ChallengeCard[]
  nextLine: string
}

/** Seasons a challenge belongs to, from the calendar's season and holiday ranges. */
function seasonsForChallenge(map: MapDefinition, goal: MapChallenge): string[] {
  if (goal.kind === 'season_flights' || goal.kind === 'heat_flights') {
    return map.seasons.filter((season) => goal.match.includes(season.id)).map((season) => season.id)
  }
  const ids: string[] = []
  for (const holiday of map.holidays) {
    if (!goal.match.includes(holiday.id)) continue
    for (const season of map.seasons) {
      const overlaps = holiday.startDay <= season.endDay && holiday.endDay >= season.startDay
      if (overlaps && !ids.includes(season.id)) ids.push(season.id)
    }
  }
  return ids
}

function cardFor(goal: MapChallenge, progress: Readonly<Record<string, number>>): ChallengeCard {
  const value = Math.max(0, progress[goal.id] ?? 0)
  return {
    id: goal.id,
    title: goal.title,
    detail: goal.detail,
    value: Math.min(goal.target, value),
    target: goal.target,
    done: value >= goal.target,
  }
}

/**
 * Current season's missions, plus one line naming the next season.
 * Goals whose holiday or season is not this one stay off the board.
 */
export function seasonMissionBoard(
  mapId: MapId,
  absoluteDay: number,
  progress: Readonly<Record<string, number>>,
): SeasonMissionBoard {
  const map = mapById(mapId)
  const season = seasonOn(map, absoluteDay)
  const ordered = [...map.seasons].sort((a, b) => a.startDay - b.startDay)
  const index = season ? ordered.findIndex((item) => item.id === season.id) : -1
  const next = index >= 0 && ordered.length ? ordered[(index + 1) % ordered.length] : null
  const missions = season
    ? map.challenges
        .filter((goal) => seasonsForChallenge(map, goal).includes(season.id))
        .map((goal) => cardFor(goal, progress))
    : []
  const nextTitles = next
    ? map.challenges
        .filter((goal) => seasonsForChallenge(map, goal).includes(next.id))
        .map((goal) => goal.title)
    : []
  const nextLine = next
    ? nextTitles.length
      ? `Next: ${next.name} · ${nextTitles.join(', ')}`
      : `Next: ${next.name}`
    : ''
  return {
    seasonId: season?.id ?? '',
    seasonName: season?.name ?? map.name,
    missions,
    nextLine,
  }
}

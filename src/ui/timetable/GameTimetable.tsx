import { useMemo } from 'react'
import type { Game } from '../../game/sim'
import { gameScheduleAdapter } from './gameAdapter'
import { Timetable } from './Timetable'

/** Mount helper for HudRoot: wires today's tower bank into the dock. */
export function GameTimetable({ game, menuOpen }: { game: Game; menuOpen: boolean }) {
  const adapter = useMemo(() => gameScheduleAdapter(game), [game])
  const open = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('timetable') === '1'
  return <Timetable adapter={adapter} menuOpen={menuOpen} defaultOpen={open} />
}

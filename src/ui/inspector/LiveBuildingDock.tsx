import { useCallback, useSyncExternalStore } from 'react'
import { BuildingPanel } from '../BuildingPanel.tsx'
import type { Game } from '../../game/sim.ts'
import { facilityLiveKey, inspectorCard } from './facilityCard.ts'
import { subscribeLiveInspector } from './live.ts'

/** Building tab. Re-reads the selected card on sim emits and at 4 Hz. */
export function LiveBuildingDock({ game }: { game: Game }) {
  const subscribe = useCallback((listener: () => void) => {
    const offGame = game.subscribe(listener)
    const offTimer = subscribeLiveInspector(listener)
    return () => {
      offGame()
      offTimer()
    }
  }, [game])
  useSyncExternalStore(subscribe, () => facilityLiveKey(game), () => '')
  const card = inspectorCard(game)
  if (!card) return <p className="left-dock-note">Select a building on the field.</p>
  return (
    <BuildingPanel
      card={card}
      onClose={() => {
        if (game.assignPick?.kind === 'vehicle') game.closeAssign()
        game.closeBuilding()
      }}
      onHire={card.hire ? () => game.hireDeskStaff() : undefined}
      onAction={(id) => game.buildingCardAction(id)}
      onPreview={(id) => game.previewStandRow(id)}
    />
  )
}

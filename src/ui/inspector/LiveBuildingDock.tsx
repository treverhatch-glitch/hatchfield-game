import { useSyncExternalStore } from 'react'
import { BuildingPanel } from '../BuildingPanel.tsx'
import type { Game } from '../../game/sim.ts'
import { inspectorCard } from './facilityCard.ts'
import { liveInspectorRev, subscribeLiveInspector } from './live.ts'

/** Building tab. Re-reads the selected card at 4 Hz while this tab is open. */
export function LiveBuildingDock({ game }: { game: Game }) {
  useSyncExternalStore(subscribeLiveInspector, liveInspectorRev, () => 0)
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

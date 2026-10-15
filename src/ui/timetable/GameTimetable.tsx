import { useMemo } from 'react'
import { FUEL as FUEL_BRANDS } from '../../game/catalog'
import type { Game } from '../../game/sim'
import { contractById, tankDef } from '../../scale/logic'
import { fuelFooterLine } from './fuelFooter'
import { gameScheduleAdapter } from './gameAdapter'
import { Timetable } from './Timetable'

/** Mount helper for HudRoot: wires today's tower bank into the dock. */
function supplierName(game: Game): string {
  const contract = contractById(game.contractId)
  if (contract) return contract.name
  if (game.fuelBrand) return FUEL_BRANDS[game.fuelBrand]?.name ?? 'No supplier'
  return 'No supplier'
}

export function GameTimetable({
  game,
  menuOpen,
  plannerOpen = false,
  onFuel,
  forceOpen = false,
  onForceClose,
}: {
  game: Game
  menuOpen: boolean
  plannerOpen?: boolean
  onFuel?: () => void
  forceOpen?: boolean
  onForceClose?: () => void
}) {
  const adapter = useMemo(() => gameScheduleAdapter(game), [game])
  const open = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('timetable') === '1'
  const fuel = fuelFooterLine({
    upliftLitres: game.bankUpliftLitres(),
    tankLitres: game.tankLitres,
    tankCapacity: tankDef(game.tankTier).capacityLitres,
    supplier: supplierName(game),
  })
  return (
    <Timetable
      adapter={adapter}
      menuOpen={menuOpen}
      plannerOpen={plannerOpen}
      defaultOpen={open}
      fuelLine={fuel.text}
      fuelShort={fuel.short}
      onFuel={onFuel}
      forceOpen={forceOpen}
      docked
      onForceClose={onForceClose}
    />
  )
}

import { powerPlantOffer } from '../economy/powerPlant.ts'
import { FUEL } from '../fuel/config.ts'
import type { Game } from '../game/sim.ts'
import { tilesOf } from '../game/path.ts'
import { tankDef } from '../scale/logic.ts'
import { airfieldModel, baysModel, fuelModel, powerModel, queuesModel, trafficModel } from './model.ts'
import type { InfoViewModel, MapViewId } from './types.ts'

/**
 * Build one info view from sim snapshots.
 * Reads landside, service-point lines, bay occupancy, power, and tankLitres.
 * Does not write sim state and does not read the logistics fuel ledger.
 */
export function readMapView(game: Game, id: MapViewId): InfoViewModel {
  if (id === 'traffic') return trafficModel(game.landsideView())
  if (id === 'queues') {
    return queuesModel(
      game.servicePointLines('checkin'),
      game.servicePointLines('security'),
      tilesOf(game.tiles, 'terminal'),
    )
  }
  if (id === 'bays') return baysModel(game.bayView().stands)
  if (id === 'airfield') return airfieldModel(game.runwayLoad(), tilesOf(game.tiles, 'runway'))
  if (id === 'power') {
    const power = game.powerReport()
    const loads = game.powerLoads()
    const cells = [
      ...tilesOf(game.tiles, 'terminal').map((spot) => ({ id: `site:${spot.c},${spot.r}`, ...spot })),
      ...tilesOf(game.tiles, 'mro').map((spot) => ({ id: `${spot.c},${spot.r}`, ...spot })),
      ...tilesOf(game.tiles, 'nighthub').map((spot) => ({ id: `hub:${spot.c},${spot.r}`, ...spot })),
      ...tilesOf(game.tiles, 'tower').map((spot) => ({ id: `tower:${spot.c},${spot.r}`, ...spot })),
    ]
    return powerModel(power, loads, powerPlantOffer(game.powerPlantTier).name, cells)
  }
  return fuelModel(
    { litres: game.tankLitres, capacity: tankDef(game.tankTier).capacityLitres },
    game.fuelView(),
    tilesOf(game.tiles, 'fuel'),
    FUEL.minutesPerDay,
  )
}

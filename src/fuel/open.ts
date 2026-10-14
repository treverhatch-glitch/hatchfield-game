/**
 * Opens the fuel-farm panel. Exported so the UI audit can move the control
 * under Operations.
 */
export function openFuelFarm(game: { openFuelFarm(): void }) {
  game.openFuelFarm()
}

/**
 * Opens the curb-flow panel. A null cell toggles it; a road cell focuses it.
 * Exported so the UI audit can move the control under Operations.
 */
export function openCurbFlow(
  game: { openLandside(cell: { c: number; r: number } | null): void },
  cell: { c: number; r: number } | null = null,
) {
  game.openLandside(cell)
}

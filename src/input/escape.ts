/**
 * What Esc / B does. The menu closes first. A camera mode or a placement
 * tool is cancelled before the menu opens, so the next press opens it.
 */
export type EscapeStep =
  | 'close-menu'
  | 'release-camera'
  | 'cancel-tool'
  | 'close-info-detail'
  | 'close-info'
  | 'close-flight-card'
  | 'open-menu'

export function nextEscape(state: {
  menuOpen: boolean
  cameraCaptured: boolean
  toolActive: boolean
  infoDetailOpen?: boolean
  infoViewOpen?: boolean
  flightCardOpen?: boolean
}): EscapeStep {
  if (state.menuOpen) return 'close-menu'
  if (state.cameraCaptured) return 'release-camera'
  if (state.toolActive) return 'cancel-tool'
  if (state.infoDetailOpen) return 'close-info-detail'
  if (state.infoViewOpen) return 'close-info'
  if (state.flightCardOpen) return 'close-flight-card'
  return 'open-menu'
}

/** Which numbers surface Esc closes. Lines, then the More menu, then a map-view panel. */
export type NumbersClose = 'lines' | 'menu' | 'detail'

export function numbersToClose(state: {
  infoLinesOpen: boolean
  infoMenuOpen: boolean
  infoDetailOpen: boolean
}): NumbersClose | null {
  if (state.infoLinesOpen) return 'lines'
  if (state.infoMenuOpen) return 'menu'
  if (state.infoDetailOpen) return 'detail'
  return null
}

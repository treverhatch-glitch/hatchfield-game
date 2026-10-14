/**
 * What Esc / B does. The menu closes first. A camera mode or a placement
 * tool is cancelled before the menu opens, so the next press opens it.
 */
export type EscapeStep = 'close-menu' | 'release-camera' | 'cancel-tool' | 'close-info-detail' | 'close-info' | 'open-menu'

export function nextEscape(state: {
  menuOpen: boolean
  cameraCaptured: boolean
  toolActive: boolean
  infoDetailOpen?: boolean
  infoViewOpen?: boolean
}): EscapeStep {
  if (state.menuOpen) return 'close-menu'
  if (state.cameraCaptured) return 'release-camera'
  if (state.toolActive) return 'cancel-tool'
  if (state.infoDetailOpen) return 'close-info-detail'
  if (state.infoViewOpen) return 'close-info'
  return 'open-menu'
}

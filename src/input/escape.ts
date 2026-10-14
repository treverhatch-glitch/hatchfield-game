/**
 * What Esc / B does. The menu closes first. A camera mode or a placement
 * tool is cancelled before the menu opens, so the next press opens it.
 */
export type EscapeStep = 'close-menu' | 'release-camera' | 'cancel-tool' | 'open-menu'

export function nextEscape(state: {
  menuOpen: boolean
  cameraCaptured: boolean
  toolActive: boolean
}): EscapeStep {
  if (state.menuOpen) return 'close-menu'
  if (state.cameraCaptured) return 'release-camera'
  if (state.toolActive) return 'cancel-tool'
  return 'open-menu'
}

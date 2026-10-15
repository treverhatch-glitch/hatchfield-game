/**
 * Apron pan axes. Positive forward moves the pivot along the camera look,
 * so W (panForward) advances and S (panBack) retreats.
 */
export function apronForward(panForward: number, panBack: number): number {
  return panForward - panBack
}

export function apronRight(panRight: number, panLeft: number): number {
  return panRight - panLeft
}

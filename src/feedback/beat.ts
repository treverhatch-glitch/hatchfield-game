import type { CameraBeat } from './session.ts'

export type { CameraBeat }

let current: CameraBeat | null = null

export function setCameraBeat(beat: CameraBeat): void {
  current = beat
}

export function peekCameraBeat(): CameraBeat | null {
  return current
}

export function clearCameraBeat(): void {
  current = null
}

/**
 * Dolly scale for a celebration beat. 1 is the player's distance.
 * The punch is a sine in and out so the camera eases back by itself.
 */
export function beatZoom(elapsedSec: number, duration: number, dolly: number): number {
  if (!(duration > 0) || elapsedSec <= 0 || elapsedSec >= duration) return 1
  const u = elapsedSec / duration
  const punch = Math.sin(u * Math.PI) * Math.max(0, dolly)
  return 1 - Math.min(0.45, punch)
}

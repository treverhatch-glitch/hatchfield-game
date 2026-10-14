export interface LodTuneInput {
  fps: number
  drawCalls: number
  triangles: number
  currentScale: number
}

const STORAGE_KEY = 'hatchfield.lodScale'

export function suggestLodScale(input: LodTuneInput): number {
  if (
    Number.isNaN(input.fps) ||
    Number.isNaN(input.drawCalls) ||
    Number.isNaN(input.triangles) ||
    Number.isNaN(input.currentScale)
  ) {
    return Number.isNaN(input.currentScale) ? 1.0 : input.currentScale
  }

  let nextScale = input.currentScale

  if (input.fps < 25 || input.drawCalls > 4000) {
    nextScale += 0.05
  } else if (input.fps > 50 && input.drawCalls < 1500) {
    nextScale -= 0.05
  }

  // Ensure precision to avoid floating point errors (e.g., 1.0500000000000005)
  nextScale = Math.round(nextScale * 100) / 100

  return Math.min(1.8, Math.max(0.6, nextScale))
}

export function formatLodAdvice(input: LodTuneInput): string {
  const suggested = suggestLodScale(input)
  return `LOD scale: ${input.currentScale.toFixed(2)} (suggested ${suggested.toFixed(2)})`
}

export function loadLodScale(storage: Storage): number {
  const val = storage.getItem(STORAGE_KEY)
  if (!val) return 1.0
  const num = parseFloat(val)
  return Number.isNaN(num) ? 1.0 : num
}

export function saveLodScale(storage: Storage, scale: number): void {
  storage.setItem(STORAGE_KEY, scale.toString())
}

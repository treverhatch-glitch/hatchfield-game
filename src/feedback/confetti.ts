import { CONFETTI_COLORS, FEEDBACK } from './config.ts'

export interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  w: number
  h: number
  color: string
  life: number
  max: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A burst in normalized screen space (0–1). Rendering is a separate pass. */
export function burstConfetti(count: number = FEEDBACK.confettiCount, seed = 1): ConfettiPiece[] {
  const rand = mulberry32(seed || 1)
  const pieces: ConfettiPiece[] = []
  for (let i = 0; i < count; i++) {
    const life = FEEDBACK.confettiLifeSec * (0.65 + rand() * 0.5)
    pieces.push({
      x: 0.15 + rand() * 0.7,
      y: 0.08 + rand() * 0.12,
      vx: (rand() - 0.5) * 0.45,
      vy: 0.15 + rand() * 0.35,
      rot: rand() * Math.PI,
      spin: (rand() - 0.5) * 8,
      w: 0.006 + rand() * 0.008,
      h: 0.012 + rand() * 0.014,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      life,
      max: life,
    })
  }
  return pieces
}

export function stepConfetti(pieces: readonly ConfettiPiece[], dt: number): ConfettiPiece[] {
  const step = Math.max(0, Math.min(0.05, dt))
  const out: ConfettiPiece[] = []
  for (const piece of pieces) {
    const life = piece.life - step
    if (life <= 0) continue
    out.push({
      ...piece,
      x: piece.x + piece.vx * step,
      y: piece.y + piece.vy * step,
      vy: piece.vy + 0.35 * step,
      rot: piece.rot + piece.spin * step,
      life,
    })
  }
  return out
}

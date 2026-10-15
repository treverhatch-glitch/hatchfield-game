import type { Body, BodyOverlap, BodySource } from './types.ts'

/**
 * Separating-axis depth of two oriented rectangles, metres.
 * Positive is how far they overlap; zero or less means they are apart by that much.
 */
export function penetration(a: Body, b: Body): number {
  const ax = Math.cos(a.heading)
  const ay = Math.sin(a.heading)
  const bx = Math.cos(b.heading)
  const by = Math.sin(b.heading)
  const dx = b.x - a.x
  const dy = b.y - a.y
  let least = Infinity
  for (const [nx, ny] of [
    [ax, ay],
    [-ay, ax],
    [bx, by],
    [-by, bx],
  ]) {
    const ra = a.halfLength * Math.abs(ax * nx + ay * ny) + a.halfWidth * Math.abs(-ay * nx + ax * ny)
    const rb = b.halfLength * Math.abs(bx * nx + by * ny) + b.halfWidth * Math.abs(-by * nx + bx * ny)
    least = Math.min(least, ra + rb - Math.abs(dx * nx + dy * ny))
  }
  return least
}

function reach(body: Body): number {
  return Math.hypot(body.halfLength, body.halfWidth)
}

/**
 * Every registered body, read fresh from its source on each call.
 * Sources keep their own motion; the list is where they see each other.
 */
export class BodyList {
  private sources = new Map<string, BodySource>()

  constructor(sources: readonly BodySource[] = []) {
    for (const source of sources) this.register(source)
  }

  /** Adds a source, replacing one with the same owner. Returns the unregister call. */
  register(source: BodySource): () => void {
    this.sources.set(source.bodyOwner, source)
    return () => {
      if (this.sources.get(source.bodyOwner) === source) this.sources.delete(source.bodyOwner)
    }
  }

  owners(): string[] {
    return [...this.sources.keys()]
  }

  all(): Body[] {
    const out: Body[] = []
    for (const source of this.sources.values()) out.push(...source.bodies())
    return out
  }

  /** Bodies whose outline may reach within `radius` metres of (x, y). */
  near(x: number, y: number, radius: number, exceptId?: string): Body[] {
    return this.all().filter((body) => body.id !== exceptId && Math.hypot(body.x - x, body.y - y) <= radius + reach(body))
  }

  /** Pairs that overlap by more than `tolerance` metres, deepest first. */
  overlaps(tolerance = 0): BodyOverlap[] {
    const bodies = this.all()
    const out: BodyOverlap[] = []
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        if (Math.hypot(b.x - a.x, b.y - a.y) > reach(a) + reach(b)) continue
        const depth = penetration(a, b)
        if (depth > tolerance) out.push({ a, b, depth })
      }
    }
    return out.sort((p, q) => q.depth - p.depth)
  }
}

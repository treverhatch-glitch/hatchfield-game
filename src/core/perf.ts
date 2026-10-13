/**
 * Cheap per-subsystem frame timing. Off by default; the QA bot (or a dev in the console)
 * turns it on with `window.__perf.enabled = true` and reads `window.__perf.report()`.
 *
 *   const t0 = perfStart()
 *   ...work...
 *   perfEnd('world.render', t0)
 *
 * No closures and no allocation per span, so it can stay wired into hot loops.
 */

interface Bucket {
  ms: number
  n: number
  max: number
}

export const perf = {
  enabled: false,
  /** Profiling only: block on gl.finish() so `*.gl` spans include GPU-process raster time. */
  syncGpu: false,
  frames: 0,
  since: 0,
  buckets: new Map<string, Bucket>(),
  reset() {
    this.buckets.clear()
    this.frames = 0
    this.since = performance.now()
  },
  /** ms per frame for each span, sorted by cost. */
  report() {
    const frames = Math.max(1, this.frames)
    const wall = performance.now() - this.since
    const rows = [...this.buckets].map(([label, b]) => ({
      label,
      msPerFrame: Math.round((b.ms / frames) * 100) / 100,
      calls: b.n,
      maxMs: Math.round(b.max * 10) / 10,
    }))
    rows.sort((a, b) => b.msPerFrame - a.msPerFrame)
    return { frames, wallMs: Math.round(wall), fps: Math.round((frames * 10000) / Math.max(1, wall)) / 10, rows }
  },
}

export function perfStart(): number {
  return perf.enabled ? performance.now() : 0
}

export function perfEnd(label: string, t0: number) {
  if (!perf.enabled) return
  const d = performance.now() - t0
  let b = perf.buckets.get(label)
  if (!b) {
    b = { ms: 0, n: 0, max: 0 }
    perf.buckets.set(label, b)
  }
  b.ms += d
  b.n++
  if (d > b.max) b.max = d
}

/** Call once per rendered frame (the apron or hall loop). */
export function perfFrame() {
  if (perf.enabled) perf.frames++
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __perf?: typeof perf }).__perf = perf
}

/**
 * Plain-data snapshot of `renderer.info`, for the debug overlay and the benchmark script.
 * Kept free of DOM so it is unit-testable.
 */
import type * as THREE from 'three'

export interface RenderStats {
  drawCalls: number
  triangles: number
  lines: number
  points: number
  geometries: number
  textures: number
  /** Rough GPU texture memory in MB, from the material maps found in the scene. */
  textureMB: number
}

/** Mip chain adds a third on top of the base level. */
const MIP_FACTOR = 4 / 3

/** Bytes for one RGBA8 texture of this size, with mips. */
export function textureBytes(width: number, height: number, mipmaps = true): number {
  const base = Math.max(0, width) * Math.max(0, height) * 4
  return Math.round(mipmaps ? base * MIP_FACTOR : base)
}

type TexLike = { isTexture?: boolean; image?: { width?: number; height?: number } | null; generateMipmaps?: boolean }

/** Estimate texture memory by walking the scene's material maps once. */
export function sceneTextureMB(scene: THREE.Object3D): number {
  const seen = new Set<unknown>()
  let bytes = 0
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!mat) return
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      for (const v of Object.values(m)) {
        const t = v as TexLike | null
        if (!t || !t.isTexture || seen.has(t)) continue
        seen.add(t)
        bytes += textureBytes(t.image?.width ?? 0, t.image?.height ?? 0, t.generateMipmaps !== false)
      }
    }
  })
  return bytes / (1024 * 1024)
}

export function readRenderStats(renderer: THREE.WebGLRenderer, scene?: THREE.Object3D): RenderStats {
  const i = renderer.info
  return {
    drawCalls: i.render.calls,
    triangles: i.render.triangles,
    lines: i.render.lines,
    points: i.render.points,
    geometries: i.memory.geometries,
    textures: i.memory.textures,
    textureMB: scene ? Math.round(sceneTextureMB(scene) * 10) / 10 : 0,
  }
}

/** Smoothed fps / frame-time over a sliding window of frame deltas. */
export class FrameMeter {
  private deltas: number[] = []
  private readonly size: number
  constructor(size = 120) {
    this.size = size
  }

  push(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return
    this.deltas.push(dtMs)
    if (this.deltas.length > this.size) this.deltas.shift()
  }

  get fps(): number {
    if (this.deltas.length === 0) return 0
    const sum = this.deltas.reduce((a, b) => a + b, 0)
    return (this.deltas.length * 1000) / sum
  }

  /** Frame time at the given percentile (0.99 = the slow 1% frames). */
  percentileMs(p: number): number {
    if (this.deltas.length === 0) return 0
    const sorted = [...this.deltas].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  }

  reset() {
    this.deltas.length = 0
  }
}

export interface EntityCounts {
  passengers: number
  vehicles: number
  aircraft: number
}

export function formatStats(fps: number, p99Ms: number, s: RenderStats): string {
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
  const frameMs = fps > 0 ? 1000 / fps : 0
  return [
    `${fps.toFixed(0)} fps  ${frameMs.toFixed(1)} ms  (p99 ${p99Ms.toFixed(1)} ms)`,
    `draws ${s.drawCalls}   tris ${k(s.triangles)}`,
    `geos ${s.geometries}   tex ${s.textures} (~${s.textureMB} MB)`,
  ].join('\n')
}

/** Passengers, vehicles, aircraft, and the last sim tick. Rendering does not compute these. */
export function formatEntities(e: EntityCounts, simMs: number): string {
  return `pax ${e.passengers}   vehicles ${e.vehicles}   aircraft ${e.aircraft}\nsim ${simMs.toFixed(1)} ms`
}

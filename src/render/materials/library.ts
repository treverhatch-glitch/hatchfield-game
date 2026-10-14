/**
 * Shared surface maps. Procedural canvas (or a DataTexture of the same pixels
 * when there is no document) until a PNG from public/textures/ loads.
 */
import * as THREE from 'three'
import { paintSurface, surfacePngUrl, type SurfaceKind } from './paint'

export type { SurfaceKind } from './paint'
export { SURFACE_FILES, surfacePngUrl } from './paint'

const KINDS: SurfaceKind[] = ['floor', 'wall', 'wood']

export interface TextureLoad {
  load(
    url: string,
    onLoad: (tex: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void
}

function finish(tex: THREE.Texture, repeat: boolean) {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  if (!repeat) {
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
  }
  tex.needsUpdate = true
  return tex
}

/** Canvas when the page has one; the same pixels as a data texture in tests. */
export function surfaceTexture(kind: SurfaceKind, size = 128): THREE.Texture {
  const pixels = paintSurface(kind, size)
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const img = ctx.createImageData(size, size)
      img.data.set(pixels)
      ctx.putImageData(img, 0, 0)
      const tex = new THREE.CanvasTexture(canvas)
      return finish(tex, true)
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
  return finish(tex, true)
}

type Mapped = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial

/**
 * One library per terminal (or hall). Materials that display a surface are
 * watched, so a later PNG replaces the procedural map in place.
 */
export class SurfaceLibrary {
  readonly maps: Record<SurfaceKind, THREE.Texture>
  private readonly made = new Map<string, THREE.Material>()
  private readonly watched = new Set<Mapped>()

  constructor(size = 128) {
    this.maps = {
      floor: surfaceTexture('floor', size),
      wall: surfaceTexture('wall', size),
      wood: surfaceTexture('wood', size),
    }
  }

  /** Shared Lambert (or basic) material. Same key returns the same instance. */
  material(key: string, color: number, surface?: SurfaceKind, basic = false): THREE.Material {
    const id = `${key}|${color.toString(16)}|${surface ?? ''}|${basic ? 'b' : 'l'}`
    const hit = this.made.get(id)
    if (hit) return hit
    const map = surface ? this.maps[surface] : undefined
    const mat = basic
      ? new THREE.MeshBasicMaterial({ color, map })
      : new THREE.MeshLambertMaterial({ color, map })
    this.made.set(id, mat)
    if (surface) this.watch(mat)
    return mat
  }

  /** Keep `mat.map` current when a PNG replaces the procedural surface. */
  watch(mat: THREE.Material) {
    if ('map' in mat) this.watched.add(mat as Mapped)
  }

  unwatch(mat: THREE.Material) {
    this.watched.delete(mat as Mapped)
  }

  /** Swap one surface. Materials already showing the old map follow. */
  useMap(kind: SurfaceKind, tex: THREE.Texture) {
    const prev = this.maps[kind]
    if (prev === tex) return
    finish(tex, true)
    this.maps[kind] = tex
    for (const mat of this.made.values()) {
      const mapped = mat as Mapped
      if (mapped.map === prev) {
        mapped.map = tex
        mapped.needsUpdate = true
      }
    }
    for (const mat of this.watched) {
      if (mat.map === prev) {
        mat.map = tex
        mat.needsUpdate = true
      }
    }
    prev.dispose()
  }

  /**
   * Try floor.png, wall.png and wood.png. A missing file keeps the procedural map.
   * Pass a loader in tests; the browser uses TextureLoader.
   */
  loadPngs(root = '/textures', loader?: TextureLoad) {
    const load = loader ?? (typeof document === 'undefined' ? null : new THREE.TextureLoader())
    if (!load) return
    for (const kind of KINDS) {
      load.load(
        surfacePngUrl(kind, root),
        (tex) => this.useMap(kind, tex),
        undefined,
        () => {
          /* procedural map stays */
        },
      )
    }
  }

  dispose() {
    for (const tex of Object.values(this.maps)) tex.dispose()
    for (const mat of this.made.values()) mat.dispose()
    this.made.clear()
    this.watched.clear()
  }
}

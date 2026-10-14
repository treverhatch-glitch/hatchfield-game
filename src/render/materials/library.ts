/**
 * Shared surface maps. Procedural canvas (or a DataTexture of the same pixels
 * when there is no document) until a PNG from public/textures/ loads.
 */
import * as THREE from 'three'
import { PACK1_DIR, PACK1_REPEAT_M, pack1Edge, pack1Url, packWorldRepeat, tileByPosition, type Pack1File } from './pack1'
import { paintSurface, surfacePngUrl, type SurfaceKind } from './paint'
import { QUALITY, type QualityLevel } from '../world/quality'

export type { SurfaceKind } from './paint'
export { SURFACE_FILES, surfacePngUrl } from './paint'
export { pack1Edge, pack1Url, PACK1_FILES } from './pack1'

/** Procedural floor / wall / wood, plus the rest of texture pack 1. */
export type LibraryMap = SurfaceKind | 'carpet' | 'glass' | 'steel' | 'fabric' | 'shop'

const PROCEDURAL: SurfaceKind[] = ['floor', 'wall', 'wood']

const PACK_ONTO: Record<Pack1File, LibraryMap> = {
  wall: 'wall',
  glass: 'glass',
  oak: 'wood',
  steel: 'steel',
  rubber: 'floor',
  shopWood: 'shop',
  fabric: 'fabric',
  carpet: 'carpet',
}

const REPEAT_M: Record<LibraryMap, number> = {
  floor: PACK1_REPEAT_M.rubber,
  wall: PACK1_REPEAT_M.wall,
  wood: PACK1_REPEAT_M.oak,
  carpet: PACK1_REPEAT_M.carpet,
  glass: PACK1_REPEAT_M.glass,
  steel: PACK1_REPEAT_M.steel,
  fabric: PACK1_REPEAT_M.fabric,
  shop: PACK1_REPEAT_M.shopWood,
}

const FLAT: Record<Exclude<LibraryMap, SurfaceKind>, [number, number, number]> = {
  carpet: [28, 42, 74],
  glass: [156, 196, 210],
  steel: [168, 172, 176],
  fabric: [32, 44, 78],
  shop: [96, 68, 42],
}

export interface TextureLoad {
  load(
    url: string,
    onLoad: (tex: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void
}

function finish(tex: THREE.Texture, repeat: boolean, anisotropy = 4) {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = anisotropy
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
function flatTexture(rgb: [number, number, number]): THREE.Texture {
  const data = new Uint8Array([rgb[0], rgb[1], rgb[2], 255])
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  return finish(tex, true)
}

export class SurfaceLibrary {
  readonly maps: Record<LibraryMap, THREE.Texture>
  private readonly made = new Map<string, THREE.Material>()
  private readonly watched = new Set<Mapped>()

  constructor(size = 128) {
    this.maps = {
      floor: surfaceTexture('floor', size),
      wall: surfaceTexture('wall', size),
      wood: surfaceTexture('wood', size),
      carpet: flatTexture(FLAT.carpet),
      glass: flatTexture(FLAT.glass),
      steel: flatTexture(FLAT.steel),
      fabric: flatTexture(FLAT.fabric),
      shop: flatTexture(FLAT.shop),
    }
  }

  /** One copy of this map, in apron world units. */
  repeatFor(kind: LibraryMap): number {
    return packWorldRepeat(REPEAT_M[kind])
  }

  /** Shared Lambert (or basic) material. Same key returns the same instance. */
  material(key: string, color: number, surface?: LibraryMap, basic = false): THREE.Material {
    const id = `${key}|${color.toString(16)}|${surface ?? ''}|${basic ? 'b' : 'l'}`
    const hit = this.made.get(id)
    if (hit) return hit
    const map = surface ? this.maps[surface] : undefined
    const mat = basic
      ? new THREE.MeshBasicMaterial({ color, map })
      : new THREE.MeshLambertMaterial({ color, map })
    this.made.set(id, mat)
    if (surface) {
      tileByPosition(mat, this.repeatFor(surface))
      this.watch(mat)
    }
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
  useMap(kind: LibraryMap, tex: THREE.Texture, anisotropy = 4) {
    const prev = this.maps[kind]
    if (prev === tex) return
    finish(tex, true, anisotropy)
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
    for (const kind of PROCEDURAL) {
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

  /**
   * Texture pack 1. High keeps each JPEG at its own size. Med and low draw
   * a smaller copy (256 and 128) and leave the file on disk untouched.
   */
  loadPack1(level: QualityLevel = 'high', root = PACK1_DIR, loader?: TextureLoad) {
    const load = loader ?? (typeof document === 'undefined' ? null : new THREE.TextureLoader())
    if (!load) return
    const edge = pack1Edge(level)
    const anisotropy = QUALITY[level].anisotropy
    for (const file of Object.keys(PACK_ONTO) as Pack1File[]) {
      const kind = PACK_ONTO[file]
      load.load(
        pack1Url(file, root),
        (tex) => {
          const img = tex.image as { width?: number; height?: number } | undefined
          const w = img?.width ?? 0
          if (edge && w > edge && typeof document !== 'undefined') {
            const canvas = document.createElement('canvas')
            canvas.width = edge
            canvas.height = edge
            const ctx = canvas.getContext('2d')
            if (ctx) ctx.drawImage(tex.image as CanvasImageSource, 0, 0, edge, edge)
            const small = new THREE.CanvasTexture(canvas)
            tex.dispose()
            this.useMap(kind, small, anisotropy)
            return
          }
          this.useMap(kind, tex, anisotropy)
        },
        undefined,
        () => {
          /* procedural or flat map stays */
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

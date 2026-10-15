/**
 * Shared surface maps. Procedural canvas (or a DataTexture of the same pixels
 * when there is no document) until a PNG from public/textures/ loads.
 */
import * as THREE from 'three'
import { INTERIOR_FLOOR_FILES } from '../terminalProps/interiorTex'
import { PACK1_DIR, PACK1_REPEAT_M, pack1Edge, pack1Url, packWorldRepeat, tileByPosition, type Pack1File } from './pack1'
import { AIRLINE_LOGOS, BRAND_LOGO, PACK4_DIR, PACK4_FILES, PACK4_REPEAT_M, pack4Edge, pack4Url, type Pack4File } from './pack4'
import { paintSurface, surfacePngUrl, type SurfaceKind } from './paint'
import { drawRosterMark, rosterMarkEdge, ROSTER } from './rosterMarks'
import { QUALITY, type QualityLevel } from '../world/quality'

export type { SurfaceKind } from './paint'
export { SURFACE_FILES, surfacePngUrl } from './paint'
export { pack1Edge, pack1Url, PACK1_FILES } from './pack1'

/** Procedural floor / wall / wood, plus the rest of texture pack 1. */
export type LibraryMap =
  | SurfaceKind
  | 'carpet'
  | 'glass'
  | 'steel'
  | 'fabric'
  | 'shop'
  | 'terrazzo'
  | 'carpetGrey'
  | 'ceiling'
  | 'granite'
  | 'rubber'
  | 'lane'
  | 'plank'

const PROCEDURAL: SurfaceKind[] = ['floor', 'wall', 'wood']

const PACK_ONTO: Record<Pack1File, LibraryMap> = {
  wall: 'wall',
  glass: 'glass',
  oak: 'wood',
  steel: 'steel',
  rubber: 'rubber',
  shopWood: 'shop',
  fabric: 'fabric',
  carpet: 'carpet',
}

const REPEAT_M: Record<LibraryMap, number> = {
  floor: 2.4,
  wall: PACK1_REPEAT_M.wall,
  wood: PACK1_REPEAT_M.oak,
  carpet: PACK1_REPEAT_M.carpet,
  glass: PACK1_REPEAT_M.glass,
  steel: PACK1_REPEAT_M.steel,
  fabric: PACK1_REPEAT_M.fabric,
  shop: PACK1_REPEAT_M.shopWood,
  terrazzo: PACK4_REPEAT_M.terrazzo,
  carpetGrey: PACK4_REPEAT_M.carpetGrey,
  ceiling: PACK4_REPEAT_M.ceiling,
  granite: PACK4_REPEAT_M.granite,
  rubber: PACK1_REPEAT_M.rubber,
  lane: PACK1_REPEAT_M.rubber,
  plank: PACK1_REPEAT_M.shopWood,
}

const PACK4_ONTO: Record<Pack4File, LibraryMap> = {
  terrazzo: 'terrazzo',
  carpetGrey: 'carpetGrey',
  ceiling: 'ceiling',
  granite: 'granite',
}

const FLAT: Record<Exclude<LibraryMap, SurfaceKind>, [number, number, number]> = {
  carpet: [28, 42, 74],
  glass: [156, 196, 210],
  steel: [168, 172, 176],
  fabric: [32, 44, 78],
  shop: [96, 68, 42],
  terrazzo: [214, 210, 200],
  carpetGrey: [150, 148, 142],
  ceiling: [232, 232, 228],
  granite: [36, 38, 40],
  rubber: [21, 23, 26],
  lane: [214, 198, 170],
  plank: [226, 208, 182],
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

type LogoWait = { mat: THREE.MeshBasicMaterial; slot: number }
type LogoListen = { slot: number; fn: (image: CanvasImageSource) => void }

export class SurfaceLibrary {
  readonly maps: Record<LibraryMap, THREE.Texture>
  /** Photographed catalog marks. Slot -1 on a waiter is the Hatchfield brand. */
  readonly airline: THREE.Texture[]
  /** One canvas mark per roster airline, in roster order. */
  readonly roster: THREE.Texture[]
  brand: THREE.Texture
  private readonly made = new Map<string, THREE.Material>()
  private readonly watched = new Set<Mapped>()
  private readonly logoWait: LogoWait[] = []
  private readonly logoListen: LogoListen[] = []

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
      terrazzo: flatTexture(FLAT.terrazzo),
      carpetGrey: flatTexture(FLAT.carpetGrey),
      ceiling: flatTexture(FLAT.ceiling),
      granite: flatTexture(FLAT.granite),
      rubber: flatTexture(FLAT.rubber),
      lane: flatTexture(FLAT.lane),
      plank: flatTexture(FLAT.plank),
    }
    const blank = () => flatTexture([255, 255, 255])
    this.airline = AIRLINE_LOGOS.map(() => blank())
    this.brand = blank()
    this.roster = ROSTER.map((airline) => this.makeRosterMark(airline))
  }

  private makeRosterMark(airline: (typeof ROSTER)[number]): THREE.Texture {
    const n = Number.parseInt(airline.primary.replace('#', ''), 16)
    const rgb: [number, number, number] = Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [40, 44, 48]
    if (typeof document === 'undefined') return flatTexture(rgb)
    const edge = rosterMarkEdge()
    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const ctx = canvas.getContext('2d')
    if (!ctx) return flatTexture(rgb)
    drawRosterMark(ctx, edge, airline)
    return finish(new THREE.CanvasTexture(canvas), false, 8)
  }

  /** Roster mark for desk fascias and gate boards. Slot wraps the full roster. */
  rosterMaterial(slot: number): THREE.MeshBasicMaterial {
    const index = ((slot % this.roster.length) + this.roster.length) % this.roster.length
    return new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.roster[index], toneMapped: false, side: THREE.FrontSide })
  }

  /** Fires now when that roster mark is already a readable canvas. */
  onRosterLogo(slot: number, fn: (image: CanvasImageSource) => void) {
    const index = ((slot % this.roster.length) + this.roster.length) % this.roster.length
    const image = this.roster[index].image as CanvasImageSource & { width?: number }
    if ((image?.width ?? 0) > 32) fn(image)
  }

  /** Backlit airline mark. The map fills in when the JPEG arrives. */
  logoMaterial(slot: number): THREE.MeshBasicMaterial {
    const index = ((slot % this.airline.length) + this.airline.length) % this.airline.length
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.airline[index], toneMapped: false, side: THREE.FrontSide })
    this.logoWait.push({ mat, slot: index })
    return mat
  }

  /**
   * Fires when that airline JPEG is on the GPU, including a call now if it
   * already arrived. Gate boards use this to paint the mark onto the sign.
   */
  onLogo(slot: number, fn: (image: CanvasImageSource) => void) {
    const index = ((slot % this.airline.length) + this.airline.length) % this.airline.length
    const image = this.airline[index].image as CanvasImageSource & { width?: number }
    if ((image?.width ?? 0) > 32) fn(image)
    this.logoListen.push({ slot: index, fn })
  }

  /** Hatchfield mark for the facade and anywhere else the airport name is a sign. */
  brandMaterial(): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.brand, toneMapped: false, side: THREE.FrontSide })
    this.logoWait.push({ mat, slot: -1 })
    return mat
  }

  releaseLogo(mat: THREE.Material) {
    const i = this.logoWait.findIndex((w) => w.mat === mat)
    if (i >= 0) this.logoWait.splice(i, 1)
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

  /**
   * Pack 4 tiles plus the airline and Hatchfield marks. High keeps each file
   * at its own size. Med and low draw 256 and 128 copies.
   */
  loadPack4(level: QualityLevel = 'high', root = PACK4_DIR, loader?: TextureLoad) {
    const load = loader ?? (typeof document === 'undefined' ? null : new THREE.TextureLoader())
    if (!load) return
    const edge = pack4Edge(level)
    const anisotropy = QUALITY[level].anisotropy
    for (const file of Object.keys(PACK4_ONTO) as Pack4File[]) {
      this.loadScaled(load, pack4Url(PACK4_FILES[file], root), edge, anisotropy, (tex) => this.useMap(PACK4_ONTO[file], tex, anisotropy))
    }
    AIRLINE_LOGOS.forEach((file, index) => {
      this.loadScaled(load, pack4Url(file, root), edge, anisotropy, (tex) => this.useLogo(index, tex, anisotropy))
    })
    this.loadScaled(load, pack4Url(BRAND_LOGO, root), edge, anisotropy, (tex) => this.useLogo(-1, tex, anisotropy))
  }

  /**
   * Security rubber and shop planks. These stay off the pack-1 rubber and shop
   * slots so belts and shelves keep their own maps. High keeps 2048 and the
   * GPU builds the mip chain.
   */
  loadInteriorFloors(level: QualityLevel = 'high', loader?: TextureLoad) {
    const load = loader ?? (typeof document === 'undefined' ? null : new THREE.TextureLoader())
    if (!load) return
    const edge = pack1Edge(level)
    const anisotropy = QUALITY[level].anisotropy
    const floors: [LibraryMap, string][] = [
      ['lane', INTERIOR_FLOOR_FILES.lane],
      ['plank', INTERIOR_FLOOR_FILES.plank],
    ]
    for (const [kind, file] of floors) {
      this.loadScaled(load, `/${file}`, edge, anisotropy, (tex) => this.useMap(kind, tex, anisotropy))
    }
  }

  private loadScaled(
    load: TextureLoad,
    url: string,
    edge: number | null,
    anisotropy: number,
    apply: (tex: THREE.Texture) => void,
  ) {
    load.load(
      url,
      (tex) => {
        const img = tex.image as { width?: number } | undefined
        const w = img?.width ?? 0
        if (edge && w > edge && typeof document !== 'undefined') {
          const canvas = document.createElement('canvas')
          canvas.width = edge
          canvas.height = edge
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.drawImage(tex.image as CanvasImageSource, 0, 0, edge, edge)
          const small = new THREE.CanvasTexture(canvas)
          tex.dispose()
          small.anisotropy = anisotropy
          apply(small)
          return
        }
        tex.anisotropy = anisotropy
        apply(tex)
      },
      undefined,
      () => {
        /* placeholder stays */
      },
    )
  }

  private useLogo(slot: number, tex: THREE.Texture, anisotropy: number) {
    finish(tex, false, anisotropy)
    const prev = slot < 0 ? this.brand : this.airline[slot]
    if (slot < 0) this.brand = tex
    else this.airline[slot] = tex
    for (const wait of this.logoWait) {
      if (wait.slot !== slot) continue
      wait.mat.map = tex
      wait.mat.needsUpdate = true
    }
    const image = tex.image as (CanvasImageSource & { width?: number }) | undefined
    if (image && (image.width ?? 0) > 32) {
      for (const listen of this.logoListen) {
        if (listen.slot === slot) listen.fn(image)
      }
    }
    if (prev && prev !== tex) prev.dispose()
  }

  dispose() {
    for (const tex of Object.values(this.maps)) tex.dispose()
    for (const tex of this.airline) tex.dispose()
    for (const tex of this.roster) tex.dispose()
    this.brand.dispose()
    this.logoWait.length = 0
    this.logoListen.length = 0
    for (const mat of this.made.values()) mat.dispose()
    this.made.clear()
    this.watched.clear()
  }
}

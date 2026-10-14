/**
 * Build-menu item pictures. Each placeable is rendered once from its real in-game
 * prop (World#building) with a small shared offscreen WebGLRenderer, three-quarter
 * angle, soft light, transparent background, then cached as a data URL per item id.
 * Work starts only when a menu asks for a thumb, and is drip-fed one item per idle
 * slot so it never competes with play frames. No mesh → callers keep their glyph.
 */
import { useEffect, useState } from 'react'
import type * as THREE_NS from 'three'
import { BUILDINGS } from '../game/catalog'
import { hasModel } from '../build/models'
import type { Tile } from '../game/types'

export const THUMB_PX = 256 // rendered at 2x+ the tray size so icons stay crisp on HiDPI

/** Tool/item id → world tile, for tools whose BuildDef tile differs or is missing. */
const TOOL_TILE: Record<string, Tile | 'runway_strip' | 'apron' | 'taxi_strip'> = {
  runway_short: 'runway_strip',
  runway: 'runway_strip',
  runway_heavy: 'runway_strip',
  taxi: 'taxi_strip',
  premade: 'terminal',
  stand_s: 'apron',
  stand: 'apron',
  stand_w: 'apron',
  stand_l: 'apron',
}

/** Commissioned capstones without their own model borrow a family look. */
const PROGRESSION_TILE: Record<string, string> = {
  prefab_ii: 'terminal',
  checkin_hall: 'terminal',
  security_hall: 'remote_screening',
  concourse: 'terminal',
  pier_ii: 'terminal',
  satellite: 'terminal',
  prestige_landmark: 'terminal',
  code_e: 'apron',
  code_f: 'apron',
}

export function tileForItem(id: string): string | null {
  if (TOOL_TILE[id]) return TOOL_TILE[id]
  if (hasModel(id)) return id
  if (PROGRESSION_TILE[id]) return PROGRESSION_TILE[id]
  const def = BUILDINGS.find((b) => b.tool === id)
  return def ? def.tile : null
}

type Entry = string | null // data URL, or null = no mesh (use glyph)
const cache = new Map<string, Entry>()
const waiters = new Map<string, Set<(v: Entry) => void>>()
const queue: string[] = []
let pumping = false

type Kit = {
  THREE: typeof THREE_NS
  renderer: THREE_NS.WebGLRenderer
  scene: THREE_NS.Scene
  camera: THREE_NS.PerspectiveCamera
  build: (tile: string) => THREE_NS.Object3D | null
}
let kitP: Promise<Kit | null> | null = null

function loadKit(): Promise<Kit | null> {
  kitP ??= (async () => {
    try {
      const THREE = await import('three')
      const { World } = await import('../render/world')
      const { buildModel } = await import('../build/models')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = THUMB_PX
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
      renderer.setPixelRatio(1)
      renderer.setSize(THUMB_PX, THUMB_PX, false)
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
      const scene = new THREE.Scene()
      // Studio rig: sky/ground fill, warm key from camera-left, cool rim from behind.
      scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x6b6253, 1.5))
      const key = new THREE.DirectionalLight(0xfff1dc, 2.4)
      key.position.set(-4, 10, 8)
      const rim = new THREE.DirectionalLight(0xbcd6ff, 1.4)
      rim.position.set(-6, 5, -9)
      const fill = new THREE.DirectionalLight(0xffffff, 0.6)
      fill.position.set(9, 3, 2)
      scene.add(key, rim, fill)
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500)
      // Borrow the live prop builder without constructing a World (no canvas/scene side effects).
      const proto = Object.create(World.prototype) as InstanceType<typeof World>
      const build = (tile: string): THREE_NS.Object3D | null => {
        if (tile === 'runway_strip' || tile === 'apron' || tile === 'taxi_strip') return slab(THREE, tile)
        const own = buildModel(tile)
        if (own) return own
        const g = proto.building(tile as Tile, new THREE.Vector3())
        return g.children.length ? g : null
      }
      return { THREE, renderer, scene, camera, build }
    } catch {
      return null
    }
  })()
  return kitP
}

/** Ground pieces live in merged surface meshes, so give them a matching slab. */
function slab(THREE: typeof THREE_NS, kind: 'runway_strip' | 'apron' | 'taxi_strip'): THREE_NS.Object3D {
  const g = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(kind === 'apron' ? 18 : 30, 0.4, 18),
    new THREE.MeshStandardMaterial({ color: kind === 'apron' ? '#8d9196' : '#3b3e44', roughness: 0.85 }),
  )
  g.add(base)
  const paint = new THREE.MeshStandardMaterial({ color: kind === 'apron' ? '#e7c24a' : '#eef1f4' })
  if (kind === 'taxi_strip') {
    const line = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: '#e7c24a' }))
    line.position.y = 0.22
    g.add(line)
  } else if (kind === 'runway_strip') {
    for (let i = -2; i <= 2; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.6), paint)
      dash.position.set(i * 5.5, 0.22, 0)
      g.add(dash)
    }
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.3, 6, 32), paint)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.22
    const lead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 9), paint)
    lead.position.set(0, 0.22, 4.5)
    g.add(ring, lead)
  }
  return g
}

function renderOne(kit: Kit, id: string): Entry {
  const tile = tileForItem(id)
  if (!tile) return null
  let obj: THREE_NS.Object3D | null = null
  try {
    obj = kit.build(tile)
  } catch {
    obj = null
  }
  if (!obj) return null
  const { THREE, scene, camera, renderer } = kit
  scene.add(obj)
  const box = new THREE.Box3().setFromObject(obj)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  // Soft contact shadow so the prop sits on something.
  const shadow = contactShadow(THREE, box)
  scene.add(shadow)
  const r = Math.max(sphere.radius, 0.5)
  const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92
  const dir = new THREE.Vector3(1, 0.85, 1.15).normalize()
  camera.position.copy(sphere.center).addScaledVector(dir, dist)
  camera.lookAt(sphere.center)
  camera.near = dist / 50
  camera.far = dist * 4
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj, shadow)
  shadow.geometry.dispose()
  ;(shadow.material as THREE_NS.Material).dispose()
  obj.traverse((o) => {
    const m = o as THREE_NS.Mesh
    m.geometry?.dispose?.()
  })
  return url
}

let shadowTex: THREE_NS.Texture | null = null
function contactShadow(THREE: typeof THREE_NS, box: THREE_NS.Box3): THREE_NS.Mesh {
  if (!shadowTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
      g.addColorStop(0, 'rgba(0,0,0,0.55)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 64, 64)
    }
    shadowTex = new THREE.CanvasTexture(c)
  }
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const geo = new THREE.PlaneGeometry(size.x * 1.5 + 0.4, size.z * 1.5 + 0.4)
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }),
  )
  mesh.position.set(center.x, box.min.y + 0.005, center.z)
  mesh.renderOrder = -1
  return mesh
}

function idle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (ric) ric(fn, { timeout: 200 })
  else setTimeout(fn, 16)
}

async function pump() {
  if (pumping) return
  pumping = true
  const kit = await loadKit()
  const step = () => {
    const id = queue.shift()
    if (id === undefined) {
      pumping = false
      return
    }
    const v = kit ? renderOne(kit, id) : null
    cache.set(id, v)
    waiters.get(id)?.forEach((cb) => cb(v))
    waiters.delete(id)
    idle(step)
  }
  idle(step)
}

/** Request a thumb; resolves from cache immediately when ready. */
export function requestThumb(id: string, cb: (v: Entry) => void): () => void {
  if (cache.has(id)) {
    cb(cache.get(id) ?? null)
    return () => {}
  }
  if (!tileForItem(id)) {
    cache.set(id, null)
    cb(null)
    return () => {}
  }
  let set = waiters.get(id)
  if (!set) {
    set = new Set()
    waiters.set(id, set)
    queue.push(id)
  }
  set.add(cb)
  void pump()
  return () => set.delete(cb)
}

/** Data URL for an item's picture, or null while pending / when no mesh exists. */
export function useItemThumb(id: string): string | null {
  const [url, setUrl] = useState<string | null>(() => cache.get(id) ?? null)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    return requestThumb(id, setUrl)
  }, [id])
  return url
}

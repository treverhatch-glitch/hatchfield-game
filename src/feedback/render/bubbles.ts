/**
 * Thought icons as instanced quads. One mesh per icon, slots handed out by a
 * pool that resets every frame, so the buffers never grow.
 */
import * as THREE from 'three'
import { InstancePool } from '../../people/pool.ts'
import type { ThoughtIcon } from '../types.ts'

export interface BubbleDraw {
  id: string
  icon: ThoughtIcon
  x: number
  y: number
  z: number
}

export interface BubbleLayerOptions {
  /** Slots per icon mesh. Extra bubbles are counted as overflow and not drawn. */
  capacity?: number
  /** World units per metre. Bubble size and head height scale with it. */
  unit?: number
  /** Metres above the feet. */
  head?: number
  /** Icon width in metres. */
  width?: number
}

export interface BubbleStats {
  drawn: number
  overflow: number
  drawCalls: number
}

const ICONS: readonly ThoughtIcon[] = ['queue', 'prices', 'delight']

/**
 * Feet height for a bubble. The instanced quad then rises by `head`.
 * A closed roof hides the hall, so the icon sits just above the roof instead.
 */
export function bubbleAnchorY(floorY: number, roofY: number, roofOn: boolean, head: number, unit: number): number {
  if (!roofOn) return floorY
  return roofY + 0.55 * unit - head * unit
}

const ICON_RGB: Record<ThoughtIcon, [number, number, number]> = {
  queue: [240, 193, 74],
  prices: [224, 87, 74],
  delight: [125, 206, 160],
}

export class ThoughtBubbleLayer {
  readonly group = new THREE.Group()
  readonly capacity: number
  private readonly pool: InstancePool
  private readonly meshes = new Map<ThoughtIcon, THREE.InstancedMesh>()
  private readonly dummy = new THREE.Object3D()
  private readonly unit: number
  private readonly head: number
  private readonly width: number

  constructor(parent: THREE.Object3D, options: BubbleLayerOptions = {}) {
    this.capacity = options.capacity ?? 8
    this.unit = options.unit ?? 1
    this.head = options.head ?? 2.2
    this.width = options.width ?? 1.15
    this.pool = new InstancePool(this.capacity)
    this.group.name = 'feedback-thoughts'
    const geo = new THREE.PlaneGeometry(1, 1)
    for (const icon of ICONS) {
      const mesh = new THREE.InstancedMesh(geo, iconMaterial(icon), this.capacity)
      mesh.name = `feedback-bubble-${icon}`
      mesh.count = 0
      mesh.frustumCulled = false
      mesh.renderOrder = 12
      this.meshes.set(icon, mesh)
      this.group.add(mesh)
    }
    parent.add(this.group)
  }

  /** Place the current bubbles. Call with the same capacity every frame. */
  sync(bubbles: readonly BubbleDraw[], camera?: THREE.Camera | null): BubbleStats {
    this.pool.reset()
    const size = this.width * this.unit
    const lift = this.head * this.unit
    if (camera) this.dummy.quaternion.copy(camera.quaternion)
    else this.dummy.quaternion.identity()
    this.dummy.scale.set(size, size, 1)
    for (const bubble of bubbles) {
      const slot = this.pool.take(bubble.icon)
      if (slot < 0) continue
      const mesh = this.meshes.get(bubble.icon)
      if (!mesh) continue
      this.dummy.position.set(bubble.x, bubble.y + lift, bubble.z)
      this.dummy.updateMatrix()
      mesh.setMatrixAt(slot, this.dummy.matrix)
    }
    let drawCalls = 0
    for (const icon of ICONS) {
      const mesh = this.meshes.get(icon)
      if (!mesh) continue
      const count = this.pool.count(icon)
      mesh.count = count
      if (count > 0) {
        mesh.instanceMatrix.needsUpdate = true
        drawCalls += 1
      }
    }
    return { drawn: bubbles.length - this.pool.overflow(), overflow: this.pool.overflow(), drawCalls }
  }

  clear(): void {
    this.sync([])
  }

  mesh(icon: ThoughtIcon): THREE.InstancedMesh | undefined {
    return this.meshes.get(icon)
  }

  /** Instance buffer length. Stays put as bubbles come and go. */
  bufferLength(icon: ThoughtIcon): number {
    return this.meshes.get(icon)?.instanceMatrix.array.length ?? 0
  }

  dispose(): void {
    const geo = this.meshes.get('queue')?.geometry
    for (const mesh of this.meshes.values()) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (mat instanceof THREE.MeshBasicMaterial) mat.map?.dispose()
        mat.dispose()
      }
    }
    geo?.dispose()
    this.group.removeFromParent()
    this.meshes.clear()
  }
}

function iconMaterial(icon: ThoughtIcon): THREE.Material {
  const map = iconTexture(icon)
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}

function iconTexture(icon: ThoughtIcon): THREE.Texture {
  if (typeof document === 'undefined') {
    const [r, g, b] = ICON_RGB[icon]
    const data = new Uint8Array([r, g, b, 230])
    const tex = new THREE.DataTexture(data, 1, 1)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    const tex = new THREE.Texture()
    return tex
  }
  const [r, gch, b] = ICON_RGB[icon]
  g.clearRect(0, 0, size, size)
  const mix = (channel: number) => Math.round(channel * 0.42 + 255 * 0.58)
  g.fillStyle = `rgba(${mix(r)},${mix(gch)},${mix(b)},0.96)`
  g.strokeStyle = `rgb(${r},${gch},${b})`
  g.lineWidth = 10
  g.beginPath()
  g.roundRect(10, 8, 108, 86, 28)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(48, 94)
  g.lineTo(62, 118)
  g.lineTo(78, 94)
  g.closePath()
  g.fill()
  g.stroke()
  drawGlyph(g, icon, r, gch, b)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function drawGlyph(g: CanvasRenderingContext2D, icon: ThoughtIcon, r: number, gc: number, b: number): void {
  g.strokeStyle = `rgb(${r},${gc},${b})`
  g.fillStyle = `rgb(${r},${gc},${b})`
  g.lineWidth = 6
  g.lineCap = 'round'
  if (icon === 'queue') {
    for (let i = 0; i < 3; i++) {
      const x = 34 + i * 24
      g.beginPath()
      g.arc(x, 36, 7, 0, Math.PI * 2)
      g.fill()
      g.fillRect(x - 6, 48, 12, 22)
    }
    return
  }
  if (icon === 'prices') {
    g.beginPath()
    g.arc(64, 48, 22, 0, Math.PI * 2)
    g.stroke()
    g.font = '700 28px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$', 64, 50)
    return
  }
  g.beginPath()
  g.arc(64, 48, 22, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(56, 44, 2.5, 0, Math.PI * 2)
  g.arc(72, 44, 2.5, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.arc(64, 52, 10, 0.15 * Math.PI, 0.85 * Math.PI)
  g.stroke()
}

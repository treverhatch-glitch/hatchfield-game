/**
 * A colour plate and a small code badge. No new mesh family: a box and a plane.
 * Apron marks use cell-scale spans. Hall marks use metres.
 */
import * as THREE from 'three'

export interface LeaseMark {
  key: string
  x: number
  y: number
  z: number
  primary: string
  code: string
  lay: 'flat' | 'upright'
  span: number
  kind?: string
  id?: string
}

const badgeTex = new Map<string, THREE.Texture>()

function badgeTexture(code: string, primary: string): THREE.Texture | null {
  const cacheKey = `${primary}|${code}`
  const hit = badgeTex.get(cacheKey)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = primary
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = primary
  ctx.font = 'bold 36px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(code.slice(0, 4), 64, 66)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  badgeTex.set(cacheKey, tex)
  return tex
}

function paint(mark: LeaseMark): THREE.Group {
  const group = new THREE.Group()
  group.name = `lease-mark:${mark.key}`
  const plate = new THREE.Mesh(
    mark.lay === 'flat'
      ? new THREE.BoxGeometry(mark.span, Math.max(0.04, mark.span * 0.04), mark.span * 0.62)
      : new THREE.BoxGeometry(mark.span, mark.span * 0.55, 0.04),
    new THREE.MeshBasicMaterial({ color: mark.primary, toneMapped: false }),
  )
  plate.name = 'lease-plate'
  plate.position.y = mark.lay === 'flat' ? 0 : mark.span * 0.3
  const tex = badgeTexture(mark.code, mark.primary)
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(mark.span * 0.28, mark.span * 0.28),
    new THREE.MeshBasicMaterial({ map: tex ?? null, color: tex ? '#ffffff' : mark.primary, transparent: true, toneMapped: false }),
  )
  badge.name = 'lease-badge'
  badge.position.y = mark.lay === 'flat' ? mark.span * 0.08 : mark.span * 0.72
  if (mark.lay === 'flat') badge.rotation.x = -Math.PI / 2
  const badgeMat = badge.material as THREE.Material
  badgeMat.userData.shared = true
  group.add(plate, badge)
  return group
}

function applyData(group: THREE.Group, mark: LeaseMark) {
  group.position.set(mark.x, mark.y, mark.z)
  group.userData.assignKind = mark.kind ?? ''
  group.userData.assignId = mark.id ?? ''
  group.userData.primary = mark.primary
  const plate = group.getObjectByName('lease-plate') as THREE.Mesh | undefined
  const mat = plate?.material as THREE.MeshBasicMaterial | undefined
  if (mat && mat.color.getStyle() !== new THREE.Color(mark.primary).getStyle()) mat.color.set(mark.primary)
}

/** Keep one group per key. Positions update every frame. New keys build a plate. */
export function syncLeaseMarks(root: THREE.Group, marks: readonly LeaseMark[]) {
  const live = new Set(marks.map((mark) => mark.key))
  for (const child of [...root.children]) {
    if (!live.has(child.name.slice('lease-mark:'.length))) {
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose()
        const mat = mesh.material as THREE.Material | undefined
        if (mat && !mat.userData.shared) mat.dispose()
      })
      root.remove(child)
    }
  }
  for (const mark of marks) {
    let group = root.getObjectByName(`lease-mark:${mark.key}`) as THREE.Group | undefined
    if (!group) {
      group = paint(mark)
      root.add(group)
    }
    applyData(group, mark)
  }
}

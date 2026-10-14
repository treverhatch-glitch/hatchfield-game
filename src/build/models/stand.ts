/** Stand ghost: a cheap aircraft-at-stand silhouette sized to the stand box. */
import * as THREE from 'three'

/**
 * Fuselage + swept wings + tailplane + fin, nose toward -length/2 (local -x when
 * alongX). `span`/`length` in world units; returns a group centred on the stand.
 */
export function standAircraftGhost(length: number, span: number, mat: THREE.Material, alongX: boolean): THREE.Group {
  const g = new THREE.Group()
  const L = length * 0.86
  const S = span * 0.9
  const r = Math.max(0.35, L * 0.055)
  const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - 2 * r, 6, 12), mat)
  fuse.rotation.z = Math.PI / 2
  fuse.position.y = r + 0.6
  g.add(fuse)
  const wing = new THREE.Shape()
  wing.moveTo(0, 0)
  wing.lineTo(S / 2, -L * 0.16)
  wing.lineTo(S / 2, -L * 0.23)
  wing.lineTo(0, -L * 0.2)
  wing.lineTo(-S / 2, -L * 0.23)
  wing.lineTo(-S / 2, -L * 0.16)
  wing.closePath()
  const wg = new THREE.ExtrudeGeometry(wing, { depth: r * 0.18, bevelEnabled: false })
  wg.rotateX(-Math.PI / 2)
  // Shape y → world -z after rotation; swap so wings span across z and sweep along +x.
  wg.rotateY(Math.PI / 2)
  const wings = new THREE.Mesh(wg, mat)
  wings.position.set(-L * 0.06, r * 0.7 + 0.6, 0)
  g.add(wings)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.08, r * 0.15, S * 0.32), mat)
  tail.position.set(L * 0.44, r * 1.4 + 0.6, 0)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, r * 2.6, r * 0.18), mat)
  fin.position.set(L * 0.43, r * 2.4 + 0.6, 0)
  fin.rotation.z = -0.35
  for (const z of [-S * 0.2, S * 0.2]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, L * 0.12, 10), mat)
    eng.rotation.z = Math.PI / 2
    eng.position.set(-L * 0.12, 0.6 + r * 0.2, z)
    g.add(eng)
  }
  g.add(tail, fin)
  g.name = 'stand-aircraft-ghost'
  if (!alongX) g.rotation.y = Math.PI / 2
  return g
}

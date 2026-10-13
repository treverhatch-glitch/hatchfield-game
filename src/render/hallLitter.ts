/**
 * Litter decals and janitor pawns in the hall view. Sizes are real meters.
 * Decals are one InstancedMesh; janitors are a handful of pooled meshes.
 */
import * as THREE from 'three'
import type { Game } from '../game/sim'
import { HALL_D, HALL_W } from '../game/terminal'
import type { LitterSpot } from '../game/litter'

const MAX_DECALS = 512
const decalGeo = new THREE.BoxGeometry(0.32, 0.015, 0.22)
const decalMat = new THREE.MeshLambertMaterial({ color: '#e6dcc2' })
const janitorGeo = new THREE.CapsuleGeometry(0.22, 0.55, 3, 6)
const janitorMat = new THREE.MeshLambertMaterial({ color: '#2f8a5a' })
const mopGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5)
const mopMat = new THREE.MeshLambertMaterial({ color: '#c8b070' })

function spin(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h >>> 0) % 628) / 100
}

export class HallLitterLayer {
  group = new THREE.Group()
  private decals = new THREE.InstancedMesh(decalGeo, decalMat, MAX_DECALS)
  private hash = ''
  private janitors: THREE.Mesh[] = []
  private tmp = new THREE.Matrix4()
  private quat = new THREE.Quaternion()
  private up = new THREE.Vector3(0, 1, 0)
  private one = new THREE.Vector3(1, 1, 1)

  constructor() {
    this.decals.count = 0
    this.decals.frustumCulled = false
    this.group.add(this.decals)
  }

  sync(game: Game, cols: number, rows: number) {
    const fit = game.activeHall()
    const litter = (fit?.litter ?? []) as LitterSpot[]
    const cw = HALL_W / Math.max(1, cols)
    const rh = HALL_D / Math.max(1, rows)
    const hash = `${cols}x${rows}|${litter.length}|${litter[0]?.id ?? ''}|${litter[litter.length - 1]?.id ?? ''}`
    if (hash !== this.hash) {
      this.hash = hash
      const n = Math.min(MAX_DECALS, litter.length)
      for (let i = 0; i < n; i++) {
        const s = litter[i]
        this.quat.setFromAxisAngle(this.up, spin(s.id))
        this.tmp.compose(
          new THREE.Vector3(
            -HALL_W / 2 + (s.c + 0.5 + s.ox) * cw,
            0.08,
            -HALL_D / 2 + (s.r + 0.5 + s.oz) * rh,
          ),
          this.quat,
          this.one,
        )
        this.decals.setMatrixAt(i, this.tmp)
      }
      this.decals.count = n
      this.decals.instanceMatrix.needsUpdate = true
    }

    const key = fit ? game.hallKey(fit) : ''
    const here = game.hallJanitors.filter((j) => j.hallId === key)
    while (this.janitors.length < here.length) {
      const body = new THREE.Mesh(janitorGeo, janitorMat)
      const mop = new THREE.Mesh(mopGeo, mopMat)
      mop.position.set(0.34, 0, 0.1)
      mop.rotation.z = 0.35
      body.add(mop)
      this.group.add(body)
      this.janitors.push(body)
    }
    this.janitors.forEach((mesh, i) => {
      const j = here[i]
      mesh.visible = Boolean(j)
      if (!j) return
      mesh.position.set(-HALL_W / 2 + j.x * cw, 0.55, -HALL_D / 2 + j.z * rh)
    })
  }

  dispose() {
    this.decals.dispose()
    this.group.clear()
    this.janitors = []
  }
}

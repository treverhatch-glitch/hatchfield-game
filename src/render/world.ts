import * as THREE from 'three'
import { AIRLINES } from '../game/catalog'
import { inBounds } from '../game/path'
import type { Game } from '../game/sim'
import { SIZE } from '../game/types'
import type { Tile, Vec } from '../game/types'

export const CELL = 6.2

export function toWorld(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (c - (SIZE - 1) / 2) * CELL,
    y,
    (r - (SIZE - 1) / 2) * CELL,
  )
}

function makeTex(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  paint(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function grassTex() {
  return makeTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3f8a4a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#4b9854' : i % 3 === 1 ? '#357844' : '#468b4f'
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1 + Math.random() * 2)
    }
  })
}

function runwayTex() {
  return makeTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3a3d45'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#32353c'
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)
    ctx.strokeStyle = '#f4f6f8'
    ctx.lineWidth = 5
    ctx.setLineDash([18, 16])
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#f4f6f8'
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(8 + i * 6, 10, 3, 14)
      ctx.fillRect(8 + i * 6, h - 24, 3, 14)
    }
  })
}

function taxiTex() {
  return makeTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9cdd4'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d8dde4'
    ctx.strokeRect(1, 1, w - 2, h - 2)
    ctx.strokeStyle = '#e4c44a'
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, w - 16, h - 16)
  })
}

function standTex() {
  return makeTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b7bcc6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#e8edf4'
    ctx.lineWidth = 4
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.fillStyle = '#f3c14a'
    ctx.fillRect(w / 2 - 4, 18, 8, h - 36)
  })
}

export class World {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot = new THREE.Vector3(0, 0, 0)
  yaw = 0.72
  pitch = 0.92
  dist = 88
  dragging: 'orbit' | 'pan' | 'pending' | 'paint' | null = null
  lastX = 0
  lastY = 0
  downX = 0
  downY = 0
  tilesGroup = new THREE.Group()
  entGroup = new THREE.Group()
  ghostGroup = new THREE.Group()
  tileHash = ''
  jets = new Map<string, THREE.Group>()
  trucks = new Map<string, THREE.Mesh>()
  people = new Map<string, THREE.Mesh>()
  ray = new THREE.Raycaster()
  ndc = new THREE.Vector2()
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  hit = new THREE.Vector3()
  sun: THREE.DirectionalLight
  onHover: (v: Vec | null) => void = () => {}
  onClick: (v: Vec, shift: boolean) => void = () => {}
  getTool: () => string = () => 'pan'
  lastPaint: Vec | null = null
  private grassM: THREE.MeshLambertMaterial
  private rwM: THREE.MeshLambertMaterial
  private taxiM: THREE.MeshLambertMaterial
  private standM: THREE.MeshLambertMaterial

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87b7d9')
    this.scene.fog = new THREE.Fog('#9fc5dd', 80, 240)

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500)
    this.placeCam()

    const hemi = new THREE.HemisphereLight('#e8f3ff', '#6b8a4a', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#fff3d4', 1.35)
    this.sun.position.set(40, 70, 18)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 10
    this.sun.shadow.camera.far = 180
    this.sun.shadow.camera.left = -70
    this.sun.shadow.camera.right = 70
    this.sun.shadow.camera.top = 70
    this.sun.shadow.camera.bottom = -70
    this.scene.add(this.sun)
    this.scene.add(new THREE.AmbientLight('#b9c9a8', 0.22))

    const earth = new THREE.Mesh(
      new THREE.CircleGeometry(220, 48),
      new THREE.MeshLambertMaterial({ color: '#2d5a34' }),
    )
    earth.rotation.x = -Math.PI / 2
    earth.position.y = -0.08
    earth.receiveShadow = true
    this.scene.add(earth)

    this.grassM = new THREE.MeshLambertMaterial({ map: grassTex() })
    this.rwM = new THREE.MeshLambertMaterial({ map: runwayTex() })
    this.taxiM = new THREE.MeshLambertMaterial({ map: taxiTex() })
    this.standM = new THREE.MeshLambertMaterial({ map: standTex() })

    this.scene.add(this.tilesGroup)
    this.scene.add(this.entGroup)
    this.scene.add(this.ghostGroup)
    this.addPlotFence()
    this.addHorizon()
    this.bind(canvas)
  }

  addPlotFence() {
    const e = (SIZE * CELL) / 2
    const pts = [
      new THREE.Vector3(-e, 0.25, -e),
      new THREE.Vector3(e, 0.25, -e),
      new THREE.Vector3(e, 0.25, e),
      new THREE.Vector3(-e, 0.25, e),
      new THREE.Vector3(-e, 0.25, -e),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    this.scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#e6c85a' })))
  }

  addHorizon() {
    const g = new THREE.CircleGeometry(200, 40)
    const m = new THREE.MeshBasicMaterial({
      color: '#cfe4f2',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
    const disc = new THREE.Mesh(g, m)
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.02
    this.scene.add(disc)
  }

  bind(canvas: HTMLCanvasElement) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('pointerdown', (e) => {
      const tool = this.getTool()
      if (e.button === 2) this.dragging = 'orbit'
      else if (e.button === 0 && tool !== 'pan') this.dragging = 'paint'
      else if (e.button === 0) this.dragging = 'pending'
      else this.dragging = 'orbit'
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.downX = e.clientX
      this.downY = e.clientY
      this.lastPaint = null
      if (this.dragging === 'paint') {
        const v = this.pick(e)
        if (v) {
          this.lastPaint = v
          this.onClick(v, false)
        }
      }
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', (e) => {
      const v = this.pick(e)
      this.onHover(v)
      if (!this.dragging) return
      if (this.dragging === 'paint') return
      if (this.dragging === 'pending') {
        const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
        if (dist < 8) return
        this.dragging = e.shiftKey ? 'orbit' : 'pan'
      }
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
      if (this.dragging === 'orbit') {
        this.yaw -= dx * 0.007
        this.pitch = clamp(this.pitch - dy * 0.005, 0.28, 1.35)
        this.placeCam()
      } else if (this.dragging === 'pan') {
        const right = new THREE.Vector3()
        this.camera.getWorldDirection(right)
        const forward = right.clone()
        right.cross(this.camera.up).normalize()
        forward.y = 0
        forward.normalize()
        this.pivot.addScaledVector(right, -dx * 0.08)
        this.pivot.addScaledVector(forward, dy * 0.08)
        this.placeCam()
      }
    })
    canvas.addEventListener('pointerup', (e) => {
      const was = this.dragging
      this.dragging = null
      if (was === 'pending' && e.button === 0) {
        const v = this.pick(e)
        if (v) this.onClick(v, e.shiftKey)
      }
      this.lastPaint = null
    })
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.dist = clamp(this.dist + e.deltaY * 0.06, 28, 160)
      this.placeCam()
    }, { passive: false })
  }

  pick(e: PointerEvent | MouseEvent): Vec | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.ray.setFromCamera(this.ndc, this.camera)
    const ok = this.ray.ray.intersectPlane(this.ground, this.hit)
    if (!ok) return null
    const c = Math.round(this.hit.x / CELL + (SIZE - 1) / 2)
    const r = Math.round(this.hit.z / CELL + (SIZE - 1) / 2)
    if (c < -1 || r < -1 || c > SIZE || r > SIZE) return null
    return {
      c: clamp(c, 0, SIZE - 1),
      r: clamp(r, 0, SIZE - 1),
    }
  }

  placeCam() {
    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist
    const y = Math.sin(this.pitch) * this.dist
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist
    this.camera.position.set(this.pivot.x + x, y, this.pivot.z + z)
    this.camera.lookAt(this.pivot)
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / Math.max(1, h)
      this.camera.updateProjectionMatrix()
    }
  }

  rebuildTiles(game: Game) {
    const hash = game.tiles.flat().join('')
    if (hash === this.tileHash) return
    this.tileHash = hash
    this.tilesGroup.clear()
    const geo = new THREE.PlaneGeometry(CELL * 0.98, CELL * 0.98)
    geo.rotateX(-Math.PI / 2)
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const tile = game.tiles[r][c]
        const pos = toWorld(c, r, 0.02)
        if (tile === 'grass') {
          const mesh = new THREE.Mesh(geo, this.grassM)
          mesh.position.copy(pos)
          mesh.receiveShadow = true
          this.tilesGroup.add(mesh)
          continue
        }
        if (tile === 'runway' || tile === 'taxi' || tile === 'stand') {
          const mat = tile === 'runway' ? this.rwM : tile === 'taxi' ? this.taxiM : this.standM
          const mesh = new THREE.Mesh(geo, mat)
          mesh.position.copy(pos)
          mesh.receiveShadow = true
          this.tilesGroup.add(mesh)
          continue
        }
        this.tilesGroup.add(this.building(tile, pos))
      }
    }
  }

  building(tile: Tile, pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group()
    g.position.copy(pos)
    if (tile === 'terminal') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.92, 3.4, CELL * 0.92),
        new THREE.MeshStandardMaterial({
          color: '#e8eef4',
          roughness: 0.42,
          metalness: 0.08,
        }),
      )
      body.position.y = 1.7
      body.castShadow = true
      body.receiveShadow = true
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 1.02, 0.18, CELL * 1.02),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.5 }),
      )
      roof.position.y = 3.5
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 1.1, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#7ec3e8',
          emissive: '#1a3a55',
          emissiveIntensity: 0.2,
          roughness: 0.12,
          metalness: 0.4,
        }),
      )
      glass.position.set(0, 1.6, CELL * 0.46)
      g.add(body, roof, glass)
    } else if (tile === 'snack') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 1.6, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#d9a441' }),
      )
      body.position.y = 0.8
      body.castShadow = true
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.85, 0.12, CELL * 0.5),
        new THREE.MeshStandardMaterial({ color: '#b33' }),
      )
      awning.position.set(0, 1.55, 0.6)
      g.add(body, awning)
    } else if (tile === 'bags') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 2.1, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#8a909a' }),
      )
      body.position.y = 1.05
      body.castShadow = true
      g.add(body)
    } else if (tile === 'fuel') {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.45, roughness: 0.35 }),
      )
      tank.position.y = 1.2
      tank.castShadow = true
      g.add(tank)
    }
    return g
  }

  makeJet(color: string, stripe: string): THREE.Group {
    const g = new THREE.Group()
    const fus = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 3.4, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.45 }),
    )
    fus.rotation.z = Math.PI / 2
    fus.castShadow = true
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.08, 1.05),
      new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.4 }),
    )
    wing.position.y = -0.05
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.1, 0.7),
      new THREE.MeshStandardMaterial({ color }),
    )
    tail.position.set(-1.7, 0.55, 0)
    const stab = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: stripe }),
    )
    stab.position.set(-1.65, 0.15, 0)
    const engL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.7, 10),
      new THREE.MeshStandardMaterial({ color: '#333' }),
    )
    engL.rotation.z = Math.PI / 2
    engL.position.set(0.2, -0.22, 1.15)
    const engR = engL.clone()
    engR.position.z = -1.15
    g.add(fus, wing, tail, stab, engL, engR)
    g.scale.setScalar(1.15)
    return g
  }

  syncGhost(game: Game) {
    this.ghostGroup.clear()
    const cells =
      game.tool === 'runway'
        ? game.ghostRunway(game.hover ?? game.runwayStart ?? { c: -1, r: -1 })
        : game.hover
          ? game.tool === 'terminal'
            ? [
                game.hover,
                { c: game.hover.c + 1, r: game.hover.r },
                { c: game.hover.c, r: game.hover.r + 1 },
                { c: game.hover.c + 1, r: game.hover.r + 1 },
              ]
            : [game.hover]
          : []
    const geo = new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95)
    geo.rotateX(-Math.PI / 2)
    const ok = new THREE.MeshBasicMaterial({
      color: '#7dff9a',
      transparent: true,
      opacity: 0.38,
    })
    const bad = new THREE.MeshBasicMaterial({
      color: '#ff6b6b',
      transparent: true,
      opacity: 0.38,
    })
    const runwayReady =
      game.tool === 'runway' &&
      cells.length > 1 &&
      cells.every((p) => inBounds(p.c, p.r) && game.tile(p) === 'grass')
    for (const p of cells) {
      if (p.c < 0) continue
      const t = game.tile(p)
      const clear = t === 'grass' || game.tool === 'clear'
      const ready = game.tool === 'runway' ? runwayReady : clear
      const mesh = new THREE.Mesh(geo, ready ? ok : bad)
      mesh.position.copy(toWorld(p.c, p.r, 0.12))
      this.ghostGroup.add(mesh)
    }
  }

  syncEntities(game: Game) {
    const seenJ = new Set<string>()
    for (const f of game.flights) {
      seenJ.add(f.id)
      let mesh = this.jets.get(f.id)
      if (!mesh) {
        const a = AIRLINES[f.airline]
        mesh = this.makeJet(a.color, a.stripe)
        this.jets.set(f.id, mesh)
        this.entGroup.add(mesh)
      }
      const p = toWorld(f.x, f.y, 0.55 + f.z * 1.15)
      mesh.position.copy(p)
      mesh.rotation.y = -f.heading
      mesh.rotation.x = f.phase === 'takeoff' || f.phase === 'approach' ? -0.12 : 0
      const sel = game.selectedFlight === f.id
      mesh.scale.setScalar(sel ? 1.22 : 1.15)
    }
    for (const [id, m] of this.jets) {
      if (!seenJ.has(id)) {
        this.entGroup.remove(m)
        this.jets.delete(id)
      }
    }

    const seenT = new Set<string>()
    const truckGeo = new THREE.BoxGeometry(1.1, 0.55, 0.7)
    for (const t of game.trucks) {
      seenT.add(t.id)
      let mesh = this.trucks.get(t.id)
      if (!mesh) {
        const color = t.kind === 'fuel' ? '#c9a227' : t.kind === 'bags' ? '#6b7280' : '#c45c26'
        mesh = new THREE.Mesh(
          truckGeo,
          new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
        )
        mesh.castShadow = true
        this.trucks.set(t.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(t.x, t.y, 0.4))
      mesh.rotation.y = -Math.atan2(
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.r ?? t.y) - t.y,
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.c ?? t.x) - t.x,
      )
    }
    for (const [id, m] of this.trucks) {
      if (!seenT.has(id)) {
        this.entGroup.remove(m)
        this.trucks.delete(id)
      }
    }

    const seenP = new Set<string>()
    const pgeo = new THREE.CapsuleGeometry(0.12, 0.34, 3, 6)
    for (const p of game.people) {
      seenP.add(p.id)
      let mesh = this.people.get(p.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          pgeo,
          new THREE.MeshLambertMaterial({ color: p.color }),
        )
        mesh.castShadow = true
        this.people.set(p.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(p.x, p.y, 0.4))
    }
    for (const [id, m] of this.people) {
      if (!seenP.has(id)) {
        this.entGroup.remove(m)
        this.people.delete(id)
      }
    }
  }

  render(game: Game) {
    this.resize()
    this.rebuildTiles(game)
    this.syncGhost(game)
    this.syncEntities(game)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.dispose()
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

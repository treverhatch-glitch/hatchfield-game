import * as THREE from 'three'
import { AIRFRAMES } from '../game/airframes'
import { inBounds } from '../game/path'
import type { Game } from '../game/sim'
import { SIZE } from '../game/types'
import type { HotelClass, ParkTerm, Tile, Vec } from '../game/types'

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
  // Three r18x: keep flipY off — avoids FLIP_Y / PREMULTIPLY_ALPHA upload warnings.
  tex.flipY = false
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
  ghostHash = ''
  jets = new Map<string, THREE.Group>()
  trucks = new Map<string, THREE.Object3D>()
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
  private liteMode = false
  private canvas: HTMLCanvasElement
  private grassM: THREE.MeshLambertMaterial
  private rwM: THREE.MeshLambertMaterial
  private taxiM: THREE.MeshLambertMaterial
  private standM: THREE.MeshLambertMaterial
  private onPointerDown!: (e: PointerEvent) => void
  private onPointerMove!: (e: PointerEvent) => void
  private onPointerUp!: (e: PointerEvent) => void
  private onWheel!: (e: WheelEvent) => void
  private onContextMenu!: (e: Event) => void
  /** True after pointerdown already stamped — blocks duplicate up/down fires. */
  private paintedThisGesture = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    // Cap DPR + shadows — software GL / cloud desktops hitch hard at 2× + 2k maps.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.BasicShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87b7d9')
    this.scene.fog = new THREE.Fog('#9fc5dd', 90, 220)

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500)
    this.placeCam()

    const hemi = new THREE.HemisphereLight('#e8f3ff', '#6b8a4a', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#fff3d4', 1.2)
    this.sun.position.set(40, 70, 18)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.near = 10
    this.sun.shadow.camera.far = 160
    this.sun.shadow.camera.left = -60
    this.sun.shadow.camera.right = 60
    this.sun.shadow.camera.top = 60
    this.sun.shadow.camera.bottom = -60
    this.scene.add(this.sun)
    this.scene.add(new THREE.AmbientLight('#b9c9a8', 0.28))

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
    this.onContextMenu = (e) => e.preventDefault()
    this.onPointerDown = (e: PointerEvent) => {
      const tool = this.getTool()
      this.paintedThisGesture = false
      // Middle (1) or right (2) = orbit. Left + build tool = one stamp. Left + select = click/pan.
      if (e.button === 1 || e.button === 2) this.dragging = 'orbit'
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
          this.paintedThisGesture = true
          this.onClick(v, false)
        }
      }
      canvas.setPointerCapture(e.pointerId)
    }
    this.onPointerMove = (e: PointerEvent) => {
      const v = this.pick(e)
      this.onHover(v)
      if (!this.dragging) return
      // Single-click stamps only — no drag-paint (prevents multi-place feel).
      if (this.dragging === 'paint') return
      if (this.dragging === 'pending') {
        const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
        if (dist < 8) return
        this.dragging = 'pan'
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
        this.nudgePan(-dx * 0.08, dy * 0.08)
      }
    }
    this.onPointerUp = (e: PointerEvent) => {
      const was = this.dragging
      this.dragging = null
      if (was === 'pending' && e.button === 0 && !this.paintedThisGesture) {
        const v = this.pick(e)
        if (v) this.onClick(v, e.shiftKey)
      }
      this.lastPaint = null
      this.paintedThisGesture = false
    }
    this.onWheel = (e: WheelEvent) => {
      e.preventDefault()
      this.dist = clamp(this.dist + e.deltaY * 0.06, 28, 160)
      this.placeCam()
    }
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** Keyboard / UI pan in camera-local ground plane. */
  nudgePan(rightAmt: number, forwardAmt: number) {
    const right = new THREE.Vector3()
    this.camera.getWorldDirection(right)
    const forward = right.clone()
    right.cross(this.camera.up).normalize()
    forward.y = 0
    forward.normalize()
    this.pivot.addScaledVector(right, rightAmt)
    this.pivot.addScaledVector(forward, forwardAmt)
    this.placeCam()
  }

  nudgeYaw(delta: number) {
    this.yaw += delta
    this.placeCam()
  }

  nudgeZoom(delta: number) {
    this.dist = clamp(this.dist + delta, 28, 160)
    this.placeCam()
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
    // Cheap revision check — avoid flattening 32² tiles into a string every frame.
    const hash = String(game.mapRev)
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
          if (tile === 'stand') {
            const cls = game.standClass[`${c},${r}`] ?? 'M'
            const tint =
              cls === 'S' ? '#6aae7a' : cls === 'L' ? '#c97816' : '#c9a227'
            const badge = new THREE.Mesh(
              new THREE.BoxGeometry(CELL * 0.22, 0.12, CELL * 0.22),
              new THREE.MeshStandardMaterial({
                color: tint,
                emissive: tint,
                emissiveIntensity: 0.15,
                roughness: 0.45,
              }),
            )
            badge.position.copy(pos)
            badge.position.y = 0.12
            badge.position.x += CELL * 0.28
            badge.position.z -= CELL * 0.28
            this.tilesGroup.add(badge)
            if (game.standAccessAt({ c, r }) === 'jetway') {
              const jw = new THREE.Mesh(
                new THREE.BoxGeometry(CELL * 0.55, 0.35, CELL * 0.12),
                new THREE.MeshStandardMaterial({
                  color: '#7ec3e8',
                  emissive: '#2a5570',
                  emissiveIntensity: 0.2,
                  roughness: 0.35,
                }),
              )
              jw.position.copy(pos)
              jw.position.y = 0.28
              jw.position.z += CELL * 0.35
              this.tilesGroup.add(jw)
            }
          }
          continue
        }
        const key = `${c},${r}`
        this.tilesGroup.add(
          this.building(tile, pos, {
            hotelClass: game.hotelClass[key],
            parkTerm: game.parkTerms[key],
          }),
        )
      }
    }
  }

  building(
    tile: Tile,
    pos: THREE.Vector3,
    opts: { hotelClass?: HotelClass; parkTerm?: ParkTerm } = {},
  ): THREE.Group {
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
    } else if (tile === 'belt') {
      // Low conveyor strip — distinct from taxi/road so broken chains read on the apron.
      const deck = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.42),
        new THREE.MeshLambertMaterial({ color: '#2a3238' }),
      )
      deck.rotation.x = -Math.PI / 2
      deck.position.y = 0.05
      deck.receiveShadow = true
      const railA = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.88, 0.08, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#5a4810',
          emissiveIntensity: 0.25,
          roughness: 0.45,
        }),
      )
      railA.position.set(0, 0.1, -CELL * 0.14)
      const railB = railA.clone()
      railB.position.z = CELL * 0.14
      const roller = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 0.06, CELL * 0.18),
        new THREE.MeshStandardMaterial({
          color: '#5a6a78',
          metalness: 0.35,
          roughness: 0.4,
        }),
      )
      roller.position.y = 0.09
      g.add(deck, railA, railB, roller)
    } else if (tile === 'fuel') {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.45, roughness: 0.35 }),
      )
      tank.position.y = 1.2
      tank.castShadow = true
      g.add(tank)
    } else if (tile === 'fire') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.75, 2.2, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#b33a2a' }),
      )
      body.position.y = 1.1
      body.castShadow = true
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.5, 1.1, 0.12),
        new THREE.MeshStandardMaterial({ color: '#f0c040' }),
      )
      bay.position.set(0, 0.9, CELL * 0.36)
      g.add(body, bay)
    } else if (tile === 'police') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 2.0, CELL * 0.65),
        new THREE.MeshStandardMaterial({ color: '#1e3a5f' }),
      )
      body.position.y = 1.0
      body.castShadow = true
      g.add(body)
    } else if (tile === 'cargo') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 2.6, CELL * 0.85),
        new THREE.MeshStandardMaterial({ color: '#6a6258' }),
      )
      body.position.y = 1.3
      body.castShadow = true
      g.add(body)
    } else if (tile === 'guard') {
      // City-edge booth — screens inbound trucks.
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 1.7, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#3d4a3a', roughness: 0.55 }),
      )
      booth.position.y = 0.85
      booth.castShadow = true
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.85, 0.1, 0.12),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#4a3a10',
          emissiveIntensity: 0.2,
        }),
      )
      bar.position.set(0, 1.15, CELL * 0.28)
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.35, 0.18),
        new THREE.MeshStandardMaterial({
          color: '#e8d080',
          emissive: '#8a7020',
          emissiveIntensity: 0.35,
        }),
      )
      lamp.position.set(0, 1.9, 0)
      g.add(booth, bar, lamp)
    } else if (tile === 'road') {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.98, CELL * 0.98),
        new THREE.MeshLambertMaterial({ color: '#3a3d42' }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.03
      mesh.receiveShadow = true
      g.add(mesh)
    } else if (tile === 'tower') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.9, 5.2, 8),
        new THREE.MeshStandardMaterial({ color: '#cfd8e3' }),
      )
      shaft.position.y = 2.6
      shaft.castShadow = true
      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.1, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a', metalness: 0.3 }),
      )
      cab.position.y = 5.4
      g.add(shaft, cab)
    } else if (tile === 'hangar') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.95, 3.2, CELL * 0.95),
        new THREE.MeshStandardMaterial({ color: '#7a8490' }),
      )
      body.position.y = 1.6
      body.castShadow = true
      g.add(body)
    } else if (tile === 'hotel') {
      this.addHotelBuilding(g, opts.hotelClass ?? 'business')
    } else if (
      tile === 'park_s' ||
      tile === 'park_l' ||
      tile === 'park_g' ||
      tile === 'park_u'
    ) {
      this.addParkBuilding(g, tile, opts.parkTerm ?? 'short')
    } else if (tile === 'helipad') {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(CELL * 0.42, CELL * 0.42, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.55 }),
      )
      pad.position.y = 0.08
      pad.receiveShadow = true
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(CELL * 0.32, 0.05, 8, 28),
        new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.16
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.08, 0.06, CELL * 0.42),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      bar.position.y = 0.16
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.42, 0.06, CELL * 0.08),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      cross.position.y = 0.16
      g.add(pad, ring, bar, cross)
    } else if (tile === 'deice') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#3a4a58' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 1.6, 12),
        new THREE.MeshStandardMaterial({
          color: '#4aa8c8',
          metalness: 0.35,
          roughness: 0.35,
        }),
      )
      tank.position.set(-CELL * 0.18, 0.85, 0)
      tank.castShadow = true
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.12, 0.18),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      boom.position.set(CELL * 0.12, 1.35, 0)
      const drip = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.55, 0.14),
        new THREE.MeshStandardMaterial({
          color: '#7ec8e0',
          emissive: '#2a6070',
          emissiveIntensity: 0.25,
        }),
      )
      drip.position.set(CELL * 0.32, 1.0, 0)
      g.add(pad, tank, boom, drip)
    } else if (tile === 'bus') {
      const curb = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.55),
        new THREE.MeshLambertMaterial({ color: '#3d4248' }),
      )
      curb.rotation.x = -Math.PI / 2
      curb.position.y = 0.05
      curb.receiveShadow = true
      const shelter = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 1.4, 0.35),
        new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.45 }),
      )
      shelter.position.set(0, 0.75, -CELL * 0.25)
      shelter.castShadow = true
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      pole.position.set(CELL * 0.28, 1.1, CELL * 0.1)
      g.add(curb, shelter, pole)
    } else if (tile === 'termbus') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#2c3338' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.75, 1.8, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#3d6a8a', roughness: 0.45 }),
      )
      shed.position.y = 0.95
      shed.castShadow = true
      const bus = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.7, CELL * 0.28),
        new THREE.MeshStandardMaterial({ color: '#e8c56a', roughness: 0.4 }),
      )
      bus.position.set(0, 0.45, CELL * 0.28)
      bus.castShadow = true
      g.add(pad, shed, bus)
    } else if (tile === 'rail') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#2a3238' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const hall = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 2.4, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#8a9aaa', roughness: 0.4 }),
      )
      hall.position.y = 1.2
      hall.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 0.12, CELL * 0.75),
        new THREE.MeshStandardMaterial({ color: '#c9a227' }),
      )
      canopy.position.y = 2.5
      g.add(pad, hall, canopy)
    }
    return g
  }

  /** Outside hotel grades — real buildings, not flat pads. */
  addHotelBuilding(g: THREE.Group, cls: HotelClass) {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.96, 0.18, CELL * 0.96),
      new THREE.MeshStandardMaterial({ color: '#6a6e76', roughness: 0.8 }),
    )
    plinth.position.y = 0.09
    plinth.receiveShadow = true
    g.add(plinth)

    if (cls === 'inn') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.82, 2.6, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#c9b08a', roughness: 0.55 }),
      )
      body.position.y = 1.45
      body.castShadow = true
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(CELL * 0.62, 1.1, 4),
        new THREE.MeshStandardMaterial({ color: '#6b3a2a', roughness: 0.65 }),
      )
      roof.position.y = 3.3
      roof.rotation.y = Math.PI / 4
      roof.castShadow = true
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.45, 0.1, CELL * 0.28),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a' }),
      )
      awning.position.set(0, 1.55, CELL * 0.38)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.1, 0.08),
        new THREE.MeshStandardMaterial({ color: '#3a2a1a' }),
      )
      door.position.set(0, 0.75, CELL * 0.36)
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.35, 0.28, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#6a5010',
          emissiveIntensity: 0.2,
        }),
      )
      sign.position.set(0, 2.35, CELL * 0.37)
      for (const dx of [-0.9, 0.9]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.06),
          new THREE.MeshStandardMaterial({
            color: '#7ec3e8',
            emissive: '#1a3a55',
            emissiveIntensity: 0.25,
            roughness: 0.15,
          }),
        )
        win.position.set(dx, 1.85, CELL * 0.36)
        g.add(win)
      }
      g.add(body, roof, awning, door, sign)
      return
    }

    if (cls === 'resort') {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.72, 7.2, CELL * 0.62),
        new THREE.MeshStandardMaterial({ color: '#d8e0e8', roughness: 0.35, metalness: 0.15 }),
      )
      tower.position.y = 3.7
      tower.castShadow = true
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.58, 5.8, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#5eb8d8',
          emissive: '#163848',
          emissiveIntensity: 0.3,
          roughness: 0.1,
          metalness: 0.45,
        }),
      )
      glass.position.set(0, 3.4, CELL * 0.32)
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.95, 2.2, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#b8c4ce', roughness: 0.45 }),
      )
      wing.position.set(0, 1.2, -CELL * 0.12)
      wing.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 0.12, CELL * 0.45),
        new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.3 }),
      )
      canopy.position.set(0, 2.4, CELL * 0.4)
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 0.45, CELL * 0.68),
        new THREE.MeshStandardMaterial({
          color: '#2f6f9a',
          emissive: '#1a3a55',
          emissiveIntensity: 0.15,
        }),
      )
      crown.position.y = 7.5
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      mast.position.y = 8.2
      g.add(tower, glass, wing, canopy, crown, mast)
      // Window grid on sides
      for (let floor = 0; floor < 5; floor++) {
        for (const side of [-1, 1] as const) {
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.45, 0.7),
            new THREE.MeshStandardMaterial({
              color: '#7ec3e8',
              emissive: '#1a3a55',
              emissiveIntensity: 0.2,
            }),
          )
          win.position.set(side * CELL * 0.37, 2.2 + floor * 1.05, 0)
          g.add(win)
        }
      }
      return
    }

    // Business mid-rise
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.86, 4.8, CELL * 0.74),
      new THREE.MeshStandardMaterial({ color: '#c4b49a', roughness: 0.5 }),
    )
    body.position.y = 2.5
    body.castShadow = true
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.92, 0.28, CELL * 0.8),
      new THREE.MeshStandardMaterial({ color: '#4a4038' }),
    )
    roof.position.y = 5.05
    const entry = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 1.6, CELL * 0.22),
      new THREE.MeshStandardMaterial({ color: '#8a9088', roughness: 0.4 }),
    )
    entry.position.set(0, 0.9, CELL * 0.42)
    entry.castShadow = true
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.62, 0.1, CELL * 0.35),
      new THREE.MeshStandardMaterial({ color: '#2f6f9a' }),
    )
    canopy.position.set(0, 1.85, CELL * 0.48)
    g.add(body, roof, entry, canopy)
    for (let floor = 0; floor < 3; floor++) {
      for (const dx of [-1.15, 0, 1.15]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.55, 0.06),
          new THREE.MeshStandardMaterial({
            color: '#7ec3e8',
            emissive: '#1a3a55',
            emissiveIntensity: 0.22,
            roughness: 0.12,
          }),
        )
        win.position.set(dx, 2.4 + floor * 0.95, CELL * 0.38)
        g.add(win)
      }
    }
  }

  /** Four park versions × short/long term paint — real buildings / structures. */
  addParkBuilding(
    g: THREE.Group,
    kind: 'park_s' | 'park_l' | 'park_g' | 'park_u',
    term: ParkTerm,
  ) {
    const accent = term === 'short' ? '#3a8fd4' : '#d4782a'
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
      new THREE.MeshLambertMaterial({
        color: kind === 'park_u' ? '#2a3038' : kind === 'park_g' ? '#3a4550' : '#3d4248',
      }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.03
    pad.receiveShadow = true
    g.add(pad)

    // Stall stripes on surface lots
    if (kind === 'park_s' || kind === 'park_l') {
      for (let i = 0; i < (kind === 'park_l' ? 5 : 3); i++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, CELL * 0.55),
          new THREE.MeshLambertMaterial({ color: '#e8eef4' }),
        )
        stripe.rotation.x = -Math.PI / 2
        stripe.position.set(-CELL * 0.28 + i * (kind === 'park_l' ? 0.55 : 0.7), 0.04, 0.15)
        g.add(stripe)
      }
    }

    if (kind === 'park_s') {
      // Small lot — ticket booth + boom arm
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.5, 1.1),
        new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.45 }),
      )
      booth.position.set(-CELL * 0.28, 0.85, -CELL * 0.28)
      booth.castShadow = true
      const boothRoof = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.15, 1.35),
        new THREE.MeshStandardMaterial({ color: accent }),
      )
      boothRoof.position.set(-CELL * 0.28, 1.7, -CELL * 0.28)
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#7ec3e8',
          emissive: '#1a3a55',
          emissiveIntensity: 0.2,
        }),
      )
      window.position.set(-CELL * 0.28, 1.05, -CELL * 0.28 + 0.56)
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: '#e8c44a' }),
      )
      boom.position.set(CELL * 0.05, 0.95, -CELL * 0.28)
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: '#c9c4b0' }),
      )
      pole.position.set(-CELL * 0.05, 0.55, -CELL * 0.28)
      g.add(booth, boothRoof, window, boom, pole)
      return
    }

    if (kind === 'park_l') {
      // Large lot — entry canopy building + dual lamps
      const office = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 2.2, CELL * 0.4),
        new THREE.MeshStandardMaterial({ color: '#b8c0c8', roughness: 0.5 }),
      )
      office.position.set(-CELL * 0.2, 1.2, -CELL * 0.28)
      office.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 0.14, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: accent, metalness: 0.25 }),
      )
      canopy.position.set(0.2, 2.45, -CELL * 0.1)
      canopy.castShadow = true
      const pillarL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 2.3, 8),
        new THREE.MeshStandardMaterial({ color: '#8a9098' }),
      )
      pillarL.position.set(-CELL * 0.25, 1.15, CELL * 0.12)
      const pillarR = pillarL.clone()
      pillarR.position.set(CELL * 0.35, 1.15, CELL * 0.12)
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.4, 0.35, 0.08),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.15,
        }),
      )
      sign.position.set(-CELL * 0.2, 2.0, -CELL * 0.08)
      for (const [x, z] of [
        [CELL * 0.32, CELL * 0.32],
        [-CELL * 0.32, CELL * 0.32],
      ] as const) {
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6),
          new THREE.MeshStandardMaterial({ color: '#c9c4b0' }),
        )
        lamp.position.set(x, 1.2, z)
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.12, 0.25),
          new THREE.MeshStandardMaterial({
            color: '#f0f4a8',
            emissive: '#a0a040',
            emissiveIntensity: 0.35,
          }),
        )
        head.position.set(x, 2.45, z)
        g.add(lamp, head)
      }
      g.add(office, canopy, pillarL, pillarR, sign)
      return
    }

    if (kind === 'park_g') {
      // Multi-level parking garage building
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.92, 4.6, CELL * 0.92),
        new THREE.MeshStandardMaterial({ color: '#7a8490', roughness: 0.65 }),
      )
      shell.position.y = 2.4
      shell.castShadow = true
      shell.receiveShadow = true
      g.add(shell)
      for (let floor = 0; floor < 4; floor++) {
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.94, 0.16, CELL * 0.94),
          new THREE.MeshStandardMaterial({ color: '#5a646e' }),
        )
        deck.position.y = 0.9 + floor * 1.15
        g.add(deck)
        // Open parking bays on front face
        for (const dx of [-1.2, 0, 1.2]) {
          const bay = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 0.75, 0.08),
            new THREE.MeshStandardMaterial({
              color: '#1a2028',
              roughness: 0.9,
            }),
          )
          bay.position.set(dx, 1.35 + floor * 1.15, CELL * 0.47)
          g.add(bay)
        }
      }
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.35, 0.2, CELL * 0.85),
        new THREE.MeshStandardMaterial({ color: '#4a5058' }),
      )
      ramp.position.set(CELL * 0.28, 0.55, 0)
      ramp.rotation.x = -0.35
      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.5, 0.4, 0.1),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.2,
        }),
      )
      badge.position.set(0, 5.0, CELL * 0.48)
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.96, 0.35, CELL * 0.96),
        new THREE.MeshStandardMaterial({ color: '#6a7480' }),
      )
      parapet.position.y = 4.85
      g.add(ramp, badge, parapet)
      return
    }

    // Underground — portal building + ramp into ground
    const portal = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.7, 2.8, CELL * 0.45),
      new THREE.MeshStandardMaterial({ color: '#8a949e', roughness: 0.45 }),
    )
    portal.position.set(0, 1.5, -CELL * 0.2)
    portal.castShadow = true
    const atrium = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 1.6, 0.08),
      new THREE.MeshStandardMaterial({
        color: '#5eb8d8',
        emissive: '#163848',
        emissiveIntensity: 0.25,
        roughness: 0.12,
        metalness: 0.4,
      }),
    )
    atrium.position.set(0, 1.7, -CELL * 0.2 + 0.24)
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.55, 1.4, CELL * 0.5),
      new THREE.MeshStandardMaterial({ color: '#1a2028', roughness: 0.9 }),
    )
    mouth.position.set(0, 0.75, CELL * 0.15)
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 0.18, CELL * 0.7),
      new THREE.MeshStandardMaterial({ color: '#3a4048' }),
    )
    ramp.position.set(0, 0.25, CELL * 0.2)
    ramp.rotation.x = 0.4
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.8, 0.2, CELL * 0.55),
      new THREE.MeshStandardMaterial({ color: accent }),
    )
    roof.position.set(0, 3.0, -CELL * 0.2)
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: '#5a6068' }),
    )
    vent.position.set(CELL * 0.28, 0.4, CELL * 0.28)
    g.add(portal, atrium, mouth, ramp, roof, vent)
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

  makeHelo(color: string, stripe: string): THREE.Group {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.4, 6, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35 }),
    )
    body.rotation.z = Math.PI / 2
    body.castShadow = true
    const cabin = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshStandardMaterial({
        color: stripe,
        roughness: 0.2,
        metalness: 0.25,
        transparent: true,
        opacity: 0.85,
      }),
    )
    cabin.position.set(0.55, 0.1, 0)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: '#333' }),
    )
    mast.position.set(0, 0.55, 0)
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.04, 0.18),
      new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.5 }),
    )
    rotor.position.set(0, 0.82, 0)
    rotor.name = 'rotor'
    const rotor2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 3.6),
      new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.5 }),
    )
    rotor2.position.set(0, 0.82, 0)
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color }),
    )
    tail.position.set(-1.2, 0.15, 0)
    const skidL = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: '#444' }),
    )
    skidL.position.set(0.1, -0.45, 0.35)
    const skidR = skidL.clone()
    skidR.position.z = -0.35
    g.add(body, cabin, mast, rotor, rotor2, tail, skidL, skidR)
    g.scale.setScalar(0.95)
    return g
  }

  /** Drop shadows / DPR while 5x fast-forward so the apron stays responsive. */
  applyPerfMode(game: Game) {
    const lite = game.speed >= 5
    if (lite === this.liteMode) return
    this.liteMode = lite
    this.renderer.shadowMap.enabled = !lite
    this.sun.castShadow = !lite
    this.renderer.setPixelRatio(
      lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.25),
    )
  }

  syncGhost(game: Game) {
    const h = game.hover
    const next = `${game.tool}|${game.facing}|${h ? `${h.c},${h.r}` : ''}|${game.mapRev}`
    if (next === this.ghostHash) return
    this.ghostHash = next
    this.clearGhost()
    const cells = game.ghostCells(game.hover)
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
    const stampRunway =
      game.tool === 'runway' ||
      game.tool === 'runway_heavy' ||
      game.tool === 'runway_short'
    const runwayReady =
      stampRunway &&
      cells.length > 1 &&
      cells.every((p) => inBounds(p.c, p.r) && game.tile(p) === 'grass')
    for (const p of cells) {
      if (p.c < 0) continue
      const t = game.tile(p)
      const clear = t === 'grass' || game.tool === 'clear'
      const ready = stampRunway ? runwayReady : clear
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
      const helo = f.craft === 'helo'
      if (!mesh) {
        const a = game.airline(f.airline)
        let color = a.color
        let stripe = a.stripe
        if (f.kind === 'military') {
          // Fighters read darker/sleeker; transports stay olive + gold.
          color = f.airframeId === 'f15' ? '#2a3028' : '#3d4a32'
          stripe = f.airframeId === 'f15' ? '#8a9a6a' : '#c9a227'
        } else if (f.kind === 'air_ambulance' || f.kind === 'helo_med') {
          color = '#b33a2a'
          stripe = '#f0c040'
        } else if (f.kind === 'freighter') {
          color = '#5a5348'
          stripe = '#d9a441'
        } else if (f.kind === 'helo_exec') {
          color = '#1a3a4a'
          stripe = '#c9a227'
        }
        mesh = helo ? this.makeHelo(color, stripe) : this.makeJet(color, stripe)
        this.jets.set(f.id, mesh)
        this.entGroup.add(mesh)
      }
      const p = toWorld(f.x, f.y, 0.55 + f.z * 1.15)
      mesh.position.copy(p)
      mesh.rotation.y = -f.heading
      mesh.rotation.x = helo
        ? 0
        : f.phase === 'takeoff' || f.phase === 'approach'
          ? -0.12
          : 0
      if (helo) {
        const rotor = mesh.getObjectByName('rotor')
        if (rotor) rotor.rotation.y += 0.55
      }
      const sel = game.selectedFlight === f.id
      const base = AIRFRAMES[f.airframeId]?.scale ?? (helo ? 0.95 : 1.15)
      mesh.scale.setScalar(sel ? base * 1.06 : base)
    }
    for (const [id, m] of this.jets) {
      if (!seenJ.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.jets.delete(id)
      }
    }

    const seenT = new Set<string>()
    for (const t of game.trucks) {
      seenT.add(t.id)
      let mesh = this.trucks.get(t.id)
      if (!mesh) {
        const color =
          t.kind === 'fuel'
            ? '#c9a227'
            : t.kind === 'bags'
              ? '#6b7280'
              : t.kind === 'citycargo'
                ? '#5a4a38'
                : t.kind === 'deice'
                  ? '#4aa8c8'
                  : t.kind === 'termbus'
                    ? '#e8c56a'
                    : '#c45c26'
        const g = new THREE.Group()
        const body = new THREE.Mesh(
          t.kind === 'citycargo'
            ? new THREE.BoxGeometry(1.35, 0.7, 0.85)
            : new THREE.BoxGeometry(1.1, 0.55, 0.7),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
        )
        body.castShadow = true
        body.name = 'body'
        g.add(body)
        // Manor Lords-style visible load — crates on bag carts / city trucks.
        if (t.kind === 'bags' || t.kind === 'citycargo') {
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(
              t.kind === 'citycargo' ? 0.7 : 0.55,
              0.4,
              t.kind === 'citycargo' ? 0.55 : 0.45,
            ),
            new THREE.MeshStandardMaterial({
              color: t.kind === 'citycargo' ? '#9a7a40' : '#8a7348',
              roughness: 0.55,
              emissive: '#3a2e14',
              emissiveIntensity: 0.15,
            }),
          )
          crate.position.set(0, t.kind === 'citycargo' ? 0.65 : 0.55, 0)
          crate.name = 'crate'
          crate.visible = false
          g.add(crate)
        }
        mesh = g
        this.trucks.set(t.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(t.x, t.y, 0.4))
      mesh.rotation.y = -Math.atan2(
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.r ?? t.y) - t.y,
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.c ?? t.x) - t.x,
      )
      const crate = mesh.getObjectByName('crate')
      if (crate) {
        crate.visible = Boolean(t.cargoUnits && t.cargoUnits > 0)
        const s = clamp(0.85 + Math.min(1.4, (t.cargoUnits ?? 0) / 80), 0.85, 1.35)
        crate.scale.set(s, s, s)
      }
    }
    for (const [id, m] of this.trucks) {
      if (!seenT.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.trucks.delete(id)
      }
    }

    const seenP = new Set<string>()
    for (const p of game.people) {
      seenP.add(p.id)
      let mesh = this.people.get(p.id)
      if (!mesh) {
        const tall = p.job === 'mechanic' ? 0.48 : p.job === 'board' ? 0.42 : 0.38
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(p.job === 'mechanic' ? 0.22 : 0.18, tall, 3, 6),
          new THREE.MeshLambertMaterial({ color: p.color }),
        )
        mesh.castShadow = true
        this.people.set(p.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(p.x, p.y, 0.55))
      // Face travel direction so flow reads clearly
      if (p.path.length > 1) {
        const a = p.path[Math.min(p.seg, p.path.length - 1)]
        const b = p.path[Math.min(p.seg + 1, p.path.length - 1)]
        mesh.rotation.y = -Math.atan2(b.r - a.r, b.c - a.c)
      }
    }
    for (const [id, m] of this.people) {
      if (!seenP.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.people.delete(id)
      }
    }
  }

  /** Ghost tiles share one geometry per rebuild — dispose it once, not every hover forever. */
  private clearGhost() {
    let geo: THREE.BufferGeometry | null = null
    const mats: THREE.Material[] = []
    for (const child of this.ghostGroup.children) {
      if (child instanceof THREE.Mesh) {
        geo = child.geometry
        const mat = child.material
        if (Array.isArray(mat)) mats.push(...mat)
        else mats.push(mat)
      }
    }
    geo?.dispose()
    for (const m of new Set(mats)) m.dispose()
    this.ghostGroup.clear()
  }

  render(game: Game) {
    this.resize()
    this.applyPerfMode(game)
    this.rebuildTiles(game)
    this.syncGhost(game)
    this.syncEntities(game)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    const canvas = this.canvas
    canvas.removeEventListener('contextmenu', this.onContextMenu)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('wheel', this.onWheel)
    this.renderer.dispose()
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) for (const m of mat) m.dispose()
    else mat?.dispose()
  })
}

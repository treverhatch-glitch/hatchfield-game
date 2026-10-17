import * as THREE from 'three'

/**
 * Touchdown dressing, visual only: the sim phase clock and positions are never read back.
 * `t` is seconds since the mains met the runway, accumulated from the render step
 * (real dt x game speed), so it freezes on pause and runs faster at 3x/5x.
 */
export const TOUCHDOWN = {
  /** Peak oleo compression as a fraction of the airframe's gear height (spec.gear, metres). */
  squashFrac: 0.11,
  /** Seconds from touchdown to peak compression. */
  peakSec: 0.16,
  /** Ring period of the settle after the first compression. */
  periodSec: 0.62,
  /** Envelope decay time constant. */
  decaySec: 0.34,
  /** Nose-down kick as the mains load up, degrees. */
  pitchKickDeg: 0.55,
  /** After this the settle is exactly zero. */
  settleSec: 1.5,
  /** Only start the effect if we see the rollout this close to the touchdown point (cells). */
  latchCells: 0.6,
  smoke: {
    /** Seconds after touchdown that the mains still shed smoke. */
    emitSec: 0.32,
    /** Puffs per main leg per second while emitting. */
    rate: 70,
    lifeMin: 1.5,
    lifeMax: 2.4,
    /** Diameter in metres at birth and at death. */
    sizeStart: 1.4,
    sizeEnd: 7.5,
    riseM: 2.2,
    /** Smoke is dragged along a little behind the wheel before it hangs in the air. */
    carryM: 5,
    spreadM: 0.9,
    opacity: 0.62,
    maxPuffs: 160,
  },
} as const

export interface GearSettle {
  /** Metres the airframe sits below its parked ride height (negative = rebound above it). */
  sinkM: number
  /** Extra nose-up radians (negative = nose dips). */
  pitch: number
}

const DEG = Math.PI / 180

/**
 * Oleo compression after touchdown: a fast first squash, one softer rebound, then settled.
 * Shaped so sink(0) = 0 (wheels just touching) and the curve is continuous at settleSec.
 */
export function gearSettle(t: number, gearM: number): GearSettle {
  if (!Number.isFinite(t) || t <= 0 || t >= TOUCHDOWN.settleSec) return { sinkM: 0, pitch: 0 }
  const amp = TOUCHDOWN.squashFrac * Math.max(0, gearM)
  const s = settleShape(t)
  return { sinkM: amp * s, pitch: -TOUCHDOWN.pitchKickDeg * DEG * s }
}

/** Unit settle curve: rises to ~1 at peakSec, rings down, 0 at settleSec. */
export function settleShape(t: number): number {
  if (t <= 0 || t >= TOUCHDOWN.settleSec) return 0
  const { peakSec, periodSec, decaySec, settleSec } = TOUCHDOWN
  // Attack: smooth rise to the first peak.
  if (t < peakSec) {
    const u = t / peakSec
    return Math.sin((u * Math.PI) / 2)
  }
  const tt = t - peakSec
  const ring = Math.exp(-tt / decaySec) * Math.cos((2 * Math.PI * tt) / periodSec)
  // Fade the tail so the curve reaches exactly 0 at settleSec with no visible snap.
  const fade = 1 - smooth01((t - (settleSec - 0.35)) / 0.35)
  return ring * fade
}

function smooth01(x: number): number {
  const u = Math.min(1, Math.max(0, x))
  return u * u * (3 - 2 * u)
}

interface Puff {
  sprite: THREE.Sprite
  mat: THREE.SpriteMaterial
  age: number
  life: number
  /** Birth point, world units. */
  ox: number
  oy: number
  oz: number
  /** Unit drift direction in XZ (opposite of travel plus scatter). */
  dx: number
  dz: number
  seed: number
  live: boolean
}

let _smokeTex: THREE.Texture | null = null

/** Soft radial puff with a little lumpiness, built once and shared. */
export function smokeTexture(): THREE.Texture {
  if (_smokeTex) return _smokeTex
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5
      const v = (y + 0.5) / size - 0.5
      const r = Math.sqrt(u * u + v * v) * 2
      const ang = Math.atan2(v, u)
      const lump = 1 + 0.12 * Math.sin(ang * 5 + 1.3) + 0.08 * Math.sin(ang * 9 - 0.4)
      const a = Math.max(0, 1 - r * lump)
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = Math.round(255 * a * a * (3 - 2 * a))
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  _smokeTex = tex
  return tex
}

/** Deterministic hash in [0, 1). */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const _night = new THREE.Color('#2a2f38')
const _day = new THREE.Color('#e4e2de')

/**
 * Pooled tyre-smoke puffs. Sprites never cast or receive shadows and never write depth,
 * so they cannot punch holes in the soft sun shadows or the planes behind them.
 */
export class TyreSmoke {
  readonly group = new THREE.Group()
  private puffs: Puff[] = []
  private serial = 0
  private carry = new Map<string, number>()
  private tint = new THREE.Color()

  /** World units per metre, so puffs scale with the airframes. */
  private wpm: number

  constructor(wpm: number, max: number = TOUCHDOWN.smoke.maxPuffs) {
    this.wpm = wpm
    this.group.name = 'tyre-smoke'
    this.group.renderOrder = 3
    const tex = smokeTexture()
    for (let i = 0; i < max; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        color: _day.clone(),
        fog: true,
      })
      mat.name = 'tyre-smoke'
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      sprite.castShadow = false
      sprite.receiveShadow = false
      sprite.frustumCulled = true
      this.group.add(sprite)
      this.puffs.push({ sprite, mat, age: 0, life: 1, ox: 0, oy: 0, oz: 0, dx: 0, dz: 0, seed: 0, live: false })
    }
  }

  get active(): number {
    let n = 0
    for (const p of this.puffs) if (p.live) n++
    return n
  }

  get capacity(): number {
    return this.puffs.length
  }

  /**
   * Shed smoke from each main-gear contact point for `step` seconds.
   * `key` is the flight id, so fractional puffs carry across frames per flight.
   */
  emit(key: string, contacts: readonly THREE.Vector3[], heading: number, step: number) {
    if (step <= 0 || contacts.length === 0) return
    const want = (this.carry.get(key) ?? 0) + TOUCHDOWN.smoke.rate * step
    const whole = Math.floor(want)
    this.carry.set(key, want - whole)
    if (whole <= 0) return
    // Travel is +X rotated by heading in sim (c, r) space, which maps to world (x, z).
    const bx = -Math.cos(heading)
    const bz = -Math.sin(heading)
    for (let k = 0; k < whole; k++) {
      for (const c of contacts) this.spawn(c, bx, bz)
    }
  }

  /** Drop the per-flight emission remainder once its touchdown is over. */
  forget(key: string) {
    this.carry.delete(key)
  }

  private spawn(c: THREE.Vector3, bx: number, bz: number) {
    let p = this.puffs.find((q) => !q.live)
    if (!p) {
      // Pool full: recycle the oldest puff rather than drop the newest.
      p = this.puffs.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b))
    }
    const seed = ++this.serial
    const sm = TOUCHDOWN.smoke
    const j = (hash01(seed) - 0.5) * 0.9
    const cs = Math.cos(j)
    const sn = Math.sin(j)
    p.dx = bx * cs - bz * sn
    p.dz = bx * sn + bz * cs
    const spread = sm.spreadM * this.wpm
    p.ox = c.x + (hash01(seed + 0.31) - 0.5) * spread
    p.oy = c.y + 0.15 * this.wpm
    p.oz = c.z + (hash01(seed + 0.67) - 0.5) * spread
    p.life = sm.lifeMin + (sm.lifeMax - sm.lifeMin) * hash01(seed + 0.13)
    p.age = 0
    p.seed = seed
    p.live = true
    p.sprite.visible = true
    p.mat.rotation = hash01(seed + 0.91) * Math.PI * 2
    this.place(p)
  }

  /** Advance every live puff. `daylight` 0..1 dims the (unlit) sprites at night. */
  update(step: number, daylight = 1) {
    const d = Math.min(1, Math.max(0, daylight))
    this.tint.copy(_night).lerp(_day, d)
    for (const p of this.puffs) {
      if (!p.live) continue
      p.age += Math.max(0, step)
      if (p.age >= p.life) {
        p.live = false
        p.sprite.visible = false
        p.mat.opacity = 0
        continue
      }
      p.mat.color.copy(this.tint)
      this.place(p)
    }
  }

  private place(p: Puff) {
    const sm = TOUCHDOWN.smoke
    const u = p.age / p.life
    // Fast billow then slow drift; ease-out on everything.
    const grow = 1 - (1 - u) * (1 - u) * (1 - u)
    const carry = (1 - Math.exp(-p.age * 3)) * sm.carryM * this.wpm
    const size = (sm.sizeStart + (sm.sizeEnd - sm.sizeStart) * grow) * this.wpm
    p.sprite.position.set(
      p.ox + p.dx * carry,
      p.oy + sm.riseM * this.wpm * grow + size * 0.25,
      p.oz + p.dz * carry,
    )
    p.sprite.scale.set(size, size, 1)
    // Quick fade-in so a puff never pops, long fade-out.
    const fadeIn = Math.min(1, p.age / 0.06)
    const fadeOut = 1 - u
    p.mat.opacity = sm.opacity * fadeIn * fadeOut * fadeOut * (0.75 + 0.25 * hash01(p.seed + 0.5))
    p.mat.rotation += 0.002
  }

  dispose() {
    for (const p of this.puffs) p.mat.dispose()
    this.puffs = []
    this.group.clear()
  }
}

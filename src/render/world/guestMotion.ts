/**
 * Visual-only crowd step. Sim positions stay authoritative; this nudges the
 * drawn bodies so queues read as lines and doorways meter the picture.
 * The low preset never constructs it.
 */
import { Crowd } from '../../crowd/crowd'
import type { Door, Waypoint } from '../../crowd/types'
import { HALL_NAV_TUNING } from '../../game/hallNavData.ts'

/**
 * Overlay pace at the old nav scale of 30 s per clock second (queue 1.1 m/s,
 * walk 1.25 m/s). Scaled with `navSecPerClockSec` so the apron picture and
 * the terminal walk slow by the same factor. Game speed is already in the
 * sim step that owns these positions.
 */
const OVERLAY_PACE = HALL_NAV_TUNING.navSecPerClockSec / 30
const QUEUE_SPEED = 1.1 * OVERLAY_PACE
const WALK_SPEED = 1.25 * OVERLAY_PACE

/** Above this, steering is skipped and the sim positions are drawn as-is. */
export const STEER_CAP = 180
const CLAMP_M = 1.6
const QUEUE_SPACING = 0.65

export interface MotionPose {
  id: string
  x: number
  z: number
  yaw: number
  queued: boolean
}

export class GuestMotion {
  private crowd = new Crowd({ neighbourRadius: 1.5, horizon: 1.2 }, 64)
  private ids: string[] = []
  private queueSig = ''
  private doorSig = ''
  private goals = new Map<string, string>()

  apply(poses: readonly MotionPose[], doors: readonly Door[], dt: number): MotionPose[] {
    if (poses.length < 2 || poses.length > STEER_CAP) return poses.map((p) => ({ ...p }))
    const doorSig = doors.map((d) => d.id).join('|')
    const queueSig = poses
      .filter((p) => p.queued)
      .map((p) => p.id)
      .sort()
      .join('|')
    const idSig = poses
      .map((p) => p.id)
      .sort()
      .join('|')
    if (doorSig !== this.doorSig || queueSig !== this.queueSig || idSig !== this.ids.slice().sort().join('|')) {
      this.rebuild(poses, doors, doorSig, queueSig)
    }
    const step = Math.min(0.08, Math.max(0, dt))
    for (const pose of poses) {
      const i = this.ids.indexOf(pose.id)
      if (i < 0) continue
      if (pose.queued) {
        if (this.crowd.queueOf[i] < 0) this.crowd.joinQueue(i, 'line')
        continue
      }
      const route = routeTo(this.crowd.x[i], this.crowd.z[i], pose, doors)
      const doorId = route[0]?.doorId ?? ''
      const key = `${pose.x.toFixed(1)},${pose.z.toFixed(1)}|${doorId}`
      if (this.goals.get(pose.id) === key && this.crowd.queueOf[i] < 0) continue
      this.goals.set(pose.id, key)
      if (this.crowd.queueOf[i] >= 0) this.crowd.release(i, route)
      else this.crowd.setRoute(i, route)
    }
    if (step > 0) this.crowd.step(step)
    return poses.map((pose) => {
      const i = this.ids.indexOf(pose.id)
      if (i < 0) return { ...pose }
      let x = this.crowd.x[i]
      let z = this.crowd.z[i]
      const dx = x - pose.x
      const dz = z - pose.z
      const d = Math.hypot(dx, dz)
      if (d > CLAMP_M) {
        const k = CLAMP_M / d
        x = pose.x + dx * k
        z = pose.z + dz * k
        this.crowd.x[i] = x
        this.crowd.z[i] = z
      }
      return { ...pose, x, z }
    })
  }

  private rebuild(poses: readonly MotionPose[], doors: readonly Door[], doorSig: string, queueSig: string) {
    this.crowd = new Crowd({ neighbourRadius: 1.5, horizon: 1.2 }, Math.max(64, poses.length * 2))
    this.doorSig = doorSig
    this.queueSig = queueSig
    this.goals.clear()
    for (const d of doors) this.crowd.addDoor(d)

    const queued = poses.filter((p) => p.queued)
    const walkers = poses.filter((p) => !p.queued)
    const ids: string[] = []
    if (queued.length) {
      const cx = queued.reduce((s, p) => s + p.x, 0) / queued.length
      const cz = queued.reduce((s, p) => s + p.z, 0) / queued.length
      const yaw = queued.reduce((s, p) => s + p.yaw, 0) / queued.length
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      const len = Math.max(1.2, queued.length * QUEUE_SPACING)
      this.crowd.addQueue(
        'line',
        [
          { x: cx + fx * 0.3, z: cz + fz * 0.3 },
          { x: cx - fx * len, z: cz - fz * len },
        ],
        QUEUE_SPACING,
      )
      const order = queued.slice().sort((a, b) => (b.x - cx) * fx + (b.z - cz) * fz - ((a.x - cx) * fx + (a.z - cz) * fz))
      for (const p of order) {
        const i = this.crowd.addAgent({ pos: { x: p.x, z: p.z }, route: [], speed: QUEUE_SPEED, radius: 0.28 })
        this.crowd.joinQueue(i, 'line')
        ids.push(p.id)
      }
    }
    for (const p of walkers) {
      this.crowd.addAgent({
        pos: { x: p.x, z: p.z },
        route: routeTo(p.x, p.z, p, doors),
        speed: WALK_SPEED,
        radius: 0.28,
      })
      ids.push(p.id)
    }
    this.ids = ids
  }
}

function routeTo(x: number, z: number, to: MotionPose, doors: readonly Door[]): Waypoint[] {
  let best: Door | null = null
  let bestD = 0.85
  for (const d of doors) {
    const mx = (d.ax + d.bx) / 2
    const mz = (d.az + d.bz) / 2
    const dist = pointSegDist(x, z, to.x, to.z, mx, mz)
    if (dist < bestD) {
      best = d
      bestD = dist
    }
  }
  if (!best) return [{ x: to.x, z: to.z }]
  return [
    { x: (best.ax + best.bx) / 2, z: (best.az + best.bz) / 2, doorId: best.id },
    { x: to.x, z: to.z },
  ]
}

function pointSegDist(x0: number, z0: number, x1: number, z1: number, px: number, pz: number): number {
  const dx = x1 - x0
  const dz = z1 - z0
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-6) return Math.hypot(px - x0, pz - z0)
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / len2))
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t))
}

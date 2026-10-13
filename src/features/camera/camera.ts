/**
 * Replay / follow-camera math. Pure functions on plain {x,y,z} vectors, so
 * THREE.Vector3 instances can be passed straight in (structural typing) and
 * results copied back with `camera.position.set(p.x, p.y, p.z)`.
 */
export interface Vec3 { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s)
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b))
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
export function normalize(a: Vec3): Vec3 {
  const l = len(a)
  return l === 0 ? v3() : scale(a, 1 / l)
}

/** Frame-rate independent exponential smoothing factor. `halfLife` in seconds. */
export function dampFactor(halfLife: number, dt: number): number {
  return halfLife <= 0 ? 1 : 1 - Math.pow(2, -dt / halfLife)
}
export const damp = (cur: number, target: number, halfLife: number, dt: number): number => cur + (target - cur) * dampFactor(halfLife, dt)
export const damp3 = (cur: Vec3, target: Vec3, halfLife: number, dt: number): Vec3 => lerp3(cur, target, dampFactor(halfLife, dt))

/** Shortest-path angle damping (radians). */
export function dampAngle(cur: number, target: number, halfLife: number, dt: number): number {
  let d = (target - cur) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return cur + d * dampFactor(halfLife, dt)
}

/** Something the camera can follow: a plane or passenger, supplied by the sim. */
export interface FollowTarget {
  position: Vec3
  /** Heading in radians around +Y (0 = facing +Z). */
  heading: number
  /** Optional velocity for look-ahead (units/s). */
  velocity?: Vec3
}

export interface FollowParams {
  /** Distance behind the target. */
  distance: number
  height: number
  /** Seconds of velocity look-ahead for the aim point. */
  lookAhead: number
  positionHalfLife: number
  aimHalfLife: number
  /** Minimum camera height above ground (y = 0). */
  minHeight: number
}

/** Presets: planes need a long, high chase; passengers a close shoulder cam. */
export const FOLLOW_PRESETS: Record<'plane' | 'passenger' | 'vehicle', FollowParams> = {
  plane: { distance: 60, height: 18, lookAhead: 1.5, positionHalfLife: 0.35, aimHalfLife: 0.15, minHeight: 3 },
  passenger: { distance: 4, height: 2.2, lookAhead: 0.5, positionHalfLife: 0.25, aimHalfLife: 0.1, minHeight: 0.8 },
  vehicle: { distance: 12, height: 5, lookAhead: 0.8, positionHalfLife: 0.3, aimHalfLife: 0.12, minHeight: 1.5 },
}

export interface CameraState { position: Vec3; aim: Vec3 }

/** Ideal (undamped) chase pose for a target. */
export function chasePose(t: FollowTarget, p: FollowParams): CameraState {
  const back = v3(-Math.sin(t.heading) * p.distance, 0, -Math.cos(t.heading) * p.distance)
  const pos = add(t.position, add(back, v3(0, p.height, 0)))
  pos.y = Math.max(pos.y, p.minHeight)
  const aim = t.velocity ? add(t.position, scale(t.velocity, p.lookAhead)) : { ...t.position }
  return { position: pos, aim }
}

/** One smooth-follow step; call every frame with dt in seconds. */
export function followStep(cam: CameraState, t: FollowTarget, p: FollowParams, dt: number): CameraState {
  const ideal = chasePose(t, p)
  const position = damp3(cam.position, ideal.position, p.positionHalfLife, dt)
  position.y = Math.max(position.y, p.minHeight)
  return { position, aim: damp3(cam.aim, ideal.aim, p.aimHalfLife, dt) }
}

export interface OrbitParams { center: Vec3; radius: number; height: number; /** rad/s */ speed: number; startAngle?: number }

/** Orbit position at time t (seconds). */
export function orbitPose(o: OrbitParams, t: number): CameraState {
  const a = (o.startAngle ?? 0) + o.speed * t
  return { position: v3(o.center.x + Math.sin(a) * o.radius, o.center.y + o.height, o.center.z + Math.cos(a) * o.radius), aim: { ...o.center } }
}

/** Yaw/pitch (radians) to look from `from` at `to`; matches Three's default -Z forward. */
export function lookAngles(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const d = sub(to, from)
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }
}

// ---------- Cinematic paths ----------

export interface CinematicKey { position: Vec3; aim: Vec3; /** seconds from start */ time: number }

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}
function catmull3(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  return v3(catmull(a.x, b.x, c.x, d.x, t), catmull(a.y, b.y, c.y, d.y, t), catmull(a.z, b.z, c.z, d.z, t))
}

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Samples a Catmull-Rom cinematic path at time t (clamped). Passes through every key exactly. */
export function samplePath(keys: CinematicKey[], t: number, ease: (u: number) => number = easeInOut): CameraState {
  if (keys.length === 0) throw new Error('empty camera path')
  if (keys.length === 1 || t <= keys[0].time) return { position: { ...keys[0].position }, aim: { ...keys[0].aim } }
  const last = keys[keys.length - 1]
  if (t >= last.time) return { position: { ...last.position }, aim: { ...last.aim } }
  let i = 0
  while (i < keys.length - 2 && t >= keys[i + 1].time) i++
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)]
  const u = ease((t - k1.time) / (k2.time - k1.time))
  return { position: catmull3(k0.position, k1.position, k2.position, k3.position, u), aim: catmull3(k0.aim, k1.aim, k2.aim, k3.aim, u) }
}

/** Builds a default flyby: approach, sweep past, pull up and away from a subject. */
export function flybyPath(subject: Vec3, heading: number, duration: number, range = 80): CinematicKey[] {
  const f = v3(Math.sin(heading), 0, Math.cos(heading))
  const side = v3(f.z, 0, -f.x)
  const at = (along: number, lateral: number, h: number) => add(subject, add(scale(f, along), add(scale(side, lateral), v3(0, h, 0))))
  return [
    { time: 0, position: at(range, range * 0.3, range * 0.15), aim: { ...subject } },
    { time: duration * 0.4, position: at(range * 0.2, range * 0.15, range * 0.05), aim: { ...subject } },
    { time: duration * 0.7, position: at(-range * 0.3, range * 0.2, range * 0.1), aim: { ...subject } },
    { time: duration, position: at(-range, range * 0.4, range * 0.4), aim: { ...subject } },
  ]
}

/** Deterministic handheld-style shake offset; returns zero when reduced motion is on. */
export function shakeOffset(t: number, amplitude: number, reducedMotion = false): Vec3 {
  if (reducedMotion || amplitude === 0) return v3()
  const n = (f: number, ph: number) => Math.sin(t * f + ph) * 0.6 + Math.sin(t * f * 2.17 + ph * 1.3) * 0.4
  return v3(n(1.9, 0.3) * amplitude, n(2.3, 1.1) * amplitude * 0.6, n(1.7, 2.2) * amplitude)
}

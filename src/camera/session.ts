import { clampHour } from './space.ts'
import { followPose } from './orbit.ts'
import type { CameraPose, CameraSnapshot, FieldLayout, Trackable } from './types.ts'

const DEFAULT_POSE: CameraPose = {
  position: { x: 40, y: 30, z: 40 },
  aim: { x: 0, y: 0, z: 0 },
}

/**
 * Follow and photo-mode state for one play session.
 * Frame steps do not notify React; only mode changes do.
 */
export class CameraSession {
  private mode: 'free' | 'follow' = 'free'
  private photo = false
  private selection: Trackable | null = null
  private hour: number | null = null
  private distanceScale = 1
  private pose: CameraPose = DEFAULT_POSE
  private capturePending = false
  private rev = 0
  private snap: CameraSnapshot
  private listeners = new Set<() => void>()
  private poseOf: () => CameraPose = () => DEFAULT_POSE

  constructor() {
    this.snap = this.makeSnap()
  }

  get following(): boolean {
    return this.mode === 'follow'
  }

  /** Photo mode freezes the sim clock. */
  get frozen(): boolean {
    return this.photo
  }

  /** Controlled hour while photographing. Null means the sim clock owns the sun. */
  get timeOfDay(): number | null {
    return this.hour
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): CameraSnapshot => this.snap

  /** World reads the live camera when Follow is pressed. */
  bindPose(read: () => CameraPose): () => void {
    this.poseOf = read
    return () => {
      this.poseOf = () => DEFAULT_POSE
    }
  }

  /** Click on the apron. Empty clicks keep the previous selection. */
  select(track: Trackable | null): void {
    if (!track) return
    if (this.selection?.id === track.id && this.selection.label === track.label) return
    this.selection = track
    this.publish()
  }

  startFollow(): void {
    if (!this.selection || this.photo || this.mode === 'follow') return
    this.pose = this.poseOf()
    this.distanceScale = 1
    this.mode = 'follow'
    this.publish()
  }

  stopFollow(): void {
    if (this.mode !== 'follow') return
    this.mode = 'free'
    this.publish()
  }

  /** A camera drag releases follow and hands the shot back to orbit. */
  noteDrag(): boolean {
    if (this.mode !== 'follow') return false
    this.mode = 'free'
    this.publish()
    return true
  }

  /**
   * Esc leaves photo mode first, then follow.
   * `none` means the rest of the game (leave the hall) may handle it.
   */
  noteEscape(): 'photo' | 'follow' | 'none' {
    if (this.photo) {
      this.photo = false
      this.hour = null
      this.publish()
      return 'photo'
    }
    if (this.mode === 'follow') {
      this.mode = 'free'
      this.publish()
      return 'follow'
    }
    return 'none'
  }

  togglePhoto(seedHour: number): void {
    if (this.photo) {
      this.photo = false
      this.hour = null
      this.publish()
      return
    }
    this.photo = true
    this.mode = 'free'
    this.hour = clampHour(seedHour)
    this.publish()
  }

  setHour(hour: number): void {
    if (!this.photo) return
    const next = clampHour(hour)
    if (this.hour === next) return
    this.hour = next
    this.publish()
  }

  /** Scroll wheel while following. Positive delta lengthens the chase. */
  noteWheel(deltaY: number): void {
    if (this.mode !== 'follow' || !Number.isFinite(deltaY) || deltaY === 0) return
    const next = this.distanceScale * Math.exp(deltaY * 0.0012)
    this.distanceScale = Math.min(2.6, Math.max(0.4, next))
  }

  requestCapture(): void {
    this.capturePending = true
  }

  /** The live view consumes this once, on the frame it renders. */
  consumeCapture(): boolean {
    if (!this.capturePending) return false
    this.capturePending = false
    return true
  }

  /**
   * Advance the chase. Returns null when follow is off.
   * A missing target drops follow so the orbit camera can take over.
   */
  step(dt: number, tracks: readonly Trackable[], layout: FieldLayout): CameraPose | null {
    if (this.mode !== 'follow' || !this.selection) return null
    const target = tracks.find((t) => t.id === this.selection?.id)
    if (!target) {
      this.selection = null
      this.mode = 'free'
      this.publish()
      return null
    }
    this.pose = followPose(this.pose, target, layout, this.distanceScale, dt)
    return this.pose
  }

  private publish(): void {
    this.rev += 1
    this.snap = this.makeSnap()
    for (const listener of this.listeners) listener()
  }

  private makeSnap(): CameraSnapshot {
    return {
      rev: this.rev,
      photo: this.photo,
      frozen: this.photo,
      following: this.mode === 'follow',
      selection: this.selection
        ? { id: this.selection.id, kind: this.selection.kind, label: this.selection.label }
        : null,
      hour: this.hour,
    }
  }
}

export const cameraSession = new CameraSession()

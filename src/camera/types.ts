/** Something on the apron the follow camera can track. Coordinates are cells. */
export type TrackKind = 'plane' | 'vehicle' | 'passenger'

export interface Trackable {
  id: string
  kind: TrackKind
  label: string
  /** Cell column. */
  c: number
  /** Cell row. */
  r: number
  /** World-up altitude in world units. Ground actors stay at 0. */
  altitude: number
  /**
   * Sim heading in radians. 0 faces +column (world +X);
   * π/2 faces +row (world +Z).
   */
  heading: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface CameraPose {
  position: Vec3
  aim: Vec3
}

export interface FieldLayout {
  /** World units per apron cell. */
  cell: number
  /** Grid size in cells (square). */
  size: number
}

export interface CameraSnapshot {
  rev: number
  photo: boolean
  frozen: boolean
  following: boolean
  selection: { id: string; kind: TrackKind; label: string } | null
  /** Hour override while photo mode is on. Null follows the sim clock. */
  hour: number | null
}

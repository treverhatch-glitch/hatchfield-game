export { SERVICE_POINT_TUNING } from './config.ts'
export { servePose, type ServePhase, type ServePose } from './anim.ts'
export {
  CLOSED_NO_STAFF_LINE,
  WALK_PAUSED_LINE,
  extraOpenServers,
  formatWait,
  openPointIds,
  pointInUse,
  serviceInfoLines,
  throughputOf,
  type HiredPosts,
  type InfoPoint,
  type PointKind,
  type PointLoad,
  type StaffPoint,
  type Throughput,
} from './points.ts'
export { simulatePoints, type PaceInput, type PaceResult } from './pace.ts'

import type { LabFrame, RoomCounts } from './types.ts'

export function roomTotal(rooms: RoomCounts): number {
  return Math.max(0, rooms.desk) + Math.max(0, rooms.board) + Math.max(0, rooms.machine)
}

/** Placeholder lab loop. Pure data — the panel draws it. */
export function labFrame(seconds: number, rooms: RoomCounts): LabFrame {
  const count = roomTotal(rooms)
  const t = Number.isFinite(seconds) ? seconds : 0
  if (count <= 0) {
    return { seconds: t, rooms: 0, phase: 'empty', bob: 0, glow: 0.12, spark: 0 }
  }
  const cycle = ((t % 4) + 4) % 4
  const phase = cycle < 1.6 ? 'scan' : cycle < 3.2 ? 'spark' : 'idle'
  const bob = (Math.sin(t * 2.2) + 1) / 2
  const glow = 0.35 + 0.65 * ((Math.sin(t * 3) + 1) / 2)
  const spark = phase === 'spark' ? (Math.sin(t * 8) + 1) / 2 : 0
  return { seconds: t, rooms: count, phase, bob, glow, spark }
}

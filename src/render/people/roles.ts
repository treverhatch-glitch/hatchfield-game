export type Role = 'passenger' | 'checkin' | 'security' | 'gate' | 'shop' | 'cleaner' | 'researcher'
export type Pose = 'walk' | 'idle' | 'queue' | 'seated' | 'working'
export const POSE_CODE: Record<Pose, number> = { walk: 0, idle: 1, queue: 2, seated: 3, working: 4 }

/** Map sim state strings onto a pose. Unknown states fall back by role. */
export function poseFor(role: Role, state: string | undefined, moving: boolean): Pose {
  const s = (state ?? '').toLowerCase()
  if (/seat|sit|wait_gate|waiting|boarding_wait|lounge/.test(s)) return 'seated'
  if (/research|desk|typing/.test(s)) return 'working'
  if (/queue|line/.test(s)) return 'queue'
  if (/walk|move|transit|^to_|heading/.test(s)) return 'walk'
  if (/idle|stand|serve|work|check|screen|clean|shop|browse|reclaim/.test(s)) return role === 'researcher' && /work/.test(s) ? 'working' : (moving ? 'walk' : 'idle')
  if (role === 'researcher') return 'working'
  return moving ? 'walk' : 'idle'
}

const hex = (h: number): [number, number, number] => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
export const STAFF_LOOK: Record<Exclude<Role, 'passenger'>, { top: number; bottom: number; cap?: boolean }> = {
  checkin: { top: 0x1f3a8a, bottom: 0x1e293b },
  security: { top: 0x334155, bottom: 0x0f172a, cap: true },
  gate: { top: 0xb91c1c, bottom: 0x1e293b },
  shop: { top: 0x15803d, bottom: 0x3f3f46 },
  cleaner: { top: 0xfacc15, bottom: 0x1e3a8a },
  researcher: { top: 0xf1f5f9, bottom: 0x475569 },
}
const PAX_TOPS = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x14b8a6, 0x3b82f6, 0x8b5cf6, 0xec4899, 0xf5f5f4, 0x737373, 0x78350f, 0x0ea5e9, 0x65a30d, 0x9f1239]
const PAX_BOTTOMS = [0x1e293b, 0x334155, 0x1d4ed8, 0x57534e, 0x0f172a, 0xa8a29e, 0x3f6212, 0x7c2d12]

export function hashId(id: string | number): number {
  const s = String(id); let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export interface Look { top: [number, number, number]; bottom: [number, number, number]; width: number; height: number; skin: number; phase: number; carry: 'none' | 'backpack' | 'rolling'; cap: boolean }
export function lookFor(id: string | number, role: Role): Look {
  const h = hashId(id), r = (k: number) => ((h >>> k) & 255) / 255
  const width = 0.85 + r(3) * 0.4, height = 0.88 + r(11) * 0.2, skin = r(19), phase = r(5)
  if (role !== 'passenger') {
    const s = STAFF_LOOK[role]
    return { top: hex(s.top), bottom: hex(s.bottom), width, height, skin, phase, carry: 'none', cap: !!s.cap }
  }
  const c = r(23)
  return { top: hex(PAX_TOPS[h % PAX_TOPS.length]), bottom: hex(PAX_BOTTOMS[(h >>> 8) % PAX_BOTTOMS.length]), width, height, skin, phase, carry: c < 0.35 ? 'rolling' : c < 0.7 ? 'backpack' : 'none', cap: false }
}

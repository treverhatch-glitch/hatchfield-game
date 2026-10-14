import { crewLook, passengerLook } from '../../people/variants'
import type { CrewKind, PersonLook, PersonPose } from '../../people/types'

export type Role = 'passenger' | 'checkin' | 'security' | 'gate' | 'shop' | 'cleaner' | 'researcher'
export type Pose = 'walk' | 'idle' | 'queue' | 'seated' | 'working'

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

/** Hall poses onto the people module's poses. A rolling bag is pulled while walking. */
export function personPose(pose: Pose, look: PersonLook): PersonPose {
  switch (pose) {
    case 'walk':
      return look.carry === 'roller' ? 'bagPull' : look.carry === 'stroller' ? 'push' : 'walk'
    case 'working':
      return 'seated'
    default:
      return pose
  }
}

const AIRLINE = {
  checkin: { primary: 0x1f3a8a, secondary: 0xf8fafc },
  gate: { primary: 0xb91c1c, secondary: 0xf8fafc },
} as const
const CREW_FOR: Partial<Record<Role, CrewKind>> = { checkin: 'cabin', gate: 'cabin', security: 'security', cleaner: 'maintenance' }

/**
 * Terminal staff wear the crew uniforms; shop and R&D staff are people looks
 * with fixed colours. Staff carry nothing.
 */
function staffLook(id: string, role: Exclude<Role, 'passenger'>): PersonLook {
  const kind = CREW_FOR[role]
  if (kind) {
    const airline = role === 'checkin' || role === 'gate' ? AIRLINE[role] : undefined
    const look = crewLook(kind, id, { airline })
    // Desk staff have no suitcase; cleaners keep the coveralls but go bareheaded.
    return { ...look, carry: 'none', hat: role === 'cleaner' ? 'none' : look.hat, key: `${look.key}.${role}` }
  }
  const base = passengerLook(id, { carry: 'none', outfit: 'casual', age: 'adult' })
  const dress = role === 'shop'
    ? { top: 0x15803d, bottom: 0x3f3f46, sleeves: false, accent: 0xf8fafc }
    : { top: 0xf1f5f9, bottom: 0x475569, sleeves: true, accent: 0 }
  return { ...base, ...dress, hat: 'none', shorts: false, jacket: 0, gear: [], backpack: false, carry: 'none', key: `${role}.${base.key}` }
}

/** Deterministic per id. `checked`: the passenger still has a checked bag to drop. */
export function lookFor(id: string | number, role: Role, checked = false): PersonLook {
  const sid = String(id)
  if (role !== 'passenger') return staffLook(sid, role)
  const base = passengerLook(sid)
  if (checked && base.carry !== 'roller' && base.carry !== 'duffel') return passengerLook(sid, { carry: 'roller' })
  return base
}

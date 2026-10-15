/**
 * Map the ramp crew scene (#227) onto people meshes. Presentation only: the
 * service clocks and positions stay owned by src/ramp.
 */
import type { CrewPose, CrewRole, CrewService } from '../ramp/crewConfig.ts'
import type { PeopleAgent } from './renderer.ts'
import type { CrewKind, PersonPose } from './types.ts'
import { crewLook, passengerLook } from './variants.ts'
import type { PersonLook } from './types.ts'

/** Metres per second a walking crew member covers; sets the stride rate. */
export const CREW_WALK_SPEED = 1.4

export function crewKindFor(service: CrewService, role: CrewRole): CrewKind {
  if (role === 'walker') return 'marshaller'
  switch (service) {
    case 'fuel':
      return 'fuel'
    case 'catering':
      return 'catering'
    case 'gpu':
      return 'maintenance'
    default:
      return 'ground'
  }
}

export function poseFor(kind: CrewKind | null, pose: CrewPose, look: PersonLook): PersonPose {
  if (kind === 'marshaller' && (pose === 'idle' || pose === 'reach')) return 'wave'
  if (pose === 'walk') return look.carry === 'roller' ? 'bagPull' : look.carry === 'stroller' ? 'push' : 'walk'
  return pose
}

/** Poses whose legs step: they need a ground speed for the stride. */
const STRIDING: ReadonlySet<CrewPose> = new Set(['walk', 'carry', 'push', 'signal'])

const looks = new Map<string, PersonLook>()
const LOOK_CACHE_LIMIT = 2048

/** Looks are deterministic per id; the cache just saves rebuilding them per frame. */
export function lookForCrewId(id: string, service: CrewService, role: CrewRole): PersonLook {
  const key = `${service}:${role}:${id}`
  let look = looks.get(key)
  if (!look) {
    if (looks.size >= LOOK_CACHE_LIMIT) looks.clear()
    look = role === 'pax' ? passengerLook(id) : crewLook(crewKindFor(service, role), id)
    looks.set(key, look)
  }
  return look
}

export function crewAgent(
  person: { id: string; role: CrewRole; service: CrewService; pose: CrewPose; heading: number },
  at: { x: number; y: number; z: number },
): PeopleAgent {
  const look = lookForCrewId(person.id, person.service, person.role)
  return {
    id: person.id,
    look,
    x: at.x,
    y: at.y,
    z: at.z,
    // Crew headings face +column; people meshes face +z.
    yaw: Math.PI / 2 - person.heading,
    pose: poseFor(look.crew, person.pose, look),
    speed: STRIDING.has(person.pose) ? CREW_WALK_SPEED : 0,
  }
}

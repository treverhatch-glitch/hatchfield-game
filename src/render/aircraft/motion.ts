/**
 * Flight and turnaround state that drives the animated airframe parts.
 * Every value is a 0..1 target. The LOD eases the drawn value toward it.
 */
export interface AircraftMotion {
  /** Trailing-edge flaps. 0.35 is takeoff, 1 is landing. */
  flaps: number
  /** Leading-edge slats. */
  slats: number
  /** Thrust reverser sleeves. */
  reverse: number
  /** Passenger and upper-deck doors. */
  doors: number
  /** Belly and main-deck cargo doors. */
  cargo: number
  /** Engine, prop and rotor speed. 0 is shut down. */
  spool: number
}

export const MOTION_IDLE: Readonly<AircraftMotion> = {
  flaps: 0,
  slats: 0,
  reverse: 0,
  doors: 0,
  cargo: 0,
  spool: 0,
}

/** Legacy default when the sim never sets a motion: engines turn, nothing deployed. */
export const MOTION_RUNNING: Readonly<AircraftMotion> = { ...MOTION_IDLE, spool: 1 }

export interface MotionInput {
  phase: string
  /** World units above the apron. */
  alt?: number
  gearDown?: boolean
  /** Ground speed in cells per second, when known. */
  speed?: number
}

/** Map a sim phase to the parts a crew or pilot would have deployed. */
export function motionForPhase(input: MotionInput): AircraftMotion {
  const alt = input.alt ?? 0
  const m: AircraftMotion = { ...MOTION_IDLE }
  switch (input.phase) {
    case 'approach':
      m.flaps = alt > 6 ? 0.6 : 1
      m.slats = 1
      m.spool = 0.7
      break
    case 'landing':
      m.flaps = 1
      m.slats = 1
      m.spool = 1
      // Reversers only once the mains are on the runway and the jet is still fast.
      m.reverse = alt <= 0.05 && (input.speed === undefined || input.speed > 0.4) ? 1 : 0
      break
    case 'taxi_out':
      m.flaps = 0.35
      m.slats = 1
      m.spool = 0.4
      break
    case 'takeoff':
      m.flaps = input.gearDown === false && alt > 4 ? 0 : 0.35
      m.slats = input.gearDown === false && alt > 6 ? 0 : 1
      m.spool = 1
      break
    case 'taxi_in':
    case 'mx_taxi':
    case 'mx_return':
      m.spool = 0.35
      break
    case 'pushback':
      m.spool = 0.3
      break
    case 'deboard':
    case 'board':
      m.doors = 1
      m.cargo = 1
      break
    case 'servicing':
      m.doors = 1
      m.cargo = 1
      break
    case 'mx_bay':
      m.cargo = 1
      break
    default:
      break
  }
  return m
}

/** Exponential ease of every channel toward its target. Mutates `drawn`. */
export function easeMotion(drawn: AircraftMotion, target: AircraftMotion, dt: number): AircraftMotion {
  const k = (rate: number) => 1 - Math.exp(-rate * dt)
  drawn.flaps += (target.flaps - drawn.flaps) * k(0.9)
  drawn.slats += (target.slats - drawn.slats) * k(1.4)
  drawn.reverse += (target.reverse - drawn.reverse) * k(3)
  drawn.doors += (target.doors - drawn.doors) * k(0.8)
  drawn.cargo += (target.cargo - drawn.cargo) * k(0.6)
  drawn.spool += (target.spool - drawn.spool) * k(0.5)
  return drawn
}

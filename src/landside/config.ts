/**
 * Landside traffic tunables. Capacity, mode split, the satisfaction nudge,
 * and how many late arrivals miss check-in live here so the curb can be
 * retuned without touching fees or upkeep.
 *
 * Two layers share these numbers. The capacity model gives each road lane
 * and curb stall a number and drives pressure, delay and missed check-ins.
 * The drawn vehicles are bodies on the lanes: they arrive at the city's
 * real rate, keep their gap, change lane to reach the curb, stop at a free
 * stall, bay, rank or lot, and leave round the loop.
 */
export const LANDSIDE = {
  /** Vehicles one lane can hold on a single 22 m road cell. */
  carsPerLaneCell: 2,
  /** Vehicles per minute one lane can pass. */
  flowPerLanePerMin: 8,
  /**
   * Drop-off stalls on each road cell that touches the hall.
   * Three starter cells at this rate fill up once a careful field has a
   * few stands and a day's passengers. The bus bay, curb lane, and taxi
   * rank are what put the stalls back.
   */
  stallsPerCurbCell: 1,
  /** Stalls a bus bay adds on top of taking coaches off the passenger curb. */
  stallsPerBusBay: 2,
  /** Stalls one extra curb lane adds. */
  stallsPerCurbLane: 2,
  /** Stalls one taxi rank adds. */
  stallsPerTaxiRank: 2,
  /** Seconds a car or taxi sits while people get out, when the curb is clear. */
  dwellSec: 28,
  /** Seconds a city bus occupies its bay. */
  busDwellSec: 40,
  /** A bus in a bay serves this many passengers. */
  paxPerBus: 30,
  paxPerCar: 1.5,
  paxPerTaxi: 1.3,
  /** How many stall-equivalents a bus uses if it has to stop on the curb. */
  busOnCurbWeight: 3,
  /**
   * Share of arriving passengers before a rail station exists.
   * With no bus bay, the bus share falls back onto taxis at the curb.
   */
  share: { car: 0.4, taxi: 0.26, bus: 0.34 },
  /** Share that moves off the road once a rail station is open. */
  railShare: 0.24,
  /** Parking stalls. Cars use these instead of a curb stall, up to the lot's turnover. */
  parkSpaces: { park_s: 36, park_l: 90, park_g: 220, park_u: 160 },
  /** Minutes a parked car keeps its stall. Turnover is spaces / this. */
  parkDwellMin: 20,
  cellM: 22,
  /**
   * Which side of the carriageway traffic keeps. The lane offsets, the
   * drop-off layby, and the U-turn direction all read this one value.
   */
  drivingSide: 'right' as 'left' | 'right',
  /** Through lanes in each direction on one 22 m road cell. */
  lanesEachWay: 2,
  /** Width of one through lane, metres. */
  laneWidthM: 3.5,
  /** Painted median between the two directions, metres. */
  medianM: 1,
  /**
   * Drop-off layby outside the curb-side lane, metres. Stalls sit in it,
   * so a stopped car leaves both through lanes open.
   */
  laybyWidthM: 2.5,
  /** Approach speed, metres per second. */
  speedMps: 6,
  /** Body of each vehicle kind, metres. Gaps and stalls are measured from these. */
  bodies: {
    car: { lengthM: 4.6, widthM: 1.8 },
    taxi: { lengthM: 4.6, widthM: 1.8 },
    bus: { lengthM: 12, widthM: 2.5 },
  },
  /** Bumper-to-bumper gap between stalls in the drop-off layby, and the floor for any gap, metres. */
  minGapM: 2,
  /**
   * In a through lane a follower stays at least this many of its own body lengths
   * behind the vehicle ahead, stopped or moving. Merges and pull-outs need the same gap.
   */
  followBodyLengths: 1,
  /** Extra following gap per metre-per-second of the follower, seconds. Used for merges. */
  headwaySec: 1,
  accelMps2: 2,
  decelMps2: 4,
  /** Sideways acceleration drivers accept in a turn, m/s². Sets U-turn and corner speed. */
  turnLatAccelMps2: 1.5,
  /**
   * Distance a lane change takes at speed, metres. Short enough that the
   * nose yaws into the new lane. A 28 m change kept a bus within about 10°
   * of the lane line, which reads as a sideways slide.
   */
  laneChangeM: 12,
  /** Shortest lane change, metres. A car stops this far before the end of its lane. */
  laneChangeMinM: 6,
  /** Seconds of travel a lane change takes, between the two lengths above. */
  laneChangeSec: 2,
  /**
   * How far inside the end of the road the U-turn centre sits, metres.
   * The curb-lane semicircle is only as wide as the two curb lanes. A bus
   * on that arc reaches about 9 m from the centre, which meets the end kerb
   * when the centre is the last cell's middle. This inset keeps that body
   * on the pavement.
   */
  loopInsetM: 4,
  /** Extra bumper gap on a tight radius, metres, so cars on the loop do not sit on each other. */
  curveGapM: 2,
  /** Start heading for the curb lane this far before the stall or the U-turn, metres. */
  prepM: 50,
  /** Shortest and longest pull into or out of a stall, metres. */
  pullMinM: 4,
  pullMaxM: 10,
  /** Speed while pulling into or out of a stall, metres per second. */
  pullSpeedMps: 3,
  /** Seconds a car stops at a car park entrance before it drives in. */
  parkGateSec: 3,
  /** Vehicle step, seconds. A longer tick is split into steps of this size. */
  substepSec: 0.25,
  /** Lateness below this does not move satisfaction. */
  delayGraceSec: 15,
  /** Reputation points per second of lateness, per sim-second. */
  satPerLateSec: 0.002,
  /** Ceiling on the nudge, reputation points per sim-second. */
  satCapPerSec: 0.05,
  /**
   * Share of arrivals who miss check-in, per second of lateness past the grace.
   * The passenger fee itself stays on the fee card.
   */
  missPerLateSec: 0.012,
  /** Cap on that share, so a jammed curb does not erase the whole bank. */
  missShareCap: 0.5,
  /**
   * Furthest a drawn car may move in one sim-second.
   * A spawn in the middle of the road, or a snap back to the city, is past this.
   */
  maxFrameJumpM: 7,
  /** How fast the meters chase a new load, seconds. */
  smoothSec: 6,
  /** Passengers who step out of one car, taxi, or bus. */
  alight: { car: 1, taxi: 1, bus: 3 },
  /** Seconds a passenger walks from the kerb to the hall door, or back out to a pickup. */
  walkSec: 4.5,
  /**
   * How early a curb vehicle is sent, seconds before that passenger's door time.
   * The drive, the stop, and the walk fit inside this, so check-in still opens
   * on the show-up curve.
   */
  curbLeadSec: 50,
  /** Closer than this to the door, the vehicle starts near the stall instead of the city. */
  curbHurrySec: 38,
  /** Metres before the stall a hurried vehicle appears. It still drives the last stretch. */
  curbHurrySpawnM: 40,
  /** Seconds a trip vehicle sits at the kerb while someone gets in or out. */
  curbStopSec: 1.2,
  /** Opening trickle, passengers per minute, before the bank grows. */
  baseArrivalsPerMin: 2,
  /** Extra passengers per minute for each passenger the airport handled today. */
  perPaxPerDay: 0.004,
  /** Extra passengers per minute for each live departure. */
  perDeparture: 1.2,
  /**
   * Turns the starter curb can absorb before the city crowds it.
   * One runway only keeps a couple of jets on the ramp, so live departures
   * alone never fill three stalls. The passengers show up once the book
   * is real: past this many completed turns, each further turn adds
   * `perTurn` passengers a minute. Walking passengers finish more of that
   * book, including a narrowbody turn, so the curb absorbs sixty-six
   * turns before the city crowds it. A careful field still crosses
   * pressure 1 on day 20, after about 80 flights and eight carriers,
   * and not in the first five days. One bus bay brings that bank back under 1.
   */
  turnAllowance: 66,
  /** Passengers per minute for each completed turn past `turnAllowance`. */
  perTurn: 0.2,
} as const

export type ParkKind = keyof typeof LANDSIDE.parkSpaces

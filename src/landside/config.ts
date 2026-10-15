/**
 * Landside traffic tunables. Capacity, mode split, the satisfaction nudge,
 * and how many late arrivals miss check-in live here so the curb can be
 * retuned without touching fees or upkeep.
 *
 * This is a capacity model: each road lane and curb stall has a number.
 * It is not a street-level traffic sim. The cars that are drawn still have
 * to enter at the map edge, dwell, and leave forward.
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
  /** Gap between queued cars along the approach, metres. */
  queueGapM: 8,
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
  /** Cars drawn on the approach. The capacity math stays aggregate. */
  visualCap: 14,
  /** Passengers who step out of one car, taxi, or bus. */
  alight: { car: 1, taxi: 1, bus: 3 },
  /** Seconds a passenger walks from the door to the hall. */
  walkSec: 4.5,
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
   * `perTurn` passengers a minute. A careful field crosses pressure 1
   * between day 15 and 35, after about 80 flights and eight carriers,
   * and not in the first five days. One bus bay brings that bank back under 1.
   */
  turnAllowance: 52,
  /** Passengers per minute for each completed turn past `turnAllowance`. */
  perTurn: 0.2,
} as const

export type ParkKind = keyof typeof LANDSIDE.parkSpaces

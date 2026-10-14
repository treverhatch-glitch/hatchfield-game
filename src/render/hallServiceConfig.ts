/** Check-in and security interior tunables. Metres, seconds. */
export const HALL_SERVICE_LOOK = {
  /** Desk centre this far past the service point, along the queue direction. */
  deskAhead: 1.6,
  /** Airline sign height and size. */
  signY: 2.45,
  signW: 1.5,
  signH: 0.42,
  /** Bag-drop scale beside the passenger, and the collector belt it feeds. */
  scaleAhead: 0.75,
  scaleSide: 0.7,
  scaleY: 0.32,
  /** Seconds a weighed bag takes to slide off the scale onto the collector belt. */
  bagSlideSec: 1.4,
  bagSlideM: 1.6,
  /** Queue barriers: post spacing along the line and offset either side of it. */
  postStepM: 1.5,
  postSideM: 0.55,
  postH: 0.95,
  tapeY: 0.9,
  maxPosts: 900,
  /** X-ray trays: count per lane, belt length behind/ahead of the service point, speed. */
  traysPerLane: 4,
  trayBackM: 1.8,
  trayAheadM: 2.2,
  traySideM: 0.6,
  trayY: 0.82,
  /** Lane belt cycles per second while the lane is screening. */
  trayRate: 0.18,
  /** Seconds between metrics reads (serving flags, served counts). */
  readEverySec: 0.25,
  /** Desk staff and officers drawn as full figures up to this many. */
  maxStaff: 96,
} as const

/** Queue tape colours by the kit the line leads to. */
export const TAPE_COLOR: Record<string, string> = {
  checkin_desk: '#1f4e9c',
  security_lane: '#b3262b',
}

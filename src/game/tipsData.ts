/**
 * Tip chips — stuck-state notes. Pure data. The sim decides when one is true;
 * the overlay only draws it. Tunable here.
 *
 * These are not the hint panel, the letter phone, or the alert stack.
 * Each id is shown at most once.
 */

/** Cash under this, outside sandbox, is "out of cash". */
export const TIP_CASH = 2_000

/** An apron queue this long (sim seconds) is backing up. */
export const TIP_QUEUE_SEC = 20

/** Security line this deep is backing up inside the hall. */
export const TIP_HALL_QUEUE = 8

/** A jet that has not changed phase in this long is stuck on the pavement. */
export const TIP_STUCK_SEC = 35

/** How many chips may sit on screen together. */
export const TIP_MAX_OPEN = 3

export const TIP_PHASES = ['landing', 'taxi_in', 'taxi_out', 'pushback'] as const

export interface TipCopy {
  id: string
  title: string
  text: string
}

export const TIP_COPY: readonly TipCopy[] = [
  {
    id: 'no-stand',
    title: 'No stand',
    text: 'Arrivals have nowhere to park. Stamp a stand beside the taxiway.',
  },
  {
    id: 'no-runway',
    title: 'No runway',
    text: 'The stands are in, but nothing can land until a strip is down.',
  },
  {
    id: 'no-runway-exit',
    title: 'No runway exit',
    text: 'The strip has no taxi off it, so a landing cannot reach a stand.',
  },
  {
    id: 'queue-backing-up',
    title: 'Queue backing up',
    text: 'Aircraft are waiting on one lane. A parallel taxi or another exit clears it.',
  },
  {
    id: 'hall-queue',
    title: 'Hall queue',
    text: 'The security line is longer than this hall can clear. Add a lane or ease the bank.',
  },
  {
    id: 'out-of-cash',
    title: 'Out of cash',
    text: 'The bank cannot cover the next bill. A turnaround brings cash back in.',
  },
  {
    id: 'taxi-stuck',
    title: 'Taxi stuck',
    text: 'An aircraft has stopped on the pavement. Check the path between the strip and the stand.',
  },
  {
    id: 'fuel-dry',
    title: 'Fuel farm empty',
    text: 'Departures that need fuel will wait until the next tanker arrives.',
  },
] as const

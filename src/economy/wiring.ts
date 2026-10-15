/**
 * Which economy-tech nodes the live sim actually reads.
 * A node that nothing reads is held back in the wallet so points are not spent on nothing.
 * Add a row here in the same change that wires a modifier into the sim.
 */

export interface LiveTech {
  /** What the player sees in the world once the node is owned. */
  shows: string
}

export const LIVE_TECH: Readonly<Record<string, LiveTech>> = {
  'sustainability.t1': {
    shows: 'Site load drops 10% and capacity rises 10%, so the hangar and night hub trip a brown-out later.',
  },
  'sustainability.t2': {
    shows: 'Battery reserve adds 150 units of capacity before a brown-out.',
  },
  'safety_security.t2': {
    shows: 'CT scanners come online. Fast-track lane II opens on the Premium sheet.',
  },
  'cargo.t4': {
    shows: 'Cold store opens on Build > Airside ops > Bags/Cargo. Chilled rooms lift every night freighter wave.',
  },
  'maintenance.t4': {
    shows: 'Hangar MRO: every heavy check pays 15% more.',
  },
}

export const HELD_REASON =
  'Held back: no airport system reads this yet, so points spent here would buy nothing.'

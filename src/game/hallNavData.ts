/** Tunables for the live passenger walk in the Terminal view (src/game/hallNav.ts). */
import type { EquipKind } from '../terminalbuild/types.ts'
import type { ItemDef } from './terminal.ts'
import type { ThoughtKey } from '../paxnav/guestConfig.ts'

export const HALL_NAV_TUNING = {
  /**
   * PaxNav seconds per sim clock second at 1x. PaxNav walks and serves in real
   * seconds (1.3 m/s, 75 s check-in); a game day is 180 clock seconds.
   * 10 puts a walker at 13 m/s on screen at 1x (was 39 m/s). Tick already
   * multiplies by game speed, so 3× and 5× stay three and five times this.
   */
  navSecPerClockSec: 10,
  /**
   * Nav seconds of departure lead per clock second left to STD. The show-up
   * window (3 game hours = 22.5 clock s) is short once walking is slow enough
   * to read: 360 turns a leisure show-up into 135 nav minutes, time for
   * security and a toilet or shop stop before boarding opens (30 nav min out).
   * Only real queues make anyone miss.
   */
  departLeadScale: 360,
  /** Departure lead, clock seconds, for a walker with no flight yet (day-one walkers, unbound slots). */
  unknownLeadClockSec: 40,
  /** Seed for each hall's walker rolls (bags, needs, curb door). */
  seed: 204,
  /** Walkers are guests: traits, needs, thoughts, groups, rebooking (src/paxnav/guests.ts). */
  guests: true,
  /** Family fares on one flight: share that walk as a party, and most followers behind the first. */
  familyGroups: { share: 0.6, maxFollowers: 3 },
  /** Placed items that count as departure boards for wayfinding. */
  boardItems: ['info_screen', 'info_kiosk'] as readonly string[],
}

/**
 * Live queue read-out and its pull on passenger mood. Seconds are nav seconds
 * (the walk's own clock; boarding opens 30 nav minutes before departure).
 */
export const HALL_QUEUE_TUNING = {
  /** Nav seconds between queue read-outs (badges, info panel, bottleneck paint). */
  readEveryNavSec: 5,
  /**
   * A facility is a bottleneck once someone joining now would wait this long,
   * or its line has spilled past the marked floor. Set so the starter hall
   * only turns red a week or so in, once the first airlines fill it.
   */
  bottleneckSec: { checkin_desk: 900, security_lane: 600, toilet: 300, shop_counter: 420, gate_desk: 900 } as Partial<Record<EquipKind, number>>,
  /** A wait up to this long costs no mood. */
  toleranceSec: { checkin_desk: 600, security_lane: 420, toilet: 180, shop_counter: 300, gate_desk: 600 } as Partial<Record<EquipKind, number>>,
  /** Happiness lost per nav minute past tolerance. */
  moodPerMinOver: 0.6,
  /** Most happiness one wait can cost. */
  maxMoodHit: 15,
  /** Happiness for being served in under a quarter of the tolerance. */
  quickMood: 1,
}

/**
 * How a walker's thoughts carry onto the fare it stands for (sim `HallGuest.happiness`),
 * which at the gate moves airline heat and the diplomacy mood grade. 0 leaves a thought
 * to the model that already scores it: waits go through `waitMoodDelta`, shop and
 * restroom visits through the hall's own purchase and wear rules, a missed flight
 * through the missed-gate penalty.
 */
export const HALL_MOOD_LINK = {
  /** Share of a thought's satisfaction move that lands on the fare's happiness. */
  weight: {
    lost: 0.6,
    no_amenity: 0.6,
    out_of_stock: 0.6,
    no_seats: 0.6,
    nice_seats: 0.6,
    crowded: 0.6,
    hungry: 0.3,
    thirsty: 0.3,
    need_toilet: 0.3,
    bored: 0.3,
    tired: 0.3,
    anxious: 0.3,
  } as Partial<Record<ThoughtKey, number>>,
}

/** Capacity forecast on the check-in and security cards (src/game/hallCapacity.ts). */
export const HALL_CAPACITY_TUNING = {
  /**
   * Nav seconds over which the passengers committed to a point count as one
   * hour's rate. 1200 (20 nav minutes): a lane with 30 people headed for it
   * is read as 90 pax/hr, so a 120 pax/hr lane shows 75% loaded.
   */
  planWindowNavSec: 1200,
}

/** Terminal crew in the hall walk (src/paxnav/crew.ts). */
export const HALL_CREW_TUNING = {
  /** Clock seconds per shift: a third of the 180 s game day. */
  shiftClockSec: 60,
}

/** Arriving passengers on the hall's nav grid (src/game/hallArrivals.ts). Nav seconds, metres. */
export const HALL_ARRIVAL_TUNING = {
  /** Hover line for an arriving passenger. */
  glanceThought: 'Heading for the bags and the exit',
  /** Seed for arrival rolls (jet bridge cell, bags, needs, pace). */
  seed: 207,
  /** Share of arrivals with a checked bag to collect at the claim belt. */
  bagShare: 0.65,
  /** Chance an arrival stops at each before heading out. */
  needShare: { toilet: 0.2, shop: 0.1 },
  /** Nav seconds an arrival waits at the belt for a bag, min and max. */
  claimWaitSec: [120, 360] as const,
  /** Claim-hall cells within this many cells of a belt count as a spot to wait at. */
  claimReachCells: 2,
}

/** Prefab kit that stands on the claim hall: solid (walk round it), and the belts people wait beside. */
export const PREFAB_CLAIM_KIT = {
  solid: ['claim_carousel', 'bag_system'] as readonly string[],
  belts: ['claim_carousel'] as readonly string[],
}

/** Terminal-view walker drawing (src/render/hallNavCrowd.ts). Never changes who is in the sim. */
export const HALL_CROWD_TUNING = {
  /** Most walkers drawn in one frame, nearest first. 0 = everyone: no cap. */
  maxVisible: 0,
  /** Walkers farther than this from the camera, metres, are not drawn. Past any camera the hall allows. */
  drawDistM: 1e6,
  /** Past this distance walkers would drop to a body only. Out of reach: nobody is downgraded. */
  lodDistM: 1e6,
  /** Inside this distance every walker uses the shared low-poly body (sheet outfit and props). Out of reach too. */
  nearDistM: 1e6,
  /** Sheet bodies the renderer holds: as many as the people renderer can carry. */
  nearCap: 4096,
  /** Frustum test radius around a walker, metres. */
  cullRadiusM: 1.2,
}

/** Clicking a nav-grid walker in the Terminal view: ray height (mid body) and how close counts, metres. */
export const HALL_WALKER_PICK = {
  bodyY: 1.1,
  radiusM: 1.6,
  /** Screen-space pick radius, pixels. A click this close to a walker selects them. */
  screenPx: 36,
  /** Hover tooltip: least milliseconds between picks while the cursor moves. */
  hoverEveryMs: 60,
}

/**
 * Prefab kit room -> build kit it stands for when a prefab hall is read as a
 * build layout. One piece per server, as far as the item's cell has room.
 */
export const PREFAB_ROOM_KIT: Partial<Record<NonNullable<ItemDef['room']>, EquipKind>> = {
  checkin: 'checkin_desk',
  bagdrop: 'checkin_desk',
  security: 'security_lane',
  gate: 'gate_desk',
  bathroom: 'toilet',
  food: 'shop_counter',
  souvenir: 'shop_counter',
}

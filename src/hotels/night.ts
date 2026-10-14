import {
  CREW_RATE_SHARE,
  OUTSIDE_VOUCHER_RATE,
  RATE_ELASTICITY,
  RATE_MAX,
  RATE_MIN,
  VOUCHER_RATE_SHARE,
} from './config.ts'
import type { HotelDemand, HotelNight, HotelNightLine, HotelSegment, HotelSite } from './types.ts'

const SEGMENTS: HotelSegment[] = [
  'voucherAirline',
  'voucherAirport',
  'crew',
  'layoverAirside',
  'layoverLandside',
  'local',
]

function whole(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

function emptySegments(): Record<HotelSegment, number> {
  return { voucherAirline: 0, voucherAirport: 0, crew: 0, layoverAirside: 0, layoverLandside: 0, local: 0 }
}

export function clampRate(mult: number): number {
  if (!Number.isFinite(mult)) return 1
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(mult * 10) / 10))
}

/** Guests who pay themselves react to price. Contracted rooms do not. */
export function priceDemand(guests: number, rateMult: number): number {
  const mult = clampRate(rateMult)
  const factor = Math.max(0, 1 - RATE_ELASTICITY * (mult - 1))
  return whole(guests * factor)
}

/** Order hotels for a segment. Hotels a segment cannot use are left out. */
function preference(segment: HotelSegment, sites: readonly HotelSite[]): HotelSite[] {
  const byStars = (dir: 1 | -1) => (a: HotelSite, b: HotelSite) =>
    dir * (a.stars - b.stars) || a.id.localeCompare(b.id)
  const linked = (s: HotelSite) => s.side === 'airside' || s.link !== 'none'
  switch (segment) {
    case 'voucherAirline':
    case 'voucherAirport':
      // Cheapest bed that can be reached.
      return sites.filter(linked).sort(byStars(1))
    case 'crew': {
      const land = sites.filter((s) => s.side === 'landside').sort((a, b) => {
        const fit = (s: HotelSite) => Math.abs(s.stars - 3)
        return fit(a) - fit(b) || a.id.localeCompare(b.id)
      })
      return [...land, ...sites.filter((s) => s.side === 'airside')]
    }
    case 'layoverAirside':
      return [
        ...sites.filter((s) => s.side === 'airside').sort(byStars(-1)),
        ...sites.filter((s) => s.side === 'landside' && linked(s)).sort(byStars(-1)),
      ]
    case 'layoverLandside':
      return [
        ...sites.filter((s) => s.side === 'landside' && linked(s)).sort(byStars(-1)),
        ...sites.filter((s) => s.side === 'airside').sort(byStars(-1)),
      ]
    case 'local':
      return sites.filter((s) => s.side === 'landside').sort(byStars(-1))
  }
}

function roomRate(segment: HotelSegment, site: HotelSite): number {
  if (segment === 'crew') return site.rate * CREW_RATE_SHARE
  if (segment === 'voucherAirline') return site.rate * VOUCHER_RATE_SHARE
  // The airport's own vouchers are comped rooms in its own hotel.
  if (segment === 'voucherAirport') return 0
  return site.rate
}

/**
 * One night of bookings. Contracted rooms (vouchers, crew) book first, then
 * self-paying layover and local guests. Rooms never overbook; the rest is
 * overflow. Airport vouchers that do not fit go to an outside hotel at cost.
 */
export function settleHotelNight(
  sites: readonly HotelSite[],
  demand: HotelDemand,
  rateMult = 1,
): HotelNight {
  const free = new Map<string, number>()
  const lines = new Map<string, HotelNightLine>()
  for (const site of sites) {
    const rooms = whole(site.rooms)
    free.set(site.id, rooms)
    lines.set(site.id, {
      id: site.id,
      name: site.name,
      grade: site.grade,
      side: site.side,
      stars: site.stars,
      rooms,
      occupied: 0,
      occupancy: 0,
      revenue: 0,
      upkeep: Number.isFinite(site.upkeep) ? Math.max(0, site.upkeep) : 0,
      rate: site.rate,
      link: site.link,
      bySegment: emptySegments(),
    })
  }
  const overflow = emptySegments()
  for (const segment of SEGMENTS) {
    const raw = whole(demand[segment])
    let left =
      segment === 'layoverAirside' || segment === 'layoverLandside' || segment === 'local'
        ? priceDemand(raw, rateMult)
        : raw
    for (const site of preference(segment, sites)) {
      if (left <= 0) break
      const room = free.get(site.id) ?? 0
      if (room <= 0) continue
      const take = Math.min(room, left)
      free.set(site.id, room - take)
      left -= take
      const line = lines.get(site.id)
      if (!line) continue
      line.occupied += take
      line.bySegment[segment] += take
      line.revenue += take * roomRate(segment, site)
    }
    overflow[segment] = left
  }
  const out = [...lines.values()].map((line) => ({
    ...line,
    revenue: Math.round(line.revenue),
    occupancy: line.rooms > 0 ? line.occupied / line.rooms : 0,
  }))
  const rooms = out.reduce((sum, l) => sum + l.rooms, 0)
  const occupied = out.reduce((sum, l) => sum + l.occupied, 0)
  return {
    lines: out,
    rooms,
    occupied,
    occupancy: rooms > 0 ? occupied / rooms : 0,
    revenue: out.reduce((sum, l) => sum + l.revenue, 0),
    upkeep: out.reduce((sum, l) => sum + l.upkeep, 0),
    overflow,
    outsideVoucherCost: overflow.voucherAirport * OUTSIDE_VOUCHER_RATE,
  }
}

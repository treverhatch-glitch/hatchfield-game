import { CHECKIN_RATES, DEFAULT_BAG_SHARE } from './data';
import { queueWaitMinutes } from './queue';

export interface CheckinConfig {
  desks: number;
  kiosks: number;
  bagDrops: number;
}

export interface CheckinChannelResult {
  count: number;
  paxPerHr: number;
  capacity: number;
  utilisation: number;
  waitMinutes: number;
}

export interface CheckinMixResult {
  channels: {
    desk: CheckinChannelResult;
    kiosk: CheckinChannelResult;
    bagDrop: CheckinChannelResult;
  };
  totalPax: number;
  totalCapacity: number;
  overallUtilisation: number;
  maxWaitMinutes: number;
  bottleneck: boolean;
}

function roundValue(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 1e6) / 1e6;
}

/**
 * Calculates passenger routing and wait times across check-in channels.
 * Routes no-bag passengers to kiosks first; overflow no-bag pax and bag overflow go to desks.
 *
 * @param config Counts of desks, kiosks, and bag drops
 * @param paxPerHr Total passenger arrival rate
 * @param bagShare Proportion of passengers with bags (0.0 to 1.0, default 0.8)
 */
export function checkinMix(
  config: CheckinConfig,
  paxPerHr: number,
  bagShare: number = DEFAULT_BAG_SHARE
): CheckinMixResult {
  const safePax = Number.isFinite(paxPerHr) ? Math.max(0, paxPerHr) : 0;
  const safeBagShare = Number.isFinite(bagShare)
    ? Math.max(0, Math.min(1, bagShare))
    : DEFAULT_BAG_SHARE;

  const desks = Math.max(0, Math.floor(config?.desks ?? 0));
  const kiosks = Math.max(0, Math.floor(config?.kiosks ?? 0));
  const bagDrops = Math.max(0, Math.floor(config?.bagDrops ?? 0));

  const paxWithBags = roundValue(safePax * safeBagShare);
  const paxNoBags = roundValue(safePax * (1 - safeBagShare));

  // Kiosks process no-bag pax
  const kioskCapacity = kiosks * CHECKIN_RATES.kiosk;
  const kioskPax = roundValue(Math.min(paxNoBags, kioskCapacity));
  const overflowNoBagPax = roundValue(paxNoBags - kioskPax);

  // Bag drops process bag pax
  const bagDropCapacity = bagDrops * CHECKIN_RATES.bagDrop;
  const bagDropPax = roundValue(Math.min(paxWithBags, bagDropCapacity));
  const overflowBagPax = roundValue(paxWithBags - bagDropPax);

  // Desks process overflow
  const deskPax = roundValue(overflowNoBagPax + overflowBagPax);
  const deskCapacity = desks * CHECKIN_RATES.desk;

  const buildChannelResult = (
    count: number,
    pax: number,
    rate: number
  ): CheckinChannelResult => {
    const capacity = count * rate;
    const rawUtil = capacity > 0 ? pax / capacity : pax > 0 ? 1 : 0;
    const utilisation = roundValue(rawUtil);
    const waitMinutes =
      count > 0 && capacity > 0
        ? queueWaitMinutes(pax, count, rate)
        : pax > 0
          ? 240
          : 0;

    return {
      count,
      paxPerHr: pax,
      capacity,
      utilisation,
      waitMinutes: roundValue(waitMinutes),
    };
  };

  const kioskResult = buildChannelResult(kiosks, kioskPax, CHECKIN_RATES.kiosk);
  const bagDropResult = buildChannelResult(bagDrops, bagDropPax, CHECKIN_RATES.bagDrop);
  const deskResult = buildChannelResult(desks, deskPax, CHECKIN_RATES.desk);

  const totalCapacity = deskCapacity + kioskCapacity + bagDropCapacity;
  const rawOverallUtil =
    totalCapacity > 0 ? safePax / totalCapacity : safePax > 0 ? 1 : 0;
  const overallUtilisation = roundValue(rawOverallUtil);
  const maxWaitMinutes = roundValue(
    Math.max(
      kioskResult.waitMinutes,
      bagDropResult.waitMinutes,
      deskResult.waitMinutes
    )
  );

  const bottleneck = overallUtilisation >= 0.85 || maxWaitMinutes >= 15;

  return {
    channels: {
      desk: deskResult,
      kiosk: kioskResult,
      bagDrop: bagDropResult,
    },
    totalPax: roundValue(safePax),
    totalCapacity,
    overallUtilisation,
    maxWaitMinutes,
    bottleneck,
  };
}

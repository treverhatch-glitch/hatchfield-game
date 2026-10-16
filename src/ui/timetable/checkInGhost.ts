import {
  CHECKIN_CLOSE_DOM_GAME_MIN,
  CHECKIN_CLOSE_INTL_GAME_MIN,
  LEISURE_LEAD_GAME_MIN,
  checkInCloseAt,
  flightIsIntl,
  isIntlKind,
  leadSecForTag,
} from '../../pax/showup'

/** Leisure show-up open through check-in close, in sim seconds. Reads show-up, does not copy it. */
export function checkInGhost(std: number, intl: boolean): { from: number; to: number } {
  return {
    from: std - leadSecForTag('budget'),
    to: checkInCloseAt(std, intl),
  }
}

export function checkInCloseMin(intl: boolean): number {
  return intl ? CHECKIN_CLOSE_INTL_GAME_MIN : CHECKIN_CLOSE_DOM_GAME_MIN
}

export { LEISURE_LEAD_GAME_MIN, flightIsIntl, isIntlKind }

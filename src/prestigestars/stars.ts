export interface StarStats {
  rating: number;
  rivalShare: number;
  transferShare: number;
  mishandledRate: number;
  onTimeRate: number;
  paxPerDay: number;
  specializationsMastered: number;
  awards: number;
}

export interface StarThreshold {
  star: number;
  check: (s: StarStats) => boolean;
}

function isValidNumber(val: number): boolean {
  return typeof val === 'number' && !Number.isNaN(val);
}

export const STAR_THRESHOLDS: readonly StarThreshold[] = [
  {
    star: 1,
    check: (s: StarStats) =>
      isValidNumber(s.rating) &&
      isValidNumber(s.rivalShare) &&
      s.rating >= 0.80 &&
      s.rivalShare <= 0.45,
  },
  {
    star: 2,
    check: (s: StarStats) =>
      isValidNumber(s.transferShare) &&
      isValidNumber(s.mishandledRate) &&
      s.transferShare >= 0.25 &&
      s.mishandledRate <= 0.008,
  },
  {
    star: 3,
    check: (s: StarStats) =>
      isValidNumber(s.onTimeRate) &&
      isValidNumber(s.paxPerDay) &&
      s.onTimeRate >= 0.90 &&
      s.paxPerDay >= 8000,
  },
  {
    star: 4,
    check: (s: StarStats) =>
      isValidNumber(s.specializationsMastered) &&
      isValidNumber(s.awards) &&
      s.specializationsMastered >= 2 &&
      s.awards >= 2,
  },
  {
    star: 5,
    check: (s: StarStats) =>
      isValidNumber(s.paxPerDay) &&
      isValidNumber(s.rating) &&
      isValidNumber(s.rivalShare) &&
      isValidNumber(s.awards) &&
      s.paxPerDay >= 15000 &&
      s.rating >= 0.90 &&
      s.rivalShare <= 0.25 &&
      s.awards >= 4,
  },
];

export function starsEarned(current: number, s: StarStats): number {
  const safeCurrent = isValidNumber(current) ? Math.max(0, Math.floor(current)) : 0;
  let earned = safeCurrent;

  for (let starNum = safeCurrent + 1; starNum <= 5; starNum++) {
    const threshold = STAR_THRESHOLDS.find((t) => t.star === starNum);
    if (threshold && threshold.check(s)) {
      earned = starNum;
    } else {
      break;
    }
  }

  return Math.max(safeCurrent, earned);
}

export function newGamePlusUnlocked(stars: number): boolean {
  return isValidNumber(stars) && stars >= 5;
}

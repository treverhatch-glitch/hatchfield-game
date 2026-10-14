/**
 * Tunables for the day/night cycle and the four map seasons.
 * Climates are the three weather tints: dry and hot, rainy, and cool.
 * Spring is rainy, summer is dry and hot, autumn and winter are cool
 * with their own palettes.
 */
import type { Weather } from '../game/types.ts'

export type GfxQuality = 'low' | 'med' | 'high'

export type ClimateId = 'dry_hot' | 'rainy' | 'cool'

export interface SeasonPalette {
  id: string
  name: string
  climate: ClimateId
  /** 0–1 mix from the clock sky toward this season's colours. */
  amount: number
  skyTop: number
  skyHorizon: number
  sun: number
  hemi: number
  ground: number
  grass: number
  /** Multiplier on sun intensity after weather. */
  sunScale: number
  /** Multiplier on fog distance. Dropped on the low preset. */
  fogScale: number
}

/** One palette per economy-calendar season. */
export const SEASON_PALETTES: Record<string, SeasonPalette> = {
  spring: {
    id: 'spring',
    name: 'Spring',
    climate: 'rainy',
    amount: 0.46,
    skyTop: 0x6e8c86,
    skyHorizon: 0xa8b8ae,
    sun: 0xd5e2d4,
    hemi: 0xc5d4cc,
    ground: 0x3f6240,
    grass: 0xb7d49a,
    sunScale: 0.86,
    fogScale: 0.8,
  },
  summer: {
    id: 'summer',
    name: 'Summer',
    climate: 'dry_hot',
    amount: 0.5,
    skyTop: 0x3d88d4,
    skyHorizon: 0xf0c080,
    sun: 0xffe0a0,
    hemi: 0xfff0cc,
    ground: 0x8a7430,
    grass: 0xd4c06a,
    sunScale: 1.12,
    fogScale: 1.15,
  },
  autumn: {
    id: 'autumn',
    name: 'Autumn',
    climate: 'cool',
    amount: 0.44,
    skyTop: 0x6a7ea4,
    skyHorizon: 0xe2b48a,
    sun: 0xffd0a4,
    hemi: 0xe6d2b4,
    ground: 0x6a4c30,
    grass: 0xc49858,
    sunScale: 0.9,
    fogScale: 0.9,
  },
  winter: {
    id: 'winter',
    name: 'Winter',
    climate: 'cool',
    amount: 0.52,
    skyTop: 0x8eacc8,
    skyHorizon: 0xd4e2ee,
    sun: 0xdce8f8,
    hemi: 0xd0e0f0,
    ground: 0x7a868c,
    grass: 0xb4c2b4,
    sunScale: 0.82,
    fogScale: 0.74,
  },
}

/** Chance of each weather, per season. Weights sum to 1. */
export const SEASON_WEATHER: Record<string, Record<Weather, number>> = {
  spring: { clear: 0.36, rain: 0.4, fog: 0.12, storm: 0.12 },
  summer: { clear: 0.74, rain: 0.12, fog: 0.08, storm: 0.06 },
  autumn: { clear: 0.44, rain: 0.28, fog: 0.16, storm: 0.12 },
  winter: { clear: 0.4, rain: 0.16, fog: 0.3, storm: 0.14 },
}

/**
 * Arrival factor by hour. Overnight is thin; the day banks sit near 1.
 * Keys are hours on the same clock `simClockToHour` uses (night = 19:00–08:00).
 */
export const TIME_OF_DAY_DEMAND: readonly { hour: number; factor: number }[] = [
  { hour: 0, factor: 0.3 },
  { hour: 5, factor: 0.36 },
  { hour: 7, factor: 0.62 },
  { hour: 8, factor: 1 },
  { hour: 11, factor: 1.12 },
  { hour: 15, factor: 1.04 },
  { hour: 17.5, factor: 1.14 },
  { hour: 19, factor: 0.68 },
  { hour: 22, factor: 0.38 },
  { hour: 24, factor: 0.3 },
]

/** Turnaround stretch. 1 = fair weather. Rain slows the ramp a little. */
export const GROUND_OPS = {
  byWeather: { clear: 1, rain: 1.12, fog: 1.06, storm: 1.2 } as Record<Weather, number>,
  /** Extra stretch when a rainy season is actually wet. */
  rainyExtra: 0.04,
  /** Extra stretch in cool weather (rain, fog, or storm). */
  coolExtra: 0.03,
}

export const DEMAND = {
  /**
   * Overnight gap multiplier cap. Wide enough to thin the night bank,
   * short of a hole that dumps every held flight at dawn.
   */
  spacingMax: 1.4,
  /** With Night bank researched, overnight gaps stay only slightly wider than the day. */
  nightBankSpacingCap: 1.15,
  nightBankDemandFloor: 0.62,
  minOpenBank: 2,
}

export const CLIMATE_LABEL: Record<ClimateId, string> = {
  dry_hot: 'dry and hot',
  rainy: 'rainy',
  cool: 'cool',
}

/**
 * Winter ground snow. A colour + emissive write on the grass, not a particle
 * system. Low uses the lighter mix so the field still reads as snow.
 */
export const SNOW = {
  cover: 0.82,
  lowCover: 0.64,
  /** Emissive strength at full cover. Low scales with `lowCover`. */
  emissive: 0.72,
}

import { simRandom } from '../game/simRng.ts'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface WeatherEffects {
  runwayRateMult: number
  groundOpsMult: number
  paxHappinessDelta: number
  cancelChance: number
}

export interface WeatherEvent {
  id: string
  name: string
  blurb: string
  durationHours: [number, number]
  effects: WeatherEffects
  minFL: number
  weightBySeason: Record<Season, number>
  scalingNote: string
}

export const WEATHER_EVENTS: readonly WeatherEvent[] = [
  {
    id: 'fog',
    name: 'Fog',
    blurb: 'Low visibility reduces runway throughput and slows ground taxiing.',
    durationHours: [2, 6],
    effects: {
      runwayRateMult: 0.6,
      groundOpsMult: 0.8,
      paxHappinessDelta: -5,
      cancelChance: 0.05,
    },
    minFL: 1,
    weightBySeason: {
      spring: 30,
      summer: 10,
      autumn: 40,
      winter: 35,
    },
    scalingNote: 'Common at all airport tiers; ILS upgrades mitigate capacity loss at higher FL.',
  },
  {
    id: 'freezing_fog',
    name: 'Freezing Fog',
    blurb: 'Supercooled fog causing rapid ice accumulation on airframes and taxiways.',
    durationHours: [3, 8],
    effects: {
      runwayRateMult: 0.4,
      groundOpsMult: 0.5,
      paxHappinessDelta: -12,
      cancelChance: 0.15,
    },
    minFL: 2,
    weightBySeason: {
      spring: 10,
      summer: 0,
      autumn: 15,
      winter: 50,
    },
    scalingNote: 'Requires deicing pad capacity and glycol reserves at FL2+.',
  },
  {
    id: 'snowstorm',
    name: 'Snowstorm',
    blurb: 'Heavy snowfall requiring continuous runway plowing and deicing operations.',
    durationHours: [4, 12],
    effects: {
      runwayRateMult: 0.3,
      groundOpsMult: 0.4,
      paxHappinessDelta: -20,
      cancelChance: 0.25,
    },
    minFL: 2,
    weightBySeason: {
      spring: 10,
      summer: 0,
      autumn: 10,
      winter: 60,
    },
    scalingNote: 'Plow fleets and winter ops staffing unlock at FL2 to prevent airport closure.',
  },
  {
    id: 'crosswind',
    name: 'Crosswind',
    blurb: 'Strong sustained gusts perpendicular to main runways increase separation spacing.',
    durationHours: [3, 10],
    effects: {
      runwayRateMult: 0.7,
      groundOpsMult: 0.9,
      paxHappinessDelta: -5,
      cancelChance: 0.08,
    },
    minFL: 3,
    weightBySeason: {
      spring: 35,
      summer: 20,
      autumn: 35,
      winter: 25,
    },
    scalingNote: 'Secondary crosswind runway construction at FL3+ mitigates throughput penalty.',
  },
  {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    blurb: 'Convective activity with lightning stops ramp operations and triggers holds.',
    durationHours: [1, 4],
    effects: {
      runwayRateMult: 0.3,
      groundOpsMult: 0.2,
      paxHappinessDelta: -15,
      cancelChance: 0.2,
    },
    minFL: 3,
    weightBySeason: {
      spring: 30,
      summer: 60,
      autumn: 20,
      winter: 5,
    },
    scalingNote: 'Ramp lightning detection systems at FL3 provide safety warnings.',
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    blurb: 'Extreme ambient temperatures reduce air density, lowering runway performance and max takeoff weight.',
    durationHours: [6, 18],
    effects: {
      runwayRateMult: 0.75,
      groundOpsMult: 0.85,
      paxHappinessDelta: -10,
      cancelChance: 0.05,
    },
    minFL: 4,
    weightBySeason: {
      spring: 10,
      summer: 65,
      autumn: 10,
      winter: 0,
    },
    scalingNote: 'FL4 longer runways and high-altitude weight restriction rules lessen penalty.',
  },
  {
    id: 'hail',
    name: 'Hail',
    blurb: 'Severe hail impacts inspect aircraft airframes and halts apron movements.',
    durationHours: [1, 3],
    effects: {
      runwayRateMult: 0.2,
      groundOpsMult: 0.1,
      paxHappinessDelta: -18,
      cancelChance: 0.3,
    },
    minFL: 4,
    weightBySeason: {
      spring: 25,
      summer: 30,
      autumn: 15,
      winter: 5,
    },
    scalingNote: 'Hangar space and inspection crews at FL4 prevent grounded airframe backlogs.',
  },
  {
    id: 'dust_storm',
    name: 'Dust Storm',
    blurb: 'Particulate dust storm drastically cuts visibility and clogs engine air intakes.',
    durationHours: [4, 14],
    effects: {
      runwayRateMult: 0.4,
      groundOpsMult: 0.5,
      paxHappinessDelta: -15,
      cancelChance: 0.22,
    },
    minFL: 5,
    weightBySeason: {
      spring: 30,
      summer: 40,
      autumn: 20,
      winter: 10,
    },
    scalingNote: 'Advanced air filtration maintenance at FL5 preserves engine overhaul intervals.',
  },
  {
    id: 'typhoon_hurricane_watch',
    name: 'Typhoon/Hurricane Watch',
    blurb: 'Major tropical cyclone system approaching, forcing flight cancellations and tie-downs.',
    durationHours: [12, 36],
    effects: {
      runwayRateMult: 0.1,
      groundOpsMult: 0.1,
      paxHappinessDelta: -30,
      cancelChance: 0.6,
    },
    minFL: 6,
    weightBySeason: {
      spring: 5,
      summer: 45,
      autumn: 45,
      winter: 5,
    },
    scalingNote: 'Hub emergency protocols and diversion agreements at FL6 manage widespread cancellations.',
  },
  {
    id: 'volcanic_ash_advisory',
    name: 'Volcanic Ash Advisory',
    blurb: 'Airborne volcanic ash plume closes airspace corridors and severely restricts flight operations.',
    durationHours: [8, 24],
    effects: {
      runwayRateMult: 0.2,
      groundOpsMult: 0.5,
      paxHappinessDelta: -25,
      cancelChance: 0.5,
    },
    minFL: 7,
    weightBySeason: {
      spring: 15,
      summer: 15,
      autumn: 15,
      winter: 15,
    },
    scalingNote: 'Global routing coordination at FL7 enables international rerouting.',
  },
]

export function pickWeatherEvent(
  fl: number,
  season: Season,
  rng: () => number = simRandom,
): WeatherEvent | null {
  const eligible = WEATHER_EVENTS.filter(
    (event) => event.minFL <= fl && (event.weightBySeason[season] ?? 0) > 0,
  )
  if (eligible.length === 0) {
    return null
  }
  const totalWeight = eligible.reduce(
    (sum, event) => sum + event.weightBySeason[season],
    0,
  )
  if (totalWeight <= 0 || Number.isNaN(totalWeight)) {
    return null
  }
  let roll = rng() * totalWeight
  for (const event of eligible) {
    const weight = event.weightBySeason[season]
    if (roll < weight) {
      return event
    }
    roll -= weight
  }
  return eligible[eligible.length - 1]
}

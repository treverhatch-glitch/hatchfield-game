import type { CouncilRequestDef } from './types.ts'

/** Council opens during normal late play, before the first prestige XP star. */
export const COUNCIL_UNLOCK_FIELD_LEVEL = 8
export const COUNCIL_STARTING_STANDING = 50
export const COUNCIL_REQUEST_INTERVAL_DAYS = 10
export const COUNCIL_STANDING_MIN = 0
export const COUNCIL_STANDING_MAX = 100
export const COUNCIL_PASS_STANDING_BONUS = 4
export const COUNCIL_FAIL_STANDING_PENALTY = -2
/** Existing award prestige helps governance without changing field XP or its curves. */
export const COUNCIL_PRESTIGE_VOTE_WEIGHT = 0.5
export const COUNCIL_HISTORY_LIMIT = 8

export const COUNCIL_REQUESTS: readonly CouncilRequestDef[] = [
  {
    id: 'surface-access',
    title: 'Regional access compact',
    sponsor: 'Transit committee',
    request: 'The city wants the airport to share the cost of late buses and accessible curb works.',
    threshold: 64,
    prestigeReward: 2,
    choices: [
      {
        id: 'full',
        label: 'Underwrite the compact',
        detail: 'Fund the full public-access package. Expensive, but the coalition is broad.',
        cost: 45_000,
        voteBoost: 18,
        standingDelta: 8,
        reputationDelta: 2,
      },
      {
        id: 'compromise',
        label: 'Fund the curb works',
        detail: 'Back a smaller accessible-curb package and ask the region to operate the buses.',
        cost: 18_000,
        voteBoost: 8,
        standingDelta: 3,
        reputationDelta: 1,
      },
      {
        id: 'decline',
        label: 'Decline funding',
        detail: 'Keep the cash for airport capacity and accept the public disagreement.',
        cost: 0,
        voteBoost: -8,
        standingDelta: -7,
        reputationDelta: -1,
      },
    ],
  },
  {
    id: 'night-charter',
    title: 'Night operations charter',
    sponsor: 'Neighbourhood forum',
    request: 'Councillors will vote on a charter pairing late operations with home-insulation support.',
    threshold: 68,
    prestigeReward: 2,
    choices: [
      {
        id: 'full',
        label: 'Fund the insulation fund',
        detail: 'Pay into the full mitigation fund and secure the strongest council coalition.',
        cost: 55_000,
        voteBoost: 20,
        standingDelta: 9,
        reputationDelta: 2,
      },
      {
        id: 'compromise',
        label: 'Offer a monitoring pact',
        detail: 'Fund independent noise monitoring without underwriting every home.',
        cost: 14_000,
        voteBoost: 6,
        standingDelta: 2,
        reputationDelta: 0,
      },
      {
        id: 'decline',
        label: 'Defend airport discretion',
        detail: 'Spend nothing and argue that existing operating rules are enough.',
        cost: 0,
        voteBoost: -10,
        standingDelta: -8,
        reputationDelta: -2,
      },
    ],
  },
  {
    id: 'skills-campus',
    title: 'Airport skills campus',
    sponsor: 'Employment board',
    request: 'The region proposes a training partnership for terminal, maintenance, and ramp careers.',
    threshold: 70,
    prestigeReward: 3,
    choices: [
      {
        id: 'full',
        label: 'Found the campus',
        detail: 'Make the airport lead sponsor and put its name on the programme.',
        cost: 70_000,
        voteBoost: 22,
        standingDelta: 10,
        reputationDelta: 3,
      },
      {
        id: 'compromise',
        label: 'Sponsor apprenticeships',
        detail: 'Buy a smaller annual apprenticeship cohort with a narrower coalition.',
        cost: 25_000,
        voteBoost: 9,
        standingDelta: 4,
        reputationDelta: 1,
      },
      {
        id: 'decline',
        label: 'Leave it to the colleges',
        detail: 'Preserve capital, but lose influence with the employment board.',
        cost: 0,
        voteBoost: -9,
        standingDelta: -7,
        reputationDelta: -1,
      },
    ],
  },
]

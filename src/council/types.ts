export type CouncilChoiceId = 'full' | 'compromise' | 'decline'

export interface CouncilChoice {
  id: CouncilChoiceId
  label: string
  detail: string
  cost: number
  voteBoost: number
  standingDelta: number
  reputationDelta: number
}

export interface CouncilRequestDef {
  id: string
  title: string
  sponsor: string
  request: string
  threshold: number
  prestigeReward: number
  choices: readonly CouncilChoice[]
}

export interface OpenCouncilRequest {
  id: string
  openedDay: number
}

export interface CouncilVoteRecord {
  requestId: string
  title: string
  day: number
  choiceId: CouncilChoiceId
  choiceLabel: string
  support: number
  passed: boolean
  cost: number
  prestigeAwarded: number
}

export interface CouncilState {
  processedDay: number
  standing: number
  nextRequestDay: number
  requestIndex: number
  pending: OpenCouncilRequest | null
  votes: CouncilVoteRecord[]
}

export interface CouncilContext {
  day: number
  fieldLevel: number
  prestige: number
  cash: number
}

export interface CouncilChoiceView extends CouncilChoice {
  projectedSupport: number
  projectedPass: boolean
  affordable: boolean
}

export interface CouncilRequestView {
  id: string
  title: string
  sponsor: string
  request: string
  openedDay: number
  threshold: number
  choices: CouncilChoiceView[]
}

export interface CouncilView {
  unlocked: boolean
  unlockFieldLevel: number
  standing: number
  prestige: number
  nextRequestInDays: number | null
  pending: CouncilRequestView | null
  votes: CouncilVoteRecord[]
}

export interface CouncilBooks {
  balance(): number
  spend(amount: number, label: string): boolean
}

export interface CouncilNote {
  text: string
  tone: 'ok' | 'good' | 'bad'
  reputation?: number
  prestige?: number
}

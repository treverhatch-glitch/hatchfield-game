import type { MoneyCategory } from '../core/bank.ts'
import type { BankPostMeta } from '../core/bank.ts'
import type { CampaignKind, QualityTier, UnitKind } from './config.ts'

export interface TycoonBooks {
  balance(): number
  /** Signed amount. Return false when an expense cannot be paid. */
  post(category: MoneyCategory, amount: number, meta: BankPostMeta): boolean
  entriesBetween(start: number, end: number): { category: MoneyCategory; amount: number }[]
}

export interface TycoonNote {
  text: string
  tone: 'ok' | 'good' | 'bad'
  /** Applied by the sim onto airport reputation. */
  reputation?: number
}

export interface TenantUnit {
  id: string
  kind: UnitKind
  label: string
}

export interface TenantBid {
  id: string
  unitId: string
  brand: string
  kind: UnitKind
  dailyRent: number
  /** Airport cut of sales, 0–1. */
  revenueShare: number
  quality: QualityTier
}

export interface Lease {
  id: string
  unitId: string
  brand: string
  kind: UnitKind
  dailyRent: number
  revenueShare: number
  quality: QualityTier
  startDay: number
  /** First day the lease is no longer active. */
  endDay: number
  renewed: number
}

export interface RunningCampaign {
  id: string
  kind: CampaignKind
  startDay: number
  endDay: number
  cost: number
}

export interface YearBucket {
  passengers: number
  satisfactionSum: number
  satisfactionN: number
  cleanlinessSum: number
  cleanlinessN: number
}

export interface YearMetric {
  id: 'revenue' | 'costs' | 'passengers' | 'satisfaction'
  label: string
  value: number
  /** 0–100, higher is better, so costs invert. */
  score: number
}

export interface AwardWin {
  id: string
  name: string
  year: number
  prestige: number
  reputation: number
}

export interface YearReport {
  year: number
  fromDay: number
  toDay: number
  revenue: number
  costs: number
  net: number
  passengers: number
  satisfaction: number
  cleanliness: number
  best: YearMetric
  worst: YearMetric
  awards: AwardWin[]
}

export interface TycoonState {
  seed: number
  rngState: number
  seq: number
  /** Last completed game day already closed. -1 before the first day ends. */
  processedDay: number
  units: TenantUnit[]
  leases: Lease[]
  bids: Record<string, TenantBid[]>
  rerollDay: Record<string, number>
  campaigns: RunningCampaign[]
  prestige: number
  awards: AwardWin[]
  bucket: YearBucket
  pendingReport: YearReport | null
}

export interface TycoonPulse {
  passengers: number
  /** 0–100. */
  satisfaction: number
  /** 0–100. Low wear is a clean terminal. */
  cleanliness: number
}

export interface UnitView {
  id: string
  kind: UnitKind
  label: string
  bids: TenantBid[]
  lease: Lease | null
  daysLeft: number | null
}

export interface CampaignView {
  kind: CampaignKind
  label: string
  cost: number
  days: number
  blurb: string
  demandBoost: number
  airlineInterest: number
  /** Days remaining when this campaign is the one on the clock. */
  activeDaysLeft: number | null
  /** Another campaign is already running. */
  blocked: boolean
}

export type TycoonTab = 'shops' | 'ads' | 'awards' | 'year'

export interface TycoonView {
  units: UnitView[]
  campaigns: CampaignView[]
  demandMultiplier: number
  airlineInterest: number
  prestige: number
  awards: AwardWin[]
  report: YearReport | null
}

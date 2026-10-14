
export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  isMilestone?: boolean
}

export interface AchievementState {
  unlocked: Record<string, number> // id -> timestamp
  progress?: Record<string, number>
}

export type AchievementEvent =
  | { type: "pax_served"; count: number }
  | { type: "flights_done"; count: number }
  | { type: "cash_earned"; amount: number }
  | { type: "reputation_reached"; level: number }
  | { type: "field_xp_gained"; amount: number }

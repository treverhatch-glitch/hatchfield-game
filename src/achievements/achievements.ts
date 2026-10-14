
import type { AchievementState, AchievementDef } from "./types.ts";

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  pax_100: { id: "pax_100", name: "100 Passengers", description: "Serve 100 passengers.", icon: "🧑‍🤝‍🧑" },
  pax_1000: { id: "pax_1000", name: "1,000 Passengers", description: "Serve 1,000 passengers.", icon: "🧑‍🤝‍🧑", isMilestone: true },
  pax_10000: { id: "pax_10000", name: "10,000 Passengers", description: "Serve 10,000 passengers.", icon: "🧑‍🤝‍🧑", isMilestone: true },
  flights_50: { id: "flights_50", name: "50 Flights", description: "Complete 50 flights.", icon: "✈️" },
  flights_500: { id: "flights_500", name: "500 Flights", description: "Complete 500 flights.", icon: "✈️", isMilestone: true },
  cash_1m: { id: "cash_1m", name: "Millionaire", description: "Have $1,000,000 cash.", icon: "💰", isMilestone: true },
  reputation_90: { id: "reputation_90", name: "Stellar Reputation", description: "Reach 90% reputation.", icon: "⭐" }
};

export class AchievementTracker {
  state: AchievementState;
  private newUnlocks: AchievementDef[] = [];

  constructor(state?: AchievementState) {
    this.state = state || { unlocked: {} };
  }

  load(state: AchievementState) {
    this.state = state;
  }

  save(): AchievementState {
    return { ...this.state };
  }

  check(game: any) { // using any for now, later Game
    this.checkThreshold("pax_100", game.paxServed >= 100);
    this.checkThreshold("pax_1000", game.paxServed >= 1000);
    this.checkThreshold("pax_10000", game.paxServed >= 10000);
    this.checkThreshold("flights_50", game.flightsDone >= 50);
    this.checkThreshold("flights_500", game.flightsDone >= 500);
    this.checkThreshold("cash_1m", game.cash >= 1000000);
    this.checkThreshold("reputation_90", game.reputation >= 90);
  }

  private checkThreshold(id: string, condition: boolean) {
    if (condition && !this.state.unlocked[id]) {
      this.state.unlocked[id] = Date.now();
      this.newUnlocks.push(ACHIEVEMENTS[id]);
    }
  }

  popUnlocks(): AchievementDef[] {
    const unlocks = this.newUnlocks;
    this.newUnlocks = [];
    return unlocks;
  }
}

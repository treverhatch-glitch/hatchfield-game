import { ALL_RULES } from './rules';
import type { AdvisorCard, AdvisorSnapshot, Rule, Severity } from './types';

export interface AdvisorOptions { cooldown?: number; dismissCooldown?: number; maxCards?: number; rules?: Rule[] }
const RANK: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

/**
 * Stateful wrapper around pure rules. Advisor only diagnoses; it never changes sim state
 * (bottlenecks are never suppressed, only explained).
 */
export class Advisor {
  private active = new Map<string, AdvisorCard>();
  private lastSeen = new Map<string, number>();
  private dismissed = new Map<string, number>();
  private o: Required<AdvisorOptions>;
  constructor(opts: AdvisorOptions = {}) {
    this.o = { cooldown: 120, dismissCooldown: 900, maxCards: 3, rules: ALL_RULES, ...opts };
  }

  update(s: AdvisorSnapshot): AdvisorCard[] {
    const seen = new Set<string>();
    for (const rule of this.o.rules) for (const c of rule(s)) {
      if (seen.has(c.key)) continue; // dedupe within tick
      seen.add(c.key);
      this.lastSeen.set(c.key, s.time);
      const d = this.dismissed.get(c.key);
      if (d !== undefined && s.time - d < this.o.dismissCooldown) continue;
      const prev = this.active.get(c.key);
      this.active.set(c.key, { ...c, createdAt: prev?.createdAt ?? s.time });
    }
    // Retire cards whose condition has cleared for longer than cooldown (prevents flicker).
    for (const [k] of this.active) {
      if (!seen.has(k) && s.time - (this.lastSeen.get(k) ?? 0) >= this.o.cooldown) this.active.delete(k);
    }
    return this.cards();
  }

  cards(): AdvisorCard[] {
    return [...this.active.values()]
      .sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.createdAt - b.createdAt)
      .slice(0, this.o.maxCards);
  }

  dismiss(key: string, time: number): void { this.active.delete(key); this.dismissed.set(key, time); }
}

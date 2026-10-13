import type { LedgerEntry } from './types';
import { GLYCOL_PRICE_PER_LITRE, GLYCOL_ORDER_LEAD_TIME } from './data';

interface PendingOrder {
  litres: number;
  arriveAt: number;
}

export class GlycolStock {
  litres: number;
  ledger: LedgerEntry[];
  private pendingOrders: PendingOrder[];

  constructor(initialLitres: number = 0) {
    this.litres = typeof initialLitres === 'number' && !Number.isNaN(initialLitres)
      ? Math.max(0, initialLitres)
      : 0;
    this.ledger = [];
    this.pendingOrders = [];
  }

  order(litres: number, now: number): void {
    if (typeof litres !== 'number' || Number.isNaN(litres) || litres <= 0) {
      return;
    }
    const safeNow = typeof now === 'number' && !Number.isNaN(now) ? now : 0;
    const cost = litres * GLYCOL_PRICE_PER_LITRE;

    this.ledger.push({
      kind: 'glycol_order',
      amount: -cost,
      time: safeNow,
    });

    this.pendingOrders.push({
      litres,
      arriveAt: safeNow + GLYCOL_ORDER_LEAD_TIME,
    });
  }

  tick(now: number): void {
    const safeNow = typeof now === 'number' && !Number.isNaN(now) ? now : 0;
    const remainingOrders: PendingOrder[] = [];

    for (const pending of this.pendingOrders) {
      if (pending.arriveAt <= safeNow) {
        this.litres += pending.litres;
      } else {
        remainingOrders.push(pending);
      }
    }

    this.pendingOrders = remainingOrders;
  }

  consume(l: number): boolean {
    if (typeof l !== 'number' || Number.isNaN(l) || l < 0) {
      return false;
    }
    if (l === 0) {
      return true;
    }
    if (this.litres >= l) {
      this.litres -= l;
      return true;
    }
    return false;
  }
}

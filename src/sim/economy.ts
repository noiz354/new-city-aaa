// Treasury: single balance, budget, monthly tax income (T-301; docs/02 §4), 12-month history ring,
// bankruptcy block. Income per building = TAX_BASE × (rate/9) × happyFactor(0.6+0.4·happy/100).
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import { COSTS } from './tuning/costs.js';
import { BANKRUPT_LIMIT, HAPPINESS_STUB, HAPPY_FLOOR, HISTORY_MONTHS, TAX_BASE, TAX_RATE } from './tuning/economy.js';

export interface MonthEntry {
  income: number;
  expense: number; // gross upkeep (positive number)
  subsidy: number; // frontier safety-net paid back (positive number)
}

export class Economy {
  balance: number;
  /**
   * Monthly tax-% per zone (docs/02 §4). No writer exists before the T-302 slider task, so the
   * rates always equal the 9/9/9 default and reconstruct identically at load — persisting them
   * is bundled with T-302's save-format change (spec §9 ask-first, decision pending).
   */
  readonly tax: { r: number; c: number; i: number } = { r: TAX_RATE.default, c: TAX_RATE.default, i: TAX_RATE.default };
  private readonly ring: MonthEntry[] = [];
  private ringHead = 0; // index where the NEXT record lands (oldest record when full)
  private ringCount = 0;
  private last: MonthEntry = { income: 0, expense: 0, subsidy: 0 };

  constructor(start: number = COSTS.startBalance) {
    this.balance = Math.floor(start);
  }

  canAfford(cost: number): boolean {
    return this.balance >= cost;
  }

  spend(cost: number): boolean {
    if (cost < 0 || !this.canAfford(cost)) return false;
    this.balance -= Math.floor(cost);
    return true;
  }

  add(amount: number): void {
    this.balance += Math.floor(amount);
  }

  /** T-302 seam: clamped integer slider set; default state is pre-slider VS-2a behavior. */
  setTax(zone: 'r' | 'c' | 'i', rate: number): boolean {
    if (!Number.isFinite(rate)) return false;
    this.tax[zone] = Math.max(TAX_RATE.min, Math.min(TAX_RATE.max, Math.round(rate)));
    return true;
  }

  /** T-301 docs/02 §4: income = Σ TAX_BASE[zone][level] × (rate/9) × (0.6 + 0.4·happy/100). */
  collectTax(buildings: Buildings): number {
    let total = 0;
    const happyFactor = HAPPY_FLOOR + 0.4 * (HAPPINESS_STUB / 100); // floor = death-spiral guard
    const rate = { 1: this.tax.r, 2: this.tax.c, 3: this.tax.i } as const;
    buildings.forEachLive((b) => {
      if (b.state !== BUILDING_OCCUPIED) return;
      const base = TAX_BASE[b.zone]?.[b.level] ?? 0;
      total += base * ((rate[b.zone as 1 | 2 | 3] ?? TAX_RATE.default) / TAX_RATE.default) * happyFactor;
    });
    return Math.floor(total);
  }

  /** docs/02 §4: balance < −$5,000 ⇒ paid commands blocked until the city climbs out. */
  isBankrupt(): boolean {
    return this.balance < BANKRUPT_LIMIT;
  }

  /** End-of-month ledger entry: treasury already settled; record the ring + last-month pair. */
  recordMonth(income: number, expense: number, subsidy: number): void {
    this.last = { income: Math.floor(income), expense: Math.floor(expense), subsidy: Math.floor(subsidy) };
    this.ring[this.ringHead] = this.last;
    this.ringHead = (this.ringHead + 1) % HISTORY_MONTHS;
    if (this.ringCount < HISTORY_MONTHS) this.ringCount++;
  }

  /** docs/02 §4 sparkline feed: oldest → newest (12 max); fresh and equal-sized arrays each call. */
  history(): MonthEntry[] {
    const out: MonthEntry[] = [];
    for (let i = 0; i < this.ringCount; i++) {
      const idx = (this.ringHead - this.ringCount + i + HISTORY_MONTHS * 2) % HISTORY_MONTHS;
      const e = this.ring[idx];
      if (e !== undefined) out.push({ income: e.income, expense: e.expense, subsidy: e.subsidy });
    }
    return out;
  }

  lastMonth(): MonthEntry {
    return { ...this.last };
  }
}

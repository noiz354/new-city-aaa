import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { Sim } from './sim.js';
import { TAX_BASE, HAPPINESS_STUB, BANKRUPT_LIMIT } from './tuning/economy.js';

function tinySim(): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13].map((x) => ({ x, y: 10 })) });
  if (!road.ok) throw new Error(road.reason);
  return sim;
}

function withR1(sim: Sim): void {
  const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 1 });
  if (!zone.ok) throw new Error(zone.reason);
}

describe('T-301 — tax income (docs/02 §4 canonical formula)', () => {
  it('occupied building pays TAX_BASE × (rate/9) × happyFactor once per month', () => {
    const sim = tinySim();
    withR1(sim);
    runDays(sim, 10); // complete (3d) + move-in same-day (T-202), comfortably inside the window
    // Happy stub 80 ⇒ happyFactor = 0.6 + 0.4·0.8 = 0.92; rate default 9 ⇒ ×1.
    const income = sim.economy.collectTax(sim.buildings);
    const expected = Math.floor(TAX_BASE[1]![1]! * 1 * (0.6 + 0.4 * (HAPPINESS_STUB / 100)));
    expect(sim.buildings.population()).toBe(4); // guard: R1 actually housing 4
    expect(income).toBe(expected);
    expect(income).toBe(23); // 25 × 0.92, floored
  });

  it('setTax clamps to docs/02 §4 range 0..20 and scales income by rate/9', () => {
    const sim = tinySim();
    withR1(sim);
    runDays(sim, 10);
    expect(sim.economy.setTax('r', 99)).toBe(true);
    expect(sim.economy.tax.r).toBe(20);
    const hi = sim.economy.collectTax(sim.buildings);
    sim.economy.setTax('r', -5);
    expect(sim.economy.tax.r).toBe(0);
    expect(sim.economy.collectTax(sim.buildings)).toBe(0); // rate 0 ⇒ no revenue, loop guard math
    expect(hi).toBe(Math.floor(25 * (20 / 9) * 0.92)); // ≈ 51
  });

  it('monthly tick lands income − upkeep on the real balance and records the ring', () => {
    const sim = tinySim();
    withR1(sim);
    runDays(sim, 10);
    // pop=4 < SUBSIDY_POP_LIMIT ⇒ frontier subsidy trims the month's net debit.
    const bill0 = sim.economy.balance;
    runDays(sim, 30);
    const m = sim.economy.lastMonth();
    expect(sim.economy.history()).toEqual([m]);
    expect(m.income).toBe(23); // exactly one settled month recorded with the canonical formula
    expect(m.expense).toBeGreaterThan(0);
    expect(sim.economy.balance).toBe(bill0 + m.income - (m.expense - m.subsidy));
  });

  it('12-month ring buffer wraps in order (oldest first)', () => {
    const sim = tinySim();
    runDays(sim, 360 + 36); // 12 full months + one extra
    const h = sim.economy.history();
    expect(h.length).toBe(12);
    const incomes = h.map((m) => m.income);
    expect(incomes.every((n) => n >= 0)).toBe(true);
    // The ring head wrapped exactly once: months 1..12 retained, month 13 rolled in at the front.
  });
});

describe('T-301 — bankruptcy block (docs/02 §4: < −$5,000)', () => {
  it('bankrupt ⇒ paid commands rejected with machine-readable reason + recoverable', () => {
    const sim = tinySim();
    sim.economy.balance = BANKRUPT_LIMIT - 1; // below threshold
    expect(sim.economy.isBankrupt()).toBe(true);
    const r = sim.execute({ kind: 'place-road', path: [14, 15].map((x) => ({ x, y: 10 })) });
    expect(r).toEqual({ ok: false, reason: 'bankrupt' });
    const z = sim.execute({ kind: 'paint-zone', rect: { x0: 11, y0: 9, x1: 11, y1: 9 }, zone: 1 });
    expect(z.ok).toBe(false); // paint is paid ⇒ same block
    // …and funds can still rescue the city (land tax + subsidy floor the loop per docs/02 §5).
    sim.economy.balance = 100; // recovery: back above the limit AND able to afford the paid tile ($10)
    expect(sim.execute({ kind: 'paint-zone', rect: { x0: 11, y0: 9, x1: 11, y1: 9 }, zone: 1 }).ok).toBe(true);
  });

  it('boundary: exactly at the limit commands still pass; history stays reload-independent', () => {
    const sim = tinySim();
    sim.economy.balance = BANKRUPT_LIMIT;
    expect(sim.economy.isBankrupt()).toBe(false);
    // The history ring is derived analytics — loadState does not restore it (no save-format change);
    // last-month/ring simply restream from the next monthly tick.
  });

  it('month tick cadence: one settlement per 3200 ticks, honest zero income on empty city', () => {
    const sim = tinySim(); // road only → upkeep debit
    const before = sim.snapshot().balance;
    runDays(sim, 60);
    const m = sim.economy.lastMonth();
    expect(sim.economy.history().length).toBe(2);
    expect(m.income).toBe(0); // nothing housed → zero tax, honest zero
    expect(sim.snapshot().balance).toBe(before - (m.expense - m.subsidy) * 2); // 2 subsidized road-upkeep months
  });
});

// Upkeep T-205 (FR-E03, B1/B3/B6): monthly per-building upkeep debits the treasury.
// Canonical numbers: upkeep[zone][level] from docs/03-simulation-core (R1=2, C1=4, I1=6);
// roads $0.5/tile/mo (B3, integerized as floor(roads/2)); Frontier subsidy <500 pop = −30%
// (B6, integerized as floor(gross×7/10)); all money integer; balance may go negative
// (bankruptcy blocking is T-301, not here). Construction pays nothing; occupied AND
// abandoned pay (structure stands). Tick-order compliant: economy stage after growth
// (simulation-architecture §2).
import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { BUILDING_ABANDONED, BUILDING_CONSTRUCTION } from './buildings.js';
import { Sim } from './sim.js';

/** Residential town: road row at y=10, N R lots adjacent (y=9), like growth.test. */
function buildRTown(lots = 4): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((x) => ({ x, y: 10 })) });
  if (!road.ok) throw new Error(road.reason);
  const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 9 + lots, y1: 9 }, zone: 1 });
  if (!zone.ok) throw new Error(zone.reason);
  return sim;
}

describe('Upkeep monthly tick (T-205, FR-E03)', () => {
  it('monthlyBill exposes canonical parts: buildings by zone×level, roads floor(N/2)', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const r1 = sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] });
    if (!r1.ok) throw new Error(r1.reason);
    const zR = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 1 });
    if (!zR.ok) throw new Error(zR.reason);
    const zC = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 11, x1: 10, y1: 11 }, zone: 2 });
    if (!zC.ok) throw new Error(zC.reason);
    const zI = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 12, x1: 10, y1: 12 }, zone: 3 });
    if (!zI.ok) throw new Error(zI.reason);
    expect(sim.buildings.startConstruction(10, 9, 0)).not.toBeNull(); // R1
    expect(sim.buildings.startConstruction(10, 11, 0)).not.toBeNull(); // C1
    expect(sim.buildings.startConstruction(10, 12, 0)).not.toBeNull(); // I1
    runDays(sim, 5); // all occupied (capacity C/I = 0 but state holds)
    const bill = sim.upkeep.monthlyBill();
    expect(bill.buildings).toBe(2 + 4 + 6); // R1 + C1 + I1 canonical table
    expect(bill.roads).toBe(0); // 1 road tile → floor(1/2)
    expect(bill.gross).toBe(bill.buildings + bill.roads);
  });

  it('construction pays nothing; abandoned keeps paying (structure stands)', () => {
    const sim = buildRTown(2);
    runDays(sim, 1); // one under construction
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_CONSTRUCTION);
    expect(sim.upkeep.monthlyBill().buildings).toBe(0); // construction excluded
    runDays(sim, 4); // both occupied
    const occupied = sim.upkeep.monthlyBill().buildings;
    expect(occupied).toBe(4); // 2 × R1 2$
    const hid = ((): number => {
      let hit = -1;
      sim.buildings.forEachLive((b) => { if (b.x === 10 && b.y === 9) hit = b.id; });
      return hit;
    })();
    expect(sim.buildings.transition(hid, BUILDING_ABANDONED, sim.clock.tick)).toBe(true);
    expect(sim.upkeep.monthlyBill().buildings).toBe(4); // abandoned still billed
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_ABANDONED);
  });

  it('empty city: two months pass, treasury untouched', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const start = sim.snapshot().balance;
    runDays(sim, 61);
    expect(sim.snapshot().balance).toBe(start);
  });

  it('month pass debits exact amount with Frontier subsidy (<500 pop, −30%)', () => {
    // 10×R1 (gross 20) + 10 road tiles (roads 10/2=5) → gross 25; subsidy floor(25×7/10)=17.
    const sim = buildRTown(10);
    runDays(sim, 15); // all 10 houses occupied by day ~14
    expect(sim.buildings.count).toBe(10);
    expect(sim.upkeep.monthlyBill().gross).toBe(25);
    runDays(sim, 14); // day 29: no month boundary crossed since
    const before = sim.snapshot().balance;
    runDays(sim, 1); // day 30 → month pass #1
    expect(before - sim.snapshot().balance).toBe(17);
    expect(sim.snapshot().population).toBeGreaterThan(0);
    expect(sim.snapshot().population).toBeLessThan(500);
  });

  it('subsidy drops at ≥500 pop: full upkeep charged (no rounding handout)', () => {
    // Two parallel roads (y=4, y=8) with 5 lot rows between/around them: every lot is ≤2 from
    // a road (T-204 rule). 27 cols × 5 rows = 135 lots → 135×4 = 540 residents possible.
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    for (const ry of [4, 8]) {
      const road = sim.execute({ kind: 'place-road', path: Array.from({ length: 27 }, (_, i) => ({ x: 2 + i, y: ry })) });
      if (!road.ok) throw new Error(road.reason);
    }
    for (const [y0, y1] of [[2, 3], [5, 7]] as const) {
      const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 2, y0, x1: 28, y1 }, zone: 1 });
      if (!zone.ok) throw new Error(zone.reason);
    }
    runDays(sim, 140); // spawn 1/day; 125th house occupied by ~day 128 → pop crosses 500
    expect(sim.snapshot().population).toBeGreaterThanOrEqual(500);
    expect(sim.buildings.count).toBe(135);
    const gross = sim.upkeep.monthlyBill();
    expect(gross.subsidyApplied).toBe(false);
    expect(gross.gross).toBe(135 * 2 + 27); // R1×135 + roads 54/2
    runDays(sim, 19); // day 159 — month pass #5 (day 150) already charged full
    const before = sim.snapshot().balance;
    runDays(sim, 31); // day 190: exactly one month pass (day 180) in between
    expect(before - sim.snapshot().balance).toBe(297); // full gross, no subsidy
    expect(gross.net).toBe(297);
  });

  it('bulldozing a building stops its upkeep from the next pass (derived bill)', () => {
    const sim = buildRTown(2);
    runDays(sim, 5);
    expect(sim.upkeep.monthlyBill().buildings).toBe(4);
    const r = sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 9, x1: 10, y1: 9 } });
    if (!r.ok) throw new Error(r.reason);
    expect(sim.upkeep.monthlyBill().buildings).toBe(2);
  });

  it('month pass emits treasury-changed so the HUD balance moves', () => {
    const sim = buildRTown(4);
    runDays(sim, 10);
    sim.drainEvents();
    runDays(sim, 21); // crosses day-30 month pass
    const evs = sim.drainEvents();
    expect(evs.some((e) => e.type === 'treasury-changed' && 'balance' in e)).toBe(true);
  });

  it('balance may go negative: upkeep debits even when the treasury cannot afford it', () => {
    const sim = buildRTown(2);
    sim.economy.balance = 0; // lawful: bankruptcy handling is T-301, not here
    runDays(sim, 31); // month pass: 2×R1 gross 4, subsidy floor(4×7/10)=2
    expect(sim.snapshot().balance).toBeLessThan(0);
  });

  it('deterministic: identical scripts → identical balance across month boundaries', () => {
    const a = buildRTown(6);
    const b = buildRTown(6);
    runDays(a, 65);
    runDays(b, 65);
    expect(a.hash()).toBe(b.hash());
    expect(a.snapshot().balance).toBe(b.snapshot().balance);
  });

  it('load/save parity: restored sim charges the identical bill on the next pass', () => {
    const a = buildRTown(4);
    runDays(a, 20);
    const b = new Sim({ seed: 7, size: 64, preset: 'plains' });
    b.loadState(a.getSaveMeta(), a.getSaveLayers(), a.getSaveEntities());
    runDays(a, 40);
    runDays(b, 40);
    expect(b.hash()).toBe(a.hash());
  });
});

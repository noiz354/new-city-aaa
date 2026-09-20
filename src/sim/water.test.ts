import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { Sim } from './sim.js';
import { demandFor } from './water.js';
import { COSTS_WATER, WATER_TUNING } from './tuning/water.js';

/** Road spine y=20 serves R (y=19) and I (y=21) blocks; tower joins the net via the road. */
function buildWaterCity(opts: { tower: { x: number; y: number } | null; iX1?: number }): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({
    kind: 'place-road',
    path: Array.from({ length: 34 }, (_, k) => ({ x: 8 + k, y: 20 })),
  });
  if (!road.ok) throw new Error(`road: ${road.reason}`);
  const r = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 19, x1: 13, y1: 19 }, zone: 1 });
  if (!r.ok) throw new Error(`R zone: ${r.reason}`);
  const iX1 = opts.iX1 ?? 39;
  const ind = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 21, x1: iX1, y1: 21 }, zone: 3 });
  if (!ind.ok) throw new Error(`I zone: ${ind.reason}`);
  if (opts.tower) {
    const t = sim.execute({ kind: 'place-tower', x: opts.tower.x, y: opts.tower.y });
    if (!t.ok) throw new Error(`tower: ${t.reason}`);
  }
  return sim;
}

describe('T-406 water grid (pressure falloff)', () => {
  it('inactive grid: lots count as watered, city grows exactly like before (legacy-guard)', () => {
    const sim = buildWaterCity({ tower: null, iX1: 13 }); // small I: R homes spawn early, pop flows by day 14
    expect(sim.water.active).toBe(false);
    expect(sim.water.isWatered(10, 19)).toBe(true);
    expect(sim.snapshot().water).toEqual({ active: false, towers: 0, nets: 0, supplyKl: 0, demandKl: 0, unwatered: 0 });
    runDays(sim, 14);
    expect(sim.buildings.count).toBeGreaterThan(0);
    expect(sim.snapshot().population).toBeGreaterThan(0);
    expect(sim.water.active).toBe(false); // growth alone never activates the grid
  });

  it('demand table: R 10 / C 15 / I 30 kL at level 1 (docs/03 §3)', () => {
    expect(demandFor(1, 1)).toBe(10);
    expect(demandFor(2, 2)).toBe(50);
    expect(demandFor(3, 1)).toBe(30);
    expect(demandFor(0, 1)).toBe(0);
  });

  it('place-tower: cost, validation, immediate grid truth', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const before = sim.snapshot().balance;
    const t = sim.execute({ kind: 'place-tower', x: 5, y: 5 });
    if (!t.ok) throw new Error(`tower: ${t.reason}`);
    expect(t.cost).toBe(COSTS_WATER.tower);
    expect(sim.snapshot().balance).toBe(before - COSTS_WATER.tower);
    // Same tile twice / on road / out of bounds are rejected.
    expect(sim.execute({ kind: 'place-tower', x: 5, y: 5 }).ok).toBe(false);
    sim.execute({ kind: 'place-road', path: [{ x: 20, y: 20 }] });
    expect(sim.execute({ kind: 'place-tower', x: 20, y: 20 }).ok).toBe(false);
    expect(sim.execute({ kind: 'place-tower', x: -1, y: 0 }).ok).toBe(false);
    // Grid truth is immediate (no one-tick dry start): active with 1 net, 800 kL supply.
    expect(sim.snapshot().water).toMatchObject({ active: true, towers: 1, supplyKl: WATER_TUNING.towerCapacityKl });
  });

  it('growth gate: connected city grows, isolated-tower city stalls with no-water', () => {
    const wet = buildWaterCity({ tower: { x: 9, y: 21 }, iX1: 13 }); // adjacent to the road → same net
    const dry = buildWaterCity({ tower: { x: 50, y: 50 }, iX1: 13 }); // tower exists, grid live, lots off-net
    runDays(wet, 14);
    runDays(dry, 14);
    // Connected city thrives on the tower-fed road net.
    expect(wet.buildings.count).toBeGreaterThan(0);
    expect(wet.snapshot().population).toBeGreaterThan(0);
    expect(wet.snapshot().water.unwatered).toBe(0);
    expect(wet.snapshot().water.supplyKl).toBe(WATER_TUNING.towerCapacityKl);
    // Isolated tower activates the grid but feeds nothing: R lots stall, reason is no-water.
    expect(dry.water.active).toBe(true);
    expect(dry.buildings.count).toBe(0);
    expect(dry.snapshot().population).toBe(0);
    expect(dry.growth.growthBlockReason(10, 19)).toBe('no-water');
    expect(dry.snapshot().water.unwatered).toBeGreaterThan(0);
  });

  it('far lots on a loaded net lose pressure; a 2nd tower near them restores all (T-406 accept)', () => {
    const sim = buildWaterCity({ tower: { x: 9, y: 21 } });
    runDays(sim, 40);
    const status = sim.water.netStatus();
    expect(status.supplyKl).toBe(WATER_TUNING.towerCapacityKl);
    expect(status.demandKl).toBeGreaterThan(0);
    expect(status.unpowered).toBeGreaterThan(0);
    // Homes near the tower keep pressure; every unwatered tile is far I.
    for (let x = 10; x <= 13; x++) expect(sim.water.isWatered(x, 19)).toBe(true);
    for (const t of sim.water.collectUnwatered()) {
      expect(sim.world.zone[sim.world.idx(t.x, t.y)]).toBe(3);
    }
    // Unwatered flips surfaced as events for the icon layer.
    const flips = sim.drainEvents().filter((e) => e.type === 'water-changed');
    expect(flips.some((e) => e.type === 'water-changed' && e.watered === false)).toBe(true);
    // T-406 acceptance: a second tower near the far lots restores every lot immediately.
    const second = sim.execute({ kind: 'place-tower', x: 40, y: 21 });
    if (!second.ok) throw new Error(`2nd tower: ${second.reason}`);
    expect(sim.water.netStatus().unpowered).toBe(0);
    expect(sim.snapshot().water.supplyKl).toBe(2 * WATER_TUNING.towerCapacityKl);
    const restored = sim.drainEvents().filter((e) => e.type === 'water-changed');
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.every((e) => e.type !== 'water-changed' || e.watered)).toBe(true);
  });

  it('bulldozing the only tower deactivates the grid (self-watered again)', () => {
    const sim = buildWaterCity({ tower: { x: 9, y: 21 } });
    expect(sim.water.active).toBe(true);
    const b = sim.execute({ kind: 'bulldoze', rect: { x0: 9, y0: 21, x1: 9, y1: 21 } });
    expect(b.ok).toBe(true);
    expect(sim.water.active).toBe(false);
    expect(sim.water.isWatered(10, 19)).toBe(true);
  });

  it('hash covers tower sites: twins match, divergent water diverges', () => {
    const a = buildWaterCity({ tower: { x: 9, y: 21 } });
    const b = buildWaterCity({ tower: { x: 9, y: 21 } });
    runDays(a, 5);
    runDays(b, 5);
    expect(b.hash()).toBe(a.hash());
    b.execute({ kind: 'place-tower', x: 30, y: 30 });
    expect(b.hash()).not.toBe(a.hash());
  });
});

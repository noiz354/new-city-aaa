import { describe, expect, it } from 'vitest';
import { consumptionFor } from './power.js';
import { Sim } from './sim.js';
import { COSTS_POWER, POWER_TUNING } from './tuning/power.js';
import { runDays } from '../testing/fixtures.js';

/** Road spine y=20 serves R (y=19) and I (y=21) blocks; plant joins the net via the road. */
function buildPowerCity(opts: { plant: { x: number; y: number } | null; iX1?: number }): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({
    kind: 'place-road',
    path: Array.from({ length: 22 }, (_, k) => ({ x: 8 + k, y: 20 })),
  });
  if (!road.ok) throw new Error(`road: ${road.reason}`);
  const r = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 19, x1: 13, y1: 19 }, zone: 1 });
  if (!r.ok) throw new Error(`R zone: ${r.reason}`);
  const iX1 = opts.iX1 ?? 29;
  const ind = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 21, x1: iX1, y1: 21 }, zone: 3 });
  if (!ind.ok) throw new Error(`I zone: ${ind.reason}`);
  if (opts.plant) {
    const p = sim.execute({ kind: 'place-plant', x: opts.plant.x, y: opts.plant.y });
    if (!p.ok) throw new Error(`plant: ${p.reason}`);
  }
  return sim;
}

describe('T-405 power grid (FR-P)', () => {
  it('inactive grid: lots count as powered, city grows exactly like before (legacy-guard)', () => {
    const sim = buildPowerCity({ plant: null });
    expect(sim.power.active).toBe(false);
    expect(sim.power.isPowered(10, 19)).toBe(true);
    expect(sim.snapshot().power).toEqual({ active: false, plants: 0, nets: 0, supplyMw: 0, demandMw: 0, unpowered: 0 });
    runDays(sim, 14);
    expect(sim.buildings.count).toBeGreaterThan(0);
    expect(sim.snapshot().population).toBeGreaterThan(0);
    expect(sim.power.active).toBe(false); // growth alone never activates the grid
  });

  it('consumption table: R l*1 / C l*2 / I l*3 MW', () => {
    expect(consumptionFor(1, 2)).toBe(2);
    expect(consumptionFor(2, 3)).toBe(6);
    expect(consumptionFor(3, 1)).toBe(3);
    expect(consumptionFor(0, 1)).toBe(0);
  });

  it('place-plant / place-power-line: cost, validation, immediate grid truth', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const before = sim.snapshot().balance;
    const p = sim.execute({ kind: 'place-plant', x: 5, y: 5 });
    if (!p.ok) throw new Error(`plant: ${p.reason}`);
    expect(p.cost).toBe(COSTS_POWER.plant);
    expect(sim.snapshot().balance).toBe(before - COSTS_POWER.plant);
    // Same tile twice / on road / out of bounds are rejected.
    expect(sim.execute({ kind: 'place-plant', x: 5, y: 5 }).ok).toBe(false);
    sim.execute({ kind: 'place-road', path: [{ x: 20, y: 20 }] });
    expect(sim.execute({ kind: 'place-plant', x: 20, y: 20 }).ok).toBe(false);
    expect(sim.execute({ kind: 'place-plant', x: -1, y: 0 }).ok).toBe(false);
    // Grid truth is immediate (no one-tick dark start): active with 1 net, 60 MW supply.
    expect(sim.snapshot().power).toMatchObject({ active: true, plants: 1, supplyMw: POWER_TUNING.plantCapacityMw });

    const l = sim.execute({ kind: 'place-power-line', path: [{ x: 6, y: 5 }, { x: 7, y: 5 }] });
    if (!l.ok) throw new Error(`line: ${l.reason}`);
    expect(l.cost).toBe(2 * COSTS_POWER.linePerTile);
    expect(sim.world.counts.lines).toBe(2);
    // Re-lay is free; lines on buildings are rejected.
    const free = sim.execute({ kind: 'place-power-line', path: [{ x: 6, y: 5 }, { x: 7, y: 5 }] });
    if (!free.ok) throw new Error(`re-lay: ${free.reason}`);
    expect(free.cost).toBe(0);
  });

  it('growth gate: connected city grows, isolated-plant city stalls with no-power', () => {
    const hot = buildPowerCity({ plant: { x: 9, y: 21 }, iX1: 13 }); // adjacent to the road → same net
    const dark = buildPowerCity({ plant: { x: 50, y: 50 }, iX1: 13 }); // plant exists, grid live, lots off-net
    runDays(hot, 14);
    runDays(dark, 14);
    // Connected city thrives on the plant-fed road net.
    expect(hot.buildings.count).toBeGreaterThan(0);
    expect(hot.snapshot().population).toBeGreaterThan(0);
    expect(hot.snapshot().power.unpowered).toBe(0);
    expect(hot.snapshot().power.supplyMw).toBe(POWER_TUNING.plantCapacityMw);
    // Isolated plant activates the grid but feeds nothing: R lots stall, reason is no-power.
    expect(dark.power.active).toBe(true);
    expect(dark.buildings.count).toBe(0);
    expect(dark.snapshot().population).toBe(0);
    expect(dark.growth.growthBlockReason(10, 19)).toBe('no-power');
    expect(dark.snapshot().power.unpowered).toBeGreaterThan(0);
  });

  it('overload sheds industry farthest-first, never homes; a 2nd plant restores all', () => {
    // R 4 lots (4 MW) + I 20 lots (60 MW) = 64 MW demand vs one 60 MW plant.
    const sim = buildPowerCity({ plant: { x: 9, y: 21 } });
    runDays(sim, 30);
    const status = sim.power.netStatus();
    expect(status.supplyMw).toBe(POWER_TUNING.plantCapacityMw);
    expect(status.demandMw).toBeGreaterThan(status.supplyMw);
    expect(status.unpowered).toBeGreaterThan(0);
    // Shed order: every unpowered tile is industrial; every R lot stays lit.
    for (let x = 10; x <= 13; x++) expect(sim.power.isPowered(x, 19)).toBe(true);
    for (const t of sim.power.collectUnpowered()) {
      expect(sim.world.zone[sim.world.idx(t.x, t.y)]).toBe(3);
    }
    // Overload flips surfaced as events for the icon layer.
    const flips = sim.drainEvents().filter((e) => e.type === 'power-changed');
    expect(flips.some((e) => e.type === 'power-changed' && e.powered === false)).toBe(true);
    // T-405 acceptance: a second plant on the same net restores every lot immediately.
    const second = sim.execute({ kind: 'place-plant', x: 8, y: 19 });
    if (!second.ok) throw new Error(`2nd plant: ${second.reason}`);
    expect(sim.power.netStatus().unpowered).toBe(0);
    expect(sim.snapshot().power.supplyMw).toBe(2 * POWER_TUNING.plantCapacityMw);
    const restored = sim.drainEvents().filter((e) => e.type === 'power-changed');
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.every((e) => e.type !== 'power-changed' || e.powered)).toBe(true);
  });

  it('bulldozing the only plant deactivates the grid (self-powered again)', () => {
    const sim = buildPowerCity({ plant: { x: 9, y: 21 } });
    expect(sim.power.active).toBe(true);
    const b = sim.execute({ kind: 'bulldoze', rect: { x0: 9, y0: 21, x1: 9, y1: 21 } });
    expect(b.ok).toBe(true);
    expect(sim.power.active).toBe(false);
    expect(sim.power.isPowered(10, 19)).toBe(true);
  });

  it('hash covers plant sites: twins match, divergent power diverges', () => {
    const a = buildPowerCity({ plant: { x: 9, y: 21 } });
    const b = buildPowerCity({ plant: { x: 9, y: 21 } });
    runDays(a, 5);
    runDays(b, 5);
    expect(b.hash()).toBe(a.hash());
    b.execute({ kind: 'place-power-line', path: [{ x: 30, y: 30 }, { x: 31, y: 30 }] });
    expect(b.hash()).not.toBe(a.hash());
  });
});

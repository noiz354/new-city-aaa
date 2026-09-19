import { describe, expect, it } from 'vitest';
import { planRoadPath } from '../shared/grid.js';
import { TERRAIN_WATER } from '../shared/types.js';
import { applyRoad, applyZone, validateBulldoze, validateRoad, validateZone } from './commands.js';
import { Economy } from './economy.js';
import { Sim } from './sim.js';
import { COSTS } from './tuning/costs.js';
import { World } from './world.js';

function setup(): { world: World; econ: Economy } {
  return { world: new World({ size: 64, seed: 1, preset: 'plains' }), econ: new Economy() };
}

describe('road commands', () => {
  it('charges per new tile; re-lay is free', () => {
    const { world, econ } = setup();
    const path = planRoadPath({ x: 1, y: 1 }, { x: 5, y: 1 });
    const v = validateRoad(world, econ, path);
    expect(v).toMatchObject({ ok: true, cost: 5 * COSTS.roadPerTile, tiles: 5 });
    if (v.ok && v.plan) applyRoad(world, v.plan);
    const v2 = validateRoad(world, econ, path);
    expect(v2).toMatchObject({ ok: true, cost: 0, tiles: 0 });
  });

  it('rejects paths crossing water with the exact reason', () => {
    const { world, econ } = setup();
    world.terrain[world.idx(3, 1)] = TERRAIN_WATER;
    const v = validateRoad(world, econ, planRoadPath({ x: 1, y: 1 }, { x: 5, y: 1 }));
    expect(v).toEqual({ ok: false, reason: 'Water blocks construction' });
  });

  it('rejects unaffordable paths with shortBy', () => {
    const { world } = setup();
    const poor = new Economy(10);
    const v = validateRoad(world, poor, planRoadPath({ x: 1, y: 1 }, { x: 5, y: 1 }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe('Insufficient funds');
      expect(v.shortBy).toBe(5 * COSTS.roadPerTile - 10);
    }
  });
});

describe('zone commands', () => {
  it('paints rects and skips road tiles', () => {
    const { world, econ } = setup();
    world.setRoad(2, 2);
    const v = validateZone(world, econ, { x0: 1, y0: 1, x1: 3, y1: 3 });
    expect(v.ok).toBe(true);
    if (v.ok && v.plan) {
      expect(v.plan.tiles).toHaveLength(8);
      expect(v.plan.skipped).toBe(1);
      applyZone(world, v.plan, 1);
    }
    expect(world.counts.zonesR).toBe(8);
  });

  it('rejects rects with nothing paintable', () => {
    const { world, econ } = setup();
    world.setRoad(2, 2);
    expect(validateZone(world, econ, { x0: 2, y0: 2, x1: 2, y1: 2 })).toEqual({
      ok: false,
      reason: 'No paintable tiles in area',
    });
  });
});

describe('bulldoze commands', () => {
  it('charges road rate for roads, flat rate for zones, nothing for empty', () => {
    const { world, econ } = setup();
    world.setRoad(1, 1);
    world.setZone(2, 2, 3);
    const v = validateBulldoze(world, econ, { x0: 0, y0: 0, x1: 3, y1: 3 });
    expect(v).toMatchObject({ ok: true, cost: COSTS.bulldozeRoad + COSTS.bulldozePerTile, tiles: 2 });
    const empty = validateBulldoze(world, econ, { x0: 10, y0: 10, x1: 12, y1: 12 });
    expect(empty).toMatchObject({ ok: true, cost: 0, tiles: 0 });
  });
});

describe('Sim.execute', () => {
  it('spends treasury and emits applied + chunk-dirty events', () => {
    const sim = new Sim({ size: 64, seed: 1, preset: 'plains' });
    const before = sim.economy.balance;
    const res = sim.execute({ kind: 'place-road', path: planRoadPath({ x: 0, y: 0 }, { x: 3, y: 0 }) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(sim.economy.balance).toBe(before - res.cost);
    const types = sim.drainEvents().map((e) => e.type);
    expect(types).toContain('command-applied');
    expect(types).toContain('treasury-changed');
    expect(types).toContain('chunk-dirty');
  });

  it('emits command-rejected and spends nothing on failure', () => {
    const sim = new Sim({ size: 64, seed: 1, preset: 'plains' });
    sim.economy.balance = 0;
    const res = sim.execute({ kind: 'place-road', path: planRoadPath({ x: 0, y: 0 }, { x: 3, y: 0 }) });
    expect(res.ok).toBe(false);
    expect(sim.drainEvents().map((e) => e.type)).toContain('command-rejected');
    expect(sim.world.counts.roads).toBe(0);
  });
});

// Fields T-207 (land value v0 + desirability, FR-S02 context):
//   landValue = clamp(base[terrain] + waterHalo + forestHalo [+ parkHalo, seam-only] − pollution, 0..100)
//   sources → linear-falloff stamp → 2-pass separable 3×3 blur (world-and-terrain §4), daily cadence.
// Balancing anchors: forest/water raise neighbours; an I building depresses R-side value by ≥15
// within radius (utilities-and-environment §3 example); parks raise value (engine seam asserted
// with a direct source inject — player plop is the pending §9 save-format decision, not faked).
import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { BUILDING_OCCUPIED } from './buildings.js';
import { Fields } from './fields.js';
import { Sim } from './sim.js';
import { TERRAIN_FOREST, TERRAIN_WATER } from '../shared/types.js';

function flatTown(size = 32): Sim {
  return new Sim({ seed: 7, size, preset: 'plains' });
}

describe('Fields: land value v0 (T-207)', () => {
  it('base follows terrain (grass 50, forest 60, water 0); no blur lifts a lone tile', () => {
    const sim = flatTown();
    sim.fields.recompute();
    const fields = sim.fields;
    // plains preset: interior grass; find a controlled patch via a fixed idx scan
    let grassIdx = -1; let waterIdx = -1; let forestIdx = -1;
    for (let i = 0; i < sim.world.size * sim.world.size; i++) {
      const t = sim.world.terrain[i] as number;
      if (t === TERRAIN_WATER && waterIdx === -1) waterIdx = i;
      if (t === TERRAIN_FOREST && forestIdx === -1) forestIdx = i;
      if (t !== TERRAIN_WATER && t !== TERRAIN_FOREST && grassIdx === -1) grassIdx = i;
    }
    expect(grassIdx).toBeGreaterThanOrEqual(0);
    const gv = fields.valueAt(grassIdx % sim.world.size, Math.floor(grassIdx / sim.world.size));
    expect(gv).toBeGreaterThanOrEqual(45); // grass base 50 minus nothing here, blur spreads a little
    expect(gv).toBeLessThanOrEqual(55);
    if (waterIdx !== -1) {
      expect(fields.valueAt(waterIdx % sim.world.size, Math.floor(waterIdx / sim.world.size))).toBe(0);
    }
    if (forestIdx !== -1) {
      const fv = fields.valueAt(forestIdx % sim.world.size, Math.floor(forestIdx / sim.world.size));
      expect(fv).toBeGreaterThan(gv); // forest base + own halo
    }
  });

  it('"halo air": water adjacency raises land value ≤3 tiles away', () => {
    const world = {
      size: 16,
      idx: (x: number, y: number) => y * 16 + x,
      inBounds: (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16,
      terrain: new Uint8Array(16 * 16).fill(1),
    } as never;
    // water column at x=3
    for (let y = 0; y < 16; y++) (world as { terrain: Uint8Array }).terrain[y * 16 + 3] = TERRAIN_WATER;
    const sim = flatTown();
    const fields = new Fields(world as never, sim.buildings, []);
    fields.recompute();
    const near = fields.valueAt(5, 8); // d=2 from water column
    const far = fields.valueAt(10, 8); // d=7: out of halo radius
    expect(near).toBeGreaterThan(far);
    expect(far).toBe(50); // grass base; the blur of a uniform field is unchanged
  });

  it('park seam: an injected park source raises neighbours (engine verified; plop pending §9)', () => {
    const world = {
      size: 16,
      idx: (x: number, y: number) => y * 16 + x,
      inBounds: (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16,
      terrain: new Uint8Array(16 * 16).fill(1),
    } as never;
    const sim = flatTown();
    const noPark = new Fields(world as never, sim.buildings, []);
    noPark.recompute();
    const base = noPark.valueAt(9, 8);
    const withPark = new Fields(world as never, sim.buildings, [8 * 16 + 8]); // park at (8,8)
    withPark.recompute();
    expect(withPark.valueAt(8, 8)).toBeGreaterThan(base); // "park menaikkan value sekitar" (engine)
    expect(withPark.valueAt(9, 8)).toBeGreaterThan(base);
    // halo radius 4 + separable blur reach radius 5 and stop: d=5 (x=13) is untouched
    expect(withPark.valueAt(13, 8)).toBe(base);
  });

  it('I building depresses nearby value by ≥15 (balancing anchor, utilities §3); grass far away heals', () => {
    const sim = flatTown();
    const road = sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] });
    if (!road.ok) throw new Error(road.reason);
    const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 3 });
    if (!zone.ok) throw new Error(zone.reason);
    runDays(sim, 5); // I spawns on positive demand (T-206 bootstrap I +16.5)
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_OCCUPIED);
    sim.fields.recompute();
    const next = sim.fields.valueAt(10, 11); // 2 tiles away inside I aura (level 1: 10, radius 8)
    const far = sim.fields.valueAt(10, 20);
    expect(next - far).toBeLessThanOrEqual(-15); // depression anchor ≥15 within radius
    expect(sim.fields.valueAt(10, 9)).toBeLessThan(far); // under the plume itself
  });

  it('desirability: with an active plume, R growth prefere clean high-idx lots over plume low-idx ones', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const road = sim.execute({ kind: 'place-road', path: Array.from({ length: 30 }, (_, i) => ({ x: 2 + i, y: 10 })) });
    if (!road.ok) throw new Error(road.reason);
    sim.execute({ kind: 'paint-zone', rect: { x0: 5, y0: 9, x1: 5, y1: 9 }, zone: 3 });
    runDays(sim, 6); // factory occupied + plume live in the field before any R exists
    expect(sim.buildings.stateAt(5, 9)).toBeGreaterThanOrEqual(1);
    // R lots on BOTH sides: plume side has LOWER tile index (would win every pure tie)
    sim.execute({ kind: 'paint-zone', rect: { x0: 3, y0: 9, x1: 4, y1: 9 }, zone: 1 });
    sim.execute({ kind: 'paint-zone', rect: { x0: 28, y0: 9, x1: 31, y1: 9 }, zone: 1 });
    runDays(sim, 2); // budget N=2/day at pop 0 → top-4-scored R picks (the clean lots)
    const cleanCount = [28, 29, 30, 31].filter((x) => sim.buildings.stateAt(x, 9) >= 1).length;
    const plumeCount = [3, 4].filter((x) => sim.buildings.stateAt(x, 9) >= 1).length;
    expect(cleanCount).toBeGreaterThanOrEqual(2);
    expect(plumeCount).toBe(0); // landFit (value) overrides the lower-idx tiebreak (docs/03 §3)
  });

  it('derived + deterministic: equal scripts → equal value arrays; recompute idempotent', () => {
    const a = flatTown();
    simRun(a, 8);
    const b = flatTown();
    simRun(b, 8);
    expect(a.fields.landValue).toEqual(b.fields.landValue);
    a.fields.recompute();
    expect(a.fields.valueAt(10, 10)).toBe(b.fields.valueAt(10, 10));
  });

  it('save/load: fields recompute from restored world+buildings (not persisted)', () => {
    const sim = flatTown();
    const road = sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] });
    if (!road.ok) throw new Error(road.reason);
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 1 });
    runDays(sim, 6);
    const restored = flatTown();
    restored.loadState(sim.getSaveMeta(), sim.getSaveLayers(), sim.getSaveEntities());
    restored.fields.recompute();
    expect(restored.fields.landValue).toEqual(sim.fields.landValue);
  });
});

function simRun(sim: Sim, days: number): void {
  runDays(sim, days);
}

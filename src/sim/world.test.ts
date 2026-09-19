import { describe, expect, it } from 'vitest';
import { TERRAIN_GRASS, TERRAIN_WATER } from '../shared/types.js';
import { DIRTY_ALL, DIRTY_NONE, DIRTY_ROADS, DIRTY_ZONES } from '../shared/types.js';
import { SLOPE_BUILD_MAX, World } from './world.js';

describe('World generation', () => {
  it('plains are flat, grass, and fully buildable', () => {
    const w = new World({ size: 64, seed: 1, preset: 'plains' });
    expect(w.height.every((h) => h === 0.5)).toBe(true);
    expect(w.terrain.every((t) => t === TERRAIN_GRASS)).toBe(true);
    for (let y = 0; y < 64; y += 3) {
      for (let x = 0; x < 64; x += 3) expect(w.buildBlockReason(x, y)).toBeNull();
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = new World({ size: 64, seed: 42, preset: 'default' });
    const b = new World({ size: 64, seed: 42, preset: 'default' });
    const c = new World({ size: 64, seed: 43, preset: 'default' });
    expect(a.height).toEqual(b.height);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.height).not.toEqual(c.height);
  });

  it('hills have slope-blocked tiles; default has almost none', () => {
    const slopeBlocked = (w: World): number => {
      let n = 0;
      for (let y = 0; y < w.size; y++) {
        for (let x = 0; x < w.size; x++) {
          if ((w.terrain[w.idx(x, y)] as number) !== TERRAIN_WATER && w.slopeAt(x, y) > SLOPE_BUILD_MAX) n++;
        }
      }
      return n;
    };
    const hills = new World({ size: 128, seed: 1, preset: 'hills' });
    expect(slopeBlocked(hills)).toBeGreaterThan(0);
    const plain = new World({ size: 128, seed: 1, preset: 'default' });
    expect(slopeBlocked(plain) / (128 * 128)).toBeLessThan(0.02);
  });

  it('river carves a continuous water band', () => {
    const w = new World({ size: 128, seed: 5, preset: 'river' });
    let water = 0;
    for (const t of w.terrain) if (t === TERRAIN_WATER) water++;
    expect(water).toBeGreaterThan(1000);
  });
});

describe('World mutation', () => {
  it('maintains counts and road masks', () => {
    const w = new World({ size: 64, seed: 1, preset: 'plains' });
    w.setRoad(10, 10);
    w.setRoad(11, 10);
    w.setRoad(12, 10);
    expect(w.counts.roads).toBe(3);
    expect(w.roadMask[w.idx(11, 10)]).toBe(1 | 2); // E|W
    w.setRoad(11, 9);
    w.setRoad(11, 11);
    expect(w.roadMask[w.idx(11, 10)]).toBe(1 | 2 | 4 | 8);
    w.clearRoad(11, 10);
    expect(w.counts.roads).toBe(4);
    expect(w.roadMask[w.idx(11, 10)]).toBe(0);
  });

  it('roads clear zones; zones refuse road tiles', () => {
    const w = new World({ size: 64, seed: 1, preset: 'plains' });
    expect(w.setZone(5, 5, 1)).toBe(true);
    expect(w.counts.zonesR).toBe(1);
    w.setRoad(5, 5);
    expect(w.counts.zonesR).toBe(0);
    expect(w.setZone(5, 5, 2)).toBe(false);
  });

  it('marks chunk dirty flags', () => {
    const w = new World({ size: 64, seed: 1, preset: 'plains' });
    w.chunkDirty.fill(DIRTY_NONE);
    w.setRoad(20, 20);
    w.setZone(40, 40, 3);
    expect((w.chunkDirty[w.chunkIndexFor(20, 20)] as number) & DIRTY_ROADS).toBe(DIRTY_ROADS);
    expect((w.chunkDirty[w.chunkIndexFor(40, 40)] as number) & DIRTY_ZONES).toBe(DIRTY_ZONES);
    expect(w.chunkDirty[w.chunkIndexFor(0, 0)] as number).toBe(DIRTY_NONE);
  });

  it('maps ground height correctly (plains = 4.32m)', () => {
    const w = new World({ size: 64, seed: 1, preset: 'plains' });
    const c = w.tileCenterWorld(10, 10);
    expect(w.groundHeightAt(c.x, c.z)).toBeCloseTo((0.5 - 0.32) * 24, 5);
  });

  it('round-trips layers with derived state rebuilt', () => {
    const w = new World({ size: 64, seed: 3, preset: 'plains' });
    w.setRoad(1, 1);
    w.setRoad(2, 1);
    w.setZone(9, 9, 2);
    const w2 = new World({ size: 64, seed: 999, preset: 'plains' });
    w2.loadLayers(w.toLayers());
    expect(w2.counts).toEqual(w.counts);
    expect(w2.roadMask).toEqual(w.roadMask);
    expect(w2.chunkDirty.every((f) => f === DIRTY_ALL)).toBe(true);
  });
});

// BlockedIconLayer tests (T-204): the view side of FR-C06 — a pure projection of sim
// attachment truth. Mirrors the BuildingLayer test contract: deltas, full sync, swap-remove
// density, capacity growth; view never invents blocked tiles.
import { describe, expect, it } from 'vitest';
import { BlockedIconLayer, type IconGeo } from './icons.js';

function fakeWorld(size = 8): IconGeo {
  return {
    size,
    tileCenterWorld: (x, y) => ({ x: x * 8 + 4, z: y * 8 + 4 }),
    groundHeightAt: () => 10,
  };
}

describe('BlockedIconLayer (FR-C06 projection)', () => {
  it('adds on blocked, removes on unblock; dense after mixed flips', () => {
    const icons = new BlockedIconLayer(fakeWorld());
    icons.apply({ x: 1, y: 1, blocked: true });
    icons.apply({ x: 2, y: 2, blocked: true });
    icons.apply({ x: 3, y: 3, blocked: true });
    expect(icons.count).toBe(3);
    icons.apply({ x: 2, y: 2, blocked: false });
    expect(icons.count).toBe(2);
    expect(icons.has(1, 1)).toBe(true);
    expect(icons.has(2, 2)).toBe(false);
    expect(icons.has(3, 3)).toBe(true);
    icons.dispose();
  });

  it('duplicate blocked events are idempotent (flip-once-drain contract)', () => {
    const icons = new BlockedIconLayer(fakeWorld());
    icons.apply({ x: 4, y: 4, blocked: true });
    icons.apply({ x: 4, y: 4, blocked: true });
    expect(icons.count).toBe(1);
    icons.apply({ x: 4, y: 4, blocked: false });
    icons.apply({ x: 4, y: 4, blocked: false }); // drain after already-clear markers
    expect(icons.count).toBe(0);
    icons.dispose();
  });

  it('sync rebuilds wholesale and replaces prior deltas (post-load resync)', () => {
    const icons = new BlockedIconLayer(fakeWorld());
    icons.apply({ x: 1, y: 1, blocked: true });
    icons.sync([
      { x: 5, y: 5 },
      { x: 6, y: 6 },
    ]);
    expect(icons.count).toBe(2);
    expect(icons.has(1, 1)).toBe(false);
    expect(icons.has(5, 5)).toBe(true);
    icons.sync([]); // nothing blocked in this world
    expect(icons.count).toBe(0);
    icons.dispose();
  });

  it('grows capacity beyond the initial cap without losing markers', () => {
    const icons = new BlockedIconLayer(fakeWorld(), 4);
    for (let i = 0; i < 9; i++) icons.apply({ x: i, y: 0, blocked: true });
    expect(icons.count).toBe(9);
    for (let i = 0; i < 9; i++) expect(icons.has(i, 0)).toBe(true);
    icons.apply({ x: 0, y: 0, blocked: false });
    expect(icons.count).toBe(8);
    expect(icons.has(8, 0)).toBe(true); // swap-remove moved it, still tracked
    icons.dispose();
  });

  it('same drain sequence → same marker set (deterministic projection)', () => {
    const drain = [
      { x: 1, y: 2, blocked: true },
      { x: 2, y: 1, blocked: true },
      { x: 1, y: 2, blocked: false },
      { x: 3, y: 3, blocked: true },
    ];
    const a = new BlockedIconLayer(fakeWorld());
    const b = new BlockedIconLayer(fakeWorld());
    for (const e of drain) {
      a.apply(e);
      b.apply(e);
    }
    expect(a.count).toBe(2);
    expect(a.has(2, 1)).toBe(b.has(2, 1));
    expect(a.has(3, 3)).toBe(b.has(3, 3));
    expect(a.has(1, 2)).toBe(false);
    a.dispose();
    b.dispose();
  });
});

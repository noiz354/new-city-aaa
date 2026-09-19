// LandValueOverlay tests (T-207): gradient correctness + texture write from sim-truth arrays.
import { describe, expect, it } from 'vitest';
import { LandValueOverlay, valueColor } from './landvalue.js';
import type { WorldView } from '../shared/types.js';

function fakeWorld(size = 8): WorldView {
  const terrain = new Uint8Array(size * size).fill(1);
  return {
    size,
    mapMeters: size * 8,
    idx: (x: number, y: number) => y * size + x,
    tileCenterWorld: (x: number, y: number) => ({ x: x * 8, z: y * 8 }),
    groundHeightAt: () => 0,
    terrain,
    zone: new Uint8Array(size * size),
    road: new Uint8Array(size * size),
    slopeAt: () => 0,
    chunkDirty: new Uint8Array(1),
  } as unknown as WorldView;
}

describe('LandValueOverlay (T-207)', () => {
  it('gradient ramp: 0 brown → 100 green, clamped outside [0,100]', () => {
    const [r0, g0] = valueColor(0);
    const [r1, g1] = valueColor(100);
    expect(g1).toBeGreaterThan(g0); // "gradien" goes richer with value
    expect(r1).toBeLessThan(r0);
    expect(valueColor(-50)).toEqual(valueColor(0));
    expect(valueColor(250)).toEqual(valueColor(100));
  });

  it('update writes sim values into the texture at the canonical row mapping', () => {
    const world = fakeWorld(8);
    const overlay = new LandValueOverlay(world);
    const fields = { landValue: new Float32Array(64).fill(50) };
    fields.landValue[0 * 8 + 0] = 100; // tile (0,0)
    overlay.update(fields);
    // texture row for tile row 0 is the LAST row (n-1-y, ZoneOverlay orientation)
    const o = ((8 - 1 - 0) * 8 + 0) * 4;
    const [r, g, b, a] = valueColor(100);
    void a;
    expect(readTexPixel(overlay, o)).toEqual([r, g, b, 140]);
    overlay.dispose();
  });

  it('hidden by default; toggle flips visibility (no sim coupling)', () => {
    const overlay = new LandValueOverlay(fakeWorld(8));
    expect(overlay.visible).toBe(false);
    overlay.setVisible(true);
    expect(overlay.visible).toBe(true);
    overlay.setVisible(false);
    expect(overlay.visible).toBe(false);
    overlay.dispose();
  });
});

function readTexPixel(overlay: LandValueOverlay, offset: number): number[] {
  const data = (overlay as unknown as { data: Uint8Array }).data;
  return [data[offset] as number, data[offset + 1] as number, data[offset + 2] as number, data[offset + 3] as number];
}

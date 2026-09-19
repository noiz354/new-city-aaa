import { describe, expect, it } from 'vitest';
import { Rng } from './rng.js';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('differs across seeds', () => {
    expect(new Rng(1).nextUint32()).not.toBe(new Rng(2).nextUint32());
  });

  it('round-trips state exactly (save/load mid-stream)', () => {
    const a = new Rng(999);
    for (let i = 0; i < 37; i++) a.next();
    const b = new Rng(a.getState().seed, a.getState().state);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('forks independent per-day streams', () => {
    const r = new Rng(7);
    const d1 = r.fork('traffic', 1);
    const d1b = Rng.dayStream(7, 'traffic', 1);
    const d2 = r.fork('traffic', 2);
    expect(d1.nextUint32()).toBe(d1b.nextUint32());
    expect(d1.nextUint32()).not.toBe(d2.nextUint32());
  });

  it('int() stays within [min, max]', () => {
    const r = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

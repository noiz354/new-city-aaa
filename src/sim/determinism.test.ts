import { describe, expect, it } from 'vitest';
import { decodeSave } from '../persistence/codec.js';
import { encodeSave } from '../persistence/codec.js';
import { buildHamlet } from '../testing/fixtures.js';
import { Sim } from './sim.js';

// Hamlets are identical builds: any hash difference means nondeterminism.
describe('determinism', () => {
  it('identical fixtures hash identically', () => {
    const a = buildHamlet();
    const b = buildHamlet();
    expect(a.hash()).toBe(b.hash());
    expect(a.snapshot().counts.roads).toBeGreaterThan(300);
    expect(a.snapshot().counts.zonesR).toBeGreaterThan(0);
    expect(a.snapshot().counts.zonesC).toBeGreaterThan(0);
    expect(a.snapshot().counts.zonesI).toBeGreaterThan(0);
  });

  it('is FPS-independent: different dt chunking over 5 days hashes equally', () => {
    const a = buildHamlet();
    const b = buildHamlet();
    // totals sit 0.2 ticks past a tick boundary: float accumulators legitimately
    // bank different sub-tick residue per chunking, but whole-tick streams match
    for (let d = 0; d < 5; d++) for (let i = 0; i < 48; i++) a.update(250);
    for (let d = 0; d < 5; d++) for (let i = 0; i < 240; i++) b.update(50);
    a.update(100);
    b.update(100);
    expect(a.clock.tick).toBe(b.clock.tick);
    expect(a.hash()).toBe(b.hash());
  });

  it('save at day 2, reload, continue to day 5 === uninterrupted run', () => {
    const a = buildHamlet();
    for (let i = 0; i < 96; i++) a.update(250); // 2 days
    const bytes = encodeSave(a);
    const b = new Sim({ size: 128, seed: 1, preset: 'plains' });
    const dec = decodeSave(bytes);
    b.loadState(dec.meta, dec.layers);
    for (let i = 0; i < 144; i++) {
      a.update(250);
      b.update(50);
      b.update(50);
      b.update(50);
      b.update(50);
      b.update(50);
    }
    a.update(100); // 0.2 ticks past the boundary (see chunking test above)
    b.update(100);
    expect(b.hash()).toBe(a.hash());
  });
});

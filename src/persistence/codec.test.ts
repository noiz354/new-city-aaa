import { gunzipSync, gzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crc32Bytes } from '../shared/crc32.js';
import { planRoadPath } from '../shared/grid.js';
import { Sim } from '../sim/sim.js';
import { runDays } from '../testing/fixtures.js';
import { decodeSave, encodeSave, SaveError } from './codec.js';

function builtSim(): Sim {
  const sim = new Sim({ size: 64, seed: 9, preset: 'plains' });
  sim.execute({ kind: 'place-road', path: planRoadPath({ x: 4, y: 30 }, { x: 60, y: 30 }) });
  sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 10, x1: 20, y1: 20 }, zone: 1 });
  sim.execute({ kind: 'paint-zone', rect: { x0: 40, y0: 10, x1: 50, y1: 20 }, zone: 2 });
  runDays(sim, 2);
  sim.drainEvents();
  return sim;
}

describe('codec', () => {
  it('round-trips sim state with identical hash', () => {
    const sim = builtSim();
    const hashA = sim.hash();
    const dec = decodeSave(encodeSave(sim));
    expect(dec.repairs).toEqual([]);
    expect(dec.header.game).toBe('city-builder-aaa');
    expect(dec.header.worldSeed).toBe(9);
    const sim2 = new Sim({ size: 64, seed: 1234, preset: 'plains' });
    sim2.loadState(dec.meta, dec.layers);
    expect(sim2.hash()).toBe(hashA);
    expect(sim2.snapshot()).toEqual(sim.snapshot());
  });

  it('save/load mid-game then continue === uninterrupted run', () => {
    const a = builtSim();
    const bytes = encodeSave(a);
    const b = new Sim({ size: 64, seed: 1, preset: 'plains' });
    const dec = decodeSave(bytes);
    b.loadState(dec.meta, dec.layers);
    runDays(a, 3);
    runDays(b, 3);
    expect(b.hash()).toBe(a.hash());
  });

  it('rejects non-save bytes', () => {
    expect(() => decodeSave(new Uint8Array([1, 2, 3]))).toThrowError(SaveError);
    const truncated = encodeSave(builtSim()).subarray(0, 20);
    expect(() => decodeSave(truncated)).toThrowError(SaveError);
  });

  it('rejects tampered payloads (CRC) and future versions', () => {
    const inner = gunzipSync(encodeSave(builtSim())).slice();
    inner[inner.length - 10] = (inner[inner.length - 10] as number) ^ 0xff;
    expect(() => decodeSave(gzipSync(inner))).toThrowError(/CRC/);
    const inner2 = gunzipSync(encodeSave(builtSim())).slice();
    new DataView(inner2.buffer).setUint16(4, 99, true);
    expect(() => decodeSave(gzipSync(inner2))).toThrowError(/version 99/);
  });

  it('skips unknown sections with a repair note (forward compat)', () => {
    const inner = gunzipSync(encodeSave(builtSim()));
    const payload = new Uint8Array([9, 9, 9, 9]);
    const section = new Uint8Array(1 + 2 + 4 + 4 + 4);
    section[0] = 99;
    const dv = new DataView(section.buffer);
    dv.setUint16(1, 1, true);
    dv.setUint32(3, 4, true);
    section.set(payload, 7);
    dv.setUint32(11, crc32Bytes(payload), true);
    const extended = new Uint8Array(inner.length + section.length);
    extended.set(inner, 0);
    extended.set(section, inner.length);
    new DataView(extended.buffer).setUint16(4 + 2, 4, true); // section count 3 -> 4
    const dec = decodeSave(gzipSync(extended));
    expect(dec.repairs).toHaveLength(1);
    expect(dec.header.worldSeed).toBe(9);
  });
});

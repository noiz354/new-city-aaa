import { gunzipSync, gzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crc32Bytes } from '../shared/crc32.js';
import { planRoadPath } from '../shared/grid.js';
import { Sim } from '../sim/sim.js';
import { runDays } from '../testing/fixtures.js';
import { decodeSave, encodeSave, SAVE_VERSION, SECTION_POLICY, SaveError } from './codec.js';

function builtSim(): Sim {
  const sim = new Sim({ size: 64, seed: 9, preset: 'plains' });
  sim.execute({ kind: 'place-road', path: planRoadPath({ x: 4, y: 30 }, { x: 60, y: 30 }) });
  sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 10, x1: 20, y1: 20 }, zone: 1 });
  sim.execute({ kind: 'paint-zone', rect: { x0: 40, y0: 10, x1: 50, y1: 20 }, zone: 2 });
  runDays(sim, 2);
  sim.drainEvents();
  return sim;
}

/** Drop the last matching section from an inner save buffer and fix the section count. */
function stripSection(inner: Uint8Array, id: number): Uint8Array {
  const dv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
  const count = dv.getUint16(6, true);
  let off = 8;
  let start = -1;
  let end = -1;
  for (let s = 0; s < count; s++) {
    const sid = inner[off] as number;
    const len = dv.getUint32(off + 3, true);
    const sEnd = off + 7 + len + 4;
    if (sid === id) {
      start = off;
      end = sEnd;
    }
    off = sEnd;
  }
  if (start < 0) throw new Error(`section ${id} not found`);
  const kept = new Uint8Array(inner.length - (end - start));
  kept.set(inner.subarray(0, start), 0);
  kept.set(inner.subarray(end), start);
  new DataView(kept.buffer).setUint16(6, count - 1, true);
  return kept;
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
    sim2.loadState(dec.meta, dec.layers, dec.entities ?? undefined, dec.policy);
    expect(sim2.hash()).toBe(hashA);
    expect(sim2.snapshot().tax).toEqual(sim.snapshot().tax); // T-302: tax rates survive the round-trip
    expect(sim2.snapshot()).toEqual(sim.snapshot());
  });

  it('save/load mid-game then continue === uninterrupted run', () => {
    const a = builtSim();
    const bytes = encodeSave(a);
    const b = new Sim({ size: 64, seed: 1, preset: 'plains' });
    const dec = decodeSave(bytes);
    b.loadState(dec.meta, dec.layers, dec.entities ?? undefined, dec.policy);
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
    inner[inner.length - 5] = (inner[inner.length - 5] as number) ^ 0xff; // last payload byte (trailing 4 = CRC)
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
    const dv2 = new DataView(extended.buffer);
    dv2.setUint16(6, dv2.getUint16(6, true) + 1, true); // section count += 1
    const dec = decodeSave(gzipSync(extended));
    expect(dec.repairs).toHaveLength(1);
    expect(dec.header.worldSeed).toBe(9);
  });

  it('round-trips a living city: buildings restore byte-identical (entity section 4)', () => {
    const sim = new Sim({ size: 64, seed: 9, preset: 'plains' });
    sim.execute({ kind: 'place-road', path: planRoadPath({ x: 10, y: 30 }, { x: 20, y: 30 }) });
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 29, x1: 14, y1: 29 }, zone: 1 });
    runDays(sim, 6); // spawn day 1, occupied ~day 4, move-in fills population
    expect(sim.snapshot().population).toBeGreaterThan(0);
    const hashA = sim.hash();
    const dec = decodeSave(encodeSave(sim));
    expect(dec.repairs).toEqual([]);
    expect(dec.entities).not.toBeNull();
    const sim2 = new Sim({ size: 64, seed: 1234, preset: 'plains' });
    sim2.loadState(dec.meta, dec.layers, dec.entities ?? undefined);
    expect(sim2.hash()).toBe(hashA);
    expect(sim2.snapshot().population).toBe(sim.snapshot().population);
    // Derived RCI demand is rebuilt at load (popFactor moved C off its bootstrap value); growth
    // reads it before the next daily recompute, so a stale vector would also break continuation.
    expect(sim2.demand.target()).toEqual(sim.demand.target());
    expect(sim.demand.target().c).not.toBe(new Sim({ size: 64, seed: 1, preset: 'plains' }).demand.target().c); // guard: pop moved it
    // save/continue equivalence still holds with entities in the hash
    runDays(sim, 3);
    runDays(sim2, 3);
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('loads pre-entity saves with a repair note and empty buildings (T-202 migration default)', () => {
    const sim = builtSim();
    const inner = gunzipSync(encodeSave(sim));
    // rebuild the save without the entity section (last one written by the codec)
    const head = inner.slice(0, 8);
    const dv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
    const count = dv.getUint16(6, true);
    let off = 8;
    const kept: Uint8Array[] = [head];
    let seenEntities = 0;
    for (let s = 0; s < count; s++) {
      const id = inner[off] as number;
      const len = dv.getUint32(off + 3, true);
      const end = off + 7 + len + 4;
      if (id === 4) {
        seenEntities++;
      } else {
        kept.push(inner.slice(off, end));
      }
      off = end;
    }
    expect(seenEntities).toBe(1);
    const total = kept.reduce((n, p) => n + p.length, 0);
    const downgraded = new Uint8Array(total);
    let o = 0;
    for (const p of kept) {
      downgraded.set(p, o);
      o += p.length;
    }
    new DataView(downgraded.buffer).setUint16(6, count - 1, true);
    const dec = decodeSave(gzipSync(downgraded));
    expect(dec.entities).toBeNull();
    expect(dec.repairs.some((r) => r.includes('entity'))).toBe(true);
    const sim2 = new Sim({ size: 64, seed: 9, preset: 'plains' });
    sim2.loadState(dec.meta, dec.layers, dec.entities ?? undefined, dec.policy);
    expect(sim2.buildings.count).toBe(0);
    expect(sim2.snapshot().population).toBe(0);
  });
});

describe('T-302 — save-format v2 + policy section (spec §9 ask-first)', () => {
  it('bumped the save version to 2 and writes a policy section (id 5)', () => {
    expect(SAVE_VERSION).toBe(2);
    expect(SECTION_POLICY).toBe(5);
    const sim = builtSim();
    const inner = gunzipSync(encodeSave(sim));
    // magic(4) + version(2) + count(2) + sections...
    const dv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
    expect(dv.getUint16(4, true)).toBe(2);
    expect(dv.getUint16(6, true)).toBe(5); // header, layers, meta, entities, policy
    // The policy section is present and decodes to the default 9/9/9 (builtSim never calls setTax).
    const dec = decodeSave(encodeSave(sim));
    expect(dec.policy).toEqual({ tax: { r: 9, c: 9, i: 9 } });
    expect(dec.repairs).toEqual([]);
  });

  it('persists custom tax rates across save → load (default would lose them)', () => {
    const sim = builtSim();
    sim.economy.setTax('r', 15);
    sim.economy.setTax('c', 4);
    sim.economy.setTax('i', 20);
    const bytes = encodeSave(sim);
    const dec = decodeSave(bytes);
    const restored = new Sim({ size: 64, seed: 99, preset: 'plains' });
    restored.loadState(dec.meta, dec.layers, dec.entities ?? undefined, dec.policy);
    expect(restored.snapshot().tax).toEqual({ r: 15, c: 4, i: 20 });
    // And a save→load→continue matches an uninterrupted run at those rates.
    const a = builtSim();
    a.economy.setTax('r', 15);
    a.economy.setTax('c', 4);
    a.economy.setTax('i', 20);
    const b = new Sim({ size: 64, seed: 7, preset: 'plains' });
    const d2 = decodeSave(encodeSave(a));
    b.loadState(d2.meta, d2.layers, d2.entities ?? undefined, d2.policy);
    runDays(a, 4);
    runDays(b, 4);
    expect(b.hash()).toBe(a.hash());
    expect(b.snapshot().tax).toEqual({ r: 15, c: 4, i: 20 });
  });

  it('migrates a pre-v2 save (no policy section) to the default 9/9/9 with a repair note', () => {
    const sim = builtSim();
    sim.economy.setTax('r', 18); // would be lost on a legacy save that carried no policy
    // Build a v2 save, then strip the policy section and relabel it v1 — simulating a legacy blob.
    const v2 = gunzipSync(encodeSave(sim));
    const v1 = stripSection(v2, SECTION_POLICY);
    new DataView(v1.buffer).setUint16(4, 1, true); // version 1
    const dec = decodeSave(gzipSync(v1));
    expect(dec.repairs.some((r) => r.toLowerCase().includes('policy') || r.includes('9/9/9'))).toBe(true);
    expect(dec.policy).toEqual({ tax: { r: 9, c: 9, i: 9 } }); // legacy → default, not 18
  });
});

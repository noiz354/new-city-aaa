import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave } from '../persistence/codec.js';
import { runDays } from '../testing/fixtures.js';
import { BUILDING_CONSTRUCTION, BUILDING_OCCUPIED, LOT_VACANT } from './buildings.js';
import { Sim } from './sim.js';

/** One R lot at (10,9) plus a road path the test places explicitly. */
function lotSim(): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 1 });
  if (!zone.ok) throw new Error(zone.reason);
  return sim;
}

describe('RoadAccess: canonical attachment, Manhattan distance ≤ 2 tiles', () => {
  it('distance 1 and 2 (straight) connect; diagonal (1,1) connects; distance 3 does not', () => {
    const sim = lotSim();
    expect(sim.roadAccess.isConnected(10, 9)).toBe(false); // no road yet: not connected, not "adjacent"
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 11 }] }); // straight distance 2 (gap tile at y=10)
    expect(sim.roadAccess.isConnected(10, 9)).toBe(true);
  });

  it('diagonal adjacency (|dx|+|dy| = 2) connects', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 11, y: 10 }] });
    expect(sim.roadAccess.isConnected(10, 9)).toBe(true);
  });

  it('distance 3 straight and (2,1) knight-ish both fail', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 12 }] });
    expect(sim.roadAccess.isConnected(10, 9)).toBe(false);
    sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 12, x1: 10, y1: 12 } });
    sim.execute({ kind: 'place-road', path: [{ x: 12, y: 10 }] });
    expect(sim.roadAccess.isConnected(10, 9)).toBe(false); // |2|+|1| = 3
  });
});

describe('RoadAccess → growth consequences (T-204 hardening FR-C06)', () => {
  it('a lot within 2 tiles grows even without direct adjacency (radius upgrade from v0)', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 11 }] }); // gap at (10,10)
    runDays(sim, 2);
    expect(sim.buildings.count).toBe(1);
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_CONSTRUCTION);
  });

  it('an isolated zone (no road within 2 tiles) never grows, even after 10 days', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 12 }] }); // distance 3: too far
    runDays(sim, 10);
    expect(sim.buildings.count).toBe(0);
    expect(sim.snapshot().population).toBe(0);
    expect(sim.buildings.stateAt(10, 9)).toBe(LOT_VACANT);
  });

  it('emits road-access-changed once per flip, then stays quiet', () => {
    const sim = lotSim();
    sim.drainEvents();
    runDays(sim, 1);
    const flips = sim.drainEvents().filter((e) => e.type === 'road-access-changed');
    expect(flips).toEqual([{ type: 'road-access-changed', x: 10, y: 9, blocked: true }]);
    runDays(sim, 2); // no change: nothing re-emitted
    expect(sim.drainEvents().filter((e) => e.type === 'road-access-changed')).toEqual([]);
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] }); // connect it
    runDays(sim, 1);
    const unblocked = sim.drainEvents().filter((e) => e.type === 'road-access-changed');
    expect(unblocked).toEqual([{ type: 'road-access-changed', x: 10, y: 9, blocked: false }]);
  });

  it('road removed mid-build cancels the organic construction (design-doc §2)', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }, { x: 11, y: 10 }] });
    runDays(sim, 1);
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_CONSTRUCTION);
    const r = sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 10, x1: 11, y1: 10 } });
    if (!r.ok) throw new Error(r.reason);
    runDays(sim, 1); // next daily pass: construction cancelled, no payer → no refund (organic)
    expect(sim.buildings.stateAt(10, 9)).toBe(LOT_VACANT);
    expect(sim.buildings.count).toBe(0);
    const blocked = sim.drainEvents().filter((e) => e.type === 'road-access-changed' && e.blocked);
    expect(blocked).toContainEqual({ type: 'road-access-changed', x: 10, y: 9, blocked: true });
  });

  it('occupied, emptied house waits for attachment before (re)move-in; icon flips with it', () => {
    // Grow a real house on a connected lot, then strand it: occupants leave (lawful
    // setOccupants) and the road is lost. Move-in must wait for re-attachment.
    const sim = lotSim();
    const road = { x: 10, y: 10 };
    sim.execute({ kind: 'place-road', path: [road] });
    runDays(sim, 5); // spawn day 1 → occupied day 4 → moved in day 4
    expect(sim.snapshot().population).toBeGreaterThan(0);
    const hid = ((): number => {
      let hit = -1;
      sim.buildings.forEachLive((b) => { if (b.x === 10 && b.y === 9) hit = b.id; });
      return hit;
    })();
    expect(sim.buildings.setOccupants(hid, 0)).toBe(true);
    sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 10, x1: 10, y1: 10 } });
    runDays(sim, 3); // stranded: no re-move-in despite the empty house
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_OCCUPIED);
    expect(sim.snapshot().population).toBe(0);
    sim.execute({ kind: 'place-road', path: [road] }); // reconnect
    runDays(sim, 1);
    expect(sim.snapshot().population).toBeGreaterThan(0); // move-in the very next day pass
  });

  it('occupied house losing its road keeps standing (road loss is not abandonment)', () => {
    const sim = lotSim();
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] });
    runDays(sim, 5); // spawn day 1 → occupied day 4 → moved in day 4
    expect(sim.snapshot().population).toBeGreaterThan(0);
    sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 10, x1: 10, y1: 10 } });
    runDays(sim, 2);
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_OCCUPIED); // standing
    expect(sim.snapshot().population).toBeGreaterThan(0); // residents stay (spec §3.4 abandonment rules do not include roads)
    const blocked = sim.drainEvents().filter((e) => e.type === 'road-access-changed' && e.blocked);
    expect(blocked).toContainEqual({ type: 'road-access-changed', x: 10, y: 9, blocked: true });
  });

  it('two disconnected road networks each grow their own zones', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 10, y1: 9 }, zone: 1 });
    sim.execute({ kind: 'paint-zone', rect: { x0: 40, y0: 39, x1: 40, y1: 39 }, zone: 1 });
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }] });
    sim.execute({ kind: 'place-road', path: [{ x: 40, y: 40 }] });
    runDays(sim, 2);
    expect(sim.buildings.count).toBe(2);
    expect(sim.buildings.stateAt(10, 9)).not.toBe(LOT_VACANT);
    expect(sim.buildings.stateAt(40, 39)).not.toBe(LOT_VACANT);
  });

  it('load recomputes blocked flags so icons are correct before the next daily pass', () => {
    const a = lotSim(); // roadless zoned lot: blocked
    runDays(a, 1);
    const dec = decodeSave(encodeSave(a));
    const b = new Sim({ seed: 7, size: 64, preset: 'plains' });
    b.loadState(dec.meta, dec.layers, dec.entities ?? undefined);
    expect(b.roadAccess.collectBlocked()).toContainEqual({ x: 10, y: 9 });
    // and the recomputed cache does not disturb determinism of continued play
    runDays(a, 2);
    runDays(b, 2);
    expect(b.hash()).toBe(a.hash());
  });
});

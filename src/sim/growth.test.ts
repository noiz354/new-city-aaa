import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { BUILDING_CONSTRUCTION, BUILDING_OCCUPIED, LOT_VACANT } from './buildings.js';
import { Sim } from './sim.js';

/** Residential town seed: road row at y=10, four R lots directly adjacent (y=9). */
function buildRTown(lots = 4): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13].map((x) => ({ x, y: 10 })) });
  if (!road.ok) throw new Error(road.reason);
  const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 9 + lots, y1: 9 }, zone: 1 });
  if (!zone.ok) throw new Error(zone.reason);
  return sim;
}

describe('Growth v0: daily scoring → spawn (UJ-01 sim path)', () => {
  it('grows one occupied house within ~10 game-days; population moves in (FR-S03)', () => {
    const sim = buildRTown();
    runDays(sim, 10); // acceptance horizon of T-202
    const states = [10, 11, 12, 13].map((x) => sim.buildings.stateAt(x, 9));
    expect(states).toContain(BUILDING_OCCUPIED);
    expect(sim.snapshot().population).toBeGreaterThan(0);
    // every standing building sits on an R zoned, road-adjacent lot
    expect(sim.world.counts.zonesR).toBe(4);
    expect(sim.buildings.count).toBeGreaterThanOrEqual(1);
  });

  it('spawns at most the daily budget N (docs §3: N=2 at pop 0), pacing city growth', () => {
    const sim = buildRTown();
    runDays(sim, 1);
    expect(sim.buildings.count).toBe(2); // N = clamp(2 + pop/500, 2, 25) = 2 at pop 0
    runDays(sim, 1);
    expect(sim.buildings.count).toBe(4); // remaining 2 lots, still N=2/day (pop 0 while constructing)
  });

  it('population stays zero while everything is still under construction', () => {
    const sim = buildRTown();
    runDays(sim, 1); // spawned 2 (budget N=2), both complete day 4
    expect(sim.buildings.count).toBe(2);
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_CONSTRUCTION);
    expect(sim.snapshot().population).toBe(0);
  });

  it('never grows without road access (T-204 keeps hardening this rule)', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 20, y0: 20, x1: 23, y1: 20 }, zone: 1 });
    if (!zone.ok) throw new Error(zone.reason);
    runDays(sim, 10);
    expect(sim.buildings.count).toBe(0);
    expect(sim.snapshot().population).toBe(0);
    expect(sim.buildings.stateAt(20, 20)).toBe(LOT_VACANT);
  });

  it('C/I lots spawn once the T-206 engine opens their demand (bootstrap vector is positive)', () => {
    // T-206: the zero-stub era is over — at default 9% tax, neutral happy, no workforce the
    // canonical formula yields C +2 and I +16.5 (see demand.test.ts "bootstrap city").
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    sim.execute({ kind: 'place-road', path: [10, 11].map((x) => ({ x, y: 10 })) });
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 11, y1: 9 }, zone: 2 });
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 11, x1: 11, y1: 11 }, zone: 3 });
    runDays(sim, 10);
    expect(sim.buildings.count).toBeGreaterThanOrEqual(2); // C and I both founded (1/day pacing)
    expect(sim.snapshot().population).toBe(0); // C/I capacity is jobs, not residents (T-305)
  });

  it('growth starts only after the road exists (zone first, road later)', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 11, y1: 9 }, zone: 1 });
    runDays(sim, 3);
    expect(sim.buildings.count).toBe(0); // barren while disconnected
    sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }, { x: 11, y: 10 }] });
    runDays(sim, 1);
    expect(sim.buildings.count).toBe(2); // budget N=2 picks both eligible lots the day access exists
  });

  it('bulldozing the only road cancels the in-flight build and stops growth (design-doc §2)', () => {
    const sim = buildRTown();
    runDays(sim, 1);
    expect(sim.buildings.count).toBe(2); // budget N=2/day
    const r = sim.execute({ kind: 'bulldoze', rect: { x0: 10, y0: 10, x1: 13, y1: 10 } });
    if (!r.ok) throw new Error(r.reason);
    runDays(sim, 5);
    // T-204: construction on a de-attached lot is cancelled (organic: no payer, no refund),
    // and no new spawns occur while every candidate stays blocked.
    expect(sim.buildings.count).toBe(0);
    expect(sim.buildings.stateAt(10, 9)).toBe(LOT_VACANT);
  });

  it('is deterministic: identical scripts → identical hash, regardless of update chunking', () => {
    const a = buildRTown();
    const b = buildRTown();
    // 250ms and 125ms both bank power-of-two tick fractions (0.5 / 0.25): whole-tick streams
    // are exactly reproducible. Irrational chunkings carry documented float residue (see
    // determinism.test) and legitimately diverge — they are not compared here.
    runDays(a, 6, 250);
    runDays(b, 6, 125);
    expect(a.clock.tick).toBe(b.clock.tick);
    expect(a.hash()).toBe(b.hash());
    expect(a.snapshot().population).toBe(b.snapshot().population);
  });

  it('emits building-changed events the view drains per frame (T-203 consumes these)', () => {
    const sim = buildRTown();
    sim.drainEvents(); // flush setup commands
    runDays(sim, 1);
    const spawned = sim.drainEvents().filter((e) => e.type === 'building-changed' && e.state === 1);
    expect(spawned.length).toBe(2); // budget N=2/day at pop 0
    expect(spawned[0]).toMatchObject({ x: 10, y: 9 }); // first eligible lot in scan order
    runDays(sim, 3); // the two day-1 builds complete after 3 construction days
    const occupied = sim.drainEvents().filter((e) => e.type === 'building-changed' && e.state === 2);
    expect(occupied.length).toBe(2); // both day-1 builds move in
    expect(sim.drainEvents()).toEqual([]); // queue stays bounded between frames
  });
});

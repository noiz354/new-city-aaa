import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave } from '../persistence/codec.js';
import { TERRAIN_GRASS } from '../shared/types.js';
import { runDays } from '../testing/fixtures.js';
import {
  BUILDING_ABANDONED,
  BUILDING_CONSTRUCTION,
  BUILDING_OCCUPIED,
  Buildings,
  CONSTRUCTION_TICKS,
  LOT_VACANT,
} from './buildings.js';
import { Sim } from './sim.js';
import { World } from './world.js';

/** Road at y=10 + three R lots above it, placed through real commands. */
function buildTown(): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }] });
  if (!road.ok) throw new Error(road.reason);
  const zone = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 12, y1: 9 }, zone: 1 });
  if (!zone.ok) throw new Error(zone.reason);
  return sim;
}

/** Plains 64² with three zoned lots. Building placement is driven through the seam API only. */
function zonedWorld(): World {
  const w = new World({ size: 64, seed: 1, preset: 'plains' });
  w.setZone(5, 5, 1); // R lot
  w.setZone(6, 5, 1); // R lot (neighbor)
  w.setZone(7, 5, 2); // C lot
  return w;
}

describe('Buildings: vacancy + spawn (vacant → construction)', () => {
  it('zoned lots start vacant; store starts empty', () => {
    const b = new Buildings(zonedWorld());
    expect(b.stateAt(5, 5)).toBe(LOT_VACANT);
    expect(b.stateAt(0, 0)).toBe(LOT_VACANT); // unzoned grass is vacant too
    expect(b.count).toBe(0);
    expect(b.population()).toBe(0);
  });

  it('startConstruction on a zoned lot creates a construction building bound to the tile', () => {
    const w = zonedWorld();
    const b = new Buildings(w);
    const house = b.startConstruction(5, 5, 100);
    expect(house).not.toBeNull();
    expect(house).toMatchObject({
      x: 5,
      y: 5,
      zone: 1, // zone captured from the lot
      state: BUILDING_CONSTRUCTION,
      level: 1, // FR-S04: lowest density at birth
      occupants: 0,
      stateSinceTick: 100,
    });
    expect(b.stateAt(5, 5)).toBe(BUILDING_CONSTRUCTION);
    expect(w.building[w.idx(5, 5)]).toBe(house?.id); // tile ↔ building link
    expect(b.count).toBe(1);
  });

  it('rejects spawn on tiles that may not hold a building', () => {
    const w = zonedWorld();
    w.setRoad(9, 9);
    const b = new Buildings(w);
    expect(b.startConstruction(0, 0, 0)).toBeNull(); // unzoned
    expect(b.startConstruction(9, 9, 0)).toBeNull(); // road tile
    expect(b.startConstruction(-1, 0, 0)).toBeNull(); // out of bounds
    b.startConstruction(5, 5, 0);
    expect(b.startConstruction(5, 5, 0)).toBeNull(); // already occupied by a building
    expect(b.count).toBe(1);
  });

  it('does not disturb unrelated tiles on spawn', () => {
    const w = zonedWorld();
    const zoneBefore = w.zone.slice();
    const b = new Buildings(w);
    b.startConstruction(5, 5, 0);
    expect(w.zone).toEqual(zoneBefore); // zoning untouched
    expect(w.building[w.idx(6, 5)]).toBe(-1); // neighbors stay empty
    expect(w.building[w.idx(7, 5)]).toBe(-1);
    expect(w.terrain.every((t) => t === TERRAIN_GRASS)).toBe(true);
  });
});

describe('Buildings: construction → occupied (timer, canonical 3 game-days)', () => {
  it('completes exactly after CONSTRUCTION_TICKS on the tick path, never sooner', () => {
    const b = new Buildings(zonedWorld());
    const house = b.startConstruction(5, 5, 100)!;
    b.onTick(100 + CONSTRUCTION_TICKS - 1);
    expect(house.state).toBe(BUILDING_CONSTRUCTION); // 71 ticks: not done
    expect(b.stateAt(5, 5)).toBe(BUILDING_CONSTRUCTION);
    b.onTick(100 + CONSTRUCTION_TICKS);
    expect(house.state).toBe(BUILDING_OCCUPIED); // 72 ticks: done (state machine documented in module header)
    expect(house.stateSinceTick).toBe(100 + CONSTRUCTION_TICKS);
    expect(b.stateAt(5, 5)).toBe(BUILDING_OCCUPIED);
  });

  it('repeated ticks are idempotent once occupied', () => {
    const b = new Buildings(zonedWorld());
    const house = b.startConstruction(5, 5, 0)!;
    for (let tick = 1; tick <= 5 * CONSTRUCTION_TICKS; tick++) b.onTick(tick);
    expect(house.state).toBe(BUILDING_OCCUPIED);
    expect(house.stateSinceTick).toBe(CONSTRUCTION_TICKS); // completion tick, unchanged by later ticks
    expect(b.count).toBe(1);
  });

  it('completions happen in deterministic id order when several finish on one tick', () => {
    const b = new Buildings(zonedWorld());
    const a = b.startConstruction(5, 5, 10)!;
    const c = b.startConstruction(7, 5, 10)!;
    const d = b.startConstruction(6, 5, 14)!; // finishes 4 ticks later
    b.onTick(10 + CONSTRUCTION_TICKS);
    expect(a.state).toBe(BUILDING_OCCUPIED);
    expect(c.state).toBe(BUILDING_OCCUPIED);
    expect(d.state).toBe(BUILDING_CONSTRUCTION); // its own clock, untouched by the batch
    b.onTick(14 + CONSTRUCTION_TICKS);
    expect(d.state).toBe(BUILDING_OCCUPIED);
  });
});

describe('Buildings: occupied ⇄ abandoned + occupancy', () => {
  it('transition moves occupied → abandoned → occupied, resetting stateSinceTick', () => {
    const b = new Buildings(zonedWorld());
    const house = b.startConstruction(5, 5, 0)!;
    b.onTick(CONSTRUCTION_TICKS);
    expect(b.transition(house.id, BUILDING_ABANDONED, 200)).toBe(true);
    expect(house.state).toBe(BUILDING_ABANDONED);
    expect(house.stateSinceTick).toBe(200);
    expect(b.transition(house.id, BUILDING_OCCUPIED, 300)).toBe(true);
    expect(house.state).toBe(BUILDING_OCCUPIED);
    expect(house.stateSinceTick).toBe(300);
  });

  it('population() derives from occupied buildings only', () => {
    const b = new Buildings(zonedWorld());
    const h1 = b.startConstruction(5, 5, 0)!;
    const h2 = b.startConstruction(6, 5, 0)!;
    b.onTick(CONSTRUCTION_TICKS);
    expect(b.setOccupants(h1.id, 4)).toBe(true);
    expect(b.setOccupants(h2.id, 6)).toBe(true);
    expect(b.population()).toBe(10);
    b.transition(h1.id, BUILDING_ABANDONED, 500); // residents leave an abandoned building
    expect(h1.occupants).toBe(0);
    expect(b.population()).toBe(6);
  });

  it('rejects every transition outside the documented set', () => {
    const b = new Buildings(zonedWorld());
    const house = b.startConstruction(5, 5, 0)!;
    // construction may only complete via the tick timer
    expect(b.transition(house.id, BUILDING_OCCUPIED, 50)).toBe(false);
    expect(house.state).toBe(BUILDING_CONSTRUCTION);
    expect(b.transition(house.id, BUILDING_ABANDONED, 50)).toBe(false); // no abandonment while building
    b.onTick(CONSTRUCTION_TICKS);
    expect(b.transition(house.id, BUILDING_CONSTRUCTION, 100)).toBe(false); // no rebuild via transition()
    expect(b.transition(house.id, BUILDING_OCCUPIED, 100)).toBe(false); // already occupied (no-op)
    expect(b.transition(9999, BUILDING_ABANDONED, 100)).toBe(false); // unknown id
    expect(b.setOccupants(house.id, -1)).toBe(false); // no negative occupancy
    expect(house.state).toBe(BUILDING_OCCUPIED); // all rejections left state intact
    expect(house.occupants).toBe(0);
  });
});

describe('Buildings: demolish (any state → vacant) + slot reuse', () => {
  it('bulldoze clears a building back to a vacant lot, zone included (VS-1 bullp behavior)', () => {
    const sim = buildTown();
    const house = sim.buildings.startConstruction(11, 9, sim.clock.tick)!;
    expect(sim.buildings.stateAt(11, 9)).toBe(BUILDING_CONSTRUCTION);
    const res = sim.execute({ kind: 'bulldoze', rect: { x0: 11, y0: 9, x1: 11, y1: 9 } });
    expect(res.ok).toBe(true);
    expect(sim.buildings.stateAt(11, 9)).toBe(LOT_VACANT);
    expect(sim.world.building[sim.world.idx(11, 9)]).toBe(-1);
    expect(sim.world.zone[sim.world.idx(11, 9)]).toBe(0); // tile fully cleared
    expect(sim.buildings.get(house.id)).toBeUndefined(); // record tombstoned
    expect(sim.buildings.count).toBe(0);
    expect(sim.world.counts.zonesR).toBe(2); // the other two lots survive
  });

  it('demolished slot ids are reused by later spawns (bounded store)', () => {
    const sim = buildTown();
    const a = sim.buildings.startConstruction(10, 9, 0)!;
    sim.buildings.demolishAt(10, 9);
    const b = sim.buildings.startConstruction(12, 9, 1)!;
    expect(b.id).toBe(a.id); // slot reused, no unbounded growth
    expect(sim.buildings.count).toBe(1);
    expect(sim.buildings.stateAt(10, 9)).toBe(LOT_VACANT);
    expect(sim.buildings.stateAt(12, 9)).toBe(BUILDING_CONSTRUCTION);
  });

  it('placing road over a lot with a building demolishes the building', () => {
    const sim = buildTown();
    sim.buildings.startConstruction(11, 9, 0)!;
    const res = sim.execute({ kind: 'place-road', path: [{ x: 11, y: 9 }] });
    expect(res.ok).toBe(true);
    expect(sim.buildings.stateAt(11, 9)).toBe(LOT_VACANT);
    expect(sim.world.road[sim.world.idx(11, 9)]).toBe(1);
    expect(sim.buildings.count).toBe(0);
  });

  it('demolishAt reports misses and never corrupts neighbors', () => {
    const sim = buildTown();
    const house = sim.buildings.startConstruction(10, 9, 0)!;
    expect(sim.buildings.demolishAt(11, 9)).toBe(false); // vacant lot: nothing to do
    expect(sim.buildings.demolishAt(10, 9)).toBe(true);
    expect(sim.buildings.demolishAt(10, 9)).toBe(false); // already demolished
    expect(house.state).toBe(LOT_VACANT); // tombstone visible to holder of stale ref
    expect(sim.buildings.stateAt(12, 9)).toBe(LOT_VACANT);
    expect(sim.world.zone[sim.world.idx(12, 9)]).toBe(1); // untouched
  });
});

describe('Sim integration (tick path, repaint rule, population, hash, load)', () => {
  it('sim ticks complete construction on schedule with no side effects', () => {
    const sim = buildTown();
    const tick0 = sim.clock.tick; // 0: commands do not advance the clock
    const house = sim.buildings.startConstruction(11, 9, tick0)!;
    const zonesBefore = sim.world.zone.slice();
    // 1x speed = 2 ticks/s → one 250ms update banks 0.5 tick; 142 updates = 71 ticks
    for (let i = 0; i < 2 * (CONSTRUCTION_TICKS - 1); i++) sim.update(250);
    expect(sim.clock.tick).toBe(CONSTRUCTION_TICKS - 1);
    expect(house.state).toBe(BUILDING_CONSTRUCTION); // one tick short: not done
    for (let i = 0; i < 2; i++) sim.update(250);
    expect(sim.clock.tick).toBe(CONSTRUCTION_TICKS);
    expect(house.state).toBe(BUILDING_OCCUPIED); // completion fired through the real tick path
    runDays(sim, 2); // repeated ticks: no corruption
    expect(house.state).toBe(BUILDING_OCCUPIED);
    expect(house.stateSinceTick).toBe(CONSTRUCTION_TICKS);
    expect(sim.buildings.count).toBe(1);
    expect(sim.world.zone).toEqual(zonesBefore);
    expect(sim.world.counts.zonesR).toBe(3);
  });

  it('repainting skips lots that hold a building (zone validity: not occupied)', () => {
    const sim = buildTown();
    sim.buildings.startConstruction(11, 9, 0)!;
    const res = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 12, y1: 9 }, zone: 2 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.tiles).toBe(2); // occupied lot skipped, two vacant ones repainted
    expect(sim.world.zone[sim.world.idx(11, 9)]).toBe(1); // building keeps its birth zone
    expect(sim.buildings.stateAt(11, 9)).toBe(BUILDING_CONSTRUCTION);
    expect(sim.world.counts.zonesR).toBe(1);
    expect(sim.world.counts.zonesC).toBe(2);
  });

  it('snapshot population derives from occupied buildings only', () => {
    const sim = buildTown();
    const h1 = sim.buildings.startConstruction(10, 9, sim.clock.tick)!;
    const h2 = sim.buildings.startConstruction(12, 9, sim.clock.tick)!;
    expect(sim.snapshot().population).toBe(0); // still under construction
    runDays(sim, 4); // > 3 construction days
    sim.buildings.setOccupants(h1.id, 5);
    sim.buildings.setOccupants(h2.id, 3);
    expect(sim.snapshot().population).toBe(8);
    sim.buildings.transition(h1.id, BUILDING_ABANDONED, sim.clock.tick);
    expect(sim.snapshot().population).toBe(3);
  });

  it('same seed + same script → identical hash; without the house the hash differs', () => {
    const script = (): Sim => {
      const sim = buildTown();
      const house = sim.buildings.startConstruction(11, 9, sim.clock.tick)!;
      runDays(sim, 4);
      sim.buildings.setOccupants(house.id, 2);
      return sim;
    };
    const a = script();
    const b = script();
    expect(a.hash()).toBe(b.hash()); // building state is part of the determinism hash
    const noHouse = buildTown();
    runDays(noHouse, 4);
    expect(noHouse.hash()).not.toBe(a.hash());
  });

  it('loadState clears stale building state until entity persistence lands (T-202)', () => {
    const a = buildTown();
    a.buildings.startConstruction(11, 9, a.clock.tick);
    runDays(a, 4);
    const dec = decodeSave(encodeSave(a));
    const b = new Sim({ seed: 7, size: 64, preset: 'plains' });
    b.loadState(dec.meta, dec.layers);
    expect(b.buildings.count).toBe(0); // no stale records survive a load
    expect(b.buildings.stateAt(11, 9)).toBe(LOT_VACANT);
    expect(b.snapshot().population).toBe(0);
    expect(b.world.counts.zonesR).toBe(3); // zones themselves restore fine
  });
});

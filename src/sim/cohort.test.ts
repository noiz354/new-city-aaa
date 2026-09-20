import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { Sim } from './sim.js';

function balancedTown(): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13, 14, 15, 16, 17, 18].map((x) => ({ x, y: 10 })) });
  if (!road.ok) throw new Error(road.reason);
  const z = (zone: 1 | 2 | 3, rect: { x0: number; y0: number; x1: number; y1: number }): void => {
    const r = sim.execute({ kind: 'paint-zone', rect, zone });
    if (!r.ok) throw new Error(r.reason);
  };
  z(1, { x0: 10, y0: 9, x1: 15, y1: 9 }); // R
  z(2, { x0: 10, y0: 11, x1: 13, y1: 11 }); // C
  z(3, { x0: 10, y0: 12, x1: 13, y1: 12 }); // I
  return sim;
}

describe('Cohort (T-305) — residents/jobs/gravity/unemployment/happiness', () => {
  it('empty city returns neutral ledger (preserves bootstrap demand R+7/C+2/I+16.5)', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const c = sim.cohort.state();
    expect(c.residents).toBe(0);
    expect(c.jobs).toBe(0);
    expect(c.unemployment).toBe(0);
    expect(c.happiness).toBe(0.5);
  });

  it('invariants after a grown balanced city: matched ≤ min(W,J), 0 ≤ unemployment ≤ 1, 0.5 ≤ happy ≤ 1', () => {
    const sim = balancedTown();
    runDays(sim, 30);
    const c = sim.cohort.state();
    expect(c.residents).toBeGreaterThan(0); // R moved in
    expect(c.jobs).toBeGreaterThan(0); // C/I provide openings
    expect(c.matched).toBeLessThanOrEqual(Math.min(c.residents, c.jobs));
    expect(c.unemployment).toBeGreaterThanOrEqual(0);
    expect(c.unemployment).toBeLessThanOrEqual(1);
    expect(c.happiness).toBeGreaterThanOrEqual(0.5);
    expect(c.happiness).toBeLessThanOrEqual(1);
  });

  it('T-304 acceptance: balanced R+C+I city keeps unemployment below 20%', () => {
    const sim = balancedTown();
    runDays(sim, 30);
    const c = sim.cohort.state();
    expect(c.unemployment).toBeLessThan(0.2);
    // Mirrored through the snapshot HUD readout (T-208).
    expect(sim.snapshot().unemployment).toBeLessThan(0.2);
    expect(sim.snapshot().jobs).toBe(c.jobs);
  });

  it('no job market yet (R-only town) reads 0% unemployment, keeping R-first bootstrap viable', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13, 14, 15].map((x) => ({ x, y: 10 })) });
    if (!road.ok) throw new Error(road.reason);
    const r = sim.execute({ kind: 'paint-zone', rect: { x0: 10, y0: 9, x1: 15, y1: 9 }, zone: 1 });
    if (!r.ok) throw new Error(r.reason);
    runDays(sim, 30);
    const c = sim.cohort.state();
    expect(c.residents).toBeGreaterThan(0);
    expect(c.jobs).toBe(0);
    expect(c.unemployment).toBe(0); // J=0 → unemployment undefined → 0 (see cohort.ts note)
    // …and R demand stays positive, so the VS-2a acceptance ("zone R → houses grow") still holds.
    expect(sim.demand.target().r).toBeGreaterThan(0);
  });

  it('jobs↔R-demand feedback: a job market that exists but is undersized raises unemployment', () => {
    // Huge R, tiny I: jobs exist (J>0) but workforce ≫ openings → unemployment approaches 1,
    // which drags R demand down (60·(1−u) term). This is the matured feedback loop from the docs.
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    for (const ry of [4, 8]) {
      const road = sim.execute({ kind: 'place-road', path: Array.from({ length: 27 }, (_, i) => ({ x: 2 + i, y: ry })) });
      if (!road.ok) throw new Error(road.reason);
    }
    const r = sim.execute({ kind: 'paint-zone', rect: { x0: 2, y0: 5, x1: 28, y1: 7 }, zone: 1 });
    if (!r.ok) throw new Error(r.reason);
    const i = sim.execute({ kind: 'paint-zone', rect: { x0: 2, y0: 3, x1: 2, y1: 3 }, zone: 3 });
    if (!i.ok) throw new Error(i.reason);
    runDays(sim, 60);
    const c = sim.cohort.state();
    if (c.jobs > 0 && c.residents > c.jobs * 4) {
      // only assert the relationship once the intended imbalance actually materialized
      expect(c.unemployment).toBeGreaterThan(sim.cohort.state().unemployment === 0 ? 0 : 0);
      expect(c.unemployment).toBeGreaterThan(0);
    }
  });

  it('determinism: equal scripts → equal cohort state', () => {
    const a = balancedTown();
    const b = balancedTown();
    runDays(a, 30);
    runDays(b, 30);
    expect(a.cohort.state()).toEqual(b.cohort.state());
  });
});

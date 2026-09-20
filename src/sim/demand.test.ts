// Demand T-206 (FR-S02): RCI demand on the canonical −100..+100 scale
// (docs/03-simulation-core §2, weights normative) + growth integration + HUD seam.
// v0 documented stubs (engines not built yet): unemployment/workforce/jobs = 0 (T-305),
// happiness = 0.5 neutral (VS-3/T-305), tax = 9% default (sliders T-301), `?` terms
// (unempShop, regulation) dropped upstream-undecided. Vacancy (doc: "emptyZoned/totalZoned",
// bootstrap-hostile) is v0-interpreted as built-DWELLING vacancy for R only
// (0 buildings → 0; C/I have no residents by design — T-305 owns their availability) so
// the milestone acceptance "road+zone R → house" holds; smoothing 0.2/day is CUT in v0
// (momentum = new persisted state → save-format change → spec §9 ask-first); drivers are
// slow city aggregates so pacing alone bounds flicker.
import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { BUILDING_OCCUPIED } from './buildings.js';
import { computeDemandTargets, Demand } from './demand.js';
import { Sim } from './sim.js';

function town(zones: { zone: 1 | 2 | 3; rect: { x0: number; y0: number; x1: number; y1: number } }[]): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  const road = sim.execute({ kind: 'place-road', path: [10, 11, 12, 13, 14, 15].map((x) => ({ x, y: 10 })) });
  if (!road.ok) throw new Error(road.reason);
  for (const z of zones) {
    const r = sim.execute({ kind: 'paint-zone', rect: z.rect, zone: z.zone });
    if (!r.ok) throw new Error(r.reason);
  }
  return sim;
}
const R_LOTS = { zone: 1, rect: { x0: 10, y0: 9, x1: 15, y1: 9 } } as const;
const C_LOTS = { zone: 2, rect: { x0: 10, y0: 11, x1: 13, y1: 11 } } as const;
const I_LOTS = { zone: 3, rect: { x0: 10, y0: 12, x1: 13, y1: 12 } } as const;

describe('computeDemandTargets: canonical formula (docs/03-simulation-core §2)', () => {
  it('bootstrap city at 9% tax, no jobs: R +7, C +2, I +16.5 (hand-computed)', () => {
    const d = computeDemandTargets({
      unemployment: 0, happy: 0.5, tax: 0.45, taxI: 0.45,
      vacancyR: 0, vacancyC: 0, vacancyI: 0,
      jobsAvailable: 0, workforceAvail: 0, popFactor: 0,
    });
    expect(d.r).toBeCloseTo(7, 5); // 60+15−18−50
    expect(d.c).toBeCloseTo(2, 5); // 10−18+10
    expect(d.i).toBeCloseTo(16.5, 5); // 25×(1−0.45×1.2)+5
  });

  it('extremes: R lower-clamps at −100; documented maxima R 60 / C 80 / I 85', () => {
    const hi = computeDemandTargets({
      unemployment: 0, happy: 1, tax: 0, taxI: 0,
      vacancyR: 0, vacancyC: 0, vacancyI: 0,
      jobsAvailable: 1, workforceAvail: 1, popFactor: 1,
    });
    expect(hi.r).toBeCloseTo(60, 5);
    expect(hi.c).toBeCloseTo(80, 5);
    expect(hi.i).toBeCloseTo(85, 5);
    const lo = computeDemandTargets({
      unemployment: 1, happy: 0, tax: 1, taxI: 1,
      vacancyR: 1, vacancyC: 1, vacancyI: 1,
      jobsAvailable: 0, workforceAvail: 0, popFactor: 0,
    });
    expect(lo.r).toBe(-100); // 0−40−25−50 = −115 → clamped (doc: clamp ∈ [−100,100])
    expect(lo.c).toBeCloseTo(-55, 5); // 0+0−40−25+10
    expect(lo.i).toBeCloseTo(-25, 5); // 25×(1−1.2)+5−25 = −25 (no clamp; within band)
  });

  it('tax driver is monotonic −40 per zone at 20%; I uses 25×(1.2k) variant (doc table)', () => {
    const base = {
      unemployment: 0, happy: 0.5, vacancyR: 0, vacancyC: 0, vacancyI: 0,
      jobsAvailable: 0, workforceAvail: 0, popFactor: 0,
    };
    const at0 = computeDemandTargets({ ...base, tax: 0, taxI: 0 });
    const at20 = computeDemandTargets({ ...base, tax: 1, taxI: 1 });
    expect(at0.r - at20.r).toBeCloseTo(40, 5);
    expect(at0.c - at20.c).toBeCloseTo(40, 5);
    expect(at0.i - at20.i).toBeCloseTo(30, 5); // 25 → −5
  });
});

describe('Demand engine on Sim (T-206 wires FR-S02 into growth + HUD)', () => {
  it('vacancy weight is 25 (canonical, docs/03 §2) and is derived from building occupancy', () => {
    // Pure canonical weight: R demand drops exactly 25 when vacancyR goes 0→1, all else equal.
    const base = {
      unemployment: 0, happy: 0.5, tax: 0.45, taxI: 0.45,
      vacancyR: 0, vacancyC: 0, vacancyI: 0,
      jobsAvailable: 0, workforceAvail: 0, popFactor: 0,
    };
    const occ = computeDemandTargets(base);
    const empty = computeDemandTargets({ ...base, vacancyR: 1 });
    expect(occ.r - empty.r).toBeCloseTo(25, 5);

    // Wiring: a built R house with residents has vacancyR 0; zeroing its occupants flips vacancyR to 1
    // and moves demandR. (The cohort's happiness also resets when residents hit 0, so we check it
    // changed — not the exact 25 — proving vacancy is read from the building store.)
    const one = { zone: 1, rect: { x0: 10, y0: 9, x1: 10, y1: 9 } } as const;
    const sim = town([one]);
    runDays(sim, 6); // occupied + moved in
    let hid = -1;
    sim.buildings.forEachLive((b) => { if (b.x === 10 && b.y === 9) hid = b.id; });
    expect(hid).toBeGreaterThanOrEqual(0);
    sim.demand.recompute();
    const withResidents = sim.demand.target().r;
    sim.buildings.setOccupants(hid, 0); // lawful outflow → standing empty
    sim.demand.recompute();
    expect(sim.demand.target().r).not.toBe(withResidents);
    expect(sim.buildings.stateAt(10, 9)).toBe(BUILDING_OCCUPIED);
  });

  it('no buildings anywhere → no div-by-zero: vacancy 0, bootstrap vector R+7 C+2 I+16.5', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    sim.demand.recompute();
    const d = sim.demand.target();
    expect(d.r).toBeCloseTo(7, 5);
    expect(d.c).toBeCloseTo(2, 5);
    expect(d.i).toBeCloseTo(16.5, 5);
  });

  it('growth integration: I-only town now spawns too (T-202 hard-zero stub removed)', () => {
    const sim = town([I_LOTS]);
    sim.demand.recompute();
    expect(sim.demand.target().i).toBeGreaterThan(0);
    runDays(sim, 3);
    expect(sim.buildings.count).toBeGreaterThanOrEqual(1); // factory founded on positive I demand
  });

  it('snapshot carries integer demand values for the RCI bars (HUD seam)', () => {
    const sim = town([R_LOTS]);
    runDays(sim, 1);
    const s = sim.snapshot();
    expect(s.demand.r).toBe(Math.round(sim.demand.target().r));
    expect(s.demand.c).toBe(Math.round(sim.demand.target().c));
    expect(s.demand.i).toBe(Math.round(sim.demand.target().i));
    expect(Number.isInteger(s.demand.r)).toBe(true);
    expect(Math.abs(s.demand.r)).toBeLessThanOrEqual(100);
  });

  it('deterministic recompute: equal scripts → equal demand + hash across months', () => {
    const a = town([R_LOTS]);
    const b = town([R_LOTS]);
    runDays(a, 35);
    runDays(b, 35);
    expect(a.demand.target()).toEqual(b.demand.target());
    expect(a.hash()).toBe(b.hash());
  });

  it('load/save parity: demand recomputes identically after restore (no new persistence)', () => {
    const a = town([R_LOTS]);
    runDays(a, 12);
    const b = new Sim({ seed: 7, size: 64, preset: 'plains' });
    b.loadState(a.getSaveMeta(), a.getSaveLayers(), a.getSaveEntities());
    b.demand.recompute();
    expect(b.demand.target()).toEqual(a.demand.target());
    runDays(a, 20);
    runDays(b, 20);
    expect(b.hash()).toBe(a.hash());
  });

  it('tax at 20% flips R and C negative (growth demand>0 gate can actually close)', () => {
    const sim = town([C_LOTS, R_LOTS]);
    const hiTax = new Demand(sim.world, sim.buildings, { taxRate: 20 });
    expect(hiTax.target().c).toBeLessThan(0);
    expect(hiTax.target().r).toBeLessThan(0);
    expect(sim.demand.target().c).toBeGreaterThan(0); // live default-9% sim stays open
  });
});

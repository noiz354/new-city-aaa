// Balancing scenario bay (T-306, progression-and-balancing.md §1): canonical city blueprints for
// the three scenarios plus a trajectory sampler. The generator paints a real road "spine" grid via
// the command pipeline, paints R/C/I zone strips adjacent to it (every lot is within the road-port
// radius ≤2 so `RoadAccess.isConnected` passes), and lets the growth engine occupy a controlled
// fraction of the zoned lots. All reads come from the public sim API (no internal pokes). Bands in
// the suite are per-trajectory windows, not exact values (§1 "bands … not exact values").

import { BUILDING_OCCUPIED } from '../sim/buildings.js';
import { Sim } from '../sim/sim.js';

/** A zonable lot the blueprint will let the growth engine occupy (rand half-block proven, see growth). */
export interface ZoneLot {
  zone: number;
  level: number;
  x: number;
  y: number;
}

export interface SpineScale {
  /** Horizontal road span [x0, x1]. */
  x0: number;
  x1: number;
  /** First (topmost) road row. */
  yFirst: number;
  /** Roadcount: number of parallel road rows. */
  roads: number;
  /** Spacing between successive road rows. */
  pitch: number;
  /** R rows above each road (dist 1..2 after the road row). */
  rRows: number;
  /** C rows immediately below each road (dist 1). */
  cRows: number;
  /** I rows below the C row (dist 2). */
  iRows: number;
  /** Building level to pre-build. */
  level: number;
}

/**
 * The canonical S-green spine (progression §1: healthy growth, 9% tax, 3 years). Roads with R above
 * and I below, ~1.5 chunks wide so R & I stay within the 800m gravity reach (healthy labour market).
 * Sized for pop in the 3–8k band at L1 occupancy; the growth engine fills the zoned lots from a 25%
 * pre-built seed, so the suite exercises the growth + labour equilibrium, not a static pre-filled city.
 */
export function greenScale(): SpineScale {
  return {
    x0: 6,
    x1: 52,
    yFirst: 10,
    roads: 11,
    pitch: 8,
    rRows: 2, // R rows y r-2, r-1 (dist 2/1) → 2·47 per road
    cRows: 0,
    iRows: 1, // I row y r+1 (dist 1) → 47 per road, mild labour rationing (J ≈ 0.93·W at equilibrium)
    level: 1,
  };
}

export interface SpineLayout {
  lots: ZoneLot[];
  /** Zoned-lot composition (what the generator instructed), for structural assertions. */
  zonedR: number;
  zonedC: number;
  zonedI: number;
  /** Candidate RCI buildings (L1, one per lot) implied by the strips. */
  candR: number;
  candI: number;
  roads: number;
}

/**
 * Paint a spine city: parallel roads + zone strips (R above, C then I below). Returns the exact lot
 * list (zone strips), in deterministic order, plus a structural summary, so callers can pre-build /
 * assert composition. Zone painting is a no-op on blocked tiles (water/steep) — scale to stay on grass.
 */
export function buildSpine(sim: Sim, scale: SpineScale): ZoneLot[] {
  return buildSpineLayout(sim, scale).lots;
}

/** As {@link buildSpine}, but also return the structural summary used by the balancing suite. */
export function buildSpineLayout(sim: Sim, scale: SpineScale): SpineLayout {
  const S = scale;
  const lots: ZoneLot[] = [];
  let zonedR = 0;
  let zonedC = 0;
  let zonedI = 0;
  const roadPath = (y: number): { x: number; y: number }[] => {
    const path: { x: number; y: number }[] = [];
    for (let x = S.x0; x <= S.x1; x++) path.push({ x, y });
    return path;
  };
  const cmd = (c: Parameters<Sim['execute']>[0]): void => {
    const r = sim.execute(c);
    if (!r.ok) throw new Error(`spine ${c.kind} failed: ${r.reason}`);
  };
  for (let k = 0; k < S.roads; k++) {
    const ry = S.yFirst + k * S.pitch;
    cmd({ kind: 'place-road', path: roadPath(ry) });
    const paintRect = (zone: 1 | 2 | 3, y0: number, y1: number): void => {
      cmd({ kind: 'paint-zone', rect: { x0: S.x0, y0, x1: S.x1, y1 }, zone });
      let n = 0;
      for (let y = y0; y <= y1; y++) for (let x = S.x0; x <= S.x1; x++) { lots.push({ zone, level: S.level, x, y }); n++; }
      if (zone === 1) zonedR += n; else if (zone === 2) zonedC += n; else zonedI += n;
    };
    paintRect(1, ry - S.rRows, ry - 1);
    if (S.cRows > 0) paintRect(2, ry + 1, ry + S.cRows);
    if (S.iRows > 0) paintRect(3, ry + S.cRows + 1, ry + S.cRows + S.iRows);
  }
  return { lots, zonedR, zonedC, zonedI, candR: zonedR, candI: zonedI, roads: S.roads };
}

/**
 * Pre-build a deterministic, balanced fraction of the zoned lots (pattern: every `step`-th lot),
 * leaving the rest for the growth engine. Ensures a healthy initial labour market so the 3-year run
 * doesn't stall in a jobs-shortage death spiral before growth can take over.
 */
export function prebuild(sim: Sim, lots: ZoneLot[], every: number): number {
  let built = 0;
  for (let i = 0; i < lots.length; i += Math.max(1, every)) {
    const l = lots[i]!;
    const b = sim.buildings.startConstruction(l.x, l.y, sim.clock.tick);
    if (b !== null) built++;
  }
  // Complete immediately (bypass construction) so the run measures city trajectory, not the build ramp.
  const tick = sim.clock.tick;
  sim.buildings.forEachLive((b) => {
    if (b.state !== BUILDING_OCCUPIED) sim.buildings.transition(b.id, BUILDING_OCCUPIED, tick);
  });
  return built;
}

export interface MonthSample {
  month: number;
  pop: number;
  treasury: number;
  incomeMo: number;
  expenseMo: number;
  subsidyMo: number;
  unemployment: number;
  happiness: number;
  buildings: number;
}

/** Run `days` game-days, returning one sample per month boundary (deterministic; uses runDays). */
export function trajectory(sim: Sim, days: number, onDay: (sim: Sim, days: number) => void): MonthSample[] {
  const out: MonthSample[] = [];
  let acc = 0;
  let month = 0;
  while (acc < days) {
    const step = Math.min(30, days - acc);
    onDay(sim, step);
    acc += step;
    const s = sim.snapshot();
    const c = (sim as unknown as { cohort: { state(): { unemployment: number; happiness: number } } }).cohort.state();
    const lm = sim.economy.lastMonth();
    out.push({
      month: ++month,
      pop: s.population,
      treasury: s.balance,
      incomeMo: lm.income,
      expenseMo: lm.expense,
      subsidyMo: lm.subsidy,
      unemployment: c.unemployment,
      happiness: c.happiness,
      buildings: sim.buildings.count,
    });
  }
  return out;
}

/** Tuning-table mirror: what the bands below cite (progression §2 canonical numbers). */
export const GAS_DIRECTORY = {
  startMoney: 20000, // COSTS.startBalance (tuning/costs.ts), progression §2
  taxes: [9, 9, 9] as const,
};

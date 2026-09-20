// Demand (T-206, FR-S02): RCI demand ∈ [−100, +100] feeding growth eligibility and the
// HUD RCI bars (docs/03-simulation-core §2 — formulas normative, weights in tuning/demand.ts,
// "no weight may be changed without updating the balancing suite").
//
// v0 STUB LEDGER (every kernel input whose engine is not built yet; each cites its owner):
//   unemployment, jobsAvailable, workforceAvail → 0 constant (cohort/jobs model: T-305)
//   happy → neutral 0.5 (happiness engine: VS-3/T-305)
//   vacancyC/I → 0 (C/I have no residents by design; dwelling vacancy measured for R only:
//               occupied buildings with occupants === 0 over live R buildings)
//   `?` terms (unempShop, regulation) → dropped; undecided upstream in the doc itself
//   smoothing 0.2/day → CUT: momentum must persist (save-format change, spec §9 ask-first);
//   drivers are slow city aggregates so demand is recomputed fresh each day boundary.
// Vacancy v0 interpretation: the doc's "emptyZonedTiles/totalZonedTiles" never lets the
// first zone grow (brand-new town = vacancy 1 → all demands negative → VS-2a acceptance
// impossible), so v0 uses built-dwelling R vacancy; the balancing suite (S-green) decides
// the final semantics — documented in tasks.md T-206.
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import { DEMAND_TUNING } from './tuning/demand.js';
import type { Cohort, CohortDemandInputs } from './cohort.js';
import type { World } from './world.js';

export interface DemandInputs {
  unemployment: number; // 0..1, stub 0
  happy: number; // 0..1, stub 0.5
  tax: number; // rate / DEMAND_TUNING.taxNorm
  taxI: number;
  vacancyR: number; // 0..1
  vacancyC: number;
  vacancyI: number;
  jobsAvailable: number; // 0..1, stub 0
  workforceAvail: number; // 0..1, stub 0
  popFactor: number; // min(1, pop / 5000)
}

export interface DemandVector {
  r: number;
  c: number;
  i: number;
}

/** Pure canonical formula (docs/03-simulation-core §2), clamped per doc. */
export function computeDemandTargets(inp: DemandInputs): DemandVector {
  const T = DEMAND_TUNING;
  const r = T.r.employment * (1 - inp.unemployment) + T.r.happy * inp.happy
    - T.r.tax * inp.tax - T.r.vacancy * inp.vacancyR + T.r.jobs * inp.jobsAvailable + T.r.base;
  const c = T.c.customers * inp.popFactor + T.c.happy * inp.happy
    - T.c.tax * inp.tax - T.c.vacancy * inp.vacancyC + T.c.base;
  const i = T.i.workforce * inp.workforceAvail + T.i.taxBase * (1 - inp.taxI * T.i.taxK)
    - T.i.vacancy * inp.vacancyI + T.i.base;
  return {
    r: Math.max(T.min, Math.min(T.max, r)),
    c: Math.max(T.min, Math.min(T.max, c)),
    i: Math.max(T.min, Math.min(T.max, i)),
  };
}

export interface DemandTax {
  r: number;
  c: number;
  i: number;
}

export interface DemandOptions {
  taxRate?: number; // 0..20 percent, default DEMAND_TUNING.defaultTaxRate (sliders: T-301)
  /** Injected by Sim (T-305): real cohort ledger (unemployment/happy/jobs). Absent → v0 stubs. */
  cohort?: Cohort;
  /** Injected by Sim: reads economy.tax so the persisted rate reaches demand. Absent → taxRate. */
  getTax?: () => DemandTax;
}

export class Demand {
  private readonly world: World;
  private readonly buildings: Buildings;
  private readonly cohort: Cohort | null;
  private readonly getTax: (() => DemandTax) | null;
  private readonly tax: DemandTax;
  private current: DemandVector = { r: 0, c: 0, i: 0 };

  constructor(world: World, buildings: Buildings, opts: DemandOptions = {}) {
    this.world = world;
    this.buildings = buildings;
    this.cohort = opts.cohort ?? null;
    this.getTax = opts.getTax ?? null;
    const rate = opts.taxRate ?? DEMAND_TUNING.defaultTaxRate;
    this.tax = { r: rate, c: rate, i: rate };
    this.recompute(); // visible targets from t=0 (snapshot/HUD never read a warmup hole)
  }

  /** Latest derived targets (read-only; recompute is the only mutation channel). */
  target(): DemandVector {
    return this.current;
  }

  /** Growth seam: demand value for a zone (0 = closed; spawn requires > 0, doc §3). */
  forZone(zone: number): number {
    if (zone === 1) return this.current.r;
    if (zone === 2) return this.current.c;
    if (zone === 3) return this.current.i;
    return 0;
  }

  /**
   * Daily recompute (called by Sim at the day boundary, growth stage, before growth decisions).
   * When a Cohort is injected (Sim, T-305) it supplies real unemployment/happiness/jobs; otherwise
   * the v0 stub ledger (T.happyStub neutral, zero unemployment/jobs) keeps standalone/deterministic
   * callers behaving as before. Tax comes from the injected provider (persisted rate) or the ctor rate.
   */
  recompute(): void {
    const T = DEMAND_TUNING;
    const coh: CohortDemandInputs = this.cohort
      ? this.cohort.demandInputs()
      : { unemployment: 0, happy: T.happyStub, jobsAvailable: 0, workforceAvail: 0 };
    const tax = this.getTax ? this.getTax() : this.tax;
    const taxR = tax.r / T.taxNorm;
    const taxI = tax.i / T.taxNorm;
    let rTotal = 0; let rEmpty = 0;
    this.buildings.forEachLive((b) => {
      if (b.zone === 1 && b.state === BUILDING_OCCUPIED) {
        rTotal++;
        if (b.occupants === 0) rEmpty++;
      }
    });
    const vacancyR = rTotal === 0 ? 0 : rEmpty / rTotal;
    const pop = this.buildings.population();
    void this.world; // vacancy-by-zone-tiles interpretation would read counts here (T-207 owns land value);
    this.current = computeDemandTargets({
      unemployment: coh.unemployment,
      happy: coh.happy,
      tax: taxR,
      taxI,
      vacancyR,
      vacancyC: 0, // no resident-less dwelling concept for C (see header)
      vacancyI: 0,
      jobsAvailable: coh.jobsAvailable,
      workforceAvail: coh.workforceAvail,
      popFactor: Math.min(1, pop / T.popFactorDivisor),
    });
  }
}

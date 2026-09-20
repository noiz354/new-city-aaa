// Cohort (T-305, docs/02 §1 + docs/03 §4): residents, jobs (C/I buildings), gravity job-match,
// unemployment, and a simplified per-residence happiness. v1 = net-flow model (migration/aging
// deferred per §1 scope cut). Outputs feed Demand (unemployment/happy/jobsAvailable/workforceAvail)
// and the HUD (jobs, unemployment). Deterministic: fixed chunk-iteration order; no Math.random.
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import { CHUNK, TILE_M } from '../shared/types.js';
import { COHORT_TUNING } from './tuning/cohort.js';
import type { World } from './world.js';

export interface CohortState {
  residents: number;
  jobs: number; // total job openings (occupied C/I buildings)
  workforce: number; // residents available to work
  matched: number; // jobs filled via gravity (== employed workers)
  unemployment: number; // 0..1 = (workforce − matched) / workforce
  happiness: number; // 0..1 city mean
  jobsAvailable: number; // 0..1 (R demand driver)
  workforceAvail: number; // 0..1 (I demand driver)
}

/** Subset of cohort state that Demand consumes (docs/03-simulation-core §2 inputs). */
export interface CohortDemandInputs {
  unemployment: number;
  happy: number;
  jobsAvailable: number;
  workforceAvail: number;
}

const NEUTRAL: CohortState = {
  residents: 0,
  jobs: 0,
  workforce: 0,
  matched: 0,
  unemployment: 0,
  happiness: 0.5,
  jobsAvailable: 0,
  workforceAvail: 0,
};

function chunkDistMeters(ax: number, ay: number, bx: number, by: number): number {
  const dx = (ax - bx) * CHUNK * TILE_M;
  const dy = (ay - by) * CHUNK * TILE_M;
  return Math.sqrt(dx * dx + dy * dy);
}

export class Cohort {
  private readonly world: World;
  private readonly buildings: Buildings;
  private current: CohortState = { ...NEUTRAL };

  constructor(world: World, buildings: Buildings) {
    this.world = world;
    this.buildings = buildings;
  }

  state(): CohortState {
    return this.current;
  }

  /** Inputs for Demand.recompute (unemployment/happy/jobsAvailable/workforceAvail). */
  demandInputs(): CohortDemandInputs {
    return {
      unemployment: this.current.unemployment,
      happy: this.current.happiness,
      jobsAvailable: this.current.jobsAvailable,
      workforceAvail: this.current.workforceAvail,
    };
  }

  /**
   * Daily recompute at the jobs/agents stage (before growth/demand, frozen order §2).
   * `taxRate` is the current per-zone rate (%) used for the lowTax happiness term.
   * An empty city (no residents) returns NEUTRAL so bootstrap demand stays R+7/C+2/I+16.5.
   */
  recompute(taxRate: number): void {
    const T = COHORT_TUNING;
    const stride = this.world.size / CHUNK;
    const wChunks = new Map<number, number>(); // chunk key → residents
    const jChunks = new Map<number, number>(); // chunk key → job openings
    let residents = 0;
    let jobs = 0;
    this.buildings.forEachLive((b) => {
      if (b.state !== BUILDING_OCCUPIED) return;
      const cx = Math.floor(b.x / CHUNK);
      const cy = Math.floor(b.y / CHUNK);
      const key = cy * stride + cx;
      if (b.zone === 1) {
        residents += b.occupants;
        wChunks.set(key, (wChunks.get(key) ?? 0) + b.occupants);
      } else if (b.zone === 2 || b.zone === 3) {
        const j = T.jobsPerBuilding[b.zone]?.[b.level] ?? 0;
        jobs += j;
        jChunks.set(key, (jChunks.get(key) ?? 0) + j);
      }
    });

    if (residents === 0) {
      this.current = { ...NEUTRAL };
      return;
    }

    const W = residents;
    const J = jobs;
    // Gravity efficiency g ∈ (0,1]: job chunk k draws min(o_k, reachable workforce); the reachable
    // fraction for k = Σ_j w_kj·p_j / W (w_kj = 1/(1+dist/800)², cut beyond 3000m). g is the
    // job-share-weighted mean of those fractions.
    let g = 0;
    if (J > 0) {
      for (const [jk, o_k] of jChunks) {
        const jcx = jk % stride;
        const jcy = Math.floor(jk / stride);
        let denom = 0;
        for (const [wk, p_j] of wChunks) {
          const wcx = wk % stride;
          const wcy = Math.floor(wk / stride);
          const d = chunkDistMeters(jcx, jcy, wcx, wcy);
          if (d > T.maxCommuteMeters) continue;
          const w = 1 / (1 + d / T.gravityMeters) ** 2;
          denom += w * p_j;
        }
        g += (o_k / J) * (denom / W);
      }
    }
    const matched = J === 0 ? 0 : Math.floor(Math.min(W, J) * g);
    // Unemployment is only defined once a job market exists. A residential-only town (J=0) has no
    // jobs to be unemployed from, so it reports 0% — this keeps R-first bootstrap viable (VS-2a:
    // "zone R → houses grow") under the matured demand model, which otherwise would read 100%
    // unemployment and drive R demand negative, stalling all growth. Once C/I exist, unemployment
    // is real and rises when the workforce outnumbers openings.
    const unemployment = J > 0 ? Math.max(0, (W - matched) / W) : 0;
    const employed = W > 0 ? matched / W : 0;
    const lowTax = taxRate <= T.lowTaxThreshold ? T.happyLowTax : 0;
    const happy100 = Math.max(
      0,
      Math.min(100, T.happyBase + employed * T.happyEmployed + lowTax),
    );

    this.current = {
      residents: W,
      jobs: J,
      workforce: W,
      matched,
      unemployment,
      happiness: happy100 / 100,
      jobsAvailable: Math.min(1, J / Math.max(1, W)),
      workforceAvail: Math.min(1, W / T.workforceDivisor),
    };
  }
}

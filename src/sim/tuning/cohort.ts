// Cohort/jobs tuning (T-305): residents, jobs (C/I buildings), gravity job-match,
// unemployment, happiness. "first guess — scenario S-green decides" (progression §2);
// owned by the balancing suite (T-306) — no constant may change without updating it.
export const COHORT_TUNING = {
  /** Job openings per OCCUPIED building, by zone (C=2, I=3) and level (1..3). */
  jobsPerBuilding: {
    2: { 1: 6, 2: 12, 3: 24 },
    3: { 1: 10, 2: 20, 3: 40 },
  } as Record<number, Record<number, number>>,
  /** Gravity constant R0 (docs/03-simulation-core §2: openings/(1+dist/800)², dist in metres). */
  gravityMeters: 800,
  /** Beyond this commute distance a job chunk is unreachable (doc §1: ≤3000m). */
  maxCommuteMeters: 3000,
  /** Happiness (0..100) per residence (doc §4 simplified v1 subset: base + employed + lowTax). */
  happyBase: 50,
  happyEmployed: 10,
  happyLowTax: 8,
  /** Tax % at or below which the lowTax happiness bonus applies. */
  lowTaxThreshold: 10,
  /** I-demand workforceAvail = min(1, workforce / this). */
  workforceDivisor: 500,
  /** T-403: max happiness points (0–100 scale) lost when EVERY commute exceeds 45 min
   *  (scaled by over-commute share; measured by Traffic with a 1-day lag — frozen daily
   *  order cohort → traffic → demand, docs/02 §Daily). Zero realised in the S-fixtures
   *  (max commute ≈ 30 min), so the locked suite stays untouched. */
  commutePenaltyMax: 5,
} as const;

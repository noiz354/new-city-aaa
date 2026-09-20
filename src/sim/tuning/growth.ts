// Growth engine tuning (data-only, hot-tunable per D-B3; locked by the VS-3 balancing suite T-306).
export const GROWTH_TUNING = {
  /**
   * Daily development budget N = clamp(2 + floor(pop)) (docs/03-simulation-core §3). Prevents daily
   * instant cities + bounds perf; deterministic (pop derives from buildings). T-306's balancing suite
   * (S-green) is what requires the real budget — the flat 1/day cap can't reach the pop band in time.
   */
  spawnBase: 2,
  spawnPerPop: 500,
  spawnMax: 25,
  /**
   * Demand values are computed live by the T-206 engine (src/sim/demand.ts, FR-S02 −100..+100);
   * the v0 stubs were removed when the engine landed (see that file's stub ledger).
   */
  /** Score bonus for a lot with direct road adjacency (v0 eligibility is adjacency; T-204 upgrades to path). */
  roadAdjacencyBonus: 25,
} as const;

/** Daily spawn budget N per docs/03 §3 (deterministic, depends only on population). */
export function dailySpawnBudget(pop: number): number {
  return Math.max(
    GROWTH_TUNING.spawnBase,
    Math.min(GROWTH_TUNING.spawnMax, GROWTH_TUNING.spawnBase + Math.floor(pop / GROWTH_TUNING.spawnPerPop)),
  );
}

/**
 * Occupants housed per zone × level at move-in (spec FR-S04). C/I contribute jobs, not residents —
 * the cohort model (T-305) owns those, so they are deliberately 0 here (population counts R only).
 */
export const BUILDING_CAPACITY: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 4, 2: 8, 3: 16 }, // residential household size per density level
  2: { 1: 0, 2: 0, 3: 0 },
  3: { 1: 0, 2: 0, 3: 0 },
};

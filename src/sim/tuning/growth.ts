// Growth engine tuning (data-only, hot-tunable per D-B3; locked by the VS-3 balancing suite T-306).
export const GROWTH_TUNING = {
  /** Pacing: max spawns per game-day (spec §3.4 "Tiap hari: N tile spawn"). */
  maxSpawnsPerDay: 1,
  /**
   * v0 demand stubs per zone on the FR-S02 −100..+100 scale the real engine (T-206) will fill.
   * R is open for settlers; C/I stay closed until the demand engine computes them for real.
   */
  demandR: 1,
  demandC: 0,
  demandI: 0,
  /** Score bonus for a lot with direct road adjacency (v0 eligibility is adjacency; T-204 upgrades to path). */
  roadAdjacencyBonus: 25,
} as const;

/**
 * Occupants housed per zone × level at move-in (spec FR-S04). C/I contribute jobs, not residents —
 * the cohort model (T-305) owns those, so they are deliberately 0 here (population counts R only).
 */
export const BUILDING_CAPACITY: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 4, 2: 8, 3: 16 }, // residential household size per density level
  2: { 1: 0, 2: 0, 3: 0 },
  3: { 1: 0, 2: 0, 3: 0 },
};

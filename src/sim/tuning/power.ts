// Tunable power constants (T-405, data not code: balance changes land here, with tests).
// Spec: docs/02-architecture/utilities-and-environment.md §1 — binary power per building,
// overload sheds Industrial farthest-first → Commercial → Residential (homes last).
export const POWER_TUNING = {
  /** MW supplied by one coal plant (the only plant type in VS-4). */
  plantCapacityMw: 60,
  /** MW drawn by one OCCUPIED building, by zone then level 1..3. Construction draws nothing. */
  consumptionMw: {
    1: [0, 1, 2, 3], // R: a level-3 house draws 3 MW
    2: [0, 2, 4, 6], // C
    3: [0, 3, 6, 9], // I: a level-3 factory draws 9 MW
  } as Record<number, [number, number, number, number]>,
} as const;

export const COSTS_POWER = {
  /** Flat price per coal plant (clears zone/building like a road does — no refund). */
  plant: 1500,
  /** Price per power-line tile (cross-country conductor; roads conduct for free). */
  linePerTile: 8,
} as const;

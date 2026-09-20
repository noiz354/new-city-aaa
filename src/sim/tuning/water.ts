// Tunable water constants (T-406, data not code: balance changes land here, with tests).
// Spec: docs/02-architecture/utilities-and-environment.md §1 + docs/05 §A3 — pressure
// per tile: pressure = 1 − distTiles·K − loadFactor·M, watered iff > THRESHOLD.
// Tower $800 / upkeep $30 (deferred like plant upkeep) / 800 kL starter tower (pump: M7).
export const WATER_TUNING = {
  /** kL supplied by one tower (loadFactor = netDemand / netSupply). */
  towerCapacityKl: 800,
  /** kL drawn by one OCCUPIED building, by zone then level 1..3 (docs/03 §3). */
  demandKl: {
    1: [0, 10, 40, 120], // R
    2: [0, 15, 50, 150], // C
    3: [0, 30, 100, 250], // I
  },
  /** Pressure falloff per tile of BFS depth from the nearest tower. */
  pressureK: 0.02,
  /** Pressure falloff per unit of net loadFactor (demand / supply). */
  pressureM: 0.3,
  /** Tile counts as watered iff pressure is strictly above this. */
  wateredThreshold: 0.3,
} as const;

export const COSTS_WATER = {
  /** Flat price per water tower (clears zone/building like a road does — no refund). */
  tower: 800,
} as const;

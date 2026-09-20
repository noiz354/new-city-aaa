// Tunable pathfinding constants (T-402, data not code: balance changes land here, with tests).
// Spec: docs/04 §4 + docs/02 transportation §Pathfinding — weighted A* w = length/speed ×
// BPR(v/c); budgeted search (YAPF control: cap expansions, then a greedy fallback pass).
export const PATH_TUNING = {
  /** BPR congestion curve: w = lengthM/speed × (1 + alpha×(volume/capacity)^beta). */
  bprAlpha: 0.15,
  bprBeta: 4,
  /** Admissible-heuristic speed (euclid / maxSpeed); the fastest road in VS-4. */
  maxSpeedKph: 40,
  /**
   * Max node pops per A* search before the greedy fallback pass (and per fallback pass).
   * Graph nodes stay <2k even in big cities (docs/04 §4), so 8k pops bounds every sane
   * query while stopping pathological searches cold.
   */
  maxExpansions: 8192,
  /** O-D route cache cap (LRU, insertion-ordered Map); keys carry the graphVersion bucket. */
  odCacheMaxEntries: 4096,
} as const;

/**
 * Traffic-assignment tuning (T-403, docs/02 §Daily): daily volume pass over cohort flows.
 * Volume unit = car-trips/day on an edge; edge.capacity (ROAD_CAPACITY, T-401) is in the
 * same unit so v/c stays dimensionless.
 */
export const TRAFFIC_TUNING = {
  /** Trips per employed resident per day (docs/02: ×2 home↔work round trip). */
  tripsPerWorker: 2,
  /** Car-share factor (docs/02 ×0.8): the rest walks/transits. */
  carShare: 0.8,
  /** Commute (minutes) above which a worker counts as over-commuting → happiness penalty. */
  commutePenaltyThresholdMin: 45,
  /** Defensive cap on distinct worker→job chunk pairs per daily pass; overflow pairs are
   *  counted but not routed (documented S-cut: occupied-chunk counts are ≪ cap). */
  maxOdPairs: 2048,
  /** Chunk-center → road-node attachment radius (tiles). No node within → O-D unconnected. */
  chunkAttachRadiusTiles: 24,
  /** LOS letter boundaries by v/c (HCM-style): below each cap maps to A..E, ≥ last cap → F. */
  losVCaps: [0.6, 0.7, 0.8, 0.9, 1.0] as readonly number[],
} as const;

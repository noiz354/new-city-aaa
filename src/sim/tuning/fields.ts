// Fields tuning (T-207, FR-S02/context docs/02 §4 + utilities-and-environment §3):
// land value constants — data, not code; balancing suite owns changes.
// Doc cites: landValue f32 per tile, sources/sinks → 2-pass separable 3×3 blur, daily cadence
// (world-and-terrain §4); I buildings pollute level-scaled, parks/trees sink, land value↓
// (utilities-and-environment §3, balancing example "I next to R depresses value ≥15").
export const FIELD_TUNING = {
  /** Base land value per terrain (0..100); water is not land-valued. */
  base: { grass: 50, sand: 45, rock: 35, forest: 60, water: 0 },
  /** "Halo air" adjacency aura: tiles within RADIUS of water gain value (linear falloff). */
  waterHalo: { radius: 3, weight: 20 },
  /** "Trees/parks" aura (utilities §3 couples them): within RADIUS of forest/tree tile. */
  forestHalo: { radius: 3, weight: 10 },
  /** Park aura for plopped parks — ACTIVE but unhooked: park placement = §9 save-format
   *  decision (see fields.ts header); weights committed now so the seam is tuning-stable. */
  parkHalo: { radius: 4, weight: 15 },
  /** I building emission, occupied, per level (docs/02 table "level-scaled"). Calibrated so a
   *  SINGLE L1 factory depresses a 2-tiles-away grass lot by ≥15 after blur (the balancing
   *  anchor from utilities-and-environment §3: "I next to R depresses value ≥15"). */
  pollutionPerLevel: { 1: 30, 2: 90, 3: 180 } as Readonly<Record<number, number>>,
  /** Emission aura decays linearly to 0 past this Manhattan radius (doc: radius ~8→v0 blur). */
  pollutionRadius: 8,
  /** Pollution sinks: trees/parks absorb (fraction subtracted from blurred pollution). */
  sinkPerTreeTile: 0.15,
  /** Value floor/ceiling AFTER summation. */
  clampMin: 0,
  clampMax: 100,
  /** landFit (docs/03 §3): R/C want high value, I wants cheap land. */
  landFit: {
    rcBase: 0.5, rcSlope: 1 / 200, // 0.5 + value/200
    iBase: 1.2, iSlope: 1 / 150, // 1.2 - value/150
  },
} as const;

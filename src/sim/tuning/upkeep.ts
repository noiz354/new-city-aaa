// Upkeep tuning (T-205, FR-E03): tunable economy constants — data, not code.
// Building upkeep per MONTH by zone × level: canonical table from
// docs/03-simulation-core §"Building stats by zone×level" (Upkeep/mo column):
//   R1/R2/R3 = 2/6/15 · C1/C2/C3 = 4/12/30 · I1/I2/I3 = 6/18/45
// Roads: $0.5/tile/mo (docs/05 B3) — integerized as floor(roadTiles × 1/2) (B1: all money integer).
// Frontier subsidy (docs/05 B6): cities <500 pop pay 70% (upkeep −30%) — integerized floor(gross×7/10).
export const UPKEEP_PER_MONTH: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 2, 2: 6, 3: 15 }, // residential
  2: { 1: 4, 2: 12, 3: 30 }, // commercial
  3: { 1: 6, 2: 18, 3: 45 }, // industrial
};

/** Road upkeep numerator/denominator per tile per month ($0.5 int). */
export const ROAD_UPKEEP_NUM = 1;
export const ROAD_UPKEEP_DEN = 2;

/** Frontier subsidy: below this population the city pays SUBSIDY_NUM/SUBSIDY_DEN of gross. */
export const SUBSIDY_POP_LIMIT = 500;
export const SUBSIDY_NUM = 7;
export const SUBSIDY_DEN = 10;

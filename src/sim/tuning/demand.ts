// Demand tuning (T-206, FR-S02): every weight straight from docs/03-simulation-core §2
// ("implement exactly, tune via constants"; balancing suite T-306 owns future changes —
// no weight may be changed without updating that suite).
export const DEMAND_TUNING = {
  /** Clamped display scale (doc §2: demand ∈ [−100, +100]). */
  min: -100,
  max: 100,
  // Residential: people come when there are jobs + happiness + low tax.
  r: { employment: 60, happy: 30, tax: 40, vacancy: 25, jobs: 20, base: -50 },
  // Commercial: shops come when there are customers (pop) + low tax.
  c: { customers: 50, happy: 20, tax: 40, vacancy: 25, base: 10 },
  // Industrial: factories come when workers available + low tax + cheap land.
  i: { workforce: 55, taxBase: 25, taxK: 1.2, vacancy: 25, base: 5 },
  /** City tax normalization (doc: rate 0..20% → 0..1). */
  taxNorm: 20,
  /** Default tax rate until sliders land (T-301; start value from docs/05 B1). */
  defaultTaxRate: 9,
  /** popFactor = pop / this, capped 0..1 (doc tuning table). */
  popFactorDivisor: 5000,
  /** workforceAvail = unemployed / this, capped (doc; v0 stub = 0 — see demand.ts header). */
  workforceDivisor: 500,
  /** v0 happiness stub: neutral 0.5 until the happiness engine (VS-3/T-305). */
  happyStub: 0.5,
} as const;

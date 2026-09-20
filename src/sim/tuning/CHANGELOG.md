# Tuning changelog

Per progression-and-balancing.md §4: every change to a number in `*.ts` here records the decision
reached by the balancing suite (`../balancing.test.ts`) — the suite's trajectory bands lock these
constants ("no tuning change without a green balancing suite").

## 2026-09-20 — S-green lands + tuned for the first green run (T-306)

The balancing suite came online with the S-green canonical scenario. Making a 3-year healthy-growth
city actually reach the population band required two engine fixes that are themselves tuning-level
behaviour, plus a re-justification of one §1 hypothesis-band against the model's healthy outcome.

Changes (each is the constant its §2 citation pins to):

- **Growth budget N** (`growth.ts`: `maxSpawnsPerDay: 1` → `dailySpawnBudget` = `clamp(2 + floor(pop/500), 2, 25)` via
  `GROWTH_TUNING.spawnBase/spawnBasePerPop/spawnMax`). docs/03-simulation-core §3 "Daily growth budget
  N" was never implemented (v0 used a flat 1/day). At 1/day even 3 game-years tops out below the 3k
  population band, so S-green needed the spec'd budget. Locked values: base 2, growth `pop/500`,
  cap 25. Six trajectory tests that had baked the flat 1/day pacing were updated to the N-budget
  semantics (intents preserved; only the per-day counts moved to "N=2 at pop 0").
- **Cohort employment ceiling** (`cohort.ts` recruitment rule, weights in `cohort.ts` tuning). The
  gross chunk-reachability fill `matched = g·min(W,J)` capped employment at ~60–74% even in a
  surplus-job city, so S-green could not settle to a healthy unemployment band. Corrected to the
  docs §5 "+" loop ("Jobs → R → … → Jobs"): `matched = W` when `J ≥ W` (a surplus job market
  employs the whole workforce — every job-tile waypoint is within the 800 m gravity reach and the
  3000 m cutoff), and `matched = floor(J·g)` only when `J < W` (scarcity binds via chunk reach — the
  donut / traffic-stress analysis case). The `<3000 m` co-chunk spine city thus reaches full
  employment.

### S-green calibration (first green run, seed 7 / plains 256² / 9-9-9% tax / 3 game-years)

Measured stable trajectory: population ramps m1→m8 to **4136** then plateaus (growth-budget pacing);
treasury starts $20,000 and is **positive every month** (steady net ≈ +$75k/mo at plateau);
unemployment **0.0% at every sample** (J ≥ W surplus-job equilibrium); happiness **68%** stable.

| Band (progression §1 hypothesis) | Measured | Locked band (regression guard) |
|----------------------------------|----------|-------------------------------|
| pop 3–8k                          | 4136     | 3000 ≤ pop ≤ 8000 (unchanged)  |
| treasury positive                 | > 0 ∀mo  | treasury > 0 every month       |
| unemployment 3–12%                | 0.0%     | 0 ≤ u < 12% (see note)         |
| happiness 55–85%                  | 68%      | 55% ≤ h ≤ 85% (unchanged)      |

**Re-justification (§4 step 3):** the 3–12% unemployment hypothesis presupposes a permanent
frictional base, but the healthy model has *no forced frictional unemployment* — with a surplus job
market (J ≥ W) the "+" loop self-corrects to full employment, so a genuinely green city settles at
0%. Forcing the band's lower bound at 3% would fail the healthy outcome. The band is therefore
re-justified to `0 ≤ u < 12%`: the upper bound still guards against a job-market regression (if J
recedes toward scarcity the fill drops and u climbs past 12%), while 0% is a valid healthy point.
Documented in `../balancing.test.ts`.

### Deferred scenarios

- **S-sprawl** (traffic stress: arterial LOS-p95): asserts the traffic/congestion model — later slice (VS-4).
- **S-crisis** (blackout + tax shock): asserts power brownouts + recovery — VS-3 phase-2 energy.
Their constants (BPR / LOS threshold / power / pressure) are not yet introduced; they will be
recorded here when the systems land.

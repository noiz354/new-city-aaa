# Progression & Balancing

> Corrects F-01 (ungrounded numbers). Method: constants in `tuning/*.ts` + canonical scenarios with trajectory assertions. No tuning change without a green balancing suite.

## 1. Balancing harness

Three canonical scenarios (seeded scripts of commands + days), each asserting trajectories (not exact values — bands):

| Scenario | Script | Asserted bands |
|----------|--------|----------------|
| S-green (healthy growth) | road grid + plant + balanced RCI, 9% tax, 3 game-years | pop 3–8k; treasury positive; unemployment 3–12%; happiness 55–85 |
| S-sprawl (traffic stress) | bedroom suburb + single arterial, 2 years | LOS F appears on arterial; adding parallel road clears it; commute p95 <60min after fix |
| S-crisis (blackout + tax shock) | overload power; tax 16% for 60d then 9% | brownout icons appear; abandonment starts >30d; recovery within 1 year of fix |

Bands are initial hypotheses — first green run *calibrates* them; afterward they lock regressions.

## 2. Starting constants (all HYPOTHESIS until VS-3)

Start $20,000; tax default 9% (0–20%); building tax-base/upkeep/power/water tables from prior `docs/03/05`; growth budget N; demand weights; BPR coeffs; pressure constants; environment weights. Each table row cites either a genre precedent (R-02/R-06 concept) or "first guess — scenario S-green decides".

## 3. Progression curve

Milestone tiers with pressures: 500 (power ceiling), 1k (water pressure), 5k (congestion), 25k (services+pollution), 100k (everything + disasters on). Pressures arrive via *capacity math*, not scripted walls: plant MW, tower kL, road capacity, service coverage are the difficulty knobs.

## 4. Tuning procedure

1. Change one table. 2. Run balancing suite. 3. If bands break, either revert or re-justify bands in this doc (PR review). 4. Record decision in the tuning changelog (`tuning/CHANGELOG.md`).

## 5. Verification

Balancing suite in CI (nightly allowed: multi-year sims); manual playtest scripts per milestone (15-min 1k-pop test); anti-frustration spot-checks (every penalty has a surfaced fix).

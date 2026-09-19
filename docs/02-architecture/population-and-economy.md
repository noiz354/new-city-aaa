# Population & Economy

> Covers brief §5.4. Prior: `../03-simulation-core.md` formulas retained as *starting constants*, not truths. Corrects gap G-A7.

## 1. Population model

- Residences supply workers; C/I supply openings; **gravity match** at chunk level (`openings/(1+dist/800)²`, ≤3000m), deterministic order.
- Outputs: employed/unemployed, cohort list, happiness inputs. Migration/aging/death: **v1 = net-flow only** (move-in/out probability from demand+happiness); full demographics deferred — documented scope cut.
- Happiness (0–100/residence): powered/watered/employed/services/park/low-tax/low-pollution minus noise/crime; city value = pop-weighted mean.

## 2. Demand (RCI bars)

`demand ∈ [−100,100]`, smoothed 0.2/day. Drivers: unemployment, happiness, taxes, land value, vacancies, customers/workforce availability (see prior doc §2 for the starting formula). All weights in `tuning/demand.ts`, owned by balancing tests — **no weight may be changed without updating the balancing suite**.

## 3. Growth lifecycle

Daily budget `N = clamp(2 + pop/500, 2, 25)`; score = desirability × landFit × demand × jitter(rng.growth); spawn >25; L1→L2 (score>60 ×5d), L2→L3 (score>75 ×8d + services); abandon (unserved 30d / happiness<25 ×20d / tax>15% ×30d) → recoverable 30d → rubble. Every transition emits an event with a **machine-readable reason** (feeds "why abandoned?" inspector + advisors).

## 4. Economy

- Monthly tick, integer money, start $20,000 (placeholder pending balancing — flagged `HYPOTHESIS` until VS-3).
- Income per building = `base[zone][level] × (rate/9) × (0.6+0.4·happy/100)`; expenses = upkeep sum; bankruptcy < −$5,000 blocks paid commands + forces budget UI.
- Funding sliders (50/100/150%) scale outputs/radii; frontier subsidy (<500 pop, −30% upkeep) prevents new-player bankruptcy.
- 12-month ring buffer for sparkline + advisor rules.

## 5. Feedback loops & stability (required analysis)

| Loop | Direction | Danger | Guard |
|------|-----------|--------|-------|
| Jobs → R demand → pop → C demand → jobs | + | runaway growth | growth budget N; vacancy penalty; land scarcity |
| Tax↑ → happy↓ → income↓ + abandon → tax base↓ | − then + | death spiral | 30d grace + warnings; happyFactor floor 0.6; subsidy |
| Congestion → commute → happy↓ → demand↓ | − | stagnation pockets | transit stretch; road upgrade path; advisor surfacing |
| Pollution → value↓ → R abandon → I unaffected | − | donut city | services/parks counter; diffusion bounds |

Stability is **tested, not argued**: [progression-and-balancing](../03-game-design/progression-and-balancing.md) defines 3 canonical scenarios with trajectory assertions.

## 6. Verification

Demand/growth unit tables; lifecycle timer tests; economy monthly-math tests; balancing suite (VS-3); determinism snapshots including treasury/population.

# Simulation & Algorithm Research

> Question: which algorithms fit a 256²-tile browser sim at 60fps with deterministic saves? Evidence: `S-01` (F), `S-05…S-11`, `S-18/19` (secondary), prior `docs/02–05`.

## 1. Time & determinism (F)

- **Fixed-step accumulator** (Gaffer on Games, `S-01`): renderer *produces* time, sim *consumes* fixed `dt`; clamp frame-time (≤0.25s) and max steps/frame to avoid the **spiral of death**; interpolate (`alpha`) for smooth rendering. Adopted verbatim in [simulation-architecture](../02-architecture/simulation-architecture.md) with `dt = 1 game-hour`, heavy systems on day boundaries.
- **Determinism prerequisites** (R, from `S-01` + R-06 snapshots): seeded RNG streams per system; no `Date.now`/`Math.random` in sim (R-01 violated this — C); fixed iteration order; float discipline (same op order). Verified by hash-snapshot tests ([verification-strategy](../05-execution/verification-strategy.md)).

## 2. State representation: SoA typed arrays, not ECS framework (R)

- R-06 uses entity registries; R-04 uses actors; R-01 uses JS objects per tile/building (C: full-grid scans per tick).
- For 65,536 tiles + ≤10k buildings + ≤2k cohorts, hand-rolled **structure-of-arrays typed arrays + chunk dirty flags** beats a generic ECS on cache locality and has zero dependency cost. ECS framework adoption is **rejected for v1** (H: revisit only if system count × churn proves unmanageable — measurable via tick-profile).
- Spatial partitioning: uniform grid + chunk index is sufficient (O(1) tile access); quadtrees/R-trees rejected as unneeded complexity (R).

## 3. Pathfinding & traffic (C + R)

- **YAPF (R-05, C)** proves production A\* needs: budgeted search (`max_search_nodes=10,000`), cost caching with hit stats, open/closed hash tables, graceful best-effort fallback. **All four adopted** in [transportation](../02-architecture/transportation-and-pathfinding.md).
- **diverCity (R-03, C)** proves A\* + congestion penalty works inside a SimCity-like loop.
- **Micropolis drive-test (R-02, C)** is the documented fallback if A\* budgets blow: random drive sampling is *correct-looking* traffic at trivial cost. Kept as contingency, not default.
- **Scale math (R):** ≤2k graph nodes → A\* sub-ms each; ≤500 paths/day on main thread, overflow to worker; O-D cache keyed by `(origin, dest, graphVersion)`. Hierarchical (HPA\*) **deferred** — unjustified below ~10k nodes (H with clear trigger metric).
- **Traffic assignment:** all-or-nothing per day + BPR time update + volume accumulation. True user-equilibrium iteration (Frank-Wolfe) rejected for v1 (cost, complexity); all-or-nothing oscillates less when paired with daily smoothing (R, to be validated in balancing tests).

## 4. Population: aggregate cohorts + representative visuals (R, secondary-supported)

- CS1's ~65k agent cap vs 100k+ census population (community report, `S-19`, secondary) and CS2's multicore pathfinding push (`S-18`, secondary) jointly show: **per-agent-everything is the most expensive choice even for AAA studios**.
- Adopted: statistical **cohorts** (home-chunk → work-chunk, cap ~2k) own truth; **~500 cars + ~300 peds** sampled from top flows own theater. Falsifiable: if cohort count or path budget exceeds gates, degrade visuals first, never truth (see [scalability-strategy](../04-performance/scalability-strategy.md)).

## 5. Utilities, economy, environment (C + R)

- **Power/water:** union-find/BFS flood per R-01's BFS concept (C) + R-02's scan idea; nets own (supply, demand); brownout priority is a *design* choice (I-first, farthest-first) with playtest validation — not derived from research (marked as design decision in [utilities](../02-architecture/utilities-and-environment.md)).
- **Economy:** monthly tick, integer money, tax curves with happiness feedback; OpenTTD/R-02 show monthly/periodic settlement is genre-standard (C/R). Feedback-loop stability (death spirals) is the top sim risk: requires balancing tests with fixed scenarios ([progression-and-balancing](../03-game-design/progression-and-balancing.md)).
- **Fields (value/pollution/crime):** separable box-blur diffusion on typed arrays; worker-offloadable; cheap at 65k cells (R; trivially benchmarked in VS-1).

## 6. Algorithms explicitly rejected (with trigger to revisit)

| Rejected | Why | Revisit trigger |
|----------|-----|-----------------|
| Full agent-based citizens | 100k pathfinds/day breaks budget by ~200× | Never for truth; visuals only |
| HPA\*/hierarchical routing | Graph too small to pay off | Sustained >10k nodes or p95 path >2ms |
| Equilibrium traffic assignment | Complexity + oscillation risk | All-or-nothing visibly wrong in playtests |
| ECS framework / actor framework | Dependency + indirection cost at our scale | Tick-profile shows dispatch overhead |
| Rust/WASM sim core | No measured JS bottleneck yet | `perf` p95 day-tick >50ms after optimization |

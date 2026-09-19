# Transportation & Pathfinding

> Covers brief §5.3. Research: YAPF `S-08` (C), diverCity `S-07` (C), drive-test fallback `S-06` (C), agents-vs-aggregate `S-18/19` (secondary). Corrects gap G-A3.

## 1. Road graph

Nodes = intersections/dead-ends/stubs; edges = runs with `{lengthM, lanes, speedKph, capacity, volume}`. Incremental rebuild on dirty chunks + 1-ring; `graphVersion` monotonic. Buildings attach to nearest edge ≤2 tiles; no attachment → `connected=false` → no growth + icon (upgrades R-01's radius check — C).

## 2. Pathfinding: budgeted A\* (YAPF controls adopted)

- Binary-heap A\*, weight `w = length/speed × BPR(v/c)`; heuristic = euclid/maxSpeed (admissible).
- **YAPF's four controls, mandatory:** (1) `max_search_nodes` budget per query (default TBD by spike, start 10,000 per `S-08`); (2) cost cache with hit-ratio stats; (3) open/closed hash tables; (4) best-effort fallback (nearest reached node → building flagged `routeApproximate`).
- O-D cache keyed `(originNode, destNode, graphVersionBucket)`; invalidated on version bump; ≤500 fresh paths/day main-thread, overflow → path worker; beyond worker budget → nearest-cached reuse.
- Contingency: if budgets blow on stress city, degrade to Micropolis-style drive-test sampling (`S-06`) for *visual* flows while cohorts keep last-known paths. Trigger metric defined in [benchmark-scenarios](../04-performance/benchmark-scenarios.md).

## 3. Traffic assignment & congestion

Daily: zero volumes → each employed cohort adds `count × 2 trips × 0.8 car-share` along path → `v/c` per edge → LOS A–F → BPR travel-time feedback into next day's weights + happiness penalty for >45min commutes. All-or-nothing with daily smoothing (equilibrium iteration rejected for v1 — see research §3).

## 4. Agents: hybrid (truth vs theater)

- **Truth:** cohorts (cap ~2k, merged overflow bucket). **Theater:** pooled 500 cars + 300 peds sampled ∝ flow, view-interpolated, rush-hour pulsing.
- Testability: cohorts assertable (counts, paths, times); visuals assertable only structurally (pool bounds, no NaN, pause-freeze). Benchmarks: paths/day, p95 path latency, cache hit ratio, cohort count — all in `perf` output.

## 5. Transit roadmap (stretch, interface-frozen)

Bus = stops on road tiles + mode-split (40% of served cohorts off road-volume). Graph carries a `modes` bitmask from VS-4 so transit needs no refactor — only new writers.

## 6. Verification

Graph fixtures (straight/T/loop/disconnected); A\* fixtures incl. budget-exhaustion + fallback; UJ-03 corridor E2E (jam → relieve); determinism (same seed → identical paths+volumes).

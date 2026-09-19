# City-Builder Reference Projects (7 inspected)

> Requirement: ≥5 projects. Code-inspected (C): R-01, R-02, R-03, R-05, R-06, R-04(structure+deps). Secondary-only: R-07. Full citations in [source-registry](source-registry.md) (`S-05…S-12`, `S-18…S-21`).

## 1. R-01 — dgreenheck/simcity-threejs-clone (MIT, C)

Browser 3D SimCity clone, Three.js + Vite + plain JS. Inspected via clone (see prior `../09-gap-analysis-v2-code.md`): 35 JS files, 0 TS, 0 tests; buildings = cloned GLB meshes (259 `.glb` files); power = simultaneous multi-source BFS; vehicles = wall-clock random walk; `VehicleGraph extends THREE.Group` (sim/view coupled); loop = `setInterval(1000ms)`.
**Reusable:** module layout (sim/services/buildings/vehicles), power-BFS concept, road-access UX.
**Unsuitable:** per-object meshes, wall-clock sim, no saves, three@0.155 (stale).
**Decisions impacted:** instancing-first (G-03), sim/view split ADR-01, fixed-step clock, procedural-first assets.

## 2. R-02 — SimHacker/micropolis (GPL ⛔, C, concepts only)

Original SimCity Classic source. Inspected `TrafficGen.java`: random drive-test traffic (`MAX_TRAFFIC_DISTANCE=30`, perimeter-road + `tryDrive()`); power scan; budget model.
**Reusable (ideas, never code):** demand feedback loops, drive-test as *cheap* traffic approximation, disaster model.
**Unsuitable:** 2D tile assumptions, GPL contamination risk.
**Decisions impacted:** cohort+A\* chosen *over* drive-test (documented upgrade path); clean-room rule T-038.

## 3. R-03 — ijrdn/divercity (GPL ⛔, C, concepts only)

Micropolis fork; `TrafficSim.java` (636 lines) "uses A\*-Algorithm to find ways" + congestion penalty.
**Reusable:** proof that A\* + load-balancing improves on drive-test within a SimCity-like loop.
**Decisions impacted:** validates FR-C03/C04 (A\* + BPR); implementation must be clean-room TS.

## 4. R-04 — Citybound/Citybound (AGPL-3.0 ⛔, C-structure)

Rust city sim (8.1k★, last activity ~Jan 2023 — secondary). Inspected: `cb_simulation/{transport(pathfinding/road_pathfinding, microtraffic, transport_planning), economy, land_use, environment, planning}`; actor model via `kay` crate (`kay=0.5.1` in Cargo.toml); `cb_browser_ui` is Rust→WASM (`Web.toml`, `copyWasm.js`), **not** a JS-framework UI; **AGPL** license.
**Reusable:** domain decomposition (transport/economy/land-use/environment as sibling modules — mirrors our `plan.md` §3), actor/message-passing as inspiration for worker protocols, microtraffic-vs-planning split (≈ our visual-agents vs cohorts).
**Unsuitable:** AGPL forbids *any* code reuse; actor framework + custom build is overkill for v1; WASM-UI contradicts our React-HUD decision (we choose otherwise on velocity grounds — see [state-management](../02-architecture/state-management.md)).
**Decisions impacted:** module boundaries, worker message design, WASM-gating rule (benchmarks first).

## 5. R-05 — OpenTTD/OpenTTD (GPL-2.0 ⛔, C, concepts only)

Transport sim. Inspected raw `yapf_base.hpp`: template A\* (`CYapfBaseT`) with `PfFollowNode/PfCalcCost/PfCalcEstimate/PfDetectDestination`, hash-table open/closed lists, **`max_search_nodes` budget (default 10,000)**, cost-cache stats, best-intermediate fallback. Inspected `saveload.h`: `SaveLoadVersion` enum with **one descriptive entry per schema change** ("list must not be reordered"), 300+ versions over 20 years.
**Reusable:** node-budgeted A\* + cost cache + observability counters (adopted in [transportation](../02-architecture/transportation-and-pathfinding.md)); version-per-change save format (adopted in [persistence](../02-architecture/persistence-and-save-load.md)).
**Unsuitable:** GPL code; vehicle-following (trains) ≠ commuter O-D flows.
**Decisions impacted:** pathfinder budgets/instrumentation; save-versioning scheme.

## 6. R-06 — OpenRCT2/OpenTTD (GPL-3 ⛔, C, concepts only)

Theme-park sim. Inspected raw `Game.cpp` (develop): command pattern for player actions (`GameActions::Execute`, incl. `GameSetSpeedAction`), pause/speed state machine, `GameStateSnapshots` + `ReplayManager` (determinism infrastructure), Emscripten save hooks, post-load **corruption-repair functions** (`FixGuestCount`, `FixInvalidSurfaces`…). Secondary report: 40 ms fixed tick, `libopenrct2` core isolated from platform/UI.
**Reusable:** player-actions-as-commands (adopted for placement/undo in [simulation-architecture](../02-architecture/simulation-architecture.md)); snapshot/replay for determinism tests; repair-on-load philosophy.
**Unsuitable:** GPL; peep-level agents don't scale to our 100k-citizen target (supports cohorts decision).
**Decisions impacted:** command sourcing, determinism harness, save-recovery design.

## 7. R-07 — Unknown-Horizons/unknown-horizons (GPL, secondary only)

Anno-like (Python + FIFE isometric 2D → Godot migration; last stable 2019.1). Not cloned: engine is 2D/desktop-Python with no browser path, so code inspection had no applicable yield; documented here for completeness per the brief.
**Reusable:** production-chain/tax-balance *design* ideas for economy tuning (see [progression-and-balancing](../03-game-design/progression-and-balancing.md)).
**Unsuitable:** everything architectural.

## 8. Reference note (brief compliance)

- The brief's link `andrewmcwatters/openrct2` **did not resolve to a verifiable project** during research; canonical `OpenRCT2/OpenRCT2` was substituted. Status: **limitation documented**, alternative selected per instructions.
- Commercial benchmarks (Cities: Skylines 1/2 agent caps, multicore pathfinding) are secondary press reports (`S-18`, `S-19`) used only to justify the aggregate-vs-agent decision, never as verified facts.

## 9. Cross-project lesson table

| Lesson | Supported by | Adopted as |
|--------|--------------|------------|
| Sim core isolated from platform/UI | R-05 (chunks), R-06 (libopenrct2), R-04 (crates) | ADR-01 sim/view split |
| Budgeted, instrumented pathfinding | R-05 (YAPF), R-03 (A\*) | node budget + cache + counters |
| Version-per-change saves + repair | R-05 (SaveLoadVersion), R-06 (Fix*) | persistence architecture |
| Commands for player mutation | R-06 (GameActions) | command sourcing + undo |
| Agents don't scale; aggregate | R-06 (peeps), CS press (caps) | cohorts + representative visuals |
| Actor/message split for parallelism | R-04 (kay) | worker protocol design (not a framework) |
| Never ship without tests/budgets | R-01 (negative example) | gates in every vertical slice |

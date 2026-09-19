# Existing Plan Audit (spec/plan/tasks/docs-01..07)

> Audits the *plan documents* against research. Verdict scale: ✅ sufficient · ⚠️ needs strengthening · ❌ missing/insufficient. Each finding: evidence → gap/risk → reference → correction → dependencies → verification → priority/complexity.

## 1. Domain verdicts

| # | Domain (brief §4) | Verdict | Summary |
|---|-------------------|---------|---------|
| 1 | Rendering | ⚠️ | Strong instancing/LOD/day-night direction; weak on renderer choice (WebGL2-vs-WebGPU unexamined), no `BatchedMesh` evaluation, picking strategy correct but unproven |
| 2 | World | ✅ | SoA grid + chunks + diffusion is sound and research-consistent |
| 3 | Simulation | ⚠️ | Clock/decoupled-tick correct per `S-01`, but no command-sourcing, no snapshot/replay harness, RNG discipline stated but unenforced |
| 4 | Transportation | ⚠️ | A\*+BPR+cache direction validated by `S-07/08`, but missing: node budget, cost cache, invalidation protocol detail, worker protocol, fallback if budgets blow |
| 5 | Population | ⚠️ | Cohorts+visuals is the right call (`S-18/19`), but gravity-model constants are ungrounded; no migration/death/aging model; feedback-loop stability untested |
| 6 | Economy | ⚠️ | Monthly tick + curves plausible, but numbers (start $20k, tax bases) are **ungrounded estimates**; bankruptcy spiral unmodeled; no balancing harness |
| 7 | Utilities | ✅/⚠️ | Flood/nets + brownout rule implementable; water pressure constants ungrounded; services coverage deferred without interface freeze |
| 8 | Buildings | ⚠️ | Lifecycle states defined; missing construction blocking, fire/disaster state machine detail, "why abandoned" data contract |
| 9 | Environment | ❌ | Pollution/crime/health named but without diffusion weights, sources/sinks, or gameplay effects table |
| 10 | Gameplay | ❌ | No goals/progression/difficulty/win-state; UJ scenarios exist but no balancing targets or tuning procedure |
| 11 | UX | ⚠️ | HUD/tool spec good; React-vs-vanilla undecided (brief requires React evaluation); touch + a11y thin; overlay colorblind rules stated, not specified |
| 12 | Persistence | ⚠️ | Format sketch good; missing version-per-change discipline (`S-09`), repair pipeline (`S-10`), OPFS-vs-IndexedDB decision with evidence (`S-16`), corruption tests |
| 13 | Performance | ⚠️ | Budgets listed but not tied to measurement procedures, reference hardware, or CI gates (`S-02` requires all three) |
| 14 | Testing | ⚠️ | Unit+E2E named; missing determinism harness, sim-snapshot tests, visual-regression approach, save-corpus tests |
| 15 | Observability | ❌ | F3 overlay named; no metric catalog, no routing-latency/memory instrumentation, no regression detection |
| 16 | Architecture | ⚠️ | Module split good and research-aligned (R-04/R-06); missing ownership/mutation boundaries doc, worker protocol, React boundary, save-compat-from-day-one rule |

## 2. Top findings (detail)

**F-01 — Economy/balancing numbers are invented (Priority P0, complexity M).**
Evidence: `spec.md` FR-E + `docs/03/05` tables ($20k start, tax bases, upkeep).
Gap: no model or reference justifies values; death-spiral dynamics unanalyzed.
Correction: [progression-and-balancing](../03-game-design/progression-and-balancing.md) + balancing harness (fixed scenarios, assertion on treasury/population trajectories) in VS-3.
Verify: balancing tests pass on 3 canonical scenarios.

**F-02 — No command-sourced mutation (P0, M).**
Evidence: `plan.md` mutations are direct calls; undo is "single-batch" afterthought.
Reference: `S-10` GameActions. Correction: all player/sim mutations as serializable commands ([simulation-architecture](../02-architecture/simulation-architecture.md)); enables undo, replay tests, multiplayer-later.
Verify: replay test (command log → identical hash).

**F-03 — Pathfinder lacks production controls (P0, M).**
Evidence: `docs/04` has A\* prose, no node budget/cache/invalidation/instrumentation.
Reference: `S-08` YAPF. Correction: adopt all four YAPF controls ([transportation](../02-architecture/transportation-and-pathfinding.md)).
Verify: path-profile E2E + budget assertions in `perf`.

**F-04 — Persistence under-specified (P0, M).**
Evidence: `docs/06` §5 format sketch. References: `S-09`, `S-10`, `S-16`.
Correction: [persistence-and-save-load](../02-architecture/persistence-and-save-load.md) (version-per-change, OPFS+fallback, repair pipeline, corpus tests) starting VS-1, not M5.
Verify: save-corpus + fuzz + hash-roundtrip in CI.

**F-05 — WebGPU decision missing (P1, S).**
Evidence: `docs/01` assumes WebGL2. References: `S-13/15`.
Correction: WebGL2-first + abstraction seam + verification tasks ([rendering-architecture](../02-architecture/rendering-architecture.md)).
Verify: renderer decision record with measured fallback test.

**F-06 — Gameplay/progression absent (P1, L).**
Evidence: no goals/difficulty/win-state anywhere. Correction: [core-gameplay-loop](../03-game-design/core-gameplay-loop.md) + [progression-and-balancing](../03-game-design/progression-and-balancing.md); milestones before disaster/transit work.
Verify: manual playtest scripts + balancing tests.

**F-07 — Observability absent (P1, S).**
Correction: [profiling-and-observability](../04-performance/profiling-and-observability.md) metric catalog from VS-0.
Verify: F3 overlay + `perf` JSON output exist at VS-1.

**F-08 — React boundary undecided (P1, S).**
Brief requires React evaluation. Correction: [state-management](../02-architecture/state-management.md) freezes the rule (React for panels/menus, never in loop/sim).
Verify: lint rule + architecture test.

## 3. What the prior plan got right (keep)

SoA grid, sim/view split, cohorts+visuals, A\*+BPR direction, flood utilities, gated tasks with evidence, clean-room licensing stance — all research-consistent and retained.

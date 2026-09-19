# Custom Skills (5, project-specific)

> Built because no public skill covers these game workflows. Each is guidance-only (no scripts — they reuse project tooling + `webapp-testing`), spec-validated, and references frozen project docs by path.

## 1. Gap analysis (why custom)

| Workflow | Public coverage | Gap |
|----------|-----------------|-----|
| Visual/gameplay-usability QA with evidence | `webapp-testing` (mechanics) + addy devtools (gated) | No checklist for camera/terrain/ghost/overlap/UI-obstruction defects |
| Sim-truth audit (invariants, determinism, loops) | `tdd`/`diagnosing-bugs` (generic) | No invariant catalog, tick-order contract, or balancing-scenario procedure |
| Budget-gated benchmarking | `performance-optimization` (generic discipline) | No fixture set, metric contract, or degradation-ladder procedure |
| Playability journeys (UJ-01…08) | `webapp-testing` (mechanics) | No outcome-based journey definitions or feedback-quality rules |
| Roadmap-slice execution | addy planning/spec (generic) | No slice-scope lock, frozen-interface rules, or verifier orchestration |

## 2. The five skills

| Skill | Invoked when | Depends on | Evidence it demands |
|-------|--------------|------------|---------------------|
| `city-builder-visual-qa` | Any visual/milestone check: screenshots across resolutions, day/night, overlays, states; 7-point inspection | `webapp-testing`, visual-quality-standards | Screenshots + finding-per-defect; PASS only with zero open findings |
| `city-builder-simulation-audit` | Sim correctness: determinism hashes, tick order, 5-system invariant sweep, loop stability | sim-architecture, population-and-economy, progression docs | Hash equality + invariant table with ticks/values/repro |
| `city-builder-performance-gate` | Benchmarks: `perf` JSON + render runs + IO timings vs budgets and baseline | performance-budgets, benchmark-scenarios | PASS/FAIL table + profiles on failure; no claim without before/after |
| `city-builder-playability-test` | Journeys: drive UJ-01…08 like a player, assert outcomes + feedback quality | spec.md UJs, vertical-slice-milestones, `webapp-testing` | Outcome values + artifacts; keyboard path exercised |
| `city-builder-roadmap-executor` | Milestone work: scope lock → implement → verify → close out; orchestrates verifier skills | roadmap, dependency-graph, DoD, skill-task-mapping | Slice DoD checklist + artifact links + updated logs |

## 3. Maintenance

Custom skills are versioned in `metadata.version` and updated with the docs they cite (same PR rule as code). If a public skill later covers a workflow better, the custom skill shrinks to a routing stub rather than duplicating it.

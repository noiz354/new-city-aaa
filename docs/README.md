# Documentation Index — Research-Grounded AAA City Builder Audit

> Start here. Prior planning docs (`../../spec.md`, `../../plan.md`, `../../tasks.md`, `../01–07`) remain valid inputs; this tree is the **audited, research-grounded superset**. Where they conflict, this tree wins (conflicts are logged in `01-audit/`).

## 00 — Research (evidence)

- [research-methodology](00-research/research-methodology.md) — method, grades (F/C/B/R/H), traceability
- [addy-osmani-workflow](00-research/addy-osmani-workflow.md) — Osmani principles (F) vs project adaptations
- [city-builder-reference-projects](00-research/city-builder-reference-projects.md) — 7 projects, 6 code-inspected
- [graphics-rendering-research](00-research/graphics-rendering-research.md) — WebGL2/WebGPU, instancing, technique verdicts
- [simulation-algorithms-research](00-research/simulation-algorithms-research.md) — timestep, A\*, cohorts, rejected algorithms
- [browser-performance-research](00-research/browser-performance-research.md) — workers, SAB, OPFS, WASM gating
- [source-registry](00-research/source-registry.md) — all 22 sources with applicability + limitations

## 01 — Audit (verdicts)

- [repository-implementation-audit](01-audit/repository-implementation-audit.md) — repo truth: 13 docs, 0 code, no git
- [existing-plan-audit](01-audit/existing-plan-audit.md) — 16 domains, findings F-01…F-08
- [architecture-gap-analysis](01-audit/architecture-gap-analysis.md) — gaps G-A1…G-A14 + fix order
- [technical-risk-register](01-audit/technical-risk-register.md) — risks R-01…R-12, living

## 02 — Architecture (target)

- [game-engine-architecture](02-architecture/game-engine-architecture.md) — threads, data flow, lifecycle
- [rendering-architecture](02-architecture/rendering-architecture.md) — WebGL2-first + seam, instancing, sync
- [world-and-terrain](02-architecture/world-and-terrain.md) — frozen grid contracts
- [simulation-architecture](02-architecture/simulation-architecture.md) — fixed-step, commands, determinism, workers
- [transportation-and-pathfinding](02-architecture/transportation-and-pathfinding.md) — YAPF-controlled A\*, hybrid agents
- [population-and-economy](02-architecture/population-and-economy.md) — cohorts, demand, feedback loops
- [utilities-and-environment](02-architecture/utilities-and-environment.md) — nets, services, environment model, disasters
- [state-management](02-architecture/state-management.md) — React boundary decision (ADR-U1)
- [persistence-and-save-load](02-architecture/persistence-and-save-load.md) — version-per-change, OPFS, repair
- [module-boundaries](02-architecture/module-boundaries.md) — import rules, frozen interfaces

## 03 — Game design (playability)

- [core-gameplay-loop](03-game-design/core-gameplay-loop.md) — 30s/10min/session loops, goals
- [progression-and-balancing](03-game-design/progression-and-balancing.md) — harness + canonical scenarios
- [building-and-zoning-systems](03-game-design/building-and-zoning-systems.md) — state machine, placement UX
- [user-interface-and-controls](03-game-design/user-interface-and-controls.md) — layout, controls, overlays, a11y
- [visual-quality-standards](03-game-design/visual-quality-standards.md) — art direction + inspection gates

## 04 — Performance (numbers)

- [performance-budgets](04-performance/performance-budgets.md) — quantity/milestone/rule budgets (all unmeasured)
- [benchmark-scenarios](04-performance/benchmark-scenarios.md) — fixtures, `perf` contract, spikes SP-1…SP-7
- [profiling-and-observability](04-performance/profiling-and-observability.md) — metric catalog, regression detection
- [scalability-strategy](04-performance/scalability-strategy.md) — ceilings, degradation ladder, WASM/HPA\* gates

## 05 — Execution (plan)

- [development-roadmap](05-execution/development-roadmap.md) — VS-0…VS-7 with gates
- [dependency-graph](05-execution/dependency-graph.md) — ordering + critical path
- [vertical-slice-milestones](05-execution/vertical-slice-milestones.md) — acceptance per slice
- [verification-strategy](05-execution/verification-strategy.md) — 9 test layers, evidence rules, CI
- [definition-of-done](05-execution/definition-of-done.md) — task/slice DoD + anti-rationalization

## 06 — Agent skills (capabilities)

- [README](06-agent-skills/README.md) — skill environment index
- [skill-discovery](06-agent-skills/skill-discovery.md) — environment + candidate inventory
- [skill-evaluation](06-agent-skills/skill-evaluation.md) — per-skill evidence + verdicts
- [installation-manifest](06-agent-skills/installation-manifest.md) — pinned installs + verification status
- [skill-task-mapping](06-agent-skills/skill-task-mapping.md) — task/slice routing
- [skill-activation-strategy](06-agent-skills/skill-activation-strategy.md) — discovery + invocation rules
- [custom-skills](06-agent-skills/custom-skills.md) — 5 project-specific skills
- [verification-results](06-agent-skills/verification-results.md) — per-skill verification evidence
- [security-review](06-agent-skills/security-review.md) — audit + blockers

## Reading paths

- **New engineer:** this index → repository-audit → game-engine-architecture → module-boundaries → roadmap → your slice.
- **Reviewer:** existing-plan-audit → gap-analysis → risk-register → verification + DoD.
- **Skeptic:** source-registry → pick any decision → follow its `S-` citations to primary sources.

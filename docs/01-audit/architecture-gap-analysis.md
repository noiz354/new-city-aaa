# Architecture Gap Analysis (plan vs research)

> Bridges [existing-plan-audit](existing-plan-audit.md) findings to the target architecture in `docs/02-architecture/`. Each gap: G-ID, severity, correction pointer, dependency.

| ID | Gap (plan → research delta) | Severity | Corrected in | Depends on |
|----|-----------------------------|----------|--------------|------------|
| G-A1 | No mutation ownership: direct calls instead of commands; undo unimplementable as specified | **Blocker** | [simulation-architecture](../02-architecture/simulation-architecture.md) (command sourcing) | — |
| G-A2 | Save-compat starts at M5; schema will already have diverged | **Blocker** | [persistence](../02-architecture/persistence-and-save-load.md) (v1 format in VS-1) | G-A1 (commands are serializable ops) |
| G-A3 | Pathfinder missing budgets/cache/instrumentation/invalidation | **Blocker** | [transportation](../02-architecture/transportation-and-pathfinding.md) (YAPF controls) | world grid freeze |
| G-A4 | Renderer choice unexamined; no WebGPU seam | High | [rendering-architecture](../02-architecture/rendering-architecture.md) | — |
| G-A5 | React/UI boundary undecided; render-loop state risk | High | [state-management](../02-architecture/state-management.md) | G-A1 |
| G-A6 | Worker protocol undefined (messages, ownership, SAB stance) | High | [simulation-architecture](../02-architecture/simulation-architecture.md) + [browser-performance](../00-research/browser-performance-research.md) | G-A1 |
| G-A7 | Economy constants + stability ungrounded | High | [population-and-economy](../02-architecture/population-and-economy.md), [progression](../03-game-design/progression-and-balancing.md) | balancing harness (VS-3) |
| G-A8 | Environment systems (pollution/crime/health) without model | Medium | [utilities-and-environment](../02-architecture/utilities-and-environment.md) | fields infra (VS-2) |
| G-A9 | Gameplay goals/progression absent | Medium | [core-gameplay-loop](../03-game-design/core-gameplay-loop.md) | G-A7 |
| G-A10 | Observability catalog absent | Medium | [profiling-and-observability](../04-performance/profiling-and-observability.md) | VS-0 scaffold |
| G-A11 | Module dependency rules unstated (who imports whom) | Medium | [module-boundaries](../02-architecture/module-boundaries.md) | — |
| G-A12 | Rust/WASM admitted by vibes ("only when justified" without procedure) | Medium | [scalability-strategy](../04-performance/scalability-strategy.md) (W-1 gate with numbers) | perf harness |
| G-A13 | Overlay/a11y/touch under-specified | Low | [user-interface](../03-game-design/user-interface-and-controls.md) | UI scaffold |
| G-A14 | Disaster model thin (no state machine, spread rules) | Low | [utilities-and-environment](../02-architecture/utilities-and-environment.md) | services (late) |

**Dependency order for corrections:** G-A11 (rules) → G-A1 (commands) → G-A2/G-A6 (persistence/workers) → G-A3 (transport) → G-A4/G-A5 (render/UI) → G-A7/G-A9 (economy/gameplay) → G-A8/G-A14 → G-A10/G-A12/G-A13. This order shapes the [development-roadmap](../05-execution/development-roadmap.md).

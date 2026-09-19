# Development Roadmap (dependency-aware vertical slices)

> Replaces prior M1–M7 phasing (kept as reference in `plan.md`). Rule: **no slice lands without its tests + budgets + visual inspection** ([definition-of-done](definition-of-done.md)). Dependencies visualized in [dependency-graph](dependency-graph.md); slice details in [vertical-slice-milestones](vertical-slice-milestones.md).

| Slice | Name | Functional scope | Key arch decisions | Gate (must measure) |
|-------|------|------------------|--------------------|---------------------|
| VS-0 | Scaffold & repo | git+CI+lint, TS/Vite/React/three pinned, `perf`+F3 harness, arch tests, ADR log | D-B1…B3, renderer pin, T-038/42/43 | CI green; arch tests pass; remote exists |
| VS-1 | First playable tile | terrain+grid+camera+pick, 1 road + R zone via **commands**, save v1 + corpus, hamlet fixture | G-A1/A2/A11 closed; SoA freeze | place→save→load hash-equal; seed determinism |
| VS-2 | City skeleton | full tools, instanced meshers, overlays v1, fields worker, minimap, SP-1/SP-4 | renderer seam; asset gate | draws budget on `town`; save<2s/<3s |
| VS-3 | Living economy | demand/growth/cohorts/gravity, treasury+tax, budget panel, balancing suite S-green | economy lock v1 | S-green bands green; 15-min 1k-pop playtest |
| VS-4 | Traffic & utilities | graph+A\*+BPR+LOS, visual agents, power/water+overlays, brownout/pressure, SP-2/SP-3/SP-7 | YAPF controls; transit bits frozen | UJ-03/UJ-04 E2E; path budgets in `perf` |
| VS-5 | AAA render tier | day/night, LOD/culling, post tiers, audio engine, 256² default, leak test | WebGPU spike SP-5 | UJ-08 shots; <200 draws @`metro`; soak 2h |
| VS-6 | Crisis & services | environment model, services coverage, disasters, advisors/tutorial/alerts | disaster state machines | UJ-05/UJ-06; balancing S-sprawl/S-crisis |
| VS-7 | Ship hardening | touch, a11y pass, settings, share/screenshot, 8h soak, release perf table | scope freeze | all UJs + NFRs evidenced; release tag |

**Benchmark-before-features rule:** VS-2, VS-4, VS-5 each end with a mandatory benchmark review — the next slice may not start on red perf. Rollback: any slice may be reverted to the previous milestone tag; save-corpus must stay green across the revert (forward rule in [persistence](../02-architecture/persistence-and-save-load.md)).

## Skills per slice (see docs/06-agent-skills/)

| Slice | Required skills (cumulative) |
|-------|------------------------------|
| VS-0 | spec-driven-development, planning-and-task-breakdown, tdd, codebase-design, code-review-and-quality, diagnosing-bugs |
| VS-1 | + three-best-practices, webapp-testing, city-builder-roadmap-executor |
| VS-2 | + city-builder-visual-qa, city-builder-performance-gate |
| VS-3 | + city-builder-simulation-audit, city-builder-playability-test, vercel-react-best-practices, vercel-composition-patterns, frontend-ui-engineering |
| VS-4 | (verifiers: simulation-audit, playability-test, performance-gate) |
| VS-5 | + performance-optimization, browser-testing-with-devtools (if MCP ready) |
| VS-6/7 | all verifier customs; code-review-and-quality pre-merge every slice |

Full routing: [skill-task-mapping](../06-agent-skills/skill-task-mapping.md). No other planning decisions changed by this update.

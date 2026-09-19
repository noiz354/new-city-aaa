---
name: city-builder-roadmap-executor
description: Implements one roadmap slice or task exactly as specified, with verification. Use when starting milestone work, picking up the next task, or continuing the roadmap. Triggers on "implement the slice", "next task", roadmap execution, milestone work, or "continue building".
license: MIT
metadata:
  author: city-builder-aaa
  version: "1.0.0"
---

# City Builder Roadmap Executor

Build exactly the slice. Nothing more. Prove it done.

## Preconditions

1. Read `docs/05-execution/development-roadmap.md`, `dependency-graph.md`, and the slice entry in `vertical-slice-milestones.md`.
2. Confirm dependencies are green (prior slice accepted, gates passed). If red, stop and report — never build on a red gate.
3. Load only the skills the slice needs (see `docs/06-agent-skills/skill-task-mapping.md`). Do not load unrelated skills "just in case".

## Procedure

1. **Scope lock**: restate the slice's functional scope, frozen interfaces touched (if any), and acceptance criteria. Get explicit confirmation for any scope ambiguity.
2. **Implement** in task order from `tasks.md` (one task = one focused change ≤300 lines). Follow `docs/02-architecture/module-boundaries.md` import rules and `tdd` red-green discipline.
3. **Verify per task**: unit/determinism/arch tests + evidence (log, screenshot, or hash). Per slice: full [definition-of-done](../docs/05-execution/definition-of-done.md) checklist — budgets, visual inspection, balancing/corpus/soak where applicable.
4. **Invoke verifier skills** instead of self-certifying: `city-builder-visual-qa` for visuals, `city-builder-simulation-audit` for sim truth, `city-builder-performance-gate` for numbers, `city-builder-playability-test` for journeys, `code-review-and-quality` before merge.
5. **Close out**: update the risk register, decision log, and tuning changelog if touched. Report slice verdict with artifact links.

## Rules

- Frozen interfaces (tick order, save schema, command set, tuning layout) change only with version bump + migration + tests.
- No drive-by refactors, no stretch features, no new dependencies without the "ask first" rule from `spec.md` §9.
- If the plan and reality disagree, update the plan doc first, then the code (living-docs rule).

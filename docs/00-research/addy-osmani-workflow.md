# Addy Osmani's Engineering Workflow (as applied here)

> Primary sources: `S-03` (good-spec guide), `S-04` (agent-skills repo), `S-02` (web.dev budgets, incl. Osmani's JS-cost work). Grades: **F** where quoted from the fetched pages; project adaptations are labeled **ADAPTATION**.

## 1. Principles documented by Osmani (F)

1. **Plan first in read-only mode, then execute.** "Plan Mode … read-only operations … won't write any code until you're ready" (`S-03`). This audit *is* the plan-mode artifact: no implementation code was written.
2. **Specify → Plan → Tasks → Implement, gated.** Four phases where "you don't move to the next one until the current task is fully validated" (`S-03`, via GitHub Spec Kit). Maps to our `spec.md → plan.md → tasks.md → code` chain.
3. **Specs are living, executable artifacts** tied to version control and CI; "the spec drives implementation, tests, and task breakdowns" (`S-03`).
4. **Six core areas** of effective agent specs: Commands, Testing, Project structure, Code style, Git workflow, Boundaries (`S-03`, citing GitHub's 2,500-repo study).
5. **Modular tasks over monolithic prompts** — one focused task at a time; "curse of instructions" warning (`S-03`).
6. **Performance budgets as gates** (`S-02` web.dev; Osmani's cost-of-JS thesis referenced therein): quantity-based limits (bytes, requests) + milestone timings, enforced in the build. Applied in [performance-budgets](../04-performance/performance-budgets.md).
7. **Skill anatomy**: Overview → When to Use → Process → Rationalizations → Red Flags → Verification (`S-04`). Applied as the anti-rationalization tables in `tasks.md` and [definition-of-done](../05-execution/definition-of-done.md).

## 2. What Osmani does NOT say (do not attribute)

- He prescribes no game-engine architecture, no fixed-timestep scheme, no ECS-vs-arrays choice.
- He prescribes no specific file tree for games; the `docs/00–05` structure here is a **project adaptation** of "structure the spec like a PRD/SRS".
- "Anti-rationalization table" wording is our adaptation of the skill-anatomy "Rationalizations" section.

## 3. ADAPTATIONS for this project (R)

| # | Adaptation | Rationale |
|---|-----------|-----------|
| A-1 | Gate vocabulary: `SPEC-APPROVED → PLAN-APPROVED → TASKS-APPROVED → CODE` in README | Makes the gated workflow checkable in review |
| A-2 | `CONSTRAINTS.md`-style budgets become [performance-budgets](../04-performance/performance-budgets.md) + CI gates | Budgets must be measurable per milestone, not prose |
| A-3 | Verification strategy ([verification-strategy](../05-execution/verification-strategy.md)) requires *evidence artifacts* (logs, screenshots, hashes) per task | Direct from skill anatomy's "Verification" step |
| A-4 | This audit's evidence grades (`F/C/B/R/H`) | Extends "Red Flags + Verification" to research traceability |

## 4. Checklist: does this repo comply?

- [x] Commands defined (`plan.md` §1; to be created in code scaffold)
- [x] Testing strategy defined ([verification-strategy](../05-execution/verification-strategy.md))
- [x] Project structure defined ([module-boundaries](../02-architecture/module-boundaries.md))
- [x] Code style: to be fixed at scaffold (TS strict + lint) — tracked in roadmap VS-0
- [ ] Git workflow: repo is not yet a git repository — **must fix before VS-1** ([repository-implementation-audit](../01-audit/repository-implementation-audit.md))
- [x] Boundaries defined (`spec.md` §9; extended in [definition-of-done](../05-execution/definition-of-done.md))

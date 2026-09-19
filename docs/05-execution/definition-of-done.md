# Definition of Done

> Applies to every task (from `tasks.md`, as remapped) and every slice. No exceptions without milestone-owner sign-off + tracked issue.

## Task-level DoD

- [ ] Implements exactly one task's scope (≤300 lines; split otherwise)
- [ ] Unit + affected determinism/arch tests written and green
- [ ] Evidence attached (log/screenshot/hash per [verification-strategy](verification-strategy.md))
- [ ] Docs + decision log updated if behavior/contracts changed
- [ ] No frozen-interface change without version bump + migration + tests
- [ ] Reviewer confirms acceptance criteria observable (not inferred)

## Slice-level DoD (adds)

- [ ] All slice acceptance criteria in [vertical-slice-milestones](vertical-slice-milestones.md) demonstrated
- [ ] Budgets green ([performance-budgets](../04-performance/performance-budgets.md)) or waived with issue
- [ ] Visual inspection checklist + screenshots attached ([visual-quality-standards](../03-game-design/visual-quality-standards.md))
- [ ] Balancing/corpus/soak suites green where applicable
- [ ] Risk register updated (retire or re-grade with evidence)
- [ ] Benchmark review held (VS-2/4/5) with recorded decision

## Anti-rationalization table (project skill adaptation, `S-04`)

| Excuse | Required response |
|--------|-------------------|
| "Too simple for a test" | Sim/formula changes always get table tests |
| "Tests/perf later" | Later = tracked issue + owner sign-off, never silent |
| "Just one more file in this PR" | Split; reference task IDs |
| "Fine on my machine" | Show F3 + draws + `perf` on reference workload |
| "Compat can break" | Version bump + migration + corpus, always |
| "Skip worker, main thread OK" | Show `perf` numbers, then decide |
| "Copy this GPL snippet, it's small" | Never; clean-room (risk R-03); CI grep enforces |

## Rollback conditions

Revert to previous milestone tag if: CI red >1 day on main, corpus fails across versions, or benchmark review rejects. Revert must keep the save-corpus green (forward-compat rule).

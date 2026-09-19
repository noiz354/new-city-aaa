# Technical Risk Register

> Living document: update at each milestone. Probability × Impact = Exposure (H/M/L). Every risk has an owner phase and a measurable resolution.

| ID | Risk | Prob | Impact | Exposure | Mitigation | Resolved by (measurable) | Owner phase |
|----|------|------|--------|----------|------------|--------------------------|-------------|
| R-01 | No repo/version control; work unreviewable | H | H | **H** | `git init` + remote + branch rules day one | Remote exists; PR flow used | VS-0 |
| R-02 | Cohort/path budgets wrong → tick blowout at scale | M | H | **H** | YAPF controls + worker + degrade-visuals-first; spike early | `perf` p95 day-tick <50ms on stress city | VS-4 |
| R-03 | License contamination (GPL/AGPL refs) | M | H | **H** | Clean-room ADR; never clone refs into project; PR checklist | ADR signed; no GPL text in repo (CI grep) | VS-0 |
| R-04 | Save-format churn breaks compat before M5 | M | H | **H** | v1 format + version-per-change from VS-1; corpus tests | Corpus green across versions | VS-1→ |
| R-05 | WebGPU assumptions wrong (Safari churn) | M | M | M | WebGL2-first; WebGPU behind seam + device tests | Renderer ADR with fallback test log | VS-2 |
| R-06 | Economy death spirals / runaway growth | M | M | M | Balancing harness + 3 canonical scenarios; tunable constants file | Balancing tests green | VS-3 |
| R-07 | three.js monthly churn breaks build | M | M | M | Pin exact version; upgrade as explicit task with migration notes | CI green on pinned r18x | every VS |
| R-08 | Draw-call / memory blowout at 10k buildings | M | M | M | Instancing + pools + dispose discipline + leak test | Draws <200, heap <1.5GB on target city | VS-5 |
| R-09 | Stale-reference patterns copied (R-01 wall-clock, GLB-per-building) | M | M | M | T-043 lint (no Date.now/Math.random in sim); T-042 asset gate | Lint + arch tests green | VS-0/1 |
| R-10 | Scope creep (transit/multiplayer/WASM too early) | M | M | M | Stretch flags; W-1 numeric gate; roadmap dependency enforcement | No flagged code on main | every VS |
| R-11 | Touch/mobile assumed but unscoped | L | M | L | Desktop-first documented; touch = roadmap item with own budget | Touch slice accepted or cut | VS-7 |
| R-12 | Key-person / context loss across sessions | M | L | L | Living docs (Osmani); decision log in each arch doc | Docs updated per milestone | every VS |

## Retired risks

- (none yet — retire with evidence link when resolved, never by assertion)

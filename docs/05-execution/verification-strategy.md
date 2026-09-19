# Verification Strategy

> "Done" is proven, not asserted. Every task produces evidence artifacts.

## 1. Test layers

| Layer | What | Where | Gate |
|-------|------|-------|------|
| Unit | formulas, state machines, commands, migrations, A\*, flood, economy math | Vitest, `sim/` ≥80% lines | every PR |
| Determinism | snapshot-hash, replay-from-log, seed-equality | Vitest + fixtures | every PR touching sim |
| Arch | import rules, file caps, no-GPL grep, React/three boundaries | CI script | every PR |
| Balancing | S-green/sprawl/crisis trajectories | nightly + pre-VS-3/6 | slice gate |
| E2E | UJ scripts (place/grow/jam/blackout/save/tutorial) | Playwright | slice gate |
| Perf | `perf` JSON + render runs + soak | CI + manual | slice gate + benchmark reviews |
| Save corpus | every format version loads; fuzz bit-flips fail gracefully | CI | every PR touching persistence |
| Visual | screenshot suite (human-judged diffs) + inspection checklists | CI flags + manual | slice gate |
| Manual | playtests, obscured-view, keyboard-only, touch, a11y | checklist per slice | milestone review |

## 2. Evidence artifacts (required per task)

Logs (`test`, `perf`), screenshots/clips for visual changes, hashes for sim/save changes, filled inspection checklists, updated docs + decision log. Reviewers reject evidence-free "works on my machine" claims (anti-rationalization: "FPS is fine on my machine" → show F3 + draws).

## 3. CI pipeline (VS-0 → mature)

PR: typecheck + lint + unit + arch + build-size → merge. Nightly: balancing + corpus + soak-smoke + render runs. Milestone: full matrix + benchmark review + manual sign-offs. Flaky policy: quarantine with issue, never silent skip.

## 4. Falsification rules

A red gate blocks the slice (no "fix later" without a tracked issue + milestone-owner sign-off). Truth-affecting fallbacks (contingencies) require player-visible flags. Any claim of "supports N citizens/buildings" without a `perf`/E2E number is rejected in review.

---
name: city-builder-simulation-audit
description: Audits the authoritative city simulation state, tick scheduling, and system invariants. Use when checking simulation correctness, determinism, resource distribution, traffic volumes, population flows, economy balance, unstable feedback loops, or invalid state transitions. Triggers on sim audit, determinism, "population wrong", economy tuning, desync, or balancing failures.
license: MIT
metadata:
  author: city-builder-aaa
  version: "1.0.0"
---

# City Builder Simulation Audit

The sim is truth. This skill proves truth is consistent.

## Preconditions

1. Read-only inspection first: `docs/02-architecture/simulation-architecture.md` (tick order, determinism contract), `docs/02-architecture/population-and-economy.md` (feedback loops).
2. Test harness available (`npm run test`, `npm run perf`); fixtures `hamlet/town/metro`.

## Procedure

1. **Determinism**: run the snapshot-hash test (fixed script + seed → exact hash) and the replay test (command log → identical hash). Any mismatch is a P0 defect — stop and bisect (see `diagnosing-bugs`).
2. **Tick audit**: confirm tick order matches the frozen contract; confirm heavy systems run on day boundaries; confirm worker commits land in tick order (no mid-tick mutation).
3. **Invariant sweep** on a 30-day `town` run, asserting:
   - Money: `treasury[t+1] = treasury[t] + income − upkeep` (integer-exact).
   - Population: residents ≤ housing capacity; workers = employed + unemployed; cohorts sum to commuters.
   - Utilities: per net, `served ≤ supply`; shed order is I-farthest → C → R; no building both `powered` and shed.
   - Traffic: edge `volume ≥ 0`; `v/c` finite; every employed cohort has a path or a `disconnected` flag (never silently dropped).
   - Growth: daily developments ≤ N; every transition carries a machine-readable reason.
4. **Loop stability**: run balancing scenarios (`docs/03-game-design/progression-and-balancing.md`); flag runaway growth, death spirals, or stagnation outside asserted bands.
5. **Report**: table of invariant → PASS/FAIL with tick, values, and repro (seed + command log). No "looks fine" without numbers.

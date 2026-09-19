---
name: city-builder-performance-gate
description: Runs representative city-size benchmarks and gates against documented performance budgets. Use when measuring FPS, frame-time percentiles, simulation tick duration, memory, draw calls, routing latency, or save/load times. Triggers on perf check, benchmark, regression, "too slow", budget gate, or milestone benchmark review.
license: MIT
metadata:
  author: city-builder-aaa
  version: "1.0.0"
---

# City Builder Performance Gate

Measure first. Gate second. Optimize only what measurements prove matters (see `performance-optimization`).

## Preconditions

1. Budgets: `docs/04-performance/performance-budgets.md`. Fixtures + `perf` JSON contract: `docs/04-performance/benchmark-scenarios.md`.
2. Baselines checked in (`perf/baseline.json`); 3-run median on a quiet machine.

## Procedure

1. **Sim side**: `npm run perf` on `hamlet`, `town`, `metro`. Collect `dayMs p50/p95/max`, `pathsPerDay`, `pathP95`, `cacheHitRatio`, `cohorts`, `hash`, `heapMB`.
2. **Render side**: Playwright perf run (see `webapp-testing`) with the orbit script on Low/Medium/High. Collect `fps`, `frameP95`, `draws`, `tris` from `renderer.info`.
3. **IO side**: time save + load on `metro`; record bytes.
4. **Compare**: every metric vs budget (Target on `town`, Stress on `metro`) and vs baseline (fail on >10% regression).
5. **Report**: PASS/FAIL table with numbers, budgets, deltas, and the exact commands + fixture SHAs for reproduction. On FAIL, attach a profile (Chrome trace or tick-stage breakdown) and name the bottleneck — never prescribe an optimization without one.

## Rules

- No perf claim without before/after numbers from the same fixture and machine class.
- Reference hardware classes are REF-D (desktop) and REF-I (iGPU) — always state which was used.
- Degradation order under stress is fixed (visuals → overlays → path cache → never truth); verify the ladder engages before failing the gate.

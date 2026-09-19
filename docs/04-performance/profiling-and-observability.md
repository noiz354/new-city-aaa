# Profiling & Observability

> Corrects audit item 15 (no metric catalog). If it isn't measured, it isn't managed.

## 1. Metric catalog (F3 overlay + `perf` JSON + E2E)

| Metric | Source | Alert if |
|--------|--------|----------|
| fps, frameMs p50/p95 | rAF delta EMA | p95 >20ms @Medium/town |
| draws, tris | `renderer.info` | draws >200 @metro |
| tickMs EMA, dayMs p95 | sim clock | day p95 >50ms |
| paths/day, pathP95, cacheHit, cohortCount | traffic module | pathP95 >2ms, hit<70% |
| graphVersion, invalidations/day | road graph | spikes without edits |
| heapMB (JS), gpuMem est. | perf API + info | >1.5GB, or growth >15%/2h |
| saveMs, loadMs, saveBytes | persist worker receipts | over budgets |
| React commits/sec | uiStore counter | >10/s |
| workerRoundtripMs (p95 per worker) | protocol timestamps | >100ms sustained |

## 2. Profiling workflow

Dev F3 overlay (always available) → Chrome Performance trace for long tasks → `perf` fixture runs for sim-side → trace points (`performance.mark`) around tick stages, path batches, chunk remesh, save phases. Profiles attached to any perf-fix PR.

## 3. Regression detection

Baselines checked in (`perf/baseline.json` + trace budgets); CI fails on >10% regression or budget breach; release notes include the perf delta table. Flaky-perf policy: 3-run median, dedicated runner label, quarantine with issue link (never silent skip).

## 4. Player-facing transparency

F3 overlay in production builds (not just dev); "Sim behind" indicator when slow-motion engages; save panel shows last save/load timings; settings shows detected tier + override.

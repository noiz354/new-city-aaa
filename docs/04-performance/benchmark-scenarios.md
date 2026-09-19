# Benchmark Scenarios

> Workloads + spikes that turn budgets into measurements. Runner: `npm run perf` (headless sim) + Playwright perf runs (render).

## 1. Standard cities (checked-in fixtures, seeded)

| Fixture | Size | Content | Purpose |
|---------|------|---------|---------|
| `hamlet` | 128² | 200 bldgs, 1k pop | unit-scale sanity, CI-fast |
| `town` | 256² | 2k bldgs, 15k pop | **target workload** (all Target budgets) |
| `metro` | 256² | 10k bldgs, 100k pop, congestion | **stress workload** (Stress budgets) |
| `corridor` | 128² | suburb + single arterial | UJ-03 traffic E2E |
| `blackout` | 128² | overloaded grid | UJ-04 utilities E2E |

## 2. `perf` output contract (JSON)

`{ fixture, seed, days, dayMs: {p50, p95, max}, pathsPerDay, pathP95, cacheHitRatio, cohorts, hash, heapMB }`. CI asserts: budgets + **hash stability** (determinism) + ≤10% regression vs baseline (checked-in, updated only with justification).

## 3. Render perf runs (Playwright + `renderer.info`)

Scene load → orbit script → capture `{fps, frameP95, draws, tris}` per tier (Low/Med/High) on `town` + `metro`. Screenshot suite doubles as visual gate ([visual-quality-standards](../03-game-design/visual-quality-standards.md)).

## 4. Spike list (each H needs one before deciding)

| Spike | Question | Decision it unblocks |
|-------|----------|----------------------|
| SP-1 | `BatchedMesh` vs N×`InstancedMesh` @10k | building render path |
| SP-2 | A\* p95 + worker overhead on `metro` | worker split + HPA\* trigger |
| SP-3 | YAPF `max_search_nodes` value for our graphs | default budget (start 10k) |
| SP-4 | OPFS vs IndexedDB save/load on 3 browsers | store choice + fallback |
| SP-5 | WebGPU vs WebGL2 frame time on REF-D + Safari | renderer roadmap |
| SP-6 | JS day-tick headroom on `metro` post-opt | WASM gate W-1 |
| SP-7 | All-or-nothing vs smoothed assignment oscillation | traffic model lock |

## 5. Soak & stability

2h scripted soak (speed 3x, random commands from corpus) asserting: no crash, heap growth <15%, hash deterministic per seed, zero NaN. 8h soak before ship.

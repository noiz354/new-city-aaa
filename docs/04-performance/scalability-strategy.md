# Scalability Strategy

> How the game grows (and degrades) with city size — and the gated contingencies.

## 1. Scaling dimensions & ceilings (v1 design points)

| Dimension | v1 ceiling | Binding constraint | Headroom plan |
|-----------|------------|-------------------|---------------|
| Tiles | 256² (65k) | memory trivial; tick scans bounded by dirty flags | 512² experimental flag only |
| Buildings | 10k rendered | draw calls + instance buffers | instancing + LOD + culling |
| Population (simulated) | 100k | cohorts (2k) + paths/day (≤500 fresh) | merge buckets + cache |
| Visual agents | 800 pooled | instance updates + interpolation | sample rate adapts to fps |
| Save size | <5MB | gzip + compact entities | binary entities if needed |

## 2. Degradation ladder (automatic, announced in F3)

1. Reduce visual-agent sample + overlay refresh → 2. Drop shadow resolution → 3. Force LOD-near → 4. Reuse cached paths (stale ≤1 day) → 5. Suggest Low tier. **Truth is never degraded silently**; any truth-affecting fallback (drive-test contingency) requires explicit player-visible flag + event log entry.

## 3. Contingency W-1: Rust/WASM fast path (gated)

**Gate (all must hold):** (a) `metro` day-tick p95 >50ms *after* documented optimization pass; (b) profiler attributes >60% to a compact kernel (A\*/diffusion/serialization); (c) spike shows ≥2× win with ≤2-week integration + deterministic cross-toolchain output.
**Scope if opened:** one kernel only (pathfinding first), behind the existing worker protocol (WASM *inside* the worker — no architecture change). Rejected until then per [browser-performance](../00-research/browser-performance-research.md) §5.

## 4. Contingency W-2: HPA\*/hierarchical routing

Trigger: sustained >10k graph nodes or path p95 >2ms after SP-2/SP-3 tuning. Design sketch only (district abstraction over current graph); no code before trigger.

## 5. Mobile & 512² maps

Explicitly out of v1. Entry criteria for a future track: desktop budgets green for 2 milestones + dedicated touch/thermal budgets + device lab access. No silent scope entry (risk R-10/R-11).

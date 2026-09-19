# Performance Budgets

> Structure per `S-02` (quantity / milestone / rule metrics, enforced in build). Reference hardware: **REF-D (desktop)** = M1 Air / GTX1660+R5-3600, 1080p; **REF-I (iGPU)** = Intel Iris Xe laptop. All values are **budgets** (nothing measured yet — no implementation exists).

## 1. Quantity budgets (CI-enforced)

| Metric | Budget (REF-D, Medium) | Enforcement |
|--------|------------------------|-------------|
| Initial JS (gzip) | <1.5MB / <5MB raw | build-size check |
| Draw calls @10k buildings | <200 | dev counter + E2E assert |
| Tris/frame | <1.5M | `renderer.info` assert |
| JS heap @256² full city | <1.5GB | heap snapshot job |
| React commits/sec (normal play) | <10 | E2E perf run |
| `models/*.glb` in core bundle | 0 (T-042 gate) | build glob check |

## 2. Milestone timings (measured procedures in [benchmark-scenarios](benchmark-scenarios.md))

| Metric | Min | Target | Stress |
|--------|-----|--------|--------|
| FPS Medium @5k bldgs | 60 (p50 frame ≤16.7ms) | 60 @High | 30 @10k bldgs |
| Sim day-tick p95 | <50ms | <25ms | <50ms @stress city |
| Path query p95 | <2ms | <1ms | worker overflow works |
| Save / load | <2s / <3s | <1s / <2s | <4s / <6s @stress |
| First interactive (broadband) | <3s | <2s | — |
| Input→photon (place→ghost update) | <50ms | <16ms | — |
| Long-session stability | 2h no degradation >10% | 4h | 8h soak |

## 3. Rule budgets

- No long task >50ms on main thread during normal play (Lighthouse-style longtask assert in E2E).
- Tick slow-motion (not spiral) under load: dropped sim-rate flagged in F3, never silent.
- Degradation order under stress: visuals → overlays → paths-cache → (never) truth.

## 4. Mobile / REF-I

REF-I targets Medium→Low auto-tier; explicit mobile-browser support is **out of v1 scope** (thermal + touch need own budgets — see [scalability-strategy](scalability-strategy.md)).

## 5. Budget change control

Budgets change only via PR updating this doc + the affected test; regressions fail the slice (see [definition-of-done](../05-execution/definition-of-done.md)).

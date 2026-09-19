# 07 — Performance Budgets, Optimization & Testing

> Covers NFR-01..07. The "AAA proof" doc — how we know it's fast and correct.

## 1. Budgets (hard gates, CI-enforced where possible)

| Metric | Budget | Measured by | Gate |
|--------|--------|-------------|------|
| FPS @5k bldgs Med 1080p | ≥60 | F3 overlay, Playwright perf run | M6 |
| FPS @10k bldgs Med | ≥30 | same | M6 |
| Sim day tick p95 | <50ms | `npm run perf` (fixture city) | M4+ |
| Draw calls @10k | <200 | `renderer.info` dev HUD | M6 |
| Tris/frame | <1.5M | same | M6 |
| Heap @256² full | <1.5GB | Chrome measure | M6 |
| Initial JS | <5MB (gzip <1.5MB) | build report | M7 |
| Interactive | <3s broadband | Lighthouse-ish manual | M7 |
| Save / Load | <2s / <3s | T-025 timing log | M5 |
| Sim unit coverage | ≥80% lines on `sim/` | vitest --coverage | every PR |

Reference machine: M1 MacBook Air / GTX1660 + Ryzen 3600 class. Record actual numbers in `perf/RESULTS.md` per milestone.

## 2. Optimization Checklist (apply in order — measure first!)

1. **Instancing + merge** (docs/01 §6–7) — biggest win, do first.
2. **Dirty flags everywhere** — never full-grid scan per frame; daily sim, 1–4Hz overlays.
3. **Throttle DOM** — HUD 4Hz, minimap on-dirty, tooltips rAF-throttled.
4. **Pool everything hot** — agents, ghost quads, BFS queues, path arrays (no alloc in tick loop).
5. **Worker offload** — A* batches + field diffusion; postMessage with transferables.
6. **LOD + culling** — chunk frustum cull, building LOD swap, tree % by preset.
7. **Cap growth/day** (N=25) — bounds instancing churn + event queue.
8. **Compress saves** — gzip; DataTexture overlays reuse buffers.
9. **Code-split** — Three core first; disaster/audio/GLTF packs lazy.
10. **Last resort:** reduce default map to 192² on Low preset (document + setting).

**Never:** micro-opt without profiler screenshot; add deps without bundle-size note; `await` in tick loop.

## 3. Profiling Workflow

- Dev F3 overlay: `fps | frameMs | draws | tris | tickMs(EMA) | cohorts | paths/day | heap`.
- Chrome Performance: record 10 game-days @3x → find long tasks (>50ms) → fix or move to worker.
- `npm run perf`: headless 30-day fixture benchmark prints `day-p50/p95/max, paths, cohorts, hash` — asserts p95<50ms + hash stable (determinism!).
- Draw-call drill: `renderer.info.render.calls` per subsystem (log in dev when >200).

## 4. Testing Strategy

### Unit (Vitest, `sim/` — fast, deterministic, no DOM/GL)
- demand fn table tests (docs/03 §2 edge cases: 20% tax, 0 jobs, ghost town).
- growth scoring: powered/unpowered/connected permutations; upgrade/abandon timers.
- A*: fixtures (straight, detour, disconnected, congestion reroute).
- flood fill: split nets, plant isolation, loop lines.
- economy: monthly tick incl. subsidy + happyFactor + bankruptcy.
- save hash: fixture → save → load → hash equal; migration v0→v1.
- RNG: same seed 2 runs → identical hashes (FR-S06).

### E2E (Playwright — real browser, real GL via swiftshader)
- UJ-01 script: new map → road → plant → zone R → advance 15 days → assert pop>0 + powered%.
- UJ-03: corridor city → assert LOS F appears → add road → assert clears.
- UJ-07: save → reload → load → assert pop + treasury equal.
- Screenshot comparisons for day/night + overlays (loose threshold, anti-flake).

### Manual QA scripts (per milestone gate)
- M3: "15-min 1k pop" playtest. M5: bankruptcy + recovery. M7: full UJ-01..08 pass + keyboard-only run + colorblind overlay check.

## 5. CI Gates (suggested GitHub Actions)

```
on PR: typecheck + eslint + vitest(+coverage ≥80% sim) + build-size check
on milestone tag: + playwright e2e + perf benchmark (compare vs baseline ±10%)
```

Fail = block merge. Perf regressions need written justification + new baseline.

## 6. Risk Burndown (from plan.md §8 — check monthly)

A* blowout → measured in T-017; draw explosion → T-027 counter; save bloat → T-025 timings; indeterminism → hash tests; scope creep → stretch flags untouched until M5 green.

## 7. Ship Checklist (T-037)

- [ ] All UJ-01..08 recorded pass · [ ] NFR-01..07 evidenced · [ ] 3 fresh-browser playtests (inc. 1 Safari/Firefox) · [ ] Save migration test from previous tag · [ ] Bundle + perf numbers in release notes · [ ] Tutorial completable with no help · [ ] Mute + Low-FX + colorblind verified

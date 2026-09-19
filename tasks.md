# TASKS.md — Atomic, Ordered, Gated Task List

> Each task = **one focused session**, one PR (<300 lines), with **acceptance + evidence**. Do not start T-n+1 until T-n is confirmed working — per your original prompt.
>
> Sizes: **S** (<1hr) · **M** (1–3hr) · **L** (3–6hr). `Deps` must be done first.

## Conventions

- Task ID format `T-###`. Reference `spec.md` FR + `plan.md` module in every PR.
- **Evidence required:** what to show (test log / screenshot / F3 overlay / save hash).
- Mark tasks `- [ ]` → `- [x]` only after user confirms.

## M1 — Core Engine & Viz (FR-R01..03, FR-W01, FR-S01)

- [ ] **T-001 S — Scaffold + commands.** Vite + TS strict + ESLint + Vitest + Playwright skeleton. `Deps: —` · `Accept: npm run dev|build|test all pass.` · `Evidence: terminal log.`
- [ ] **T-002 M — Renderer + cameras.** Scene, ACES, fog, hemi+dir lights, Ortho↔Persp rig with damped orbit/pan/zoom. `Deps: T-001` · `Accept: empty ground plane, toggle cameras, 60fps.` · `Evidence: screenshot + fps.`
- [ ] **T-003 M — Grid + terrain gen.** Typed-array grid 128² (flag →256), seeded noise terrain + water plane. `Deps: T-001` · `Accept: new seed → new terrain; same seed → identical.` · `Evidence: 2 screenshots same seed.`
- [ ] **T-004 M — Picking + highlight.** Raycast-to-plane → tile coords, hover highlight, click inspector stub. `Deps: T-002,T-003` · `Accept: hover shows (x,y); works both cameras.` · `Evidence: short clip/screenshot.`
- [ ] **T-005 S — Game clock.** Fixed-step accumulator, pause/1x/2x/3x, day counter, F3 overlay (fps + tickMs). `Deps: T-001` · `Accept: speeds change ticks/sec; render decoupled.` · `Evidence: F3 screenshot.`
- [ ] **M1 GATE:** empty-map orbit + select @60fps; `npm run test` green.

## M2 — Tools & Assets (FR-T01..03, FR-R04, FR-X01)

- [ ] **T-006 M — Toolbar + tool state.** Select/Road/R/C/I/PowerLine/Plant/Water/Bulldoze buttons + Esc cancel + costs stub. `Deps: T-004` · `Accept: tool switching + cursor label.` · `Evidence: screenshot.`
- [ ] **T-007 M — Road placement.** Drag-line preview (green/red validity), cost = length×price, writes road layer + rebuilds graph stub. `Deps: T-006` · `Accept: L-shaped road drag works; funds deducted.` · `Evidence: screenshot + treasury log.`
- [ ] **T-008 M — Zone painting.** Drag-rect R/C/I paint + bulldoze marquee; chunk dirty flags. `Deps: T-006` · `Accept: painted zones render colored; bulldoze clears.` · `Evidence: screenshot.`
- [ ] **T-009 M — Instanced meshers.** Terrain 1-draw + merged roads/chunk + InstancedMesh buildings + tree instancing. `Deps: T-003,T-007` · `Accept: 2k zones render, draw calls <100 (dev counter).` · `Evidence: draw-call HUD screenshot.`
- [ ] **T-010 S — Asset loader.** GLTF loader + cache + fallback procedural box; `assets/buildings/*.glb` registry JSON. `Deps: T-009` · `Accept: missing file → fallback, no crash.` · `Evidence: console log.`
- [ ] **M2 GATE:** UJ-01 partial (roads+zones+costs, no growth yet).

## M3 — Sim Loop: RCI + Citizens + Treasury (FR-S, FR-C01..02, FR-E01..03)

- [ ] **T-011 M — RCI demand model.** Implement formula in `docs/03`; unit tests for unemployment/tax effects. `Deps: T-005` · `Accept: 80% branch coverage on demand fn.` · `Evidence: vitest log.`
- [ ] **T-012 M — Growth engine.** Daily scoring → spawn/upgrade/abandon; levels 1–3; procedural building swap. `Deps: T-011,T-008` · `Accept: zoned+road tiles grow in ~10 game-days.` · `Evidence: before/after screenshot + pop>0.`
- [ ] **T-013 M — Citizens + jobs (cohorts).** Residents/jobs counts, gravity job-match, unemployment + happiness. `Deps: T-012` · `Accept: R+C+I city → unemployment <50%, RCI bars respond.` · `Evidence: HUD screenshot.`
- [ ] **T-014 M — Land value + desirability.** Base − pollution + park/water halo, 3×3 diffusion; overlay view. `Deps: T-012` · `Accept: park raises nearby value; overlay shows gradient.` · `Evidence: overlay screenshot.`
- [ ] **T-015 M — Treasury + monthly tick.** Start $20k, upkeep + tax income, bankruptcy block. `Deps: T-012` · `Accept: month tick changes $ correctly (unit test).` · `Evidence: test log + HUD.`
- [ ] **M3 GATE:** UJ-01 + UJ-02 pass (houses/shops spawn, pop grows, $ ticks).

## M4 — Traffic, Pathfinding, Utilities (FR-C03..06, FR-U)

- [ ] **T-016 M — Road graph builder.** Nodes/edges from road tiles, incremental rebuild on dirty chunks; unit tests (T-junction, loop). `Deps: T-007` · `Accept: graph matches fixtures.` · `Evidence: vitest log.`
- [ ] **T-017 L — A* + cache + worker.** Binary-heap A*, BPR weights, O-D cache, worker offload; `npm run perf` harness. `Deps: T-016` · `Accept: 500 paths <100ms; same-seed deterministic.` · `Evidence: perf log.`
- [ ] **T-018 M — Traffic assignment + viz.** Volumes → v/c → LOS colors overlay + congestion alerts. `Deps: T-017,T-013` · `Accept: single-road city congests (red); parallel road relieves.` · `Evidence: 2 overlay screenshots (UJ-03).`
- [ ] **T-019 M — Visual agents pool.** 500 cars + 300 peds sampled from top flows; loop along paths; headlight sprites at night. `Deps: T-018` · `Accept: cars visible on busy roads, 0 when paused.` · `Evidence: screenshot.`
- [ ] **T-020 M — Power flood fill.** Plants + lines/roads conduct; supply/demand per net; brownout I-first rule; overlay + icons. `Deps: T-007` · `Accept: overload → unpowered icons; 2nd plant fixes (UJ-04).` · `Evidence: overlay screenshots.`
- [ ] **T-021 M — Water + pressure.** Towers/pumps + pipes/roads; pressure falloff; unwatered halts growth. `Deps: T-020` · `Accept: far building unwatered until 2nd tower.` · `Evidence: screenshot.`
- [ ] **M4 GATE:** UJ-03 + UJ-04 pass.

## M5 — Economy UI + Persistence (FR-E04..05, FR-P)

- [ ] **T-022 M — Budget panel.** Tax sliders (R/C/I 0–20%), service funding, income/expense breakdown + 12-mo sparkline. `Deps: T-015` · `Accept: 15% tax → income↑ happiness↓ (UJ-05).` · `Evidence: screenshot + test.`
- [ ] **T-023 M — Overlays + inspector.** Power/water/traffic/value/pollution/happiness tabs; click building → details (level, residents, jobs, powered, rent). `Deps: T-014,T-018,T-020` · `Accept: all overlays render; inspector accurate.` · `Evidence: screenshots.`
- [ ] **T-024 M — Save format v1.** Header + binary layers + entities, gzip, FNV hash; unit roundtrip test. `Deps: T-003,T-012` · `Accept: save→load hash equal on fixture.` · `Evidence: vitest log.`
- [ ] **T-025 M — Slots + autosave + export.** IndexedDB 3+1 slots, autosave 5min/year, base64 share string, PNG button. `Deps: T-024` · `Accept: reload → load identical (UJ-07); <2s/<3s.` · `Evidence: timing log.`
- [ ] **M5 GATE:** MVP COMPLETE — UJ-01..07 pass; `npm run e2e` green.

## M6 — AAA Render + Feel (FR-R04..07, FR-A01)

- [ ] **T-026 M — Day/night + night windows.** Sun orbit, sky/fog lerp, emissive window atlas + `nightFactor` uniform, lamp glow sprites. `Deps: M5` · `Accept: UJ-08 night shot looks lit; 0 extra real lights.` · `Evidence: day/night screenshots.`
- [ ] **T-027 M — LOD + culling + quality presets.** Chunk culling, building LOD (full/box), Low/Med/High/Ultra + Low-FX (no post). `Deps: T-009` · `Accept: 10k buildings: <200 draws, 30fps+ Med.` · `Evidence: F3 + draw HUD.`
- [ ] **T-028 S — Post-FX.** AA + bloom (subtle) + vignette; toggleable. `Deps: T-027` · `Accept: on/off has <8% fps delta on Med.` · `Evidence: fps compare.`
- [ ] **T-029 M — Audio engine.** WebAudio ambient (wind/traffic by pop) + UI/build/error/disaster stingers + mute/volume. `Deps: M5` · `Accept: mute persists; no autoplay before gesture.` · `Evidence: settings screenshot.`
- [ ] **T-030 M — 256² + perf pass.** Default map 256², object pools, HUD 4Hz throttle, `npm run perf` gates in CI. `Deps: T-027` · `Accept: NFR-01/03 met on ref machine.` · `Evidence: perf log.`
- [ ] **M6 GATE:** beauty + perf — UJ-08 + NFR-01 pass.

## M7 — Polish & Ship (FR-X02..05, FR-A02..03, NFRs)

- [ ] **T-031 M — Tutorial + advisors.** 5-step checklist + 3 rotating advisor tips + click-to-locate alerts. `Deps: M5` · `Accept: new player hits 1k pop <15min (manual script).` · `Evidence: checklist screenshot.`
- [ ] **T-032 M — Services (fire/police/school/clinic/park).** Coverage by road-distance, affects happiness/growth; upkeep. `Deps: T-014` · `Accept: school raises nearby happiness; overlay shows radius.` · `Evidence: screenshot.`
- [ ] **T-033 M — Pollution/crime/health/happiness.** Fields + diffusion + overlays + growth effects. `Deps: T-032` · `Accept: industry pollutes; R nearby abandons if high.` · `Evidence: overlay + test.`
- [ ] **T-034 M — Disasters.** Fire spread + earthquake + meteor trigger + random toggle + rubble/bulldoze loop. `Deps: M5` · `Accept: meteor → rubble → rebuild → recovery (UJ-06).` · `Evidence: screenshots.`
- [ ] **T-035 S — Minimap + notifications.** 128px canvas minimap + queue (info/warn/critical) + settings (quality/FX/autosave/keybinds). `Deps: T-023` · `Accept: click alert → camera jumps.` · `Evidence: screenshot.`
- [ ] **T-036 S — Accessibility + docs.** Keyboard-only build path, colorblind-safe overlays (icons+patterns), keybind list, player FAQ. `Deps: T-035` · `Accept: NFR-05 checklist signed.` · `Evidence: checklist.`
- [ ] **T-037 S — Ship gate.** Full `test+e2e+perf`, bundle <5MB initial, save-migration test, release notes. `Deps: all` · `Accept: all NFRs + UJ-01..08 pass.` · `Evidence: CI log + release tag.`
- [ ] **M7 GATE:** SHIPPED v1.0. Stretch next: transit, scenarios, mods, PWA.

## Stretch Backlog (post-v1, flagged)

- T-101 Transit (bus lines, stops, mode split) · T-102 Road hierarchy (avenue/highway/one-way) · T-103 Scenarios + achievements · T-104 Mod packs (building JSON) · T-105 Flood/season/weather · T-106 PWA offline

## Anti-Rationalization Table (Addy style — read before skipping)

| Excuse | Pushback | Required instead |
|--------|----------|------------------|
| "Too simple for a test" | Sim math breaks silently; UJ needs proof | Add Vitest for any formula in docs/03..05 |
| "Tests later" | Later = never; gates exist for a reason | Tests in same PR, CI must pass |
| "Just one more file in this PR" | 300-line cap keeps review real | Split PR, reference task IDs |
| "FPS is fine on my machine" | NFR-01 is on ref spec, not yours | Show F3 + draw-call HUD evidence |
| "Save compat can break" | Players lose cities = trust lost | Bump version + write migration + test |
| "Skip worker, main thread is OK" | 256² paths will blow 50ms budget | Measure with `npm run perf`, then decide |

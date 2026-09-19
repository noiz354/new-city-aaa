# Current Development State

> Living document (brief §maintenance): updated at every milestone commit.
> Authority for *status*; specs in `docs/01..04`, roadmap in `development-roadmap.md`.
> Kanonis baru: spec di `../spec.md`, roadmap VS-0..VS-9 di `../../roadmap.md`, tasks T-1xx..T-9xx di `../../tasks.md`.
> Reconcile 2026-09-19: hanya VS-0/VS-1 yang `[x]` terverifikasi; klaim selesai lain di dokumen lama = rencana, bukan fakta.

- **Updated:** 2026-09-19 #2 (Asia/Jakarta)
- **HEAD:** T-201 commit (see `git log`)
- **Slices complete:** VS-0, VS-1. **Active:** VS-2a First House (T-201 ✅, T-202 next).

## Slice status

| Slice | State | Evidence |
|-------|-------|----------|
| VS-0 Scaffold | ✅ DONE | `evidence/vs0-smoke.png`, CI green, `perf/baseline.json` |
| VS-1 First tile | ✅ DONE | `evidence/vs1-{boot,built,loaded,persp,bay}.png`, 47 unit + 6 E2E green, coverage 86.6/72.5/82.5 |
| VS-2a First House | 🔨 IN PROGRESS (1/3) | T-201 ✅: 19 unit tests, suite 66/66, coverage 87.1/77.9/85.7, perf dayP95 0.046ms |
| VS-2b..VS-7 | ⬜ QUEUED | — |

## T-201 notes (2026-09-19 #2)

- `src/sim/buildings.ts`: lifecycle store (vacant=absence / construction / occupied / abandoned),
  transisi sesuai `03-game-design/building-and-zoning-systems.md` §2 dalam scope VS-2a: spawn via
  `startConstruction`, completion 3-game-day timer di tick path (`CONSTRUCTION_TICKS=72`, `tuning/buildings.ts`),
  ⇄ occupied↔abandoned via satu pintu `transition()`, `demolishAt` untuk bulldoze/road. Rubble/burning/
  damaged didefer ke T-603. Invariant: occupants>0 hanya occupied; id stabil via free-list.
- Wiring `sim.ts`: onTick growth stage, sweep demolish sebelum bulldoze/road, `snapshot().population`
  kini derived, `hash()` mencakup buildings, `loadState` me-reset store.
- `commands.ts validateZone`: lot ber-bangunan di-skip (design §1 "not occupied") — fix rule.
- **Persistence:** entity section (codec id 4) belum ada → buildings tidak ikut save; by design ditunda
  ke T-202 (belum ada path gameplay yang membuat building). Decoder lama skip section tak dikenal
  (forward-compat); hash sudah mencakup store sehingga round-trip test T-202 akan memaksa kebenaran.
- **Verification:** unit 66/66 (19 baru) · typecheck 0 · lint 0 error · arch OK 47 files · build 815.85kB/
  223.42kB gzip (`<5MB` NFR-02) · coverage 87.08/77.91/85.71 lines-90.97 · perf dayP95 0.046ms (<50ms).
  E2E NOT RUN (belum ada surface UI/player ke buildings; dijalankan di T-203 saat view tersambung).

## VS-1 acceptance (from `vertical-slice-milestones.md`)

1. **Orbit/pan/zoom + pick accurate both cameras** — PASS. E2E `cameras` test: persp center-click lands within 3 tiles of (128,128); wheel-zoom verified by probe (420→1001); right-drag pan + Q/E/R/F + O-toggle smoke-tested, zero console errors.
2. **Road+zone commands with cost/validity** — PASS. Unit (`commands.test.ts`, 8 tests) + E2E real-mouse drags with toast receipts; treasury math cross-checked on screenshot ($20,000 − $625 − $480 − … = $18,425).
3. **Save→load hash-equal (E2E)** — PASS. `save -> reload -> load` test: `hashB === hashA`, counts equal; OPFS driver active in-browser.
4. **Same-seed terrain identical** — PASS. `world.test.ts` determinism test (equal arrays; different seeds differ).
5. **Corpus v1 green** — PASS (unit-level). `codec.test.ts`: round-trip, save→continue equivalence, CRC/version rejection, unknown-section forward-compat repair note. Binary save-corpus files deferred to the VS-7 migration gate.

Visual standards (VS-1: flat-shaded terrain + water + zone colors; no z-fighting; pixel-accurate hover) — PASS, all 5 screenshots human-inspected.

## Measured vs budget (all MEASURED, headless Chromium + SwiftShader, node 20)

| Metric | Budget | Measured | Notes |
|--------|--------|----------|-------|
| Sim day p95 (hamlet) | <50 ms | **0.14 ms** | `perf/results.json` |
| Hamlet build | <3000 ms | **4.2 ms** | incl. 400 roads + 576 zones |
| Heap (perf run) | <512 MB | **11 MB** | node |
| Coverage lines/branches/funcs | 80/70/80 | **86.6/72.5/82.5** | sim+shared+persistence |
| Draws/tris @boot (256²) | — (VS-5) | 3 / 262k | terrain+water+zones |
| E2E wall time | — | ~4.2 min / 6 tests | SwiftShader-bound, not app-bound |
| Render fps | — (VS-5) | 4 fps headless | **SwiftShader artifact**; GPU fps unmeasured (no GPU in sandbox) |

Estimates: none currently open. GPU frame-rate is NOT YET MEASURED (sandbox has no GPU).

## Deviations from docs (with justification)

1. **React 19.3.0** (state-management.md says 18): greenfield, no 18-only deps; 19 stable. Panels-only usage unchanged.
2. **TypeScript 5.9.3** (not 7.x): typescript-eslint 8.70 peer-caps TS <6.1; typed linting required by T-043.
3. **Vite 8.3.0**: latest; required dropping the object-form `manualChunks` (rolldown types) — revisited in perf slice.
4. **`.npmrc` `legacy-peer-deps=true`**: npm 10.8 arborist crashes on vitest-5 strict peer resolution; exact pins intact.
5. **Dependency inversion via `WorldView`/`CommandHost`/`SaveSource`** (shared/types.ts): the only compliant reading of module-boundaries §2 (view/ui/persistence ✗→sim); `import type` exempted (D-B3).
6. **New module `src/testing/`** (fixtures): logged as D-B3 in module-boundaries.md per its own rule.
7. **`SLOPE_BUILD_MAX=0.035`, `ROCK_SLOPE=0.04`**: tuned from measured slope distributions (see world.ts comment), not guessed.
8. **Float accumulator boundary behavior**: identical dt sequences are exactly deterministic; equal totals via different chunkings match except sub-tick boundary residue (documented in determinism tests).

## Skills activated (by actual name, this slice)

`roadmap-executor` (slice loop) · `tdd` (tests alongside code) · `diagnosing-bugs` (5 root-caused failures: mask invariant, seed restore, fixture budget, float residue, rig/store desync) · `three-best-practices` (disposal, instancing, merged chunks, `setAnimationLoop`) · `webapp-testing` + `visual-qa` (6 E2E, 5 inspected screenshots) · `codebase-design` (WorldView/CommandHost inversion).

## How to run

`npm run ci` (lint+arch+licenses+typecheck+test+build) · `npm run e2e` · `npm run perf` · `npm run dev` → http://localhost:5173 (`?seed=11&preset=bay` for fixed maps).

## Known limitations (VS-1 exit)

- No GPU in sandbox: real frame-rate, and the 10-min visual soak, are unmeasured (tracked for VS-5).
- E2E is slow (~4 min, SwiftShader); consider a `?size=64` fast-boot param if VS-2 suites grow.
- Binary save-corpus files deferred to VS-7 migration gate (codec forward-compat covered by unit test).
- `world.ts` is 326 lines (soft-cap 300 warn); split when systems land (VS-3+).

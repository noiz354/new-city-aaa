# Current Development State

> Living document (brief §maintenance): updated at every milestone commit.
> Authority for *status*; specs in `docs/01..04`, roadmap in `development-roadmap.md`.
> Kanonis baru: spec di `../spec.md`, roadmap VS-0..VS-9 di `../../roadmap.md`, tasks T-1xx..T-9xx di `../../tasks.md`.
> Reconcile 2026-09-19: hanya VS-0/VS-1 yang `[x]` terverifikasi; klaim selesai lain di dokumen lama = rencana, bukan fakta.

- **Updated:** 2026-09-19 #12 · 2026-09-20 #3 (Asia/Jakarta)
- **HEAD:** T-306 — balancing suite S-green + tuning lock (growth budget N + cohort employment ceiling)
- **Slices complete:** VS-0, VS-1, **VS-2a ✅ (engine + visual — `npm run e2e` 8/8 hijau di sandbox).**
  VS-3: T-301..T-306 ✅ (economy + cohort + balancing). Gate: UJ-01/UJ-02/UJ-05 + fase-2 (power) tersisa.

## Slice status

| Slice | State | Evidence |
|-------|-------|----------|
| VS-0 Scaffold | ✅ DONE | `evidence/vs0-smoke.png`, CI green, `perf/baseline.json` |
| VS-1 First tile | ✅ DONE | `evidence/vs1-{boot,built,loaded,persp,bay}.png`, 47 unit + 6 E2E green, coverage 86.6/72.5/82.5 |
| VS-3 Economy | ✅ ENGINE DONE (T-301..T-306) | T-301 ✅ · T-302 ✅ (sliders+v2 migrasi) · T-303 ✅ (`evidence/vs3-t303-budget-panel.png`) · T-304/305 ✅ cohort · T-306 ✅ S-green suite + `tuning/CHANGELOG.md`; suite 156/156 |
| VS-2a First House | ✅ DONE | T-201..T-208 ✅ · `evidence/vs2a-*.png` (8 capture) · suite 142/142 · e2e 8/8 · dayP95 ≤ budget |
| VS-2b..VS-7 | ⬜ QUEUED | — |

## VS-2a evidence pass (2026-09-19 #12)

- **Browser unblocked in the sandbox:** Playwright CDNs stay ECONNRESET, but the npm registry is reachable, so a
  Chromium 153 build shipped as an npm package (`@sparticuz/chromium`, installed in `/tmp`, NOT a project
  dependency) runs headless with WebGL2 via ANGLE/SwiftShader. `playwright.config.ts` reads `PW_CHROMIUM_PATH`
  and applies the serverless flag set (no zygote, in-process GPU; **not** `--single-process`, which killed the
  browser after every WebGL page). Managed-Chromium behaviour unchanged when the env var is unset.
- `e2e/vs2a-evidence.spec.ts`: real-browser playthrough (seed 25) — R/C zoned → Pop 36 @ D13 → I zoned → month
  tick (Δtreasury ≡ income − upkeep + subsidy, asserted exactly) → V overlay (value near I < near R) → B panel
  (numbers = ledger) → save → reload → load (hash-equal) → continue. Screens: `evidence/vs2a-t202-before.png`,
  `vs2a-t202-after-pop-hud.png`, `vs2a-t203-houses-closeup.png`, `vs2a-t204-no-road-icon.png`,
  `vs2a-t205-month-tick-hud.png`, `vs2a-t207-value-overlay.png`, `vs3-t303-budget-panel.png`,
  `vs2a-gate-loaded.png`. All human-inspected. `npm run e2e` 8/8 (vs1 6 + vs2a + evidence) in 4.5 min.
- **Capture-found bugs, all fixed with RED→GREEN tests:**
  1. `view/buildings.ts` + `view/icons.ts` never refreshed the InstancedMesh bounding sphere after `setMatrixAt`
     → three.js culled the whole layer once the camera left the world origin (icons vanished in the T-204
     close-up, draws 4→3). New `view/instancing.ts` (expand on place, refresh on remove/sync/grow) +
     `instancing.test.ts` (frustum away from origin must still intersect the mesh).
  2. `BudgetPanel` Net = income − gross upkeep, but the treasury moves by income − (gross − Frontier subsidy):
     `MonthLedger.subsidy` now flows through `snapshot.lastMonth/history`, panel shows the subsidy row,
     `economy.test.ts` asserts Δbalance ≡ income − expense + subsidy. Escape now closes the panel.
  3. `Sim.loadState` did not recompute derived demand; growth reads demand *before* the daily recompute, so the
     first post-load day used the bootstrap vector (HUD showed C +2 vs +3 pre-save). `codec.test.ts` now
     asserts `demand.target()` equality after load.
- UX: F3 overlay moved to bottom-left (the grown TopBar hid the treasury behind it); `View.focusTile` /
  `CameraRig.focus` added (evidence framing now, click-to-locate in T-605).
- **Balancing observation (owner T-304/T-305, not a blocker):** the v0 growth pass gives its single daily spawn to
  the highest-demand zone (bootstrap I +17 > R +7 > C +2) — a city zoned R+C+I on day 1 builds ~all I lots
  before the first house. The evidence playthrough zones R first (UJ-01 order); the jobs→R coupling in T-305 is
  the canonical remedy.
- Sandbox notes: SwiftShader ≈ 4 fps (frame clamp 250 ms) — specs fast-forward the sim synchronously through
  `sim.update(250)` instead of waiting on wall-clock speed; first-frame shader compile can exceed 5 s (vs1 F3
  assertion timeout raised to 30 s); Playwright wipes `test-results/` per run → accepted PNGs are copied to
  `docs/05-execution/evidence/`.

## T-207 notes (2026-09-19 #8)

- `src/sim/fields.ts` + `tuning/fields.ts`: land value v0 penuh — base per-terrain, halo air (r3 w20),
  forest/trees (r3 w10), polusi I-occupied per-level (30/90/180 → anchor utilities §3 "depresses ≥15"
  terverifikasi test), 2-pass separable 3×3 blur harian (fields stage pasca-growth, pre-ekonomi —
  frozen order §2), clamp 0..100, water pinned 0. Derived tanpa persist; save/load → invalidateStatic
  + recompute (parity test hijau).
- **Desirability effects:** growth score × landFit (docs/03 §3) — R/C high-value seekers, I cheap-land;
  test membuktikan R menghindari sisi plume meski kalah tile-index (tiebreak idx tidak lagi absolut).
  SPAWN_T + rng jitter belum (full §3 scorer milik upgrade-path; ledger di growth.ts).
- **Perf engineering (gate-driven):** split staticBase (terrain+halo, rebuild saat load saja) →
  stamp harian hanya I-occupied; skip via pollutionSig (count×65536 ⊕ Σ(id+1)); bug temuan:
  signature kosong-vs-id-0 collision menimbulkan skip palsu (test plume menangkapnya).
  dayP95 2.76 → **0.7365ms** vs budget 1.4312 (results.json terukur).
- **Park halo:** engine seam + test ("park menaikkan value sekitar" terverifikasi via injeksi).
  TAPI placement pemain = state persist baru = save-format change → **§9 ask-first diajukan,
  user skipped 2026-09-19** → T-207 ditahan PARTIAL sampai keputusan; codec section-5 pattern siap.
- Overlay: `src/view/landvalue.ts` (ramp brown→green cektur, row-mapping ikuti ZoneOverlay, toggle
  Default hidden; TopBar "Value" + tombol keyboard V; refresh 4Hz via snapshot pump, no-op saat hidden).
- **Verifikasi:** suite **131/131** (fields 7, landvalue overlay 3) · lint/typecheck/arch(67)/build/perf
  hijau · determinisme & load parity hijau (derived). e2e screenshot: BLOCKED lingkungan (identik).
- Catatan lingkungan: .git lokal pernah rollback ke base commit saat snapshot boundary (branch remote
  tetap utuh); pemulihan FF dari FETCH_HEAD hmk --ff-only (tanpa reset) — moved-work diwuilayahkan
  pada commit T-207 segera (durability > ukuran).

## T-206 notes (2026-09-19 #7)

- `src/sim/demand.ts` + `tuning/demand.ts`: formula kanonis docs/03-simulation-core §2 apa adanya
  (R = 60(1−unemp)+30h−40tax−25vacR+20jobs−50; C = 50popF+20h−40tax−25vacC+10;
  I = 55workforce+25(1−taxI×1.2)−25vacI+5; clamp ±100). Bootstrap @9%: **R +7, C +2, I +16.5** (hitung-tangan
  terverifikasi test) — VS-2a tetap tumbuh; I kini spawn dari zone pertama (stub-zero T-202 dihapus).
- **Keputusan interpretasi v0 (ledger di header modul, tercatat tasks.md T-206):**
  (1) `smoothing 0.2/day` DICUT — momentum = persisted state baru = perubahan format save = spec §9
  ask-first; pengganti: **recompute di akhir growth stage** (post move-in) dengan lag gate 1 hari —
  awalnya recompute pra-growth menyebabkan "flicker satu hari" (rumah fresh-complete terlihat vacant 1 hari,
  pacing test + vacancy test menangkap perilaku ini); (2) `vacancy` "emptyZoned/totalZoned" mustahil
  bootstrap (kota baru = 1 → semua demand negatif → VS-2a tak terpenuhi) → v0: **R dwelling vacancy**
  = occupied-dgn-occupants-0 ÷ occupied-R; C/I = 0 (T-305 owns); (3) stubs: unemp/jobs/workforce = 0 (T-305),
  happy = 0.5 (VS-3), tax 9% (T-301), `?` terms dropped.
- Integrasi: `Demand` di Sim (ctor compute, recompute harian end-of-stage), growth diberi demand ref;
  `snapshot.demand` int-rounded → RCI bars TopBar (`rci-r/c/i` tint pos/neg). Determinisme & load parity
  hijau (demand derived → nol perubahan codec).
- **Verifikasi:** suite **121/121** (demand 10, growth +1 pengganti stub) · **branch coverage demand.ts
  94.1% (16/17)**, statements 96.7% (acceptance: ≥80% — TERUKUR v8 json, bukan dugaan) · lint/typecheck/
  arch(62)/build/perf hijau. Catatan: perf gagal **hanya** di mode coverage (instrumentasi) — standalone PASS
  (diverifikasi langsung).
- Skills dipakai: `city-builder-simulation-audit` (tick-order & determinisme), `tdd` (formula authoritative,
  RED→GREEN, fail→temuan desain→fix ordering).

## T-205 notes (2026-09-19 #6)

- `src/sim/upkeep.ts` + `tuning/upkeep.ts`: monthly per-building upkeep — kanonis docs/03-simulation-core
  (Upkeep/mo R1..3=2/6/15, C=4/12/30, I=6/18/45) + docs/05 B1/B3/B6. Roads floor(N×½). Frontier subsidy
  <500 pop → bayar floor(gross×7/10). Semua integer (B1 hukum). Economy stage pasca-growth per frozen order
  §2 (`… → growth → fields-commit → economy(monthly) → events-out`); `TICKS_PER_MONTH=720` di clock.
- Aturan observable (dok: silent → diputus & terdokumentasi di header): occupied+abandoned bayar;
  construction bayar nol; bill DERIVED per pass (tak dipersist) — bulldoze menghentikan biaya pass berikutnya.
  Debit via `economy.add(-net)` bukan `spend` — upkeep tak pernah di-block affordability; balance bisa
  negatif (bankruptcy block = T-301). Event `treasury-changed` di-push saat net≠0 (HUD TopBar mengalir otomatis
  via snapshot 250ms — tidak ada kode UI baru).
- Scope guards: tax income = T-206/T-301; upkeep plant/air/servis datang bersama slice masing-masing (VS-3..VS-5).
- RED-first: 7/10 gagal bermakna sebelum implementasi; 3 incidental (empty-city/determinism/load) tetap hijau.
  Geografi test subsidy-tersingkir disetting 2 road paralel (semua lot ≤2 — aturan T-204 berlaku).
- **Verifikasi:** suite 111/111 (upkeep 10: parts kanonis, 17 tepat bersubsidi, 297 penuh ≥500 pop dgn 135 rumah,
  event, negatif-boleh, bulldoze-stop, hash-deterministik, load parity) · lint 0 · typecheck 0 · arch OK 59 ·
  build pass · perf dalam budget. HUD screenshot: BLOCKED lingkungan (identik T-202..T-204).
- Skills dipakai: `city-builder-simulation-audit` (invariant money integer-exact §3, frozen tick order),
  `tdd` (RED→GREEN, seam = Sim snapshot/drainEvents + monthlyBill).

## T-204 notes (2026-09-19 #5)

- Rule kanonis (transportation-and-pathfinding §1): attachment = ada road dalam radius **Manhattan ≤2** —
  supersede adjacency-4 v0 (gap-analysis R-01). T-401 akan mengganti probe ke graph-edge tanpa mengubah kontrak.
- `src/sim/road-access.ts`: `isConnected` pure probe; flag blocked = state TURUNAN (tanpa persist),
  dihitung harian **inkremental** (dirty rect ±2 dari `noteRect` pada 3 jalur mutasi sim.execute) — full scan
  65k tile pertama menyebabkan perf regression dayP95 2.14 > 1.43 (budget +10%) sehingga diganti; flip →
  event `road-access-changed`; `recomputeForLoad` silent rebuild; `collectBlocked` untuk resync view.
- Growth rewired: spawn + move-in gate pada `isConnected`; konstruksi organik pada lot terputus DIBATALKAN
  pada pass harian (design-doc §2; tanpa payer → tanpa refund). Occupied tak menjadi abandoned karena kehilangan
  road (§3.4 tidak memuat aturan road) — penduduk tetap, move-in menunggu koneksi ulang.
- Ikon: `src/view/icons.ts` InstancedMesh octahedron merah unlit (MeshBasicMaterial — tanpa light tambahan,
  sesuai batasan §9), proyeksi murni: deltas via drain, `sync` pasca-load; `view.ts`/`main.ts` wired.
  Inspector: row `Growth blocked` = reason sim-owned (`growth.growthBlockReason` + `roadAccess.blockedReason`).
- **Verifikasi:** suite 101/101 (road-access 11, icons 5) · lint 0 · typecheck 0 · arch OK · build pass ·
  perf dayP95 ≤ budget setelah inkremental · determinisme hash load-equal. e2e `vs2a.spec.ts` siap;
  playwright.config disinkronkan ke port dev aktual 5180.
- **BLOCKED (lingkungan):** screenshot ikon — identik T-202/T-203 (tanpa browser; CDN/mirror diblokir).
- Skills dipakai: `city-builder-simulation-audit` (rule kanonis §1), `three-best-practices` (instancing), `tdd`.

## T-203 notes (2026-09-19 #4)

- `src/view/buildings.ts` (BuildingLayer): 2 draw call konstan (scaffold + house procedural
  walls+hip-roof merge), mapping state→mesh: construction=scaffold, occupied=house terang,
  abandoned=house gelap (tetap 1 instance), demolish=swap-remove dense. `apply()` delta dari
  event, `sync()` rebuild dari save (boot/load), capacity grow ×2. View tetap proyeksi murni.
- Wiring: `view.applyEvents(sim.drainEvents())` tiap frame di `main.ts`; `view.syncBuildings` pasca-load.
- Verifikasi: 85/85 unit (7 headless BuildingLayer: tile position, denseness, grow, sync idempoten,
  2-mesh bound) · typecheck 0 · lint 0 · arch OK 52 · build 828.03kB/226.61kB gzip · dev 200 OK
  (page + transform buildings.ts + addons rewrite). Screenshot/visual: BLOCKED (lingkungan, lih. bawah).
- Skills dipakai: `three-best-practices` (instancing/disposal/frustum), `tdd`, `city-builder-simulation-audit`.
  Inspector "growth blocked" reasons: seam siap (`growth.growthBlockReason`), konsumsi di T-204.

## T-202 notes (2026-09-19 #3)

- `src/sim/growth.ts` + `tuning/growth.ts`: scoring harian day-boundary (eligibility = zoned+vacant+
  road-adjacency v0+demand>0; tie-break idx; pacing 1/hari), move-in capacity (R L1 = 4; C/I = 0 sampai
  T-305). Demand R stub = 1 menanti engine T-206. Powered/watered dianggap serviced sampai VS-4 (terdokumentasi).
- Persistence T-202: codec `SECTION_ENTITIES=4` (sver 1, per-slot biner; id stabil). Save lama tanpa
  section → repairs note + buildings kosong; decoder lama skip section 4 (forward-compat); `SAVE_VERSION`
  tetap 1 — strategi per-section, bukan bump, karena semua section skippable (lihat header codec).
- `building-changed` SimEvent (0/1/2/3) mengalir sim→drainEvents untuk konsumen T-203 (instancing swap).
- Deviasi berencana: desain §2 "road removed mid-build → refund+cancel" belum diimplementasi — dimiliki
  T-204 (road-access rule penuh); v0 adjacency diganti path di task yang sama.
- **Verifikasi:** 78/78 unit (growth 9, codec +2, buildings +1) · typecheck 0 · lint 0 · arch OK 50 files ·
  build 820.19kB/224.77kB gzip · perf dayP95 0.716 ms (<50 ms; baseline.json direfresh, tick avg 7.7 µs) ·
  determinisme chunk 250 vs 125 ms hash-equal · dev server 200 OK (root, modul, host preview e2b).
- **BLOCKED (lingkungan):** screenshot before/after + e2e apa pun — sandbox tanpa browser; unduhan Chromium
  gagal (ECONNRESET semua CDN/mirror). Semua bukti visual VS-2a menunggu mesin/CI ber-browser (VS-2 GATE).

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

`npm run ci` (lint+arch+licenses+typecheck+test+build) · `npm run e2e` · `npm run perf` · `npm run dev` → http://localhost:5180 (`?seed=11&preset=bay` for fixed maps).

**E2E in a sandbox without Playwright's browser download** (npm registry reachable, CDNs blocked):

```sh
mkdir -p /tmp/chromium-probe && cd /tmp/chromium-probe && npm init -y >/dev/null && npm i @sparticuz/chromium@153.0.0
node -e "import('@sparticuz/chromium').then(async m=>{console.log(await m.default.executablePath()); await m.inflate('/tmp/chromium-probe/node_modules/@sparticuz/chromium/bin/al2023.tar.br')})"
cd <repo> && PW_CHROMIUM_PATH=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib FONTCONFIG_PATH=/tmp/fonts npm run e2e
```

(Chromium 153 matches Playwright 1.63's expected build; the `al2023` lib bundle supplies libnss3/libnspr4.)

## Known limitations (VS-1 exit)

- No GPU in sandbox: real frame-rate, and the 10-min visual soak, are unmeasured (tracked for VS-5).
- **(2026-09-19 #3 → resolved #12)** Playwright CDN still unreachable, but an npm-distributed Chromium runs
  headless with SwiftShader WebGL2 (see How to run) — E2E/visual evidence is no longer blocked.
  `vite.config.ts` sets `allowedHosts: true` for proxied previews.
- E2E is slow (~4 min, SwiftShader); consider a `?size=64` fast-boot param if VS-2 suites grow.
- Binary save-corpus files deferred to VS-7 migration gate (codec forward-compat covered by unit test).
- `world.ts` is 326 lines (soft-cap 300 warn); split when systems land (VS-3+).

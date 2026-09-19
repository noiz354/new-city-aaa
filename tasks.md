# TASKS — city-builder-aaa (kanonis)

> **Status:** canonical. Setiap task = satu sesi fokus, satu PR (<300 baris), dengan **acceptance + evidence**.
> Jangan mulai T berikutnya sebelum T berjalan dikonfirmasi bekerja.
> Ukuran: **S** (<1 jam) · **M** (1–3 jam) · **L** (3–6 jam). `Deps` wajib selesai dulu.
> Aturan centang: `- [ ]` → `- [x]` **hanya** setelah gate DoD lolos + bukti dilampirkan
> (`05-execution/definition-of-done.md`, `05-execution/verification-strategy.md`).
> Rujuk ID FR di `docs/spec.md` + modul di `02-architecture/` pada setiap PR.
> Skill aktual per )).group lih. `docs/06-agent-skills/skill-task-mapping.md`
> (nama generik seperti `simulation-core`/`threejs-rendering` **tidak ada** — pakai nama di bawah).
>
> **Status reconcile (2026-09-19):** VS-0 dan VS-1 `[x]` terverifikasi (bukti: typecheck/build/test hijau,
> dev 200 OK port 5180, save hash-equal, F3 overlay — lih. `docs/05-execution/current-development-state.md`).
> Update 2026-09-19 #2: **T-201 `[x]`** (19 test baru hijau; VS-2a dimulai). Selain itu semua tahap lain `[ ]` —
> termasuk yang disebut di dokumen lama seolah selesai.

## VS-0 — Foundation (T-1xx)

- [x] **T-101 S — Scaffold + commands.** Vite + TS strict + ESLint + Vitest + Playwright skeleton.
  `Deps: —` · `Accept: npm run dev|typecheck|test|build pass.` · `Evidence: terminal log.` · `Skills: tdd, codebase-design`
- [x] **T-102 S — Kontrak sim/view + clock.** Fixed-step accumulator, pause/1x/2x/3x, day counter, F3 overlay (fps + tickMs).
  `Deps: T-101` · `Accept: speed mengubah ticks/sec; render decoupled.` · `Evidence: F3 screenshot.` · `Skills: tdd`
- [x] **T-103 S — Grid SoA + terrain seeded.** Typed-array grid (flag 256), noise terrain + water plane.
  `Deps: T-101` · `Accept: seed sama → identik; seed beda → beda.` · `Evidence: 2 screenshot seed sama.` · `Skills: tdd`

## VS-1 — First Tile (T-104..T-110)

- [x] **T-104 M — Renderer + kamera.** Scene, ACES, fog, hemi+dir light, rig Ortho↔Persp damped orbit/pan/zoom.
  `Deps: T-101` · `Accept: ground plane kosong, toggle kamera, 60fps.` · `Evidence: screenshot + fps.` · `Skills: three-best-practices`
- [x] **T-105 M — Picking + highlight.** Raycast-to-plane → koordinat tile, hover highlight, inspector stub.
  `Deps: T-104` · `Accept: hover tampil (x,y); dua kamera.` · `Evidence: screenshot.` · `Skills: three-best-practices, webapp-testing`
- [x] **T-106 M — Toolbar + tool state.** Select/Road/R/C/I/PowerLine/Plant/Water/Bulldoze + Esc cancel + cost stub.
  `Deps: T-105` · `Accept: ganti tool + label kursor.` · `Evidence: screenshot.` · `Skills: frontend-ui-engineering, city-builder-visual-qa`
- [x] **T-107 M — Road placement.** Drag-line preview validitas hijau/merah, cost = length×price, tulis road layer.
  `Deps: T-106` · `Accept: drag L-shape bekerja; dana terpotong.` · `Evidence: screenshot + treasury log.` · `Skills: city-builder-playability-test`
- [x] **T-108 M — Zone painting + bulldoze.** Drag-rect R/C/I + marquee bulldoze; chunk dirty flag.
  `Deps: T-106` · `Accept: zona berwarna; bulldoze membersihkan.` · `Evidence: screenshot.` · `Skills: city-builder-playability-test`
- [x] **T-109 M — Instanced meshers dasar.** Terrain 1-draw + road merge + InstancedMesh bangunan + pohon.
  `Deps: T-103,T-107` · `Accept: 2k zona render, draw call <100.` · `Evidence: draw-call HUD.` · `Skills: three-best-practices, city-builder-performance-gate`
- [x] **T-110 M — Save format v1 + HUD dasar.** Header + binary layers + entities, gzip + hash; topbar/toolbar/inspector.
  `Deps: T-103` · `Accept: save→load hash equal pada fixture.` · `Evidence: vitest log.` · `Skills: tdd, city-builder-playability-test`
- [x] **VS-1 GATE:** orbit + select @60fps map kosong; `npm run test` hijau; dev 200 OK `:5180`.

## VS-2 — First Living City (T-2xx) — NEXT

> Slice pertama: **VS-2a First House** = T-201..T-203 (satu rumah tulus tumbuh, bukan hardcode).

- [x] **T-201 M — Building lifecycle state.** State machine vacant→construction→occupied→abandoned + entity `buildings[]` terisi.
  `Deps: VS-1 GATE` · `Accept: transisi terdokumen + unit test tiap transisi.` · `Evidence: vitest log (buildings.test.ts 19/19, suite 66/66, 2026-09-19).` · `Skills: city-builder-simulation-audit, tdd`
  Selesai: `src/sim/buildings.ts` (transisi kanonis design-doc §2, scope VS-2a; timer 3 hari via tuning), wiring `sim.ts`
  (onTick, sweep bulldoze/road, snapshot.population, hash, loadState reset), rule "not occupied" di `validateZone`.
  Persistence entity (codec section 4) menyusul T-202 — terdokumentasi di header modul.
- [ ] **T-202 M — Growth engine v0.** Scoring harian → spawn 1 rumah pada tile zoned+road+powered dalam ~10 game-day.
  `Deps: T-201` · `Accept: pop>0; screenshot before/after.` · `Evidence: screenshot + pop HUD.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
  - **Status: PARTIAL (2026-09-19).** Sim+persistence PASS: `src/sim/growth.ts` (scoring harian, eligibility
    road-adjacency v0, pacing 1/hari, move-in capacity; powered/watered v0=serviced sampai VS-4), entity
    section 4 di codec (round-trip hash-equal; pre-entity save → repair note + empty), event
    `building-changed`; suite 78/78, determinisme 250/125ms hash-equal, perf dayP95 0.716ms≪50ms
    (baseline direfresh via UPDATE_BASELINE=1). pop>0 TERBUKTI deterministic di test (occupied L1 R=4).
  - **Remaining:** screenshot before/after + pop HUD. **Blocker: lingkungan** — sandbox tak bisa
    mengunduh Chromium (ECONNRESET ke cdn.playwright.dev + mirror), tidak ada browser sistem.
    Dev server 200 OK (root+modul, preview host) terverifikasi via curl. Unblock: mesin/CI ber-browser.
- [ ] **T-203 M — Visual rumah + instancing.** Procedural house mesh + InstancedMesh swap saat spawn; 0 crash bila aset hilang.
  `Deps: T-202` · `Accept: rumah terlihat di tile tumbuh.` · `Evidence: screenshot.` · `Skills: three-best-practices, city-builder-visual-qa`
  - **Status: PARTIAL (2026-09-19).** `src/view/buildings.ts`: 2 InstancedMesh (scaffold/house procedural,
    tint abandoned, swap-remove dense, capacity grow ×2, rotasi fasad deterministik) — murni proyeksi state sim
    (deltas via `building-changed`, rebuild via `sync`), nol aset eksternal (crash-by-missing-asset mustahil by
    construction). Wiring `view.ts` + `main.ts`; 7 unit test headless (positions/denseness/grow/sync idempoten/2 draws);
    suite 85/85; build 828KB/226.6KB gzip; dev 200 OK.
  - **Remaining:** screenshot "rumah terlihat di tile tumbuh". **Blocker: lingkungan** (sama dgn T-202:
    tanpa browser + CDN Playwright ECONNRESET). Unblock: mesin/CI ber-browser.
- [ ] **T-204 M — Road-access rule.** Tanpa path → ikon "No road connection", growth berhenti.
  `Deps: T-202` · `Accept: zona terisolasi tidak tumbuh + ikon tampil.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
  - **Status: PARTIAL (2026-09-19).** Rule kanonis (transportation §1: attachment Manhattan ≤2, T-401 upgrade
    ke graph-edge) terimplementasi penuh: `src/sim/road-access.ts` (probe `isConnected`, flag harian inkremental
    via `noteRect`, flip→event `road-access-changed`, `collectBlocked`), growth rewired (spawn/move-in/cancel
    mid-build per design-doc §2), save-load recompute. 11 sim test hijau (radius 1/2/diagonal/3, blok permanen,
    cancel saat road hilang, reconnect→move-in, dua jaringan independen, load-restore, determinisme hash);
    perf dayP95 2.14ms direkondisikan → tetap ≤1.43ms (full-scan diganti inkremental ±2 setelah regression
    budget tercatat). Ikon: `src/view/icons.ts` (InstancedMesh octahedron unlit, proyeksi murni: deltas +
    `sync` pasca-load) + 5 unit test; Inspector menampilkan reason sim-owned; e2e `vs2a.spec.ts` siap.
    Suite 101/101; lint/typecheck/build + arch bersih.
  - **Remaining:** screenshot ikon di atas zona terisolasi (`npm run e2e` → `test-results/t204-no-road-icon.png`).
    **Blocker: lingkungan** (sama dgn T-202/T-203: CDN Playwright + mirror apt diblokir, tanpa browser sistem;
    playwright.config disinkronkan ke port 5180 dev aktual). Unblock: mesin/CI ber-browser.
- [ ] **T-205 M — Upkeep tick.** Upkeep bulanan per bangunan; treasury berkurang terukur + unit test.
  `Deps: T-202` · `Accept: month tick mengubah $ benar.` · `Evidence: test log + HUD.` · `Skills: city-builder-simulation-audit, tdd`
- [ ] **T-206 M — RCI demand v0.** Demand −100..+100 dari unemployment/happiness/tax; RCI bar HUD merespons.
  `Deps: T-205` · `Accept: 80% branch coverage fungsi demand.` · `Evidence: vitest log.` · `Skills: city-builder-simulation-audit, tdd`
- [ ] **T-207 M — Land value v0 + desirability.** Base − pollution + halo park/air; difusi 3×3; overlay.
  `Deps: T-202` · `Accept: park menaikkan value sekitar; overlay gradien.` · `Evidence: overlay screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-208 S — HUD pop/RCI(p4).** Populasi + RCI bar + jobs + unemployment selalu terlihat; update 4Hz.
  `Deps: T-206` · `Accept: angka berubah saat kota tumbuh.` · `Evidence: HUD screenshot.` · `Skills: frontend-ui-engineering`
- [ ] **VS-2 GATE:** UJ-01 + UJ-02 partial (rumah/shop spawn, pop tumbuh, $ tick).

## VS-3 — Economy That Bites (T-3xx)

- [ ] **T-301 M — Treasury monthly tick penuh.** Tax income − upkeep − service funding; bankrupt block + modal.
  `Deps: VS-2 GATE` · `Accept: month tick benar (unit test).` · `Evidence: test log.` · `Skills: city-builder-simulation-audit, tdd`
- [ ] **T-302 M — Slider pajak R/C/I.** 0–20% (default 9%); income = Σ level×rate×happinessFactor.
  `Deps: T-301` · `Accept: 15% → income↑ happiness↓ (UJ-05 partial).` · `Evidence: screenshot + test.` · `Skills: frontend-ui-engineering`
- [ ] **T-303 M — Budget panel.** Breakdown income/expense + sparkline 12 bulan + slider funding service.
  `Deps: T-301` · `Accept: panel akurat vs sim.` · `Evidence: screenshot.` · `Skills: vercel-react-best-practices, frontend-ui-engineering`
- [ ] **T-304 M — RCI demand matang.** Bobot unemployment/happiness/land/tax final + unit test.
  `Deps: T-302` · `Accept: R+C+I → unemployment <20%.` · `Evidence: HUD screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-305 M — Citizens + jobs (cohort).** Resident/job count, gravity match, unemployment + happiness.
  `Deps: T-304` · `Accept: kota R+C+I unemployment <20%.` · `Evidence: HUD screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-306 M — Balancing suite + tuning lock.** Korpus skenario ekonomi hijau; angka tuning dikunci.
  `Deps: T-305` · `Accept: suite hijau.` · `Evidence: CI log.` · `Skills: city-builder-simulation-audit, city-builder-performance-gate`
- [ ] **VS-3 GATE:** UJ-01 + UJ-02 penuh; UJ-05 lolos.

## VS-4 — Traffic & Utilities (T-4xx)

- [ ] **T-401 M — Road graph builder.** Node/edge dari road tile, rebuild incremental; unit test T-junction + loop.
  `Deps: VS-3 GATE` · `Accept: graph cocok fixture.` · `Evidence: vitest log.` · `Skills: tdd, city-builder-simulation-audit`
- [ ] **T-402 L — A* + cache + worker.** Binary-heap A*, bobot BPR, cache O-D, offload worker; harness `npm run perf`.
  `Deps: T-401` · `Accept: 500 path <100ms; deterministik seed sama.` · `Evidence: perf log.` · `Skills: tdd, city-builder-simulation-audit`
- [ ] **T-403 M — Traffic assignment + viz.** Volume → v/c → warna LOS + alert congestion.
  `Deps: T-402` · `Accept: 1 jalan macet (merah); paralel melegakan (UJ-03).` · `Evidence: 2 overlay screenshot.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
- [ ] **T-404 M — Visual agent pool.** 500 mobil + 300 pejalan sampling top flow; headlight malam.
  `Deps: T-403` · `Accept: mobil di jalan sibuk, 0 saat pause.` · `Evidence: screenshot.` · `Skills: three-best-practices`
- [ ] **T-405 M — Power flood fill.** Plant + line/road hantar; supply/demand per net; brownout I-first; overlay + ikon.
  `Deps: T-401` · `Accept: overload → ikon unpowered; plant ke-2 pulihkan (UJ-04).` · `Evidence: overlay screenshot.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
- [ ] **T-406 M — Water + pressure.** Tower/pump + pipe/road; falloff jarak/beban; unwatered hentikan growth.
  `Deps: T-405` · `Accept: bangunan jauh unwatered sampai tower ke-2.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-407 S — Overlay utilitas.** Tab power/water/traffic/value + inspector akurat.
  `Deps: T-403,T-405` · `Accept: semua overlay render.` · `Evidence: screenshots.` · `Skills: frontend-ui-engineering, city-builder-visual-qa`
- [ ] **VS-4 GATE:** UJ-03 + UJ-04 lolos.

## VS-5 — Render Tier & Feel (T-5xx)

- [ ] **T-501 M — Day/night + night windows.** Orbit matahari, lerp sky/fog, atlas emissive + uniform `nightFactor`, glow lampu.
  `Deps: VS-4 GATE` · `Accept: night shot menyala; 0 real light tambahan (UJ-08).` · `Evidence: screenshot day/night.` · `Skills: three-best-practices, city-builder-visual-qa`
- [ ] **T-502 M — LOD + culling + preset.** Chunk culling, LOD full/box, Low/Med/High/Ultra + Low-FX.
  `Deps: T-501` · `Accept: 10k bangunan <200 draws, 30fps+ Med.` · `Evidence: F3 + draw HUD.` · `Skills: three-best-practices, city-builder-performance-gate`
- [ ] **T-503 S — Post-FX.** AA + bloom subtle + vignette; toggleable.
  `Deps: T-502` · `Accept: on/off <8% delta fps Med.` · `Evidence: fps compare.` · `Skills: three-best-practices`
- [ ] **T-504 M — Audio engine.** Ambient WebAudio (angin/traffic skala pop) + stinger + mute/volume persisten.
  `Deps: VS-4 GATE` · `Accept: mute persisten; no autoplay pre-gesture.` · `Evidence: settings screenshot.` · `Skills: webapp-testing`
- [ ] **T-505 M — 256² + perf pass.** Default 256², object pool, HUD throttle 4Hz, gate `perf` di CI.
  `Deps: T-502` · `Accept: NFR-01/03 pada mesin referensi.` · `Evidence: perf log.` · `Skills: performance-optimization, city-builder-performance-gate`
- [ ] **VS-5 GATE:** UJ-08 + NFR-01 lolos.

## VS-6 — Crisis & Depth (T-6xx)

- [ ] **T-601 M — Services.** Fire/police/school/clinic/park coverage jarak-jalan + upkeep; overlay radius.
  `Deps: VS-5 GATE` · `Accept: sekolah naikkan happiness sekitar.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-602 M — Pollution/crime/health/happiness.** Field + difusi + overlay + efek growth.
  `Deps: T-601` · `Accept: industri polusi → R sekitar abandon bila tinggi.` · `Evidence: overlay + test.` · `Skills: city-builder-simulation-audit`
- [ ] **T-603 M — Disaster.** Fire spread + earthquake + meteor + toggle random + loop rubble/bulldoze.
  `Deps: VS-5 GATE` · `Accept: meteor → rubble → rebuild → recovery (UJ-06).` · `Evidence: screenshots.` · `Skills: city-builder-playability-test`
- [ ] **T-604 M — Tutorial + advisor.** Checklist 5 langkah + 3 tips bergilir + click-to-locate.
  `Deps: VS-5 GATE` · `Accept: pemain baru 1k pop <15 mnt (skrip manual).` · `Evidence: checklist screenshot.` · `Skills: city-builder-playability-test`
- [ ] **T-605 S — Minimap + notifikasi.** Canvas 128px + queue info/warn/critical + settings.
  `Deps: T-604` · `Accept: klik alert → kamera lompat.` · `Evidence: screenshot.` · `Skills: frontend-ui-engineering`
- [ ] **T-606 S — Aksesibilitas + docs.** Path keyboard-only, overlay aman colorblind (ikon+pola), keybind list, FAQ.
  `Deps: T-605` · `Accept: checklist NFR-05 signed.` · `Evidence: checklist.` · `Skills: frontend-ui-engineering`
- [ ] **VS-6 GATE:** UJ-05 + UJ-06 lolos; MVP COMPLETE (UJ-01..07 gabungan VS-2..VS-5).

## VS-7 — Hardening & Ship (T-7xx)

- [ ] **T-701 M — E2E penuh.** Skrip UJ-01..08 terekam; `npm run e2e` hijau.
  `Deps: VS-6 GATE` · `Accept: semua UJ lolos.` · `Evidence: CI log.` · `Skills: webapp-testing, city-builder-playability-test`
- [ ] **T-702 M — Save migration + korpus.** Bump versi + migrasi + korpus lintas versi hijau.
  `Deps: T-701` · `Accept: save lama termuat; korup → recovery.` · `Evidence: test log.` · `Skills: tdd`
- [ ] **T-703 S — Bundle + perf gate.** Initial <5MB; gate F3/`perf` di CI.
  `Deps: T-701` · `Accept: NFR-01/02/03 pada referensi.` · `Evidence: perf log.` · `Skills: city-builder-performance-gate`
- [ ] **T-704 S — Ship gate.** Release notes + tag; checklist NFR-01..07.
  `Deps: T-701,T-702,T-703` · `Accept: semua NFR + UJ-01..08.` · `Evidence: CI log + tag.` · `Skills: code-review-and-quality`
- [ ] **VS-7 GATE:** SHIPPED v1.0.

## VS-8 — Large City & Depth Lanjutan (T-8xx, pasca-v1)

- [ ] **T-801 M — Transit (bus).** Line + stop + mode split.
- [ ] **T-802 M — Hierarki jalan.** Avenue/highway/one-way di belakang flag.
- [ ] **T-803 M — Cuaca/musim/flood.** Sistem + overlay + efek growth.
- [ ] **T-804 M — Skenario + achievement.** Engine skenario + E2E skenario.
- [ ] **T-805 M — Mod pack JSON.** Registry bangunan + validasi + contoh pack.
- [ ] **VS-8 GATE:** expansion playable; save v1 aman (bump + migrasi bila perlu).

## VS-9 — Production Readiness (T-9xx)

- [ ] **T-901 M — PWA offline.** Service worker + cache versioned + update prompt.
- [ ] **T-902 M — A11y penuh.** Keyboard-only path + checklist NFR-05 signed.
- [ ] **T-903 S — Crash recovery UX.** Tawaran recovery + tidak pernah hard-crash.
- [ ] **T-904 S — Observability.** Telemetri perf opt-in + dashboard rilis.
- [ ] **VS-9 GATE:** production checklist hijau.

## Migrasi ID lama → baru

| Lama (arsip) | Baru | Catatan |
|---|---|---|
| T-001..T-005 (M1) | T-101..T-103 + T-104..T-105 | Dipecah per VS-0/VS-1; semua `[x]` |
| T-006..T-010 (M2) | T-106..T-109 | Semua `[x]` |
| T-011..T-015 (M3) | T-202..T-208 subset + T-301..T-306 | **Belum dikerjakan** — tetap `[ ]` |
| T-016..T-021 (M4) | T-401..T-407 | `[ ]` |
| T-022..T-025 (M5) | T-303 + T-407 + T-110 + T-702 | T-110 `[x]` (save v1 dasar); sisanya `[ ]` |
| T-026..T-030 (M6) | T-501..T-505 | `[ ]` |
| T-031..T-037 (M7) | T-601..T-606 + T-701..T-704 | `[ ]` |
| T-101..T-106 stretch (lama) | T-801..T-805 | dinomori ulang cegah tabrakan |
